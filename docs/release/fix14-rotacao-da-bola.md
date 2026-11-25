# Fix 14 — Rotação livre da bola

| | |
|---|---|
| **Data** | 25/11/2026 |
| **Build** | `0.4.1-mvp1` · F7 · `440cc34` |
| **Pacote** | `release/keepie-uppie-v0.4.1-mvp1.zip` · 358,5 KiB · SHA-256 `48ad89f98f57ca3002484cb6a61460535da3e21fa60866dbcce28f2bdbabb592` |
| **URL** | https://rigato.github.io/keepie-uppie/ |

## O pedido

> "quero que a bola tenha rotação livre pois está fixa."

## O que mudou

A bola agora gira durante a run e no título. **Nada de física mudou**: posição, velocidade, colisão, trajetória, hitboxes, câmera e HUD são os mesmos.

A textura da bola foi separada em três camadas alinhadas:

| Camada | Conteúdo | Gira? |
|---|---|---|
| Corpo | gradiente radial da esfera | não |
| **Padrão** | 12 pentágonos, 20 hexágonos e costuras | **sim** |
| Acabamento | sombra, vinheta, brilho e contorno | não |

Só o padrão gira. O brilho e a sombra ficam no lugar, então a bola não parece um adesivo girando; o squash/stretch do chute continua no container externo, sem tocar nessa rotação. A textura em cache passou para `v2` (base, pattern, top por raio).

## Modelo de rotação

- **Rolagem:** `ω = clamp((vx / raio) × 0,42, ±18 rad/s)`. Bola indo para a direita gira no sentido horário (positivo no Phaser); na parede o `vx` inverte e o giro acompanha no frame seguinte.
- **Giro do chute:** `ω = 5,5 × força × (offset − 0,65 × (1 − |offset|))` rad/s, somado à rolagem e decaindo exponencialmente (`e^(−0,8·dt)`). Toque central sai em backspin; toque lateral soma no sentido do lado tocado.
- **Aimed Shot:** o offset vem da direção do tiro (`−dir.x / maxLateral`) e a força do `ratio`; o residual usa a mesma fórmula.
- **Título:** a bola decorativa gira a `0,4 rad/s` (~16 s por volta), com o brilho parado.
- **Retry:** ângulo, residual e rotação do padrão voltam a zero.

A lógica pura vive em `src/core/ball-spin.ts`, com 21 testes em `tests/ball-spin.test.ts` (rolagem, backspin, lateral, decaimento, normalização e guardas contra NaN/∞).

## Knobs (`src/game/tuning.ts`, todos `[TESTE]`)

| Knob | Valor | Papel |
|---|---:|---|
| `ball.spinRollFactor` | 0,42 | rolagem por `vx`; ~1,5 volta/s num chute lateral médio |
| `ball.spinMax` | 18 rad/s | teto da rolagem (~2,9 voltas/s) |
| `ball.spinKick` | 5,5 rad/s | giro residual a força cheia |
| `ball.spinBackspin` | 0,65 | peso do backspin no toque central |
| `ball.spinDamping` | 0,8 /s | decaimento exponencial do residual |
| `ball.titleSpin` | 0,4 rad/s | giro decorativo do título |

## Validação

- Typecheck limpo; **142/142 testes** (121 anteriores + 21 novos); build ok.
- Smoke E2E **11/11**: o passo novo **"Bola: padrão gira e acabamento fica parado"** mede `vx > 0` (rotação cresce), `vx < 0` (decresce) e confirma que container externo, glow e marcador de Ponto Doce continuam em `rotation = 0`. Zero erro de console.
- Medições em browser (390×844 @2×): chute lateral direito `vx ≈ +745` → 0,44 → 2,09 rad em ~235 ms (≈1,1 volta/s); esquerdo `vx ≈ −745` → −0,51 → −1,37 (≈1,6 volta/s); central (offset 0) → backspin −3,31 rad/s; parede `+900 → −720` inverte o sinal do giro; Aimed `vx +1666` com residual −3,46 (bate com a fórmula); título 0,4 rad/s; retry zera tudo.
- Prova visual em `/tmp/opencode/keepie-spin-*.png`: sequência de 4 frames em voo, recorte 4× com padrão nítido e comparação lado a lado mostrando o brilho no mesmo lugar.

## Ressalvas

- O sombreamento por face é cozido na textura do padrão e gira com ele; a iluminação global (rim/shine/sombra) é estática por cima. Nos testes visuais o resultado lê bem.
- Os dois primeiros frames após um chute mostram a bola levemente oval: é o squash/stretch pré-existente do chute, agora com o padrão girando dentro.
- O residual lateral é assimétrico por construção (backspin central + componente do lado tocado); as taxas ficam no alvo de ~1–2 voltas/s e convergem para a rolagem pura conforme o residual decai.
- A rotação é só visual: não altera a física nem a jogabilidade.
- O pacote foi gerado no commit de código `440cc34`; o Pages publica o commit de docs mais recente, então o label do site mostra esse SHA. O código é o mesmo.
