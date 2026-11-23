# Fix 4 — Queda mais lenta, toque generoso e chute sem punir o ápice

| | |
|---|---|
| **Data** | 23/11/2026 |
| **Build** | `0.1.4-mvp1` · F7 |
| **Pacote** | `release/keepie-uppie-v0.1.4-mvp1.zip` · 344,9 KiB · SHA-256 `4bed1af766f333708542e60fa90c4b27c1c473141f6fc1255222412b7e1c90e8` |
| **URL** | https://rigato.github.io/keepie-uppie/ |

## O problema relatado

> "Está difícil de jogar ainda. A bola vai acelerando conforme cai, então deixar a bola cair não é vantajoso. Acompanhar com o dedo a bola subir e tocar quando ela para de subir virou a única estratégia — o jogo ficou limitado na parte de cima da tela. Não consigo nem tentar mirar: só sobreviver."

O diagnóstico técnico bateu com a sensação:

1. **A queda ia até 2600 u/s.** A 60 fps isso é ~31 px por frame no celular. O alvo de 60 u ficava dentro do caminho da bola por ~3 frames (46 ms). Não é um problema de mira, é uma janela impossível.
2. **A força dependia demais da queda.** Tocar no ápice dava 1000 u/s de chute (arco de 1,18 s e só 27% de ápice). Para ter força, o jogador precisava deixar a bola cair — exatamente quando ela ficava impossível de acertar. Daí o loop "seguir a bola até o topo e tocar no ápice".
3. **O ápice ficava a 14% do topo**, dentro do scrim do HUD (170 u). A bola subia para debaixo do placar.

## O que mudou

### 1. A bola cai mais devagar e para de acelerar

| Parâmetro | Antes | Agora |
|---|---|---|
| Gravidade | 1700 u/s² | **1300 u/s²** |
| Queda máxima | 2600 u/s | **900 u/s** |
| Tempo dentro do alvo, na queda máxima | ~46 ms (~3 frames) | **167 ms (~10 frames)** |

A bola ainda acelera, mas só até 900 u/s (atingido em ~0,7 s). Depois cai em velocidade constante. O teto é o que devolve tempo de leitura e de toque no celular.

### 2. O chute no ápice não é mais punido

| Parâmetro | Antes | Agora |
|---|---|---|
| Força base | 950 | **1100** |
| Bônus por velocidade de queda | 0,5 | **0,4** |
| Piso | 1000 | **1100** |
| Teto normal / Perfect | 2100 | **1550** |

O bônus por deixar cair continua existindo, mas foi comprimido: no ápice o chute já sai com 1100 u/s; na queda máxima, 1460 u/s (+33%). A diferença é um tempero, não uma obrigação.

| Situação | Arco | Ápice acima do toque |
|---|---|---|
| Toque no ápice (vy = 0) | **1,69 s** | 465 u (43% da tela) |
| Queda máxima (vy = 900) | **2,25 s** | 820 u (76% da tela) |
| Perfect | **2,38 s** | 924 u (86% da tela) |

### 3. Acertar a bola ficou mais generoso sem afrouxar a mira

| Parâmetro | Antes | Agora |
|---|---|---|
| Área de toque | 60 u | **75 u** |
| Área que define o ângulo | 60 u | **60 u (separada)** |
| Anel de tuning (`?ring=1`) | 60 u | 75 u (área real de toque) |
| Buffer de toque no ápice | — | **160 ms** |

- A área de toque cresceu ~56% em área; o jogador pode tocar um pouco fora da bola sem perder o chute.
- O ângulo continua calibrado em 60 u: a mira não ficou mais escorregadia. A faixa de 60–75 u simplesmente satura no ângulo máximo.
- Um toque que chega até 160 ms antes do ápice fica guardado e dispara no instante em que a bola fica chutável, em vez de virar whiff.

### 4. A câmera deixa o ápice abaixo do HUD

| Parâmetro | Antes | Agora |
|---|---|---|
| Espera da catraca | 20% do topo | **34%** |
| Teto da bola | 14% do topo (151 px) | **26% (281 u)** |

O ápice agora fica abaixo do scrim do HUD (170 u) e sobra espaço de leitura acima da bola. A subida continua visível: a câmera só começa a seguir depois de 34%.

### 5. Números que precisaram acompanhar a nova física

| Item | Antes | Agora | Por quê |
|---|---|---|---|
| Breakable (romper) | 1400 u/s | **1350 u/s** | A faixa de chute caiu; a barra continua rompendo em chute forte |
| Mola | 2650 u/s | **2320 u/s** | Mantém o mesmo ápice com a gravidade nova |
| Aimed Shot (min–max) | 1300–2650 | **1200–2200** | Mantém o tiro poderoso com um voo controlado sob a gravidade nova |

## Como testar

1. Recarregue forçado no celular e confira o rodapé: **`F7 · 0.1.4-mvp1 · <sha>`**.
2. Jogue 3 runs sem pensar em mirar. A pergunta principal: **acertar a bola deixou de ser o problema?**
3. Alterne de propósito:
   - toque no ápice, quando a bola para de subir;
   - deixe a bola cair até o meio/baixo e toque nela em queda.
   Compare o tamanho do arco e diga qual dos dois parece mais gostoso.
4. Tente mirar: toque na esquerda e na direita da bola (não só no centro). O alvo é maior que a área do ângulo — a mira deve continuar respondendo, mas sem exigir precisão de pixel.
5. Julgue o "flutuante": a queda ficou lenta demais, boba? O arco ficou curto demais? O topo ainda parece o único lugar jogável?
6. `?ring=1` mostra a área de toque de 75 u; `?debug=1` mostra `KICK arc/power`, posição e streak.

## Validação

- **70 testes unitários** verdes (8 arquivos), incluindo novos testes de arco no ápice, bônus de queda, área de toque vs. área de ângulo e janela de toque na queda máxima.
- **Smoke E2E 7/7** (boot → título → chute → morte → save → retry), sem erro de console.
- `typecheck` e `build` limpos.
- Pacote validado: 3 arquivos, 1,25 MB descompactado, **344,9 KiB** zipado, maior path 25, SHA-256 `4bed1af7…`.

## `[CONFIRMAR]` — decisões de feel pendentes do seu teste

- **75 u de toque + 60 u de ângulo** é o ponto? Se ainda errar, o próximo passo é subir só o toque (80–85), não o ângulo.
- **Gravidade 1300 / queda máxima 900** deixou a bola flutuante demais? O knob é `maxFallSpeed` (900 → 1000) antes de mexer na gravidade.
- **Buffer de 160 ms** parece que o jogo "joga sozinho"? Reduzir ou remover é uma linha em `tuning.ts`.
- **Câmera 34% / 26%**: se o ápice ainda parecer preso no topo, o próximo knob é `maxTop` (26% → 30%); se a subida sumir, voltar para 22%.
- O **hard de 100 u** não mudou nesta rodada; a queda mais lenta deve dar mais tempo de recuperação. Se ainda gerar derrota automática, o próximo ajuste é o corredor de spawn acima da bola.
