/* =========================================================
 * Navegação da Mesa — obstáculos do caminho (terreno e tempo).
 * A cada dia de viagem o mestre ativo rola 1d100 (Roll nativo) contra a chance do dia: base do terreno da rota
 * + o clima do Calendário da Mesa. Se cair, sorteia numa Tabela nativa do terreno ou do clima e mostra no chat,
 * com o atraso sugerido e um botão do mestre para avançar o relógio.
 * ========================================================= */

import { chanceDoDia, climaObstaculo, fonteDoObstaculo, TERRENOS } from "./calculos.js";
import { CAL, cfg, esc, MOD, t } from "./config.js";

/** Tabelas de fábrica: chave → [[nome/texto (chave i18n), atraso em horas], ...] (1d4, um resultado por número). */
export const OBSTACULOS = {
  "terreno.estrada": [["Buraco", 1], ["Ponte", 3], ["Pedagio", 1], ["Carroca", 2]],
  "terreno.planicie": [["Riacho", 2], ["Capim", 2], ["Manada", 1], ["Erosao", 2]],
  "terreno.floresta": [["Arvore", 2], ["Mata", 4], ["Trilha", 3], ["Espinhos", 2]],
  "terreno.montanha": [["Deslizamento", 6], ["Desfiladeiro", 4], ["Ar", 3], ["Passagem", 8]],
  "terreno.pantano": [["Lamacal", 4], ["Areia", 3], ["Insetos", 2], ["Inundado", 6]],
  "terreno.deserto": [["Dunas", 4], ["Oasis", 3], ["Miragem", 2], ["Rochas", 3]],
  "terreno.gelo": [["Fenda", 4], ["LagoGelo", 3], ["Avalanche", 8], ["Branco", 4]],
  "clima.chuva": [["Lama", 3], ["Cheia", 6], ["Raio", 2], ["Abrigo", 2]],
  "clima.neve": [["Montes", 4], ["Congelado", 3], ["Hipotermia", 2], ["Soterrado", 6]],
  "clima.nevoa": [["Perdidos", 4], ["Separados", 2], ["Marcos", 3], ["Barulho", 1]],
  "clima.vento": [["Tenda", 2], ["Galhos", 2], ["Poeira", 3], ["Montaria", 2]],
  "clima.calor": [["Agua", 3], ["Insolacao", 2], ["Animais", 3], ["Noite", 6]]
};

const ICONES = { terreno: "fa-mountain-sun", clima: "fa-cloud-bolt" };
const tabelaDe = (chave) => game.tables.find((tb) => tb.getFlag(MOD, "obstaculo") === chave) ?? null;

/** Cria as tabelas de obstáculos uma vez, numa pasta nativa (mestre ativo). */
export async function garantirTabelasDeObstaculos() {
  if (!game.user.isGM || cfg("obstaculosCriados")) return;
  const faltam = Object.keys(OBSTACULOS).filter((k) => !tabelaDe(k));
  if (faltam.length) {
    const pasta = await Folder.create({ name: t("Obstaculo.Pasta"), type: "RollTable", color: "#6b4f2a" });
    const tipoTexto = CONST.TABLE_RESULT_TYPES?.TEXT ?? "text";
    await RollTable.createDocuments(faltam.map((chave) => {
      const [grupo, id] = chave.split(".");
      const lista = OBSTACULOS[chave];
      return {
        name: `${t("Obstaculo.Prefixo")}: ${t(`${grupo === "terreno" ? "Terreno" : "Clima"}.${id}`)}`,
        description: `<p>${t("Obstaculo.DescricaoTabela")}</p>`,
        img: "icons/svg/hazard.svg",
        folder: pasta.id,
        formula: `1d${lista.length}`,
        replacement: true,
        displayRoll: false,
        flags: { [MOD]: { obstaculo: chave } },
        results: lista.map(([k, atraso], i) => ({
          type: tipoTexto,
          name: t(`Obstaculo.${k}.Nome`),
          description: `<p>${t(`Obstaculo.${k}.Texto`)}</p>`,
          range: [i + 1, i + 1],
          weight: 1,
          img: "icons/svg/hazard.svg",
          flags: { [MOD]: { atraso } }
        }))
      };
    }));
  }
  await game.settings.set(MOD, "obstaculosCriados", true);
}

/** Clima de hoje pelo Calendário da Mesa (na região da cena atual): { tipo, nome, grupo, forte } ou null. */
function climaDeHoje() {
  try {
    const c = game.modules.get(CAL)?.api?.clima?.();
    const o = c ? climaObstaculo(c.tipo) : null;
    return o ? { ...o, tipo: c.tipo, nome: c.nome } : null;
  } catch { return null; }
}

/** Segundos de uma hora no calendário em uso. */
function segHora() {
  const c = game.modules.get(CAL)?.api?.config?.();
  return (c?.minutosHora ?? 60) * (c?.segundosMinuto ?? 60);
}

