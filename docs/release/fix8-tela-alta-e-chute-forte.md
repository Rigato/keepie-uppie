# Fix 8 — A bola sobe mais na tela e o chute fundo fica muito mais forte

| | |
|---|---|
| **Data** | 24/11/2026 |
| **Build** | `0.1.8-mvp1` · F7 |
| **Pacote** | `release/keepie-uppie-v0.1.8-mvp1.zip` · 345,6 KiB · SHA-256 `3f122ef7468e8acba5111debda9cb87baa55beaeca5bc76f3228b58851c6432a` |
| **URL** | https://rigato.github.io/keepie-uppie/ |

## O pedido

> "A bola precisa conseguir ir mais alta em relação à tela. A força do chute quando da metade da tela para baixo precisa ser bem mais forte. no mínimo 30%."

## Por que os dois problemas andavam juntos

1. **A câmera escondia a altura.** A catraca acomodava a bola em **34% do topo** e o teto rígido ficava em **26%**: o pico visível do chute era 281 u, sempre o mesmo, independente da força. Chutar mais forte só acelerava o cenário; a bola não subia mais na tela.
2. **A metade de baixo não era muito mais forte.** Como o ápice acomodava em 34%, um toque no meio da tela (50%) era só **173 u abaixo do ápice** e rendia ~845 u/s — pouco acima do piso. O fundo saturava em 1550 u/s, mas o meio ainda parecia fraco.

## O que mudou

### 1. A câmera sobe ~130 u: pico em 14%, acomodação em 22%

| Linha da câmera | Antes | Agora |
|---|---:|---:|
| `ratchetAt` (onde a bola acomoda) | 34% · 367 u | **22% · 238 u** |
| `maxTop` (teto rígido do pico) | 26% · 281 u | **14% · 151 u** |

O pico visível do chute subiu **130 u (12% da tela)**. Num celular 390×844 (canvas 390×780), o centro da bola no pico passou de ~203 px para ~109 px a partir do topo do canvas — 94 px mais alto. A folga de subida visível continua a mesma (~86–87 u entre acomodação e teto), então a leitura da subida não mudou: só o ápice inteiro foi para cima.

- O **scrim do topo** (gradiente do HUD) passou para **depth 8**, abaixo da bola (10), do rastro e do anel. Ele continua apagando obstáculos/interativos atrás do HUD, mas não escurece mais a bola no pico. O HUD segue acima (depth 100).
- No pico, a bola ocupa 121–181 u; o HUD termina em ~104 u. A bola não encosta no placar; o topo dela fica 17 u abaixo do "BEST". O ícone de pausa (centro em 104) só pode ser tangenciado no extremo direito por ~1 u, e fica por cima da bola.

### 2. A força: metade de baixo no mínimo +30%

| Parâmetro | Antes (0.1.7) | Agora |
|---|---:|---:|
| `minSpeed` (ápice) | 500 | **500** |
| `maxSpeed` (queda cheia) | 1550 | **2200** |
| `fullPowerDrop` | 640 u | **850 u** |
| `powerCurve` | 0.85 | **0.7** |
| Perfect | +60 u/s | **+60 u/s** |

A curva nova, medida na **mesma posição de tela** (toque fora da janela central, sem o +60 do perfect):

Posições de tela arredondadas (referência: 1080 u de altura). A 0.1.8 ainda não tinha o segundo estágio do fundo (ver `fix9-fundo-mais-forte.md`).

| Toque na tela | Antes: queda → força | Agora: queda → força | Ganho |
|---|---:|---:|---:|
| 50% (meio) | 173 u → 845 u/s | 302 u → 1325 u/s | **+57%** |
| 56% | 233 u → 945 u/s | 362 u → 1436 u/s | **+52%** |
| 65% | 333 u → 1102 u/s | 462 u → 1610 u/s | **+46%** |
| 74% | 433 u → 1253 u/s | 562 u → 1773 u/s | **+42%** |
| 83% | 533 u → 1398 u/s | 662 u → 1928 u/s | **+38%** |
| 93% | 633 u → 1540 u/s | 762 u → 2075 u/s | **+35%** |
| 100% (fundo) | 713 u → 1550 u/s | 842 u → 2189 u/s | **+41%** |

O pior caso da metade de baixo é **+35%** aos 93% da tela; no fundo absoluto (100%), +41%. No meio é +57%. Com o perfect, os dois lados somam +60 u/s; o ganho no pior ponto fica em +33% e no meio em +53% — ainda acima dos 30% pedidos.

