/* =========================================================
 * Navegação da Mesa — rotas no mapa.
 * Uma rota é um Desenho nativo (linha de polígono aberta) com flags["navegacao-mesa"].rota.
 * O mestre mede com a régua, salva a medição como rota e, pelo HUD do desenho, parte em viagem
 * pelo Calendário da Mesa com a distância já convertida em km.
 * ========================================================= */

import { desenhoDosPontos, paraKm, pontosDoDesenho, TERRENOS } from "./calculos.js";
import { CAL, cfg, esc, MOD, nomeDoUsuario, numero, souMestreAtivo, t } from "./config.js";
import { escalaDaCena, unidadeDaCena } from "./escala.js";
import { garantirTabela } from "./encontros.js";
import { ultimaMedicao } from "./regua.js";

const { DialogV2 } = foundry.applications.api;
const ehRota = (doc) => !!doc?.getFlag?.(MOD, "rota");
/** <select> do terreno predominante da rota. */
const seletorTerreno = (atual) => `<div class="form-group"><label>${t("Rota.Terreno")}</label><select name="terreno">${Object.keys(TERRENOS)
  .map((k) => `<option value="${k}" ${k === (atual || cfg("terrenoPadrao")) ? "selected" : ""}>${t(`Terreno.${k}`)}</option>`).join("")}</select></div>
  <p class="hint">${t("Rota.TerrenoDica")}</p>`;
const ehLinha = (doc) => ["p", "f"].includes(doc?.shape?.type) && (doc.shape.points?.length ?? 0) >= 4;

/** Distância da rota na unidade da cena (m, ft…), pela medição nativa da grade. */
export function distanciaDoDesenho(doc) {
  const pontos = pontosDoDesenho(doc);
  if (pontos.length < 2) return 0;
  const grade = doc.parent?.grid ?? canvas.grid;
  return grade.measurePath(pontos).distance ?? 0;
}

/** Texto que aparece no desenho: "Porto Alto · 120 km" (ou na unidade da cena, se não houver escala). */
export function rotuloDaRota(doc, { destino, escala } = {}) {
  const nome = destino ?? doc.getFlag(MOD, "rota")?.destino ?? "";
  const dist = distanciaDoDesenho(doc);
  const km = paraKm(dist, escala ?? escalaDaCena(doc.parent));
  const medida = km ? `${numero(km)} km` : `${numero(dist)} ${unidadeDaCena(doc.parent)}`;
  return nome ? `${nome} · ${medida}` : medida;
}

/** Diálogo curto: nome do destino, escala e se os jogadores veem a rota. */
async function perguntarRota(scene, padrao = {}) {
  const unidade = esc(unidadeDaCena(scene) || t("Escala.Unidade"));
  return DialogV2.wait({
    window: { title: "NAVMESA.Rota.Titulo", icon: "fa-solid fa-route" },
    position: { width: 420 },
    content: `<div class="nvm-form">
      <div class="form-group"><label>${t("Rota.Destino")}</label><input type="text" name="destino" value="${esc(padrao.destino ?? "")}" placeholder="${t("Rota.DestinoExemplo")}" autofocus></div>
      <div class="form-group"><label>${t("Escala.Rotulo")}</label><div class="form-fields"><span>1 ${unidade} =</span>
        <input type="number" name="escala" min="0" step="any" value="${escalaDaCena(scene) || ""}"><span>km</span></div></div>
      <p class="hint">${t("Escala.DicaCurta")}</p>
      ${seletorTerreno(padrao.terreno)}
      <label class="nvm-chip"><input type="checkbox" name="visivel" ${padrao.oculta ? "" : "checked"}> ${t("Rota.Visivel")}</label>
    </div>`,
    buttons: [
      { action: "ok", label: "NAVMESA.Rota.Salvar", icon: "fa-solid fa-floppy-disk", default: true, callback: (ev, btn) => new foundry.applications.ux.FormDataExtended(btn.form).object },
      { action: "cancelar", label: "Cancel" }
    ],
    rejectClose: false
  });
}

async function gravarEscala(scene, valor) {
  const e = Number(valor);
  if (!(e > 0) || e === Number(scene.getFlag(MOD, "escala"))) return;
  await scene.setFlag(MOD, "escala", e);
}

