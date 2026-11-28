# Fix 19 — Câmera de transmissão e HUD fixo

| | |
|---|---|
| **Data** | 28/11/2026 |
| **Build** | `0.9.0-mvp1` · F7 · `a737fe3` |
| **Pacote** | `release/keepie-uppie-v0.9.0-mvp1.zip` · 363,1 KiB · SHA-256 `71d204bc6c7ac3ac4c920027bb42298c452a5a660db375d3798e86bbec4293c6` |
| **URL** | https://rigato.github.io/keepie-uppie/ |

## O pedido

> "O lance do zoom out não ficou bom. A tela pisca e as bordas ficam estranhas. Não foi o que eu
> tinha imaginado. O que eu pensei é como se a câmera se afastasse um pouco do campo de jogo. Pensa
> numa transmissão de jogo de futebol e algum jogador dá um chutão lá de trás, tipo um lançamento,
> a camera se afasta para acomodar, enquadrar melhor e conforme a bola vai caindo onde vai pousar a
> camera se aproxima. Não quero exatamente esse comportamento mas esse é o look and feel que
> imaginei."

## O que estava errado na 0.8

O zoom da 0.8 era um **pulso**: saía em 80 ms, segurava 40 ms e voltava em 200 ms, e a cada chute
`playKickZoom` matava o tween anterior e forçava `cam.setZoom(1)` antes de recomeçar. Em toques
encadeados a câmera reiniciava a cada chute — a "piscada". O HUD inteiro estava na mesma câmera,
então encolhia junto com o mundo. E o zoom expunha o fora do campo: paredes e linha de morte
andavam para dentro e sobrava uma faixa chapada de canvas na borda.

Medido no build anterior com zoom 0,96: o botão de pausa desenhava em 0,96 do tamanho e as bordas
laterais mostravam ~11 u de fora do campo.

## 1. Câmera de transmissão (contínua)

O pulso foi removido; não existe mais tween de zoom nem `setZoom(1)` no chute.

- **Rampa por força (mantida):** `kickZoomAmount(power)` — zero até `kickZoomThreshold` (**50%**)
  e smoothstep até `kickZoomMax` (**4%**) em força cheia. Em `src/core/camera.ts`.
- **Envelope do voo:** `flightZoomEnvelope(vy, ballScreenY, viewHeight)` — com a bola subindo
  (`vy < 0`) o afastamento fica em 1; na queda ele se mantém até **40%** da altura da tela
  (`zoomHoldUntil`) e fecha por smoothstep até **72%** (`zoomCloseAt`); abaixo disso o alvo é o
  zoom normal. Entradas inválidas devolvem **1** de propósito: preservar o afastamento evita um
  salto/teleporte de zoom quando uma leitura falha.
- **Suavização:** `smoothZoom(current, target, dt, speed)` — aproximação exponencial, sem
  overshoot; `dt <= 0` ou entrada inválida mantém o valor atual. Abertura a **4,2/s**
  (`zoomOpenSpeed`) e fechamento a **3,6/s** (`zoomCloseSpeed`).
- **Na cena:** `PlayScene` guarda `zoom` (estado real) e `shotWide` (recuo máximo do último
  chute); `noteKick(power)` substitui `playKickZoom` no chute normal, no Chutão e no Aimed. A
  cada frame `target = 1 - shotWide × envelope`; a velocidade escolhe abertura ou fechamento; a
  câmera recebe `setZoom(this.zoom)`. O alvo parte sempre do zoom atual, então **um chute novo
  não reinicia a câmera** — ele reusa o enquadramento e só reabre o envelope.
- **Reset:** `create()`, retry e morte voltam a `zoom = 1` e `shotWide = 0`, mantendo o shake e o
  flash da morte.
- **Sem tocar no feel:** `ratchetAt`, `followSpeed`, `maxTop` e a curva de chute continuam
  intactos; o zoom é só leitura.

Traço medido em 390×844 @2× (chute de força cheia, física real): `zoom` 1 → **0,9601** em ~1 s,
segura no ápice e começa a fechar quando a bola cruza 40% da tela na queda, chegando a 1,0 antes
da zona de toque. Sem nenhum ressalto para 1 no meio do voo.

## 2. HUD fixo

O HUD (textos, pausa, estamina, barra de consumíveis, label de build) agora vive num contêiner de
tela com **contra-escala**:

- `uiRoot` é um `Container` com `scrollFactor 0` e `depth 100`, criado no fim do `create()`;
  recolhe os objetos de tela já criados (scrollFactor 0 e depth ≥ 100) e os move para dentro.
- Os filhos passam a `scrollFactor 1` — o container é que fica preso à tela. Isso é essencial
  para o hit-test do Phaser continuar funcionando em zoom (filho com scrollFactor 0 não é
  clicável dentro do container).
- `syncFixedUi()` aplica `escala = 1/zoom` e posição `(centro × (1 - escala))`, o inverso exato
  da transformação da câmera. O texto "ALTITUDE" ficou em **(28, 24)** e o botão de pausa em
  **(502, 104)** em todas as capturas, com zoom 1, 0,96 e 0,92.
