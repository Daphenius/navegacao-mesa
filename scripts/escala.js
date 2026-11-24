/* =========================================================
 * Navegação da Mesa — escala de viagem da cena (quantos km vale cada unidade da régua).
 * Fica numa flag da Cena e aparece na aba Grade da configuração nativa da cena.
 * ========================================================= */

import { cfg, esc, MOD, t } from "./config.js";

/** km por unidade da grade da cena (0 = sem escala). A cena manda; sem valor nela, vale a escala padrão do mundo. */
export function escalaDaCena(scene = canvas?.scene) {
  const daCena = Number(scene?.getFlag?.(MOD, "escala"));
  if (daCena > 0) return daCena;
  const padrao = Number(cfg("escalaPadrao"));
  return padrao > 0 ? padrao : 0;
}

export const unidadeDaCena = (scene = canvas?.scene) => scene?.grid?.units || "";

/** Campo "Escala de viagem" na aba Grade da configuração da cena (o formulário nativo grava a flag). */
export function campoNaConfigDaCena(app, html) {
  try {
    const raiz = html instanceof HTMLElement ? html : html?.[0];
    const aba = raiz?.querySelector('.tab[data-tab="grid"]');
    if (!aba || aba.querySelector(".nvm-escala")) return;
    const scene = app.document;
    const valor = Number(scene?.getFlag(MOD, "escala")) || "";
    const grupo = document.createElement("div");
    grupo.className = "form-group nvm-escala";
    grupo.innerHTML = `<label>${t("Escala.Rotulo")}</label>
      <div class="form-fields">
        <span>1 ${esc(unidadeDaCena(scene) || t("Escala.Unidade"))} =</span>
        <input type="number" name="flags.${MOD}.escala" min="0" step="any" value="${valor}" placeholder="${Number(cfg("escalaPadrao")) || ""}">
        <span>km</span>
      </div>
      <p class="hint">${t("Escala.Dica")}</p>`;
    aba.append(grupo);
  } catch (err) {
    console.warn(`${MOD} | campo de escala na cena`, err);
  }
}
