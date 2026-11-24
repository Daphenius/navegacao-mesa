/* =========================================================
 * Navegação da Mesa — identificador, tradução e configurações (game.settings nativo).
 * ========================================================= */

import { arredondar, TERRENOS } from "./calculos.js";

export const MOD = "navegacao-mesa";
export const CAL = "calendario-mesa";

/** Tradução: t("Rota.Salvar") ou t("Regua.Km", { km }). */
export const t = (chave, dados) => (dados ? game.i18n.format(`NAVMESA.${chave}`, dados) : game.i18n.localize(`NAVMESA.${chave}`));
export const cfg = (chave) => game.settings.get(MOD, chave);
export const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
export const numero = (n) => arredondar(n).toLocaleString(game.i18n.lang);

/** Só um mestre faz o trabalho de mestre (o mestre ativo do Foundry). */
export const souMestreAtivo = () => game.user.isGM && (game.users.activeGM?.isSelf ?? true);

export function registrarConfiguracoes() {
  const S = (chave, dados) => game.settings.register(MOD, chave, dados);
  S("escalaPadrao", {
    name: "NAVMESA.Config.EscalaPadrao.Nome", hint: "NAVMESA.Config.EscalaPadrao.Dica",
    scope: "world", config: true, type: Number, default: 0
  });
  S("kmPorDia", {
    name: "NAVMESA.Config.KmPorDia.Nome", hint: "NAVMESA.Config.KmPorDia.Dica",
    scope: "world", config: true, type: Number, default: 38.4
  });
  S("mostrarNaRegua", {
    name: "NAVMESA.Config.MostrarNaRegua.Nome", hint: "NAVMESA.Config.MostrarNaRegua.Dica",
    scope: "client", config: true, type: Boolean, default: true
  });
  S("corRota", {
    name: "NAVMESA.Config.CorRota.Nome", hint: "NAVMESA.Config.CorRota.Dica",
    scope: "world", config: true, type: new foundry.data.fields.ColorField({ nullable: false, initial: "#e8a33d" }), default: "#e8a33d"
  });
  S("pedirRolagem", {
    name: "NAVMESA.Config.PedirRolagem.Nome", hint: "NAVMESA.Config.PedirRolagem.Dica",
    scope: "world", config: true, type: Boolean, default: true
  });
  S("resultadoVisivel", {
    name: "NAVMESA.Config.ResultadoVisivel.Nome", hint: "NAVMESA.Config.ResultadoVisivel.Dica",
    scope: "world", config: true, type: String, default: "todos",
    choices: { todos: "NAVMESA.Config.ResultadoVisivel.Todos", mestre: "NAVMESA.Config.ResultadoVisivel.Mestre" }
  });
  S("obstaculos", {
    name: "NAVMESA.Config.Obstaculos.Nome", hint: "NAVMESA.Config.Obstaculos.Dica",
    scope: "world", config: true, type: Boolean, default: true
  });
  S("terrenoPadrao", {
    name: "NAVMESA.Config.TerrenoPadrao.Nome", hint: "NAVMESA.Config.TerrenoPadrao.Dica",
    scope: "world", config: true, type: String, default: "planicie",
    choices: Object.fromEntries(Object.keys(TERRENOS).map((k) => [k, `NAVMESA.Terreno.${k}`]))
  });
  // Internas: escolhidas no diálogo "Viajar por esta rota".
  S("obstaculosCriados", { scope: "world", config: false, type: Boolean, default: false });
  S("viagemContexto", { scope: "world", config: false, type: Object, default: {} });
  S("tabela", { scope: "world", config: false, type: String, default: "" });
  S("tabelaCriada", { scope: "world", config: false, type: Boolean, default: false });
  S("condutores", { scope: "world", config: false, type: Array, default: [] });
}

/** Jogadores que podem rolar o 1d100. Lista vazia = qualquer jogador. */
export function podeRolar(user = game.user) {
  if (user.isGM) return true;
  const lista = cfg("condutores") ?? [];
  return !lista.length || lista.includes(user.id);
}

/** Nome "Personagem (Jogador)". */
export function nomeDoUsuario(id) {
  const u = game.users.get(id);
  if (!u) return "?";
  return u.character ? `${u.character.name} (${u.name})` : u.name;
}
