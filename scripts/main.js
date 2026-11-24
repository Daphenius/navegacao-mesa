/* =========================================================
 * Navegação da Mesa — Foundry VTT v14 · addon de viagem do Calendário da Mesa
 *   calculos.js   contas puras (testadas)
 *   config.js     tradução e configurações
 *   escala.js     escala de viagem da cena (km por unidade da grade)
 *   regua.js      régua nativa mostrando km e dias; guarda a última medição
 *   rotas.js      rota = Desenho nativo; HUD "Viajar por esta rota" → viagem do calendário
 *   encontros.js  Tabela nativa 1d100, pedido no chat, rolagem do condutor e resultado
 *   obstaculos.js obstáculos do dia pelo terreno da rota e pelo clima do calendário (Tabelas nativas)
 * ========================================================= */

import { MOD, registrarConfiguracoes, t } from "./config.js";
import { aoCriarMensagem, criarTabelaPadrao, desenharPedido, garantirTabela, ligarViagemDoCalendario, pedirRolagem } from "./encontros.js";
import { campoNaConfigDaCena, escalaDaCena } from "./escala.js";
import { desenharObstaculo, garantirTabelasDeObstaculos, ligarObstaculosNaViagem, testarObstaculo } from "./obstaculos.js";
import { estenderRegua, TEMPLATE_ROTULO, ultimaMedicao } from "./regua.js";
import { botaoNoHud, distanciaDoDesenho, ligarAtualizacaoDosRotulos, salvarUltimaMedicao, viajarPelaRota } from "./rotas.js";

Hooks.once("init", () => {
  registrarConfiguracoes();
  game.keybindings.register(MOD, "salvarRota", {
    name: "NAVMESA.Atalhos.SalvarRota.Nome",
    hint: "NAVMESA.Atalhos.SalvarRota.Dica",
    editable: [{ key: "KeyN", modifiers: ["Alt"] }],
    restricted: true,
    onDown: () => { salvarUltimaMedicao(); return true; }
  });
  foundry.applications.handlebars.loadTemplates([TEMPLATE_ROTULO]);
  ligarViagemDoCalendario();
  ligarObstaculosNaViagem();
});

// No setup o sistema já trocou a régua (se troca); estendemos a que estiver em uso.
Hooks.once("setup", () => {
  CONFIG.Canvas.rulerClass = estenderRegua(CONFIG.Canvas.rulerClass);
});

Hooks.on("getSceneControlButtons", (controles) => {
  const desenhos = controles?.drawings;
  if (!desenhos?.tools || !game.user.isGM) return;
  const ordem = Object.keys(desenhos.tools).length + 1;
  desenhos.tools.nvmSalvarRota = {
    name: "nvmSalvarRota", order: ordem, title: "NAVMESA.Controles.SalvarRota", icon: "fa-solid fa-route",
    button: true, visible: true, onChange: () => salvarUltimaMedicao()
  };
  desenhos.tools.nvmPedirRolagem = {
    name: "nvmPedirRolagem", order: ordem + 1, title: "NAVMESA.Controles.PedirRolagem", icon: "fa-solid fa-dice-d20",
    button: true, visible: true, onChange: () => pedirRolagem({ quantidade: 1 })
  };
  desenhos.tools.nvmTestarObstaculo = {
    name: "nvmTestarObstaculo", order: ordem + 2, title: "NAVMESA.Controles.TestarObstaculo", icon: "fa-solid fa-mountain-sun",
    button: true, visible: true, onChange: () => testarObstaculo({ terreno: game.settings.get(MOD, "viagemContexto")?.terreno })
  };
});

Hooks.on("renderDrawingHUD", botaoNoHud);
Hooks.on("renderSceneConfig", campoNaConfigDaCena);
Hooks.on("renderChatMessageHTML", desenharPedido);
Hooks.on("renderChatMessageHTML", desenharObstaculo);
Hooks.on("createChatMessage", aoCriarMensagem);

Hooks.once("ready", async () => {
  ligarAtualizacaoDosRotulos();
  const modulo = game.modules.get(MOD);
  modulo.api = {
    /** Salva a última medição da régua como rota (mestre). */
    salvarRota: salvarUltimaMedicao,
    /** Abre "Viajar por esta rota" para um Desenho (mestre). */
    viajar: viajarPelaRota,
    /** Põe no chat o pedido de 1d100: { quantidade, destino, dia } (mestre). */
    pedirRolagem,
    /** Tabela de encontros em uso (cria a padrão se faltar). */
    tabela: garantirTabela,
    /** Cria de novo a tabela padrão de 1d100 (mestre). */
    criarTabelaPadrao,
    /** km por unidade da grade da cena. */
    escala: escalaDaCena,
    /** Testa um obstáculo agora: { terreno, destino, dia } (mestre). */
    testarObstaculo,
    /** Distância de um Desenho na unidade da cena. */
    distancia: distanciaDoDesenho,
    /** Última medição da régua deste usuário. */
    ultimaMedicao
  };
  if (game.user.isGM && (game.users.activeGM?.isSelf ?? true)) {
    try { await garantirTabela(); } catch (err) { console.error(`${MOD} | tabela de encontros`, err); }
    try { await garantirTabelasDeObstaculos(); } catch (err) { console.error(`${MOD} | tabelas de obstáculos`, err); }
  }
  if (game.user.isGM && !game.modules.get("calendario-mesa")?.active) ui.notifications.warn(t("Viajar.SemCalendario"));
});
