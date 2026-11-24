/* =========================================================
 * Navegação da Mesa — contas puras (sem Foundry), testadas em tests/.
 * ========================================================= */

/** Faixas padrão do 1d100 quando o resultado da tabela não diz o tipo. Extremos: 1–5 e 96–100. */
export const FAIXAS = [
  { ate: 5, tipo: "pessimo" },
  { ate: 25, tipo: "ruim" },
  { ate: 75, tipo: "neutro" },
  { ate: 95, tipo: "bom" },
  { ate: Infinity, tipo: "otimo" }
];
export const TIPOS = FAIXAS.map((f) => f.tipo);

/** Tipo do encontro pelo número rolado. */
export function tipoPorValor(valor) {
  const v = Number(valor);
  if (!Number.isFinite(v)) return "neutro";
  return FAIXAS.find((f) => v <= f.ate).tipo;
}

/**
 * Pontos absolutos (em pixels) de um Desenho de polígono/linha livre, já com a rotação.
 * @param {{x:number, y:number, rotation?:number, shape:{width:number, height:number, points:number[]}}} d
 */
export function pontosDoDesenho(d) {
  const p = d?.shape?.points ?? [];
  const pts = [];
  for (let i = 0; i + 1 < p.length; i += 2) pts.push({ x: d.x + p[i], y: d.y + p[i + 1] });
  const graus = Number(d?.rotation) || 0;
  if (!graus) return pts;
  const cx = d.x + (d.shape.width ?? 0) / 2, cy = d.y + (d.shape.height ?? 0) / 2;
  const r = (graus * Math.PI) / 180, cos = Math.cos(r), sin = Math.sin(r);
  return pts.map(({ x, y }) => ({ x: cx + (x - cx) * cos - (y - cy) * sin, y: cy + (x - cx) * sin + (y - cy) * cos }));
}

/** Dados de um Desenho de linha aberta que passa pelos pontos (absolutos): { x, y, shape }. */
export function desenhoDosPontos(pontos) {
  const xs = pontos.map((p) => p.x), ys = pontos.map((p) => p.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return {
    x, y,
    shape: {
      type: "p",
      width: Math.max(1, Math.max(...xs) - x),
      height: Math.max(1, Math.max(...ys) - y),
      points: pontos.flatMap((p) => [Math.round(p.x - x), Math.round(p.y - y)])
    }
  };
}

/** Remove pontos repetidos seguidos (a régua repete o último ponto ao soltar). */
export function semRepetidos(pontos) {
  return pontos.filter((p, i) => i === 0 || p.x !== pontos[i - 1].x || p.y !== pontos[i - 1].y);
}

/** Distância da cena convertida em km pela escala (km por unidade da grade). null se não houver escala. */
export function paraKm(distancia, escala) {
  const d = Number(distancia), e = Number(escala);
  if (!(e > 0) || !Number.isFinite(d)) return null;
  return d * e;
}

/** Dias de viagem para uma distância em km, com km por dia. */
export function diasDeViagem(km, kmPorDia) {
  const k = Number(km), v = Number(kmPorDia);
  if (!(k > 0) || !(v > 0)) return 0;
  return k / v;
}

/** Arredonda para mostrar: 1 casa abaixo de 10, inteiro acima. */
export function arredondar(n) {
  return Math.abs(n) < 10 ? Math.round(n * 10) / 10 : Math.round(n);
}

/* ---------------- obstáculos do caminho ---------------- */

/** Chance base (%) de obstáculo por dia em cada terreno. */
export const TERRENOS = { estrada: 5, planicie: 10, floresta: 20, montanha: 35, pantano: 35, deserto: 25, gelo: 30 };

/** Climas do Calendário da Mesa que atrapalham a estrada: id do clima → { grupo, forte }. */
export const CLIMAS_OBSTACULO = {
  garoa: { grupo: "chuva", forte: false }, chuva: { grupo: "chuva", forte: false }, chuvaNeblina: { grupo: "chuva", forte: false },
  aguaceiro: { grupo: "chuva", forte: true }, tempestade: { grupo: "chuva", forte: true }, granizo: { grupo: "chuva", forte: true },
  neveLeve: { grupo: "neve", forte: false }, neve: { grupo: "neve", forte: false }, nevasca: { grupo: "neve", forte: true }, frioIntenso: { grupo: "neve", forte: true },
  neblina: { grupo: "nevoa", forte: false }, neblinaDensa: { grupo: "nevoa", forte: true },
  vento: { grupo: "vento", forte: false }, raiosSecos: { grupo: "vento", forte: false }, areia: { grupo: "vento", forte: true }, cinzas: { grupo: "vento", forte: true },
  calor: { grupo: "calor", forte: true }
};
export const GRUPOS_CLIMA = ["chuva", "neve", "nevoa", "vento", "calor"];
export const BONUS_CLIMA = { leve: 10, forte: 25 };

/** Clima do dia que conta para obstáculo, ou null. */
export const climaObstaculo = (tipo) => CLIMAS_OBSTACULO[tipo] ?? null;

/** Chance do dia: { chance, doClima } — doClima é a parte da chance que vem do tempo. */
export function chanceDoDia(terreno, clima) {
  const base = TERRENOS[terreno] ?? TERRENOS.planicie;
  const doClima = clima ? (clima.forte ? BONUS_CLIMA.forte : BONUS_CLIMA.leve) : 0;
  return { chance: Math.min(90, base + doClima), doClima };
}

/** Pelo 1d100 do dia: null (caminho livre), "clima" (o tempo atrapalha) ou "terreno". */
export function fonteDoObstaculo(valor, { chance, doClima }) {
  if (!(valor <= chance)) return null;
  return valor <= doClima ? "clima" : "terreno";
}
