# Fix 20 — Câmera: recuo forte no chute e volta no ápice

| | |
|---|---|
| **Data** | 28/11/2026 |
| **Build** | `0.10.0-mvp1` · F7 · `043ae2a` |
| **Pacote** | `release/keepie-uppie-v0.10.0-mvp1.zip` · 363,0 KiB · SHA-256 `7580275aacb3119e79f01ece0fcfb3adebe228c14ed4b196518b8d65898335aa` |
| **URL** | https://rigato.github.io/keepie-uppie/ |

## O pedido

> "Não ficou legal, não é exatamente isso que eu quero. Você só está reduzindo as laterais do
> campo de jogo. E todos os elementos estão ficando do mesmo tamanho, então não dá a sensação de
> que a câmera está afastando. E você também errou o tempo do... Desse zoom out e zoom in. O zoom
> out, obviamente acontece quando o chute acontece, e quanto mais forte o chute, maior é o zoom
> out, ok? Mas o zoom in acontece quando a bola chega no final no seu apogeu, no seu ponto mais
> alto e começa a cair da e volta, entendeu? Não dá para esperar a bola cair de volta para o zoom
> acontecer. E eu preciso dessa sensação de que todo o campo de jogo diminui. Então, assim, é
> menos diminuir as laterais, eu acho que isso você nem precisa fazer. Eu acho que é mais diminuir
> o tamanho de todos os elementos que estão na tela. Não sei se dá para você fazer um scale down
> de tudo ao mesmo tempo, mantendo a resolução do viewport do jogo. Mas acho que esse seria mais
> o caminho."

## O que estava errado na 0.9.0

O zoom da câmera do Phaser já escala uniformemente todos os elementos do mundo em torno do centro
da tela, mantendo a resolução do viewport — era o caminho certo. O problema era a dose e o tempo:

- **4% de recuo** (`kickZoomMax` 0.04) é imperceptível no miolo: a bola de 36 px encolhia 1,4 px. O
  único sinal visível era a parede entrando ~11 px de cada lado, exatamente a leitura de "só está
  reduzindo as laterais".
- O `flightZoomEnvelope` segurava o recuo até a bola **descer até 40% da altura da tela**
  (`zoomHoldUntil` 0.40) e só fechava até 72% (`zoomCloseAt`). A câmera voltava perto da zona de
  toque, não no ápice.
- A abertura a `zoomOpenSpeed` 4.2 levava ~0,55 s para 90%, lenta para um efeito que deveria
  acontecer "quando o chute acontece".

## A câmera da 0.10

### Amplitude

- `kickZoomMax` **0,12** (12%) no chute cheio, com a rampa existente acima de **50%** de força
  (`kickZoomThreshold` 0.5). Em 390 px de largura o campo perde ~23 px de cada lateral e a bola cai
  de 36 para ~31,7 px — o miolo também encolhe, não só as bordas.
- `BACKDROP_BLEED` **56 → 80**: o recuo de 12% expõe ~32–37 u laterais e ~74 u no topo/fundo; 80
  cobre as duas direções com folga. Em zoom 1 o quadro continua pixel-idêntico (a margem fica
  fora da tela).

### Tempo

O envelope por posição de tela saiu. Entrou uma máquina de fases pura em `src/core/camera.ts`:

- `idle` — sem chute ativo, zoom normal;
- `open` — chute forte saiu; a câmera abre e **segue aberta durante toda a subida**;
- `closing` — a bola chegou ao ápice (`vy >= 0`, quando começa a cair); o recuo volta a 1.

`advanceFlightZoom(phase, vy)` só promove `open → closing` quando `vy` cruza para `>= 0`; `closing`
**nunca** volta a `open` sozinha (um quique que devolva `vy` negativo não reabre a câmera — só um
chute novo, via `noteKick`, pode). `vy` inválido mantém a fase, sem pisco.

- `zoomOpenSpeed` **8**: 94% do recuo em ~0,35 s, fechando a abertura ainda no primeiro meio
  segundo do voo.
- `zoomCloseSpeed` **4,5**: de volta a 0,99 em ~0,6 s depois do ápice, ~0,85 s para 0,998 — o
  retorno acontece durante a queda, não perto do toque.
- O alvo parte sempre do zoom atual: um chute novo no meio de um fechamento reabre a partir de
  onde está, sem `setZoom(1)` nem tween concorrente.