- O ápice continua um pulinho: 500 u/s, ~0,77 s de arco, ~5 m de ganho.
- A queda cheia agora dá 2200 u/s (2260 no centro), ~3,5 s de arco e ~98 m de subida. É o "grande golpe" da run.
- A câmera em 22% faz a mesma tela corresponder a uma queda maior: no meio da tela a bola já caiu 302 u, não 173 u. O teto de velocidade de queda (900 u/s) não limita a força, porque a força usa a **distância** caída.

### 3. Números que acompanharam a faixa nova

| Item | Antes | Agora | Por quê |
|---|---:|---:|---|
| Breakable (romper) | 1350 u/s | **1800 u/s** | Mantém a exigência de um toque fundo (tela ~82%) em vez de romper já no meio com a curva mais forte. |
| Mola | 2320 u/s | **2450 u/s** | Continua sendo um boost acima do chute máximo (1965 u de altura contra 2309 u da mola). |
| Aimed Shot (máx.) | 2200 u/s | **2500 u/s** | O tiro mirado continua sendo o golpe mais forte do jogo (2404 u) e não fica abaixo de um chute normal no fundo. |

### 4. Documentos

- GDD: pilar 2, §3.1 (força/banda), §3.3 (câmera/ápice) atualizados; a banda agora é ~0,8 s no ápice a ~3,5 s na queda cheia.
- Playtest: build 0.1.8, aviso da altura nova (~14% do topo) e da metade de baixo 30%+.
- README, readme executivo e banner do handoff apontam para esta nota.

## Como testar

1. Recarregue forçado e confira o rodapé: **`F7 · 0.1.8-mvp1 · <sha>`**.
2. Toque no **ápice**: pulinho curto (~5–6 m), como antes.
3. Deixe a bola cair até a **metade** da tela e toque: o chute já deve parecer bem mais forte que na 0.1.7 (~24 m de subida).
4. Deixe cair até o **fundo** (sem morrer) e toque: o grande golpe, ~3,4 s de voo e ~90–98 m. A bola deve subir até perto do topo (14%), passar ao lado do HUD e não sumir atrás do gradiente.
5. Confira o pós-ápice: a câmera acomoda a bola em ~22% e ela começa a cair de lá. O pico de 14% é rápido; o repouso é 22%.
6. Confira os **breakables**: agora só rompem com toque fundo (força ≥1800, tela ~82% para baixo). Um toque no meio deve desviar.
7. Confira a **mola** e o **Aimed Shot**: devem continuar claramente mais fortes que um chute normal.

## Validação

- **72 testes** (8 arquivos) verdes; typecheck limpo. Novos testes: piso de +30% da metade de baixo contra a curva da 0.1.7 e a força máxima alcançável antes da linha de morte.
- **Smoke E2E 7/7** (390×844), sem erro de console. O chute do caminho crítico saiu de `vy 308 → -756 u/s`; morte → save → retry continua passando.
- **Toques reais** (mouse via CDP, câmera e ápice reais, obstáculos desligados):
  - meio da tela (541) → 1419 u/s, pico de tela 151 (14%), 38 m;
  - fundo (1011) → 2177 u/s, pico 151 (14%), 90 m;
  - ápice (257) → 749 u/s, pico 176 (16%), 10 m.
- **Screenshot do pico congelado**: bola em 151 u (14,0%), 45 m no HUD, chute de 2198 u/s.
- **Desktop 1280×720** sem regressão visual.
- Pacote validado: 3 arquivos, 1.255,9 KiB descompactado, **345,6 KiB** zipado, maior path 25, SHA-256 `3f122ef7…`.

## `[CONFIRMAR]` — pendente do seu teste

- **Pico 14% / acomodação 22%**: a bola fica alta o bastante? Se ainda quiser mais, o próximo passo é `maxTop` 12% e `ratchetAt` 20%; o limite é o HUD (~104 u) e o ícone de pausa.
- **2200 u/s / 850 u de queda / curva 0.7**: o fundo virou o grande golpe sem ficar lento demais? Se o arco de ~3,5 s arrastar, baixar `maxSpeed` para ~2050 (ainda +32% no fundo); se o meio ainda parecer fraco, baixar `powerCurve` para 0.65.
- **Banda 0,8–3,5 s**: o piso do GDD era 1,5 s e o teto 2,5 s; a direção atual estica o teto. Confirmar no dedo se o voo longo do fundo é gostoso ou cansativo.
- **Breakable 1800 / mola 2450 / Aimed 2500**: recalibrados para preservar as intenções com a faixa nova; confirmar se o breakable ainda vale a busca e se a mola/aim ainda parecem um upgrade.
- **Perfect +60**: agora é 2,7% da faixa nova; no fundo é quase irrelevante. Se o perfect precisar de mais peso, o próximo número é 100–120 u/s.
