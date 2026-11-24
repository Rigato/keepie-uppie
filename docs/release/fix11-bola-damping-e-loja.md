# Fix 11 — Bola de futebol, damping lateral e loja

| | |
|---|---|
| **Data** | 24/11/2026 |
| **Build** | `0.3.0-mvp1` · F7 |
| **Pacote** | `release/keepie-uppie-v0.3.0-mvp1.zip` · 352,3 KiB · SHA-256 `0522d434ea1822aa332300d1d5471e82ca2e7f0363186d39781862b91d82ffdd` |
| **URL** | https://rigato.github.io/keepie-uppie/ |

## O pedido

> "A bola precisa parecer com uma bola de futebol. Atualmente ela parece um OVO."
>
> "Precisamos de um damping de velocidade lateral. Quando a bola quica muito entre as laterais fica muito difícil de acertar ela."
>
> "Implementar a loja para comprar consumíveis e ser o sink das moedas."

## A bola

O círculo amarelo com um brilho virou uma **bola de futebol clássica**: base creme, 12 pentágonos escuros e 20 hexágonos claros, costuras, contorno escuro, sombreado no canto inferior direito e luz no superior esquerdo.

A textura é **gerada em runtime** a partir de um icosaedro truncado real, projetado em 3D e rasterizado com 4× de supersampling (`src/ui/ball.ts`). Cada raio vira uma textura cacheada no TextureManager; em gameplay a bola é **um único `Image`** dentro do container que já existia (o squash/stretch do chute continua funcionando). Custo por frame: zero além do desenho normal.

Cores novas na paleta: `ballBase` (creme), `ballPatch` (azul-escuro) e `ballSeam` (costura clara). O dourado (`PALETTE.ball`) continua nas moedas, no HUD e no halo sutil atrás da bola — o rastro agora usa o azul-escuro da bola, para não parecer um segundo objeto amarelo.

A mesma textura aparece no título (58 u) e no gameplay (30 u); a leitura foi conferida nos dois tamanhos sobre o céu claro.

## O damping lateral

`physics.wallRestitution` passou de **1** para **0,8**. Cada quique na parede devolve 80% da velocidade horizontal; a direção continua invertendo, o ângulo continua espelhado.

Numa bancada determinística com `vx = 1800 u/s` e sem gravidade vertical, os quiques encadearam:

`1800 → 1440 → 1152 → 922 → 737 → 590 → 472 u/s`

Depois de 6 quiques a bola está em ~26% da velocidade inicial. Antes, ela mantinha 100% e podia atravessar a tela mais de uma dúzia de vezes no mesmo arco — o "pinball" que tornava o toque uma adivinhação. O damping é aplicado no quique, não no ar: a mira e a curva do chute continuam idênticas, e a bola não perde velocidade lateral enquanto voa sem tocar a parede.

O quique também ficou **mais barato de ler**: a bola desacelera a cada parede, então o jogador tem tempo de reposicionar o dedo. A regra de força pela queda não mudou.

## A loja

O save (`SaveV1`) ganhou dois campos aditivos: `inventory` (quantos itens de cada consumível o jogador possui) e `loadout` (até 3 tipos equipados, sem repetição). Saves antigos são migrados em silêncio com inventário e loadout vazios.

O modelo é o decidido no GDD: **3 slots, sem duplicatas, com devolução ao pool**. Comprar adiciona ao inventário; equipar não gasta; usar gasta uma unidade. Quando a última unidade sai, o item também sai do loadout.

| Consumível | Efeito | Preço `[TESTE]` |
|---|---|---:|
| **Safety Net** | Na morte, depois de a run ter começado, a bola reaparece 180 u acima da linha, com 1500 u/s para cima. Uma carga; a run continua e conta como normal. | 50 |
| **Magnet Start** | O primeiro toque da run ativa o Magnet por 15 s, com o mesmo raio/puxão do pickup. | 30 |
| **Power Kick (Chutão)** | O primeiro chute válido da run sai a **2750 u/s**, mantendo o ângulo do toque. Perfect soma +60 (2810, abaixo da mola). Whiff não gasta. | 40 |

A loja abre por um botão **SHOP** no título e outro na tela de morte. A tela mostra saldo, os três cards (ícone, descrição, preço, possuídos, BUY e EQUIP/UNEQUIP) e o loadout de 3 slots; o BACK volta ao título. O botão de morte é importante porque a tela de fim de run não tinha caminho de volta ao título.

A lógica pura está em `src/core/consumables.ts` e `src/core/shop.ts` (compra, equipar, consumir, loadout válido), a tela em `src/scenes/ShopScene.ts` + `src/ui/shop-card.ts` / `src/ui/shop-loadout.ts`. Os efeitos em gameplay ficam em `PlayScene`: Chutão no primeiro chute, Magnet no `markStarted()` e rede no `die()`.

## Validação

- **99 testes** (10 arquivos) verdes; typecheck limpo.
- **Smoke E2E 7/7** (390×844), sem erro de console.
- **Damping no browser**: 1800 → 1440 → 1152 → 922 → 737 → 590 → 472; razão 0,8 por quique.
- **Fluxo da loja no browser**: 500 moedas → comprar net/magnet/chutao (380 restantes), equipar os 3 (loadout 3/3), voltar ao título, iniciar a run. Primeiro chute: **2750 u/s**, Magnet **15000 ms**, inventário de chutão/magnet zerado e loadout só com net. `die()` com a rede: `dead=false`, `vy=-1500`, bola a 180 u acima da linha, net consumida; segundo `die()` mata. Botão SHOP da morte abre a loja.
- **Capturas 390×844**: título com a bola a 58 u, gameplay a 30 u, loja com os 3 cards e a tela de morte com SHOP.
- Pacote validado: 3 arquivos, 1.276,8 KiB descompactado, **352,3 KiB** zipado, maior path 25.

## `[CONFIRMAR]` — pendente do seu teste

- **Bola**: o padrão, o tamanho e o contraste estão bons no celular? A bola ficou escura demais para leitura em movimento? O halo dourado ajuda ou atrapalha?
- **Damping 0,8**: a bola ainda chega viva do outro lado depois de dois quiques? Se ainda parecer pinball, o próximo valor é 0,72; se a bola morrer rápido demais na parede, 0,86.
- **Rastro**: o rastro azul-escuro atrás da bola está legível sem parecer sujeira?
- **Preços**: 50/30/40 deixam a loja alcançável sem virar troco? Se as moedas sobrarem, subir; se a primeira compra demorar demais, descer.
- **Itens da loja v1**: a Safety Net é a âncora certa? Magnet Start e Chutão justificam um slot? O Chutão no **primeiro chute** é útil ou desperdiça a carga? (A proposta `docs/proposta-conteudo-0.3.md` lista alternativas.)
- **Chutão 2750**: o primeiro chute fica claramente mais alto sem parecer que quebrou a regra de força pela queda?
- **Net**: 1500 u/s / 180 u acima da linha é uma segunda chance justa, ou ainda dá muita altitude de graça?

## Como testar

1. Recarregue forçado e confirme no rodapé: **`F7 · 0.3.0-mvp1 · <sha>`**.
2. Jogue alguns arcos: a bola deve parecer um futebol; force quiques laterais e sinta a perda de velocidade a cada parede.
3. No título, toque em **SHOP**. Com moedas, compre um item, toque em **EQUIP** e volte.
4. Jogue uma run: o primeiro chute com **POWER KICK** deve ser o Chutão; o **MAGNET START** liga no primeiro toque; a **SAFETY NET** salva uma morte.
5. Morra: a tela de fim de run agora tem **SHOP** além do TAP TO RETRY.
