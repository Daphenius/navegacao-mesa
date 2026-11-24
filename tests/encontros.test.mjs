/* Fluxo do encontro num Foundry simulado: pedido → rolagem do condutor → resultado do mestre. */
import { test } from "node:test";
import assert from "node:assert/strict";

const MOD = "navegacao-mesa";
const flagsDe = (dados) => ({
  ...dados,
  getFlag(mod, k) { return this.flags?.[mod]?.[k]; }
});
const criadas = [];
const settings = new Map([["condutores", []], ["tabela", "t1"], ["resultadoVisivel", "todos"], ["tabelaCriada", true], ["pedirRolagem", true]]);
const gm = { id: "gm", isGM: true, isSelf: true, name: "Mestre" };
const jogador = { id: "j1", isGM: false, name: "Ana", character: { name: "Lia" } };
const resultados = [[1, 5, "pessimo", "Emboscada"], [6, 95, "neutro", "Estrada"], [96, 100, "otimo", "Tesouro"]]
  .map(([de, ate, tipo, name]) => flagsDe({ range: [de, ate], name, description: `<p>${name}</p>`, flags: { [MOD]: { tipo } } }));
const tabela = flagsDe({ id: "t1", name: "Encontros", flags: {}, getResultsForRoll: (v) => resultados.filter((r) => v >= r.range[0] && v <= r.range[1]) });

globalThis.foundry = {
  applications: { api: {}, ux: { TextEditor: { implementation: { enrichHTML: async (s) => s } } } },
  utils: { escapeHTML: (s) => s }
};
globalThis.CONST = { TABLE_RESULT_TYPES: { TEXT: "text" } };
globalThis.ui = { notifications: { warn: () => {} } };
const mensagens = new Map();
globalThis.ChatMessage = {
  async create(d) {
    const m = flagsDe({ id: `m${mensagens.size + 1}`, ...d, async update(u) { for (const [k, v] of Object.entries(u)) foundry_set(this, k, v); } });
    mensagens.set(m.id, m); criadas.push(m); return m;
  },
  getWhisperRecipients: () => [gm]
};
function foundry_set(obj, caminho, valor) { const p = caminho.split("."); let o = obj; for (const k of p.slice(0, -1)) o = (o[k] ??= {}); o[p.at(-1)] = valor; }
globalThis.game = {
  user: gm,
  users: { activeGM: gm, get: (id) => ({ gm, j1: jogador })[id] },
  settings: { get: (m, k) => settings.get(k), set: async (m, k, v) => settings.set(k, v) },
  i18n: { localize: (k) => k, format: (k, d) => `${k} ${JSON.stringify(d)}`, lang: "pt-BR" },
  tables: { get: (id) => (id === "t1" ? tabela : undefined), find: () => undefined },
  messages: { get: (id) => mensagens.get(id) }
};

const { pedirRolagem, aoCriarMensagem } = await import("../scripts/encontros.js");
const esperar = () => new Promise((r) => setTimeout(r, 20));

test("rolagem de 3 vira desastre e baixa o pedido", async () => {
  const pedido = await pedirRolagem({ quantidade: 2, destino: "Porto Alto" });
  assert.equal(pedido.getFlag(MOD, "pedido").pendentes, 2);
  const rolagem = flagsDe({ author: jogador, rolls: [{ total: 3 }], flags: { [MOD]: { rolagem: { pedido: pedido.id } } } });
  aoCriarMensagem(rolagem);
  await esperar();
  const res = criadas.at(-1).getFlag(MOD, "resultado") ? criadas.at(-1) : criadas.at(-2);
  assert.equal(res.getFlag(MOD, "resultado").tipo, "pessimo");
  assert.match(res.content, /nvm-extremo/);
  assert.deepEqual(res.whisper, []);
  const p = pedido.getFlag(MOD, "pedido");
  assert.equal(p.pendentes, 1);
  assert.equal(p.rolagens[0].valor, 3);
});

test("só o mestre vê: resultado sussurrado e pedido sem o nome", async () => {
  settings.set("resultadoVisivel", "mestre");
  const pedido = await pedirRolagem({ quantidade: 1 });
  aoCriarMensagem(flagsDe({ author: jogador, rolls: [{ total: 99 }], flags: { [MOD]: { rolagem: { pedido: pedido.id } } } }));
  await esperar();
  const res = [...mensagens.values()].filter((m) => m.getFlag(MOD, "resultado")?.pedido === pedido.id)[0];
  assert.equal(res.getFlag(MOD, "resultado").tipo, "otimo");
  assert.deepEqual(res.whisper, ["gm"]);
  assert.equal(pedido.getFlag(MOD, "pedido").rolagens[0].nome, undefined);
  settings.set("resultadoVisivel", "todos");
});

test("rolagem a mais depois de feito é ignorada", async () => {
  const pedido = await pedirRolagem({ quantidade: 1 });
  const rolar = (v) => aoCriarMensagem(flagsDe({ author: jogador, rolls: [{ total: v }], flags: { [MOD]: { rolagem: { pedido: pedido.id } } } }));
  rolar(50); rolar(60);
  await esperar();
  const res = [...mensagens.values()].filter((m) => m.getFlag(MOD, "resultado")?.pedido === pedido.id);
  assert.equal(res.length, 1);
  assert.equal(pedido.getFlag(MOD, "pedido").pendentes, 0);
});
