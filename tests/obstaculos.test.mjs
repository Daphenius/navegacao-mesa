/* Obstáculo do dia num Foundry simulado: clima do calendário + terreno → tabela → cartão com atraso. */
import { test } from "node:test";
import assert from "node:assert/strict";

const MOD = "navegacao-mesa";
const comFlags = (d) => ({ ...d, getFlag(m, k) { return this.flags?.[m]?.[k]; } });
let proximo = 50, climaAtual = null;
const settings = new Map([["terrenoPadrao", "planicie"], ["resultadoVisivel", "todos"], ["obstaculos", true], ["viagemContexto", {}], ["obstaculosCriados", true]]);
const tabelas = ["terreno.montanha", "clima.chuva"].map((chave) => comFlags({
  name: chave, flags: { [MOD]: { obstaculo: chave } },
  draw: async () => ({ results: [comFlags({ name: `res ${chave}`, description: "<p>x</p>", flags: { [MOD]: { atraso: 6 } } })] })
}));
const criadas = [];
globalThis.foundry = { applications: { api: {}, ux: { TextEditor: { implementation: { enrichHTML: async (s) => s } } } }, utils: { escapeHTML: (s) => s } };
globalThis.Roll = class { constructor() {} async evaluate() { this.total = proximo; return this; } };
globalThis.ChatMessage = { create: async (d) => { const m = comFlags(d); criadas.push(m); return m; }, getWhisperRecipients: () => [{ id: "gm" }] };
globalThis.game = {
  user: { isGM: true },
  settings: { get: (m, k) => settings.get(k) },
  i18n: { localize: (k) => k, format: (k, d) => `${k} ${JSON.stringify(d)}`, lang: "pt-BR" },
  tables: { find: (fn) => tabelas.find(fn) },
  modules: { get: () => ({ api: { clima: () => climaAtual, config: () => ({ minutosHora: 60, segundosMinuto: 60 }) } }) }
};
const { testarObstaculo } = await import("../scripts/obstaculos.js");

test("montanha com tempestade: número baixo é obstáculo do tempo", async () => {
  climaAtual = { tipo: "tempestade", nome: "Tempestade" };
  proximo = 12;
  const m = await testarObstaculo({ terreno: "montanha", dia: 2 });
  assert.equal(m.getFlag(MOD, "obstaculo").chave, "clima.chuva");
  assert.equal(m.getFlag(MOD, "obstaculo").atraso, 6);
  assert.match(m.content, /nvm-fonte-clima/);
});

test("montanha com tempestade: 40 é obstáculo do terreno; 61 é caminho livre só para o mestre", async () => {
  proximo = 40;
  const m = await testarObstaculo({ terreno: "montanha" });
  assert.equal(m.getFlag(MOD, "obstaculo").chave, "terreno.montanha");
  proximo = 61;
  assert.equal(await testarObstaculo({ terreno: "montanha" }), null);
  assert.deepEqual(criadas.at(-1).whisper, ["gm"]);
  assert.match(criadas.at(-1).content, /nvm-livre/);
});

test("sem clima no calendário e sem terreno: usa o padrão (planície, 10%)", async () => {
  climaAtual = null;
  proximo = 11;
  assert.equal(await testarObstaculo({}), null);
});