- `create()` e `die()` resetam `zoom`, `shotWide` e a fase; retry não herda câmera do chute anterior.

O HUD continua no `uiRoot` com contra-escala (`1/zoom`): mesmo tamanho, mesma posição e clicável em
qualquer recuo. A mira e os labels de mundo continuam proporcionais ao mundo, de propósito.

## Prova

Traço real de um chute de força cheia (390×844 @2×, física real, amostras a cada ~40 ms):

| t | zoom | ball.y | vy | fase |
|---:|---:|---:|---:|---|
| 0,00 s | 1,000 | 700 | −2660 | open |
| 0,40 s | 0,886 | −183 | −2184 | open |
| 0,81 s | 0,880 | −974 | −1643 | open |
| 1,71 s | 0,880 | −1917 | −474 | open |
| 2,01 s | 0,880 | −1997 | −84 | open (último frame de subida) |
| 2,11 s | 0,904 | −1998 | +46 | **closing (ápice)** |
| ~2,71 s | ~0,992 | — | +900 | closing |
| 3,00 s | 0,998 | −1477 | +900 | closing |

- Máximo de recuo **0,880** em ~0,4–0,8 s; nenhum ressalto para 1 durante a subida.
- O fechamento começa no frame em que `vy` cruza zero (entre 2,01 s e 2,11 s), não na queda baixa.
- O HUD mediu `scaleX` **1,136** no recuo máximo (= 1/0,880) e voltou a 1,000 com a câmera.

Capturas em `/tmp/opencode/`: `lead-open-300.png` (zoom 0,886 com a bola subindo),
`lead-apex.png` (ápice, ainda aberto), `lead-back.png` (já fechado, bola em queda),
`dolly-wide.png`, `dolly-apex.png`, `dolly-back.png` e `dolly-zoom1.png` (mesma cena em zoom 1
para comparar o tamanho da bola: pentágono escuro 78–79 px @2× contra 88–89 px, razão ≈ 0,88).
Sem faixa chapada de canvas, sem buraco no topo/fundo e com o HUD intacto.

## Validação

- Typecheck limpo; **216/216 testes** (16 arquivos; a suíte do envelope antigo virou 7 testes da
  máquina de fases e do alvo; `kickZoomAmount`/`smoothZoom` mantidos).
- Build ok (`index-*.js` 1,34 MB / 371,66 kB gzip — aviso de chunk > 500 kB pré-existente);
  `git diff --check` limpo.
- Smoke E2E **13/13** em 390×844 @2×, zero `pageerror`/`console.error`: o passo da barra mede
  `zoom 0.883→0.998`, confirma a contra-escala do HUD e verifica que uma subida forçada sem chute
  **não** reabre o zoom.
- **CI/Pages:** run `46182678542` verde (typecheck, testes, build e smoke) e deploy concluído.
- **Live:** o JS `assets/index-CSbD2eZs.js` confirma `0.10.0-mvp1` e `043ae2a`; smoke live
  **13/13**, `zoom 0.883→0.998` (subida falsa 1.000), **HUD ×1.133 @x −35,8**, zero
  `pageerror`/`console.error`.
- **Pacote:** gerado do commit de código (`GITHUB_SHA=043ae2a`); o Pages publica o commit de docs
  mais recente, então o label do site mostra o SHA dos docs. O código publicado é o mesmo do
  pacote.

## Ajuste fino

Todos os números novos são `[TESTE]`:

- `kickZoomMax` **0,12**: se o recuo ainda passar fraco no celular, subir para **0,15**; se o campo
  ficar pequeno demais ou atrapalhar a leitura, voltar para **0,10**. A rampa de força e o resto do
  envelope acompanham.
- `zoomOpenSpeed` **8**: se a abertura parecer um soco, baixar para 6; se ainda parecer que demora
  a chegar, subir para 10.
- `zoomCloseSpeed` **4,5**: se o retorno parecer abrupto, baixar para 3,5; se a câmera demorar a
  voltar durante a queda, subir para 6.
- `kickZoomThreshold` **0,5** e `BACKDROP_BLEED` **80** mantidos; o bleed só precisa cobrir o
  recuo real.
- **Observações:** o recuo é só leitura de impacto — não altera física, mira, colisão, catraca nem
  o spawn. Um chute fraco durante um voo forte zera `shotWide` e a câmera volta suavemente; um
  quique de barreira/bumper que devolva `vy` negativo não reabre. A 0.9.0 fica substituída por
  esta nota.
