# Fix 18 — Barreira de jogadores e zoom por força

| | |
|---|---|
| **Data** | 27/11/2026 |
| **Build** | `0.8.0-mvp1` · F7 · `17bb239` |
| **Pacote** | `release/keepie-uppie-v0.8.0-mvp1.zip` · 362,8 KiB · SHA-256 `cccdc723894b8e5a0cac46c1bae51bf682a2ca8ae3d7707cfa01e031cbe67add` |
| **URL** | https://rigato.github.io/keepie-uppie/ |

## O pedido

> "1. Essa folhagem não ficou legal. Não faz sentido no contexto de futebol. Pensei em
> transformá-la em uma barreira de jogadores como formam quando se cobra uma falta. Pode ser
> mais estilizado, não acho que deva ficar muito grande. O comportamento é como se a bola
> batesse na barreira e quicasse pra cima e um dos lados.
> 2. A partir de um treshold de força do chute e a partir daí quanto mais forte mais proeminente
> fica esse efeito novo que quero propor, que é de um tipo de zoom out. Bastante sutil, mas acho
> que daria mais a impressão de força e velocidade, deixando o jogo mais vivo e divertido."

## 1. Soft de folhagem → barreira de jogadores

A folhagem da 0.7.0 não lia como futebol. O obstáculo `soft` foi substituído por uma **barreira
de falta**: quatro jogadores estilizados, de frente, ombro a ombro, com braços cruzados à frente
do peito. A silhueta é feita de cabeças, ombros, shorts e chuteiras — não existe mais nenhuma
aresta reta de "barra".

- **Visual:** camisa azul forte, short claro, dois tons de pele alternados, cabelo e chuteiras
  escuros, contorno fino e luz de cima no mesmo estilo geométrico do jogo. Cores novas em
  `src/game/palette.ts` (`barrier`, `barrierShorts`, `barrierSkinA/B`, `barrierDark`); distinto
  do bird (índigo), do bumper (teal) e do breakable (marrom).
- **Hitbox:** **152×32** (`barrierWidth`/`barrierHeight`), honesta com os quatro corpos. A
  largura é a mesma da folhagem; a altura cresce para caber cabeça, camisa, short e chuteira.
- **Regra nova:** bater na barreira **não drena e não mata** — a bola **quica para cima e para
  o lado do impacto**. A física pura vive em `barrierBounce` (`src/core/collision.ts`):
  - a subida é `max(barrierMinLift, |vy| × barrierRestitution)` — piso de **620 u/s**,
    restituição **0,72**, então o quique sempre devolve a bola para cima;
  - a saída lateral é `barrierSideKick + |vx| × barrierSideCarry` (**300 + 12%**), limitada a
    **520 u/s**, sempre no sinal do lado tocado;
  - no centro ambíguo decide o `vx` de entrada; parada no centro, sai para a direita;
  - entradas `NaN`/`Infinity` caem no mínimo — a bola nunca fica sem saída.
- **Feedback:** o grupo inteiro faz um flinch curto (achata em Y e alarga em X por 70 ms +
  yoyo), uma poeirinha abre no ponto exato do toque e a cena toca o som de impacto de corpo
  (`damp`, pitch 1,05) com shake curto, sem flash. A hitbox nunca se mexe com o flinch.
- **Spawn:** o kind interno virou `barrier` e a ordem/pesos do mix **não mudaram**
  (`[barrier, breakable, bird, bumper, ramp]`, mesmas âncoras). O `softDamp` foi removido.
- **Escudo:** o Shield continua interceptando o contato antes do quique — a carga é gasta e o
  efeito original é ignorado.

Capturas em 390×844 @2×: `/tmp/opencode/barrier-full.png` (barreira no jogo),
`/tmp/opencode/barrier-zoom.png` (aproximação) e `/tmp/opencode/barrier-bounce.png` (logo após
o impacto: `vx=-300`, `vy≈-577`).

## 2. Zoom out por força do chute

Chutes fortes puxam a câmera de leve para trás e a devolvem — leitura de impacto e velocidade,
sem tocar em física, mira, colisão ou catraca.