/** Salva a última medição da régua deste usuário como rota (Desenho nativo) na cena atual. */
export async function salvarUltimaMedicao() {
  if (!game.user.isGM) return;
  const m = ultimaMedicao();
  const scene = canvas.scene;
  if (!m || !scene || m.sceneId !== scene.id) return ui.notifications.warn(t("Rota.SemMedicao"));
  const r = await perguntarRota(scene);
  if (!r || typeof r !== "object") return;
  await gravarEscala(scene, r.escala);
  const destino = String(r.destino ?? "").trim();
  const dados = {
    ...desenhoDosPontos(m.pontos),
    fillType: CONST.DRAWING_FILL_TYPES.NONE,
    strokeWidth: 6,
    strokeColor: cfg("corRota"),
    strokeAlpha: 0.9,
    fontSize: 28,
    textColor: "#ffffff",
    hidden: !r.visivel,
    flags: { [MOD]: { rota: { destino, terreno: TERRENOS[r.terreno] != null ? r.terreno : cfg("terrenoPadrao") } } }
  };
  const [doc] = await scene.createEmbeddedDocuments("Drawing", [dados]);
  if (doc) await doc.update({ text: rotuloDaRota(doc, { destino }) });
  ui.notifications.info(t("Rota.Salva", { nome: destino || t("Rota.SemNome") }));
  return doc;
}

/** Diálogo "Viajar por esta rota": destino, escala, condutores e tabela; depois abre a viagem do calendário. */
export async function viajarPelaRota(doc) {
  if (!game.user.isGM || !doc) return;
  const scene = doc.parent;
  const dist = distanciaDoDesenho(doc);
  if (!(dist > 0)) return ui.notifications.warn(t("Rota.SemDistancia"));
  const rota = doc.getFlag(MOD, "rota") ?? {};
  const tabelaPadrao = await garantirTabela();
  const condutores = new Set(cfg("condutores") ?? []);
  const jogadores = game.users.filter((u) => !u.isGM);
  const unidade = esc(unidadeDaCena(scene) || t("Escala.Unidade"));
  const kmDe = (escala) => paraKm(dist, escala);

  const r = await DialogV2.wait({
    window: { title: "NAVMESA.Viajar.Titulo", icon: "fa-solid fa-person-hiking" },
    position: { width: 480 },
    content: `<div class="nvm-form">
      <div class="form-group"><label>${t("Rota.Destino")}</label><input type="text" name="destino" value="${esc(rota.destino ?? "")}" placeholder="${t("Rota.DestinoExemplo")}"></div>
      <div class="form-group"><label>${t("Viajar.NoMapa")}</label><div class="form-fields"><b>${numero(dist)} ${unidade}</b></div></div>
      <div class="form-group"><label>${t("Escala.Rotulo")}</label><div class="form-fields"><span>1 ${unidade} =</span>
        <input type="number" name="escala" min="0" step="any" value="${escalaDaCena(scene) || ""}"><span>km</span></div></div>
      <p class="nvm-total"><i class="fa-solid fa-route"></i> <span data-nvm-total></span></p>
      ${seletorTerreno(rota.terreno)}
      <fieldset><legend><i class="fa-solid fa-compass"></i> ${t("Viajar.Condutores")}</legend>
        <p class="hint">${t("Viajar.CondutoresDica")}</p>
        <div class="nvm-chips">${jogadores.map((u) => `<label class="nvm-chip"><input type="checkbox" name="c-${u.id}" ${condutores.has(u.id) ? "checked" : ""}> ${esc(nomeDoUsuario(u.id))}</label>`).join("") || `<i>${t("Viajar.SemJogadores")}</i>`}</div>
      </fieldset>
      <div class="form-group"><label>${t("Viajar.Tabela")}</label>
        <select name="tabela">${game.tables.contents.map((tb) => `<option value="${tb.id}" ${tb.id === tabelaPadrao?.id ? "selected" : ""}>${esc(tb.name)}</option>`).join("")}</select></div>
      <label class="nvm-chip"><input type="checkbox" name="separado" checked> ${t("Viajar.DiaADia")}</label>
      <p class="hint">${t("Viajar.Dica")}</p>
    </div>`,
    render: (ev, dialog) => {
      const el = dialog.element;
      const campo = el.querySelector('input[name="escala"]');
      const alvo = el.querySelector("[data-nvm-total]");
      const atualizar = () => {
        const km = kmDe(campo.value);
        alvo.textContent = km ? t("Viajar.Total", { km: numero(km) }) : t("Viajar.SemEscala");
      };
      campo?.addEventListener("input", atualizar);
      if (campo && alvo) atualizar();
    },
    buttons: [
      { action: "ok", label: "NAVMESA.Viajar.Continuar", icon: "fa-solid fa-person-hiking", default: true, callback: (ev, btn) => new foundry.applications.ux.FormDataExtended(btn.form).object },
      { action: "cancelar", label: "Cancel" }
    ],
    rejectClose: false
  });
  if (!r || typeof r !== "object") return;
  const km = kmDe(r.escala);
  if (!km) return ui.notifications.warn(t("Viajar.SemEscala"));
  const destino = String(r.destino ?? "").trim();
  await gravarEscala(scene, r.escala);
  await game.settings.set(MOD, "condutores", jogadores.filter((u) => r[`c-${u.id}`]).map((u) => u.id));
  if (r.tabela) await game.settings.set(MOD, "tabela", r.tabela);
  const terreno = TERRENOS[r.terreno] != null ? r.terreno : cfg("terrenoPadrao");
  if (destino !== (rota.destino ?? "") || terreno !== rota.terreno || !ehRota(doc)) await doc.update({ [`flags.${MOD}.rota`]: { ...rota, destino, terreno } });
  // Os testes de obstáculo da viagem usam o terreno desta rota.
  await game.settings.set(MOD, "viagemContexto", { terreno, destino, rota: doc.uuid });
  await doc.update({ text: rotuloDaRota(doc, { destino, escala: Number(r.escala) }) });

  const api = game.modules.get(CAL)?.api;
  if (!api?.viajar) return ui.notifications.error(t("Viajar.SemCalendario"));
  const kmTexto = Math.round(km * 10) / 10;
  const calVersao = game.modules.get(CAL)?.version ?? "0";
  if (foundry.utils.isNewerVersion("4.12.0", calVersao)) ui.notifications.info(t("Viajar.CalendarioAntigo", { km: kmTexto }));
  // A chance de encontro do calendário fica 0: os encontros desta viagem são os 1d100 dos condutores.
  return api.viajar({ destino, dist: kmTexto, un: "km", ritmo: "normal", chance: 0, tabela: "", separado: !!r.separado, origem: MOD });
}