/** Mestre: testa o obstáculo de um dia de viagem e mostra o resultado no chat. */
export async function testarObstaculo({ terreno = null, destino = "", dia = null } = {}) {
  if (!game.user.isGM) return null;
  const terr = TERRENOS[terreno] != null ? terreno : (TERRENOS[cfg("terrenoPadrao")] != null ? cfg("terrenoPadrao") : "planicie");
  const clima = climaDeHoje();
  const chance = chanceDoDia(terr, clima);
  const roll = await new Roll("1d100").evaluate();
  const fonte = fonteDoObstaculo(roll.total, chance);
  const gm = ChatMessage.getWhisperRecipients("GM").map((u) => u.id);
  const resumo = t("Obstaculo.Resumo", { valor: roll.total, chance: chance.chance, terreno: t(`Terreno.${terr}`), clima: clima ? esc(clima.nome ?? t(`Clima.${clima.grupo}`)) : t("Obstaculo.TempoBom") });
  if (!fonte) {
    await ChatMessage.create({ speaker: { alias: t("Nome") }, whisper: gm, content: `<div class="nvm-livre"><i class="fa-solid fa-road-circle-check"></i> <b>${dia ? t("Obstaculo.LivreDia", { dia }) : t("Obstaculo.Livre")}</b><br><small>${resumo}</small></div>` });
    return null;
  }
  const chave = fonte === "clima" ? `clima.${clima.grupo}` : `terreno.${terr}`;
  const tabela = tabelaDe(chave);
  let res = null;
  if (tabela) {
    const sorteio = await tabela.draw({ displayChat: false });
    res = sorteio?.results?.[0] ?? null;
  }
  const atraso = Number(res?.getFlag?.(MOD, "atraso")) || 0;
  const TE = foundry.applications.ux.TextEditor.implementation;
  const descricao = res?.description ? await TE.enrichHTML(res.description, { secrets: false }) : "";
  const origem = fonte === "clima" ? (clima.nome ?? t(`Clima.${clima.grupo}`)) : t(`Terreno.${terr}`);
  return ChatMessage.create({
    speaker: { alias: t("Nome") },
    whisper: cfg("resultadoVisivel") === "mestre" ? gm : [],
    content: `<div class="nvm-obstaculo nvm-fonte-${fonte}">
      <header><i class="fa-solid ${ICONES[fonte]}"></i> <span>${t(fonte === "clima" ? "Obstaculo.PeloTempo" : "Obstaculo.PeloTerreno")} · ${esc(origem)}</span></header>
      <h3>${esc(res?.name || t("Obstaculo.SemTabela"))}</h3>
      ${descricao ? `<div class="nvm-desc">${descricao}</div>` : ""}
      ${atraso ? `<p class="nvm-atraso"><i class="fa-solid fa-hourglass-half"></i> ${t("Obstaculo.Atraso", { h: atraso })}</p>` : ""}
      <div class="nvm-obstaculo-acoes"></div>
      <footer>${dia ? `${t("Obstaculo.Dia", { dia })} · ` : ""}${destino ? `${esc(destino)} · ` : ""}${resumo}</footer>
    </div>`,
    flags: { [MOD]: { obstaculo: { chave, atraso, aplicado: false } } }
  });
}

/** Botão do mestre "Aplicar atraso" no cartão do obstáculo. */
export function desenharObstaculo(msg, html) {
  const o = msg.getFlag(MOD, "obstaculo");
  const raiz = html instanceof HTMLElement ? html : html?.[0];
  const caixa = raiz?.querySelector(".nvm-obstaculo-acoes");
  if (!o || !caixa) return;
  if (!o.atraso || !game.user.isGM) { caixa.innerHTML = ""; return; }
  if (o.aplicado) { caixa.innerHTML = `<p class="nvm-feito"><i class="fa-solid fa-check"></i> ${t("Obstaculo.Aplicado", { h: o.atraso })}</p>`; return; }
  caixa.innerHTML = `<button type="button" data-nvm-atraso><i class="fa-solid fa-forward"></i> ${t("Obstaculo.Aplicar", { h: o.atraso })}</button>`;
  caixa.querySelector("[data-nvm-atraso]").addEventListener("click", async (ev) => {
    ev.preventDefault();
    ev.currentTarget.disabled = true;
    const api = game.modules.get(CAL)?.api;
    if (api?.avancar) await api.avancar(o.atraso * segHora());
    else await game.time.advance(o.atraso * 3600);
    await msg.update({ [`flags.${MOD}.obstaculo.aplicado`]: true });
  });
}

/** Contexto da viagem que saiu de uma rota (terreno), gravado no "Viajar por esta rota". */
const contexto = () => cfg("viagemContexto") ?? {};

/** Hooks do Calendário da Mesa: um teste de obstáculo por dia de viagem. */
export function ligarObstaculosNaViagem() {
  const testarDias = async (n, info, primeiroDia) => {
    if (!game.user.isGM || !cfg("obstaculos")) return;
    const ctx = info?.origem === MOD ? contexto() : {};
    for (let i = 0; i < n; i++) await testarObstaculo({ terreno: ctx.terreno, destino: info?.destino, dia: primeiroDia + i });
  };
  Hooks.on("calendarioMesa.viagemIniciada", (info) => testarDias(info?.separado ? 1 : Math.max(1, Math.min(30, info?.dias ?? 1)), info, 1));
  Hooks.on("calendarioMesa.viagemNovoDia", (info) => testarDias(1, info, info?.dia ?? 1));
}

