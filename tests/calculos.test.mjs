/* Contas puras: node --test tests/ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { chanceDoDia, climaObstaculo, fonteDoObstaculo, desenhoDosPontos, diasDeViagem, paraKm, pontosDoDesenho, semRepetidos, tipoPorValor } from "../scripts/calculos.js";

test("tipo pelo 1d100: extremos ruins e bons", () => {
  assert.equal(tipoPorValor(1), "pessimo");
  assert.equal(tipoPorValor(5), "pessimo");
  assert.equal(tipoPorValor(6), "ruim");
  assert.equal(tipoPorValor(25), "ruim");
  assert.equal(tipoPorValor(26), "neutro");
  assert.equal(tipoPorValor(75), "neutro");
  assert.equal(tipoPorValor(76), "bom");
  assert.equal(tipoPorValor(95), "bom");
  assert.equal(tipoPorValor(96), "otimo");
  assert.equal(tipoPorValor(100), "otimo");
  assert.equal(tipoPorValor("x"), "neutro");
});

test("desenho de rota ida e volta pelos pontos", () => {
  const pts = [{ x: 500, y: 300 }, { x: 900, y: 700 }, { x: 650, y: 1200 }];
  const d = desenhoDosPontos(pts);
  assert.equal(d.x, 500); assert.equal(d.y, 300);
  assert.equal(d.shape.type, "p");
  assert.equal(d.shape.width, 400); assert.equal(d.shape.height, 900);
  assert.deepEqual(pontosDoDesenho(d), pts);
});

test("rotação do desenho gira os pontos em volta do centro", () => {
  const d = { x: 0, y: 0, rotation: 180, shape: { width: 100, height: 0, points: [0, 0, 100, 0] } };
  const [a, b] = pontosDoDesenho(d);
  assert.ok(Math.abs(a.x - 100) < 1e-9 && Math.abs(b.x) < 1e-9);
});

test("escala e dias", () => {
  assert.equal(paraKm(300, 0.5), 150);
  assert.equal(paraKm(300, 0), null);
  assert.equal(paraKm(300, ""), null);
  assert.equal(diasDeViagem(76.8, 38.4), 2);
  assert.equal(diasDeViagem(10, 0), 0);
});

test("pontos repetidos seguidos saem", () => {
  assert.deepEqual(semRepetidos([{ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 2, y: 2 }]), [{ x: 1, y: 1 }, { x: 2, y: 2 }]);
});

test("chance de obstáculo: terreno + clima, e quem causou", () => {
  assert.deepEqual(chanceDoDia("floresta", null), { chance: 20, doClima: 0 });
  const forte = climaObstaculo("tempestade");
  assert.deepEqual(chanceDoDia("montanha", forte), { chance: 60, doClima: 25 });
  assert.deepEqual(chanceDoDia("estrada", climaObstaculo("garoa")), { chance: 15, doClima: 10 });
  assert.equal(climaObstaculo("limpo"), null);
  assert.equal(chanceDoDia("xyz", null).chance, 10);
  const c = chanceDoDia("montanha", forte);
  assert.equal(fonteDoObstaculo(10, c), "clima");
  assert.equal(fonteDoObstaculo(40, c), "terreno");
  assert.equal(fonteDoObstaculo(61, c), null);
});
