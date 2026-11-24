/* =========================================================
 * Navegação da Mesa — encontros de 1d100.
 * Tabela nativa (RollTable, fórmula 1d100). A cada dia de viagem o mestre recebe no chat um pedido de rolagem;
 * o jogador condutor clica, rola 1d100 nativo (aparece no chat, com Dice So Nice se houver) e o mestre ativo
 * lê o resultado na tabela e mostra o encontro. 1–5 é o pior extremo; 96–100, o melhor.
 * ========================================================= */

import { tipoPorValor, TIPOS } from "./calculos.js";
import { cfg, esc, MOD, nomeDoUsuario, podeRolar, souMestreAtivo, t } from "./config.js";

/** Tabela padrão: [de, até, tipo, chave do texto]. */
export const PADRAO = [
  [1, 2, "pessimo", "Emboscada"],
  [3, 5, "pessimo", "Fera"],
  [6, 12, "ruim", "Saqueadores"],
  [13, 19, "ruim", "Desmoronamento"],
  [20, 25, "ruim", "Tempestade"],
  [26, 38, "neutro", "Viajantes"],
  [39, 52, "neutro", "Tranquilo"],
  [53, 64, "neutro", "Ruinas"],
  [65, 75, "neutro", "Rastros"],
  [76, 84, "bom", "Caravana"],
  [85, 91, "bom", "Atalho"],
  [92, 95, "bom", "Fonte"],
  [96, 98, "otimo", "Patrulha"],
  [99, 100, "otimo", "Tesouro"]
];

const ICONES = { pessimo: "fa-skull", ruim: "fa-triangle-exclamation", neutro: "fa-road", bom: "fa-sun", otimo: "fa-star" };

/** Tabela de encontros em uso. Cria a padrão uma vez (mestre ativo). */
export async function garantirTabela() {
  const atual = game.tables.get(cfg("tabela"));
  if (atual) return atual;
  const marcada = game.tables.find((tb) => tb.getFlag(MOD, "padrao"));
  if (marcada) {
    if (game.user.isGM) await game.settings.set(MOD, "tabela", marcada.id);
    return marcada;
  }
  if (!game.user.isGM || cfg("tabelaCriada")) return null;
  return criarTabelaPadrao();
}

export async function criarTabelaPadrao() {
  if (!game.user.isGM) return null;
  const tipoTexto = CONST.TABLE_RESULT_TYPES?.TEXT ?? "text";
  const tabela = await RollTable.create({
    name: t("Tabela.Nome"),
    description: t("Tabela.Descricao"),
    img: "icons/svg/d20-grey.svg",
    formula: "1d100",
    replacement: true,
    displayRoll: true,
    flags: { [MOD]: { padrao: true } },
    results: PADRAO.map(([de, ate, tipo, chave]) => ({
      type: tipoTexto,
      name: t(`Tabela.${chave}.Nome`),
      description: `<p>${t(`Tabela.${chave}.Texto`)}</p>`,
      range: [de, ate],
      weight: ate - de + 1,
      img: "icons/svg/d20-black.svg",
      flags: { [MOD]: { tipo } }
    }))
  });
  await game.settings.set(MOD, "tabela", tabela.id);
  await game.settings.set(MOD, "tabelaCriada", true);
  return tabela;
}

/* ---------------- pedido de rolagem (cartão no chat) ---------------- */

/** Mestre: põe no chat o pedido de 1d100 (n rolagens, uma por dia de viagem). */
export async function pedirRolagem({ quantidade = 1, destino = "", dia = null } = {}) {
  if (!game.user.isGM) return null;
  const n = Math.max(1, Math.min(30, Math.trunc(Number(quantidade) || 1)));
  return ChatMessage.create({
    speaker: { alias: t("Nome") },
    content: `<div class="nvm-pedido"><p><i class="fa-solid fa-compass"></i> ${t("Pedido.Titulo")}</p></div>`,
    flags: { [MOD]: { pedido: { total: n, pendentes: n, destino, dia, rolagens: [] } } }
  });
}

/** Monta o cartão do pedido a cada desenho da mensagem (o estado fica nas flags). */
export function desenharPedido(msg, html) {
  const p = msg.getFlag(MOD, "pedido");
  const raiz = html instanceof HTMLElement ? html : html?.[0];
  const caixa = raiz?.querySelector(".nvm-pedido");
  if (!p || !caixa) return;
  const condutores = cfg("condutores") ?? [];
  const quem = condutores.length ? condutores.map((id) => esc(nomeDoUsuario(id))).join(", ") : t("Pedido.Qualquer");
  const titulo = p.dia ? t("Pedido.TituloDia", { dia: p.dia }) : p.total > 1 ? t("Pedido.TituloDias", { n: p.total }) : t("Pedido.Titulo");
  const linhas = (p.rolagens ?? []).map((r) => `<li class="nvm-tipo-${esc(r.tipo ?? "oculto")}"><b>${r.valor}</b> ${r.nome ? `· ${esc(r.nome)}` : ""} <small>${esc(nomeDoUsuario(r.userId))}</small></li>`).join("");
  const botao = p.pendentes > 0
    ? (podeRolar() ? `<button type="button" data-nvm-rolar><i class="fa-solid fa-dice-d20"></i> ${p.total > 1 ? t("Pedido.RolarFaltam", { n: p.pendentes }) : t("Pedido.Rolar")}</button>`
      : `<p class="nvm-espera"><i class="fa-solid fa-hourglass-half"></i> ${t("Pedido.Aguardando", { quem })}</p>`)
    : `<p class="nvm-feito"><i class="fa-solid fa-check"></i> ${t("Pedido.Feito")}</p>`;
  caixa.innerHTML = `<header><i class="fa-solid fa-compass"></i> <b>${titulo}</b>${p.destino ? `<small>${t("Pedido.Rumo", { destino: esc(p.destino) })}</small>` : ""}</header>
    <p class="nvm-quem">${t("Pedido.Quem", { quem })}</p>
    ${linhas ? `<ol class="nvm-rolagens">${linhas}</ol>` : ""}
    ${botao}`;
  caixa.querySelector("[data-nvm-rolar]")?.addEventListener("click", async (ev) => {
    ev.preventDefault();
    const b = ev.currentTarget;
    b.disabled = true;
    try { await rolar(msg); } finally { setTimeout(() => { b.disabled = false; }, 1500); }
  });
}