- `handlePointerDown` converte o ponteiro de mundo para a tela visual antes de testar pausa,
  consumíveis e a loja da morte: `screenX = (x − largura/2) × zoom + largura/2` e
  `screenY = (y − cameraY − altura/2) × zoom + altura/2`. Em zoom 1 é idêntico ao anterior; o
  toque na bola continua em coordenadas de mundo.
- Ficam **fora** do contêiner: mira (depth 95), auras, rastro, partículas, pop labels, o overlay
  de exaustão e a tela de morte. Nada disso deve ficar preso à tela; a mira e os labels continuam
  proporcionais ao mundo.

## 3. Moldura do campo

- Nova cor `PALETTE.stands = 0x93b3cc` — um tom abaixo do `wall` (0xa3c2d9), sem brigar com o céu
  claro aprovado.
- `drawBackdrop` pinta o **entorno** fora das paredes e abaixo da linha de morte: laterais
  `-bleed..0` e `largura..largura+bleed` na altura inteira + bleed, e a faixa inferior
  `altura..altura+bleed` na largura inteira + bleed. Em zoom 1 tudo isso fica fora da tela e o
  quadro é pixel-idêntico ao anterior.
- `BACKDROP_BLEED` subiu de **28** para **56**: cobre o stress de 8% (~24 u laterais e ~47 u
  verticais) e o entorno. O céu continua transbordando; paredes, accent, grid e linha de morte
  não mudaram de posição.
- **Topo:** o scrim ganhou uma faixa sólida de `-56` até 0 na cor do início do gradiente, para o
  zoom out não descobrir o topo. **Exaustão:** o overlay cinza passou a `altura + 2×bleed`, para
  cobrir a tela afastada. **Grid:** as linhas fracas e fortes param na linha de morte — não há
  mais grid abaixo do campo.

Amostra de pixels nas capturas: nas laterais e no fundo em 0,96 e 0,92 a cor é exatamente
`(147, 179, 204)` (`stands`); em zoom 1 a lateral é `(163, 194, 217)` (`wall`) e o fundo é a linha
de morte, como antes. Sem faixa chapada de canvas nem buraco.

## Validação

- Typecheck limpo; **214/214 testes** (16 arquivos; **+8** de `flightZoomEnvelope` e
  `smoothZoom`); build ok (`index-*.js` 1,34 MB / 371,68 kB gzip — aviso de chunk > 500 kB
  pré-existente); `git diff --check` limpo.
- Smoke E2E **13/13** em 390×844 @2×, zero `pageerror`/`console.error`. O passo da barra mede o
  zoom contínuo: **0,966 → 0,994** com **HUD ×1,036 @x −9,6** (exatamente `1/0,966` e o
  deslocamento de contra-escala); streak e Safety Net intactos.
- **Prova de hit-test no zoom:** clique na posição visual da pausa abriu a Pause e o clique no
  slot do Magnet gastou a carga, ambos com a câmera afastada.
- **Prova visual** em `/tmp/opencode/`: `camera-fix-wide.png` (voo com zoom 0,962 e HUD fixo),
  `camera-fix-normal.png` (zoom 0,999), `frame-096.png`, `frame-092.png` (stress), `frame-100.png`
  (zoom 1, pixel-idêntico), `frame-real-kick.png` (chute real), `trace-open.png` e
  `trace-close.png`.
- **CI/Pages:** run `46179287033` verde (typecheck, testes, build, smoke) e deploy concluído.
- **Live:** o JS `assets/index-Bojc41g7.js` confirma `0.9.0-mvp1`, `a737fe3`, `zoomHoldUntil` e
  `stands`; smoke live **13/13**, zoom **0,966 → 0,995**, **HUD ×1,036 @x −9,6**, zero
  `pageerror`/`console.error`.
- **Pacote:** gerado do commit de código (`GITHUB_SHA=a737fe3`); o Pages publica o commit de docs
  mais recente, então o label do site mostra o SHA dos docs. O código publicado é o mesmo do
  pacote.

## Ajuste fino

Todos os números novos são `[TESTE]`:

- `kickZoomMax` 0,04 e `kickZoomThreshold` 0,5: se no celular o afastamento passar despercebido,
  subir o máximo para **0,05–0,06** (o restante do envelope acompanha); se incomodar, baixar para
  0,03. O efeito continua contínuo em qualquer valor.
- `zoomHoldUntil` 0,40 e `zoomCloseAt` 0,72: controlam **quando** a câmera começa a fechar na
  queda. Se ela fechar tarde demais (o jogador toca antes de ver a aproximação), baixar
  `zoomCloseAt` para **0,62–0,66**; se fechar cedo demais e perder o enquadramento no ápice,
  subir `zoomHoldUntil` para 0,45.
- `zoomOpenSpeed` 4,2 e `zoomCloseSpeed` 3,6: se a abertura parecer lenta, subir para **5–6**;
  se o fechamento parecer abrupto, baixar para 3,0.
- `stands` 0x93b3cc e `BACKDROP_BLEED` 56: se a moldura ficar pesada, aproximar a cor do `wall`
  ou reduzir o bleed para 40; o bleed só precisa cobrir o zoom real (4%).
- **Observações:** o HUD é sincronizado no mesmo frame do zoom, com um frame de defasagem apenas
  nos caminhos de early return (mira/hitstop) — invisível. A mira e os labels de mundo continuam
  escalando com a câmera, de propósito. A morte reseta o zoom antes da tela de morte.