- **Rampa:** `kickZoomAmount(power)` em `src/core/camera.ts` — zero até `kickZoomThreshold`
  (**50%** da força) e smoothstep até `kickZoomMax` (**4%**) em `power = 1`. Fora de 0..1
  clampa; `NaN`/`Infinity` não geram zoom. Na prática o efeito começa quase imperceptível
  (0,1% por volta de 50%) e só fica evidente no chute cheio.
- **Tempos:** sai em **80 ms** (`Quad.out`), segura **40 ms** no fundo e volta em **200 ms**
  (`Quad.inOut`) — total ~0,32 s. A cadeia de tweens e um número de geração impedem tween órfão
  quando outro chute entra no meio.
- **Onde vale:** chute normal (`result.power`), Chutão (força cheia → 4%) e Aimed Shot
  (`shot.ratio`). A câmera volta a 1 no fim, na morte, no retry e no `create()`.
- **Fundo:** o céu do backdrop transborda **28 u** além da tela (`BACKDROP_BLEED`), porque com
  4% de recuo a janela ganha ~11 u laterais e ~22 u verticais. O scrim do topo transborda só na
  largura. Em zoom 1 o quadro é idêntico ao anterior; as paredes continuam nas coordenadas do
  mundo e aparecem ~11 u para dentro durante o recuo, sem moldura chapada.
- **Sem mudança no feel existente:** `ratchetAt`, `followSpeed`, `maxTop` e a curva de chute
  ficaram intactos.

Capturas: `/tmp/opencode/zoom-bg.png` (zoom 0,96 sem faixa chapada nas bordas) e
`/tmp/opencode/zoom-kick.png` (chute real durante o recuo).

## Validação

- Typecheck limpo; **206/206 testes** (16 arquivos; +5 de `kickZoomAmount`, +6 de
  `barrierBounce`); build ok; `git diff --check` limpo.
- Smoke E2E **13/13** (390×844 @2×) local e **live** no Pages, zero
  `pageerror`/`console.error`. Passos novos:
  - no Power Kick, o smoke mede o zoom sair de 1 e voltar (o primeiro frame amostrado ficou
    entre `0,974` e `0,986`, meio da rampa; a volta fecha em `< 0,002`) — a rampa completa é
    conferida nas capturas;
  - o passo **Barreira** planta o obstáculo e derruba a bola na metade esquerda, exigindo
    `vx < −100` e `vy < −500`; mediu `vx −300 · vy −598`.
- O passo da estamina congela `stepPhysics`/`updateCamera`; o passo da barreira restaura os
  métodos do protótipo antes de soltar a bola (`delete scene.stepPhysics`).
- Capturas revisadas: os quatro jogadores leem como barreira e o quique sai para cima e para o
  lado. Um chute normal de força cheia mediu **zoom 0,96** no pico e **1,0** na volta.
- CI de Pages verde (typecheck, testes, build e smoke) e deploy concluído; o JS live confirma
  `0.8.0-mvp1`, `17bb239`, `barrier` e `kickZoom`.

## Ajuste fino

- Todos os números novos são `[TESTE]`:
  - barreira: `barrierRestitution` 0,72, `barrierMinLift` 620, `barrierSideKick` 300,
    `barrierSideCarry` 0,12, `barrierMaxSide` 520. Se o quique parecer fraco demais para
    recuperar, subir `barrierMinLift`; se o lado mandar a bola longe demais, baixar
    `barrierMaxSide`; se ainda parecer "drenar", subir a restituição.
  - zoom: `kickZoomThreshold` 0,5, `kickZoomMax` 0,04, `kickZoomOutMs` 80,
    `kickZoomHoldMs` 40, `kickZoomBackMs` 200. Se o efeito piscar demais em chutes médios,
    subir o threshold (0,6–0,65); se não der para sentir no fundo, subir o máximo para 0,05.
- **Observação para o playtest:** o quique da barreira não reseta `arcApexY` (mesmo
  comportamento do bumper e dos desvios atuais). Um toque logo depois do quique pode medir a
  queda desde o ápice anterior. Não mudei porque alteraria a curva de força já aprovada; se o
  chute pós-barreira parecer generoso demais no celular, o ajuste é resetar o ápice no contato.
- O pacote foi gerado no commit de código `17bb239`; o Pages publica o commit de docs mais
  recente, então o label do site mostra esse SHA. O código é o mesmo.