/** Botão no HUD nativo do desenho (só mestre, só em linhas). */
export function botaoNoHud(hud, html) {
  try {
    const doc = hud.document ?? hud.object?.document;
    if (!game.user.isGM || !ehLinha(doc)) return;
    const raiz = html instanceof HTMLElement ? html : html?.[0];
    const coluna = raiz?.querySelector(".col.right") ?? raiz?.querySelector(".col.left");
    if (!coluna || coluna.querySelector("[data-nvm-viajar]")) return;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "control-icon nvm-hud";
    b.dataset.nvmViajar = "1";
    b.dataset.tooltip = ehRota(doc) ? t("Viajar.PorEstaRota") : t("Viajar.UsarComoRota");
    b.innerHTML = '<i class="fa-solid fa-person-hiking"></i>';
    b.addEventListener("click", (ev) => { ev.preventDefault(); ev.stopPropagation(); viajarPelaRota(doc); });
    coluna.append(b);
  } catch (err) {
    console.warn(`${MOD} | HUD do desenho`, err);
  }
}

/** Mantém o texto da rota em dia quando o desenho é movido/editado ou a escala da cena muda (só o mestre ativo). */
export function ligarAtualizacaoDosRotulos() {
  Hooks.on("updateDrawing", (doc, mudancas) => {
    if (!souMestreAtivo() || !ehRota(doc)) return;
    if (!("shape" in mudancas || "rotation" in mudancas)) return;
    const texto = rotuloDaRota(doc);
    if (texto !== doc.text) doc.update({ text: texto });
  });
  Hooks.on("updateScene", (scene, mudancas) => {
    if (!souMestreAtivo()) return;
    const mudouEscala = foundry.utils.hasProperty(mudancas, `flags.${MOD}`) || foundry.utils.hasProperty(mudancas, `flags.-=${MOD}`) || "grid" in mudancas;
    if (!mudouEscala) return;
    const atualizacoes = scene.drawings.filter(ehRota).map((d) => ({ _id: d.id, text: rotuloDaRota(d) })).filter((u) => u.text !== scene.drawings.get(u._id).text);
    if (atualizacoes.length) scene.updateEmbeddedDocuments("Drawing", atualizacoes);
  });
}
