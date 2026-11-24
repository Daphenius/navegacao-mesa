/* Traduções, tabela padrão e prefixo do CSS (sem Foundry). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const ler = (p) => readFileSync(join(RAIZ, p), "utf8");
const scripts = readdirSync(join(RAIZ, "scripts")).map((n) => ler(`scripts/${n}`)).join("\n");
const idiomas = { "pt-BR": JSON.parse(ler("lang/pt-BR.json")), en: JSON.parse(ler("lang/en.json")) };
const pegar = (obj, chave) => chave.split(".").reduce((o, k) => o?.[k], obj);
const folhas = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? folhas(v, `${p}${k}.`) : [`${p}${k}`]));

// O módulo é carregado no Node só para pegar a tabela padrão (encontros.js depende de calculos/config, sem globais no topo).
globalThis.foundry = { applications: { api: {} } };
const { PADRAO } = await import("../scripts/encontros.js");
const { tipoPorValor, TERRENOS, GRUPOS_CLIMA, CLIMAS_OBSTACULO } = await import("../scripts/calculos.js");
const { OBSTACULOS } = await import("../scripts/obstaculos.js");

test("toda chave usada existe nos dois idiomas", () => {
  const usadas = new Set([
    ...[...scripts.matchAll(/\bt\("([A-Za-z.]+)"/g)].map((m) => `NAVMESA.${m[1]}`),
    ...[...scripts.matchAll(/"(NAVMESA\.[A-Za-z.]+)"/g)].map((m) => m[1])
  ]);
  for (const [chave] of PADRAO.map((r) => [r[3]])) { usadas.add(`NAVMESA.Tabela.${chave}.Nome`); usadas.add(`NAVMESA.Tabela.${chave}.Texto`); }
  for (const lista of Object.values(OBSTACULOS)) for (const [k] of lista) { usadas.add(`NAVMESA.Obstaculo.${k}.Nome`); usadas.add(`NAVMESA.Obstaculo.${k}.Texto`); }
  for (const k of Object.keys(TERRENOS)) usadas.add(`NAVMESA.Terreno.${k}`);
  for (const k of GRUPOS_CLIMA) usadas.add(`NAVMESA.Clima.${k}`);
  for (const tipo of ["pessimo", "ruim", "neutro", "bom", "otimo", "oculto"]) usadas.add(`NAVMESA.Tipo.${tipo}`);
  for (const [lang, dic] of Object.entries(idiomas)) {
    const faltam = [...usadas].filter((c) => typeof pegar(dic, c) !== "string");
    assert.deepEqual(faltam, [], lang);
  }
});

test("os dois idiomas têm as mesmas chaves", () => {
  assert.deepEqual(folhas(idiomas.en).sort(), folhas(idiomas["pt-BR"]).sort());
});

test("tabela padrão cobre 1 a 100 sem buracos e com o tipo da faixa", () => {
  let esperado = 1;
  for (const [de, ate, tipo] of PADRAO) {
    assert.equal(de, esperado, `faixa começando em ${de}`);
    assert.ok(ate >= de);
    assert.equal(tipoPorValor(de), tipo); assert.equal(tipoPorValor(ate), tipo);
    esperado = ate + 1;
  }
  assert.equal(esperado, 101);
});

test("CSS só usa o prefixo nvm-", () => {
  const classes = [...ler("styles/navegacao.css").matchAll(/\.([a-z][\w-]*)/g)].map((m) => m[1]);
  const alheias = classes.filter((c) => !c.startsWith("nvm-") && !["waypoint-label"].includes(c));
  assert.deepEqual(alheias, []);
});

test("versão sem segmento acima de 9 e link de download batendo", () => {
  const m = JSON.parse(ler("module.json"));
  assert.ok(m.version.split(".").every((n) => Number(n) <= 9));
  assert.ok(m.download.endsWith(`/v${m.version}/navegacao-mesa.zip`));
});

test("toda tabela de obstáculo tem terreno ou clima conhecido, e todo clima que atrapalha tem tabela", () => {
  for (const chave of Object.keys(OBSTACULOS)) {
    const [g, id] = chave.split(".");
    assert.ok(g === "terreno" ? id in TERRENOS : GRUPOS_CLIMA.includes(id), chave);
  }
  for (const k of Object.keys(TERRENOS)) assert.ok(OBSTACULOS[`terreno.${k}`], k);
  for (const c of Object.values(CLIMAS_OBSTACULO)) assert.ok(OBSTACULOS[`clima.${c.grupo}`], c.grupo);
});