/** Jogador condutor (ou mestre): rola 1d100 nativo ligado ao pedido. */
async function rolar(pedidoMsg) {
  if (!podeRolar()) return ui.notifications.warn(t("Pedido.NaoCondutor"));
  if (!game.users.activeGM) return ui.notifications.warn(t("Pedido.SemMestre"));
  const roll = await new Roll("1d100").evaluate();
  await roll.toMessage({
    speaker: ChatMessage.getSpeaker(),
    flavor: `<i class="fa-solid fa-compass"></i> ${t("Pedido.Flavor")}`,
    flags: { [MOD]: { rolagem: { pedido: pedidoMsg.id } } }
  });
}

/* ---------------- resultado (mestre ativo) ---------------- */

let fila = Promise.resolve();
/** Mestre ativo: cada rolagem de condutor vira um resultado, uma de cada vez. */
export function aoCriarMensagem(msg) {
  const ref = msg.getFlag(MOD, "rolagem");
  if (!ref || !souMestreAtivo()) return;
  fila = fila.then(() => resolver(msg, ref)).catch((err) => console.error(`${MOD} | encontro`, err));
}

/** Tipo do resultado: o que a tabela diz (flag) ou pela faixa do número. */
function tipoDoResultado(res, valor) {
  const f = res?.getFlag?.(MOD, "tipo");
  return TIPOS.includes(f) ? f : tipoPorValor(valor);
}

async function resolver(msg, ref) {
  const pedido = game.messages.get(ref.pedido);
  const p = pedido?.getFlag(MOD, "pedido");
  if (!p || p.pendentes <= 0) return;
  const valor = msg.rolls?.[0]?.total;
  if (!Number.isFinite(valor)) return;
  const tabela = await garantirTabela();
  const res = tabela?.getResultsForRoll(valor)?.[0] ?? null;
  const tipo = tipoDoResultado(res, valor);
  const nome = res?.name || res?.text || t("Resultado.SemTabela");
  const TE = foundry.applications.ux.TextEditor.implementation;
  const descricao = res?.description ? await TE.enrichHTML(res.description, { secrets: false }) : "";
  const link = res?.documentUuid ? await TE.enrichHTML(`@UUID[${res.documentUuid}]`) : "";
  const secreto = cfg("resultadoVisivel") === "mestre";
  const extremo = tipo === "pessimo" || tipo === "otimo";
  await ChatMessage.create({
    speaker: { alias: t("Nome") },
    whisper: secreto ? ChatMessage.getWhisperRecipients("GM").map((u) => u.id) : [],
    content: `<div class="nvm-resultado nvm-tipo-${tipo}${extremo ? " nvm-extremo" : ""}">
      <header><i class="fa-solid ${ICONES[tipo]}"></i> <span>${t(`Tipo.${tipo}`)}</span><b class="nvm-valor">${valor}</b></header>
      <h3>${esc(nome)}</h3>
      ${descricao ? `<div class="nvm-desc">${descricao}</div>` : ""}
      ${link ? `<p>${link}</p>` : ""}
      <footer>${t("Resultado.Rolou", { quem: esc(nomeDoUsuario(msg.author?.id)) })}${p.destino ? ` · ${esc(p.destino)}` : ""}${tabela ? ` · ${esc(tabela.name)}` : ""}</footer>
    </div>`,
    flags: { [MOD]: { resultado: { valor, tipo, pedido: pedido.id } } }
  });
  const rolagens = [...(p.rolagens ?? []), secreto ? { valor, userId: msg.author?.id } : { valor, nome, tipo, userId: msg.author?.id }];
  await pedido.update({ [`flags.${MOD}.pedido`]: { ...p, pendentes: p.pendentes - 1, rolagens } });
}

/* ---------------- viagem do calendário ---------------- */

/** Hooks do Calendário da Mesa (4.12.0+): pede as rolagens a cada dia de viagem. Rodam só no cliente do mestre que viaja. */
export function ligarViagemDoCalendario() {
  Hooks.on("calendarioMesa.viagemIniciada", (info) => {
    if (!game.user.isGM || !cfg("pedirRolagem")) return;
    if (info?.separado) pedirRolagem({ quantidade: 1, destino: info.destino, dia: 1 });
    else pedirRolagem({ quantidade: info?.dias ?? 1, destino: info?.destino });
  });
  Hooks.on("calendarioMesa.viagemNovoDia", (info) => {
    if (!game.user.isGM || !cfg("pedirRolagem")) return;
    pedirRolagem({ quantidade: 1, destino: info?.destino, dia: info?.dia });
  });
}
