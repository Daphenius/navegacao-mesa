/* =========================================================
 * Navegação da Mesa — régua nativa com km.
 * Estende a régua do Foundry (CONFIG.Canvas.rulerClass): cada ponto mostra também os km pela escala da cena
 * e o último ponto mostra os dias de viagem. Guarda a última medição do usuário para virar rota.
 * ========================================================= */

import { diasDeViagem, paraKm, semRepetidos } from "./calculos.js";
import { cfg, MOD, numero, t } from "./config.js";
import { escalaDaCena } from "./escala.js";

const TEMPLATE_DO_FOUNDRY = "templates/hud/waypoint-label.hbs";
export const TEMPLATE_ROTULO = `modules/${MOD}/templates/rotulo-waypoint.hbs`;

let ultima = null;
/** Última medição feita por este usuário: { sceneId, pontos: [{x, y}] } ou null. */
export const ultimaMedicao = () => ultima;

/** Texto "≈ 45 km" (e "· 1,2 dias" no último ponto) para uma distância da cena; "" sem escala. */
export function textoKm(distancia, { comDias = false } = {}) {
  const km = paraKm(distancia, escalaDaCena());
  if (!(km > 0)) return "";
  let texto = t("Regua.Km", { km: numero(km) });
  if (comDias) {
    const dias = diasDeViagem(km, cfg("kmPorDia"));
    if (dias > 0) texto += ` · ${t(dias > 1 ? "Regua.Dias" : "Regua.Dia", { dias: numero(dias) })}`;
  }
  return texto;
}

export function estenderRegua(Base) {
  const templateNativo = !Base.WAYPOINT_LABEL_TEMPLATE || Base.WAYPOINT_LABEL_TEMPLATE === TEMPLATE_DO_FOUNDRY;

  return class ReguaNavegacao extends Base {
    static WAYPOINT_LABEL_TEMPLATE = templateNativo ? TEMPLATE_ROTULO : Base.WAYPOINT_LABEL_TEMPLATE;

    _onPathChange() {
      super._onPathChange();
      try {
        if (this.user?.isSelf && this.path?.length >= 2 && canvas.scene) {
          const pontos = semRepetidos(this.path.map(({ x, y }) => ({ x, y })));
          if (pontos.length >= 2) ultima = { sceneId: canvas.scene.id, pontos };
        }
      } catch (err) { console.warn(`${MOD} | régua`, err); }
    }

    _getWaypointLabelContext(waypoint, state) {
      const contexto = super._getWaypointLabelContext(waypoint, state);
      if (!contexto || !cfg("mostrarNaRegua")) return contexto;
      const texto = textoKm(waypoint.measurement?.distance, { comDias: !waypoint.next });
      if (!texto) return contexto;
      if (templateNativo) contexto.navegacao = { texto };
      else contexto.units = `${contexto.units ?? ""} · ${texto}`;
      return contexto;
    }
  };
}
