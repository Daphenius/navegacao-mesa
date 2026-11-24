# Navegação da Mesa

## Sobre como este módulo foi feito

> Sei que parte da comunidade não gosta de módulos produzidos com IA, então prefiro ser transparente: este foi desenvolvido com ajuda de IA. Não sou programador.
>
> Tudo começou quando um amigo me disse: “cara, ficou muito mais simples, é só fazer uma macro do que você quer”. Fiz a macro para a minha mesa, fui adaptando conforme a necessidade dos jogos e, no fim, ela virou um módulo. Uso nas minhas próprias sessões e resolvi compartilhar caso seja útil para mais alguém.
>
> Se encontrar bugs ou tiver sugestões, abra uma issue. Todo retorno é bem-vindo.

Addon de **viagem** do [Calendário da Mesa](https://github.com/Daphenius/calendario-mesa) para o Foundry VTT 14.
O mestre traça o caminho no mapa com a **régua nativa**, diz quantos km vale cada metro da cena e parte pela viagem do calendário. A cada dia de estrada o caminho pode travar pelo terreno ou pelo tempo, e os jogadores que **conduzem** o grupo rolam **1d100** numa **Tabela de rolagem nativa**: os extremos são o pior (1–5) e o melhor (96–100) que pode acontecer.

> Status: **0.1.0, em testes**. Feito para o Foundry VTT 14 e o sistema D&D 5e (os encontros e obstáculos são texto, servem a qualquer sistema).

## Instalação

No Foundry, *Instalar módulo* › cole o manifesto:

```
https://github.com/Daphenius/navegacao-mesa/releases/latest/download/module.json
```

Precisa do [Calendário da Mesa](https://github.com/Daphenius/calendario-mesa) 4.12.0 ou mais novo.

## Como usar

1. **Escala da cena.** Na configuração da cena, aba **Grade**, preencha **Escala de viagem** (ex.: `1 m = 0,5 km`). Também dá para definir uma escala padrão nas configurações do módulo, ou direto no diálogo da rota.
2. **Medir.** Use a régua do Foundry normalmente (arraste; clique para fazer curvas). Com escala, cada ponto mostra também `≈ X km` e o último mostra os dias (pelo "km por dia" das configurações).
3. **Salvar a rota.** Na barra de **Desenhos**, botão 🛣️ *Salvar a última medição como rota* (ou **Alt+N**). Dê o nome do destino. A rota vira um **Desenho nativo** no mapa, com o nome e a distância em km; os jogadores veem se você deixar marcado. Pode mover, editar e apagar como qualquer desenho: o texto se atualiza sozinho.
4. **Viajar.** Selecione o desenho e clique no 🥾 do HUD: *Viajar por esta rota*. Escolha os **condutores**, a **tabela de encontros** e se a viagem é dia a dia. **Continuar** abre a viagem do Calendário da Mesa já preenchida; confira ritmo e horas por dia e clique em **Partir**.
   Também funciona em qualquer desenho de polígono ou mão livre que você já tenha no mapa.
5. **Encontros.** Ao partir (e a cada amanhecer na viagem dia a dia) aparece no chat o pedido **Role 1d100**. Só os condutores (ou qualquer jogador, se ninguém foi marcado) veem o botão. A rolagem é a nativa do Foundry; o mestre lê o resultado na tabela e o encontro aparece no chat, colorido pelo tipo:

| 1d100 | Tipo |
|---|---|
| 1–5 | **Desastre** (extremo ruim) |
| 6–25 | Problema |
| 26–75 | Estrada comum |
| 76–95 | Sorte |
| 96–100 | **Grande achado** (extremo bom) |

Na primeira vez o módulo cria a tabela **Encontros na Estrada (1d100)** com 14 resultados. Edite à vontade (textos, faixas, ligar um ator ou diário no resultado) ou escolha outra tabela no diálogo da viagem. O tipo vem da flag do resultado ou, se não houver, da faixa do número.

Também na barra de Desenhos: 🎲 *Pedir 1d100 de encontro* manda um pedido avulso.

## Obstáculos do caminho (terreno e tempo)

Além do encontro, a cada dia de viagem o mestre rola **1d100** contra a chance de o caminho travar:

| Terreno da rota | Chance base por dia |
|---|---|
| Estrada | 5% |
| Planície | 10% |
| Floresta | 20% |
| Deserto | 25% |
| Neve e gelo | 30% |
| Montanha ou colinas, Pântano | 35% |

O **clima do dia no Calendário da Mesa** (na região da cena) soma **+10%** se for leve (garoa, chuva, neve fraca, neblina, ventania) ou **+25%** se for forte (aguaceiro, tempestade, granizo, nevasca, frio intenso, nevoeiro denso, tempestade de areia, cinzas, calor extremo). Rolou dentro da parte do clima, o obstáculo é do tempo; senão, do terreno.

O obstáculo vem de uma **Tabela nativa** (pasta *Navegação da Mesa: obstáculos*: 7 de terreno e 5 de tempo, 48 obstáculos) e aparece no chat com o **atraso sugerido**; o botão do mestre *Aplicar o atraso* avança o relógio do calendário. Caminho livre vira só um aviso sussurrado ao mestre.
O terreno é escolhido ao salvar a rota ou no *Viajar por esta rota*; viagens que não saíram de uma rota usam o *Terreno padrão* das configurações. Barra de Desenhos: ⛰️ *Testar obstáculo do caminho agora*.

## Configurações

| Opção | Padrão |
|---|---|
| Escala de viagem padrão (km por unidade) | 0 (desligado; cada cena tem a sua) |
| km por dia (estimativa na régua) | 38,4 (ritmo normal × 8 h) |
| Mostrar km na régua (por usuário) | ligado |
| Cor das rotas | âmbar |
| Pedir 1d100 a cada dia de viagem | ligado |
| Quem vê o encontro e o obstáculo | todos (ou só o mestre: os jogadores veem só o número) |
| Obstáculos do caminho | ligado |
| Terreno padrão | planície |

## Nativo do Foundry

Régua: `CONFIG.Canvas.rulerClass` estendida (só o rótulo). Rotas: `Drawing`. Escala: flag da `Scene` no formulário nativo. Encontros: `RollTable` + `Roll` + `ChatMessage`. Configurações: `game.settings`; atalho: `game.keybindings`. Nenhuma biblioteca de fora.

## API para macros

`game.modules.get("navegacao-mesa").api`: `salvarRota()`, `viajar(desenho)`, `pedirRolagem({ quantidade, destino, dia })`, `tabela()`, `criarTabelaPadrao()`, `escala(cena)`, `distancia(desenho)`, `ultimaMedicao()`, `testarObstaculo({ terreno, destino, dia })`.

## Requisitos

- Foundry VTT 14 (verificado na 14.370).
- Calendário da Mesa **4.12.0** ou mais novo (diálogo de viagem preenchido e hooks da viagem).

## Testes

`node --test tests/*.test.mjs` (contas, traduções, tabelas padrão e os fluxos de encontro e obstáculo num Foundry simulado).
