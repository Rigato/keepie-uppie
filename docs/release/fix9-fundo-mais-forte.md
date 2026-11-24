# Fix 9 — Segundo estágio no fundo: o ganho volta a crescer de 80% para baixo

| | |
|---|---|
| **Data** | 24/11/2026 |
| **Build** | `0.1.9-mvp1` · F7 |
| **Pacote** | `release/keepie-uppie-v0.1.9-mvp1.zip` · 345,7 KiB · SHA-256 `142827e49f2ff00d0b2de37dc03a41886a709a25262f7fef05400a6215aeddfd` |
| **URL** | https://rigato.github.io/keepie-uppie/ |

## O pedido

> "ficou beeeem melhor. Acho qsó que você foi reduzindo o ganho marginal quanto mais embaixo da tela e isso da a sensação de normalizar e não dar muita vantagem deixar cair muito mais do que 60-70%. Então acho que de 80% pra baixo podemos dar outro boost de força."

## O diagnóstico

A curva da 0.1.8 era **côncava** (`r^0.7`) e saturava em `fullPowerDrop` 850 u. Na prática:

1. Cada trecho de 5% da tela rendia **menos** que o anterior: 60→65 +92 u/s, 70→75 +86, 75→80 +84. Abaixo de 80% a curva-base continuava rendendo cada vez menos (82, 80, 78, 76 u/s por 5%) até zerar em 100,7% da tela.
2. O ganho contra a 0.1.7 caía de +57% no meio para +35% aos 93% — o fundo parecia "normalizado" justamente porque a parte de baixo era a que menos mudava por trecho.

O pedido está certo: faltava um **segundo estágio** no fundo, não mais um ajuste na curva inteira.

## O que mudou

Até 80% da tela, **nada muda** — a faixa que você aprovou na 0.1.8 fica intacta. De 80% até a linha de morte entra um boost com **ganho marginal crescente**.

| Parâmetro | 0.1.8 | 0.1.9 |
|---|---:|---:|
| `minSpeed` | 500 | **500** |
| `maxSpeed` (teto da curva-base) | 2200 | **2200** |
| `fullPowerDrop` | 850 u | **850 u** |
| `powerCurve` | 0.7 | **0.7** |
| `deepStartDrop` | — | **626 u** (80% da tela) |
| `deepFullDrop` | — | **872 u** (linha de morte) |
| `deepBonus` | — | **+400 u/s** por cima da curva-base |
| `deepPowerCurve` | — | **1.3** (>1 = ganho cresce) |
| Perfect | +60 u/s | **+60 u/s** |

A conta do fundo é `base + 400 * ((queda - 626) / 246)^1.3`. O expoente >1 é o que inverte a sensação: em vez de cada trecho render menos, rende mais.

## Números (toque fora da janela do perfect)

| Tela | Queda | 0.1.8 | 0.1.9 | Ganho | Subida 0.1.9 | Arco |
|---|---:|---:|---:|---:|---:|---:|
| 50% | 302 u | 1325 u/s | 1325 u/s | 0% | 33,8 m | 2,04 s |
| 60% | 410 u | 1521 u/s | 1521 u/s | 0% | 44,5 m | 2,34 s |
| 70% | 518 u | 1703 u/s | 1703 u/s | 0% | 55,8 m | 2,62 s |
| 80% | 626 u | 1873 u/s | 1873 u/s | 0% | 67,5 m | 2,88 s |
| 85% | 680 u | 1955 u/s | **2011 u/s** | **+2,9%** | 77,8 m | 3,09 s |
| 90% | 734 u | 2035 u/s | **2172 u/s** | **+6,8%** | 90,8 m | 3,34 s |
| 95% | 788 u | 2113 u/s | **2346 u/s** | **+11,0%** | 105,8 m | 3,61 s |
| 100% | 842 u | 2189 u/s | **2528 u/s** | **+15,5%** | 122,9 m | 3,89 s |
| 102,8% (morte) | 872 u | 2200 u/s | **2600 u/s** | **+18,2%** | 130,0 m | 4,00 s |

O ganho marginal por 5% de tela, que antes caía, agora sobe:

| Trecho | 0.1.8 | 0.1.9 |
|---|---:|---:|
| 75→80% | +84 u/s | +84 u/s |
| 80→85% | +82 u/s | **+138 u/s** |
| 85→90% | +80 u/s | **+161 u/s** |
| 90→95% | +78 u/s | **+173 u/s** |
| 95→100% | +76 u/s | **+182 u/s** |

Em altura (o que o jogador vê no contador) cada 5% do fundo passa a render **+206, +260, +301 e +341 u** — 10 a 17 m por trecho, contra ~6 m antes. O fundo absoluto com perfect chega a **2660 u/s / 136 m**.

- Acima de 80% a curva é bit a bit a mesma: o meio da tela continua com +57% sobre a 0.1.7, e o ápice continua um pulinho de 500 u/s.
- O boost é contínuo no início (a fração é 0 em 80%) e satura em `deepFullDrop`, que fica na linha de morte (872 u de queda útil).
- O `power` que alimenta som, shake e squash agora normaliza pela faixa real (2200 + 400). Antes ele batia em 100% no fim da curva-base e o fundo não ganhava feedback; agora o feedback continua crescendo no segundo estágio.

## Números que acompanharam

| Item | 0.1.8 | 0.1.9 | Por quê |
|---|---:|---:|---|
| Breakable (romper) | 1800 u/s | **1800 u/s** | A curva-base já chega a 1800 aos ~76% da tela; o boost só entra depois. Continua exigindo um toque fundo. |
| Mola | 2450 u/s | **2850 u/s** | Continua acima do chute máximo (2660 com perfect) — +7,1% de velocidade. |
| Aimed Shot (máx.) | 2500 u/s | **3000 u/s** | Continua sendo o golpe mais forte do jogo — +12,8% sobre o fundo perfeito. |

## Documentos

- GDD: pilar 2 e §3.1 (força/banda) atualizados; a banda agora é ~0,8 s no ápice a ~4,0 s na queda cheia.
- Playtest: build 0.1.9 e aviso do segundo estágio de 80% para baixo.
- README, readme executivo e banner do handoff apontam para esta nota.
- A tabela da nota da 0.1.8 (`fix8`) teve as posições de tela corrigidas para porcentagens reais de 1080 u (a versão anterior rotulava 600/700/… como 60%/70%, quando são 55,6%/64,8%). Os valores de força não mudaram.

## Como testar

1. Recarregue forçado e confira o rodapé: **`F7 · 0.1.9-mvp1 · <sha>`**.
2. **Acima de 80%:** deve estar igual à 0.1.8 — mesmo meio, mesmo ápice, mesmo arco.
3. **80% → fundo:** cada trecho deve parecer que vale mais que o anterior. Aos 90% o chute já passa de 2170 u/s; no fundo visível, ~2530 u/s e ~123 m.
4. **Fundo absoluto:** se conseguir tocar nos últimos instantes antes da morte, ~2600 u/s, ~130 m e arco de 4 s. A bola volta a subir até o pico de 14% (agora com muito mais metros no HUD).
5. **Perfect:** no fundo soma +60 u/s; confira se ainda vale a pena mirar o centro.
6. **Breakable:** deve continuar exigindo um toque fundo (≥1800, ~76% da tela para baixo). O boost novo não deve romper no meio.
7. **Mola e Aimed:** devem continuar claramente acima de um chute normal, mesmo no fundo.
8. **Leitura:** o trecho de 80% até a morte passa em ~0,27 s na velocidade máxima de queda. Confira se o boost é legível e parece skill, ou se virou loteria.

## Validação

- **75 testes** (8 arquivos) verdes; typecheck limpo. Novos testes: o boost começa exatamente aos 80% e preserva a curva aprovada; o ganho marginal cresce em velocidade e em altura; o `power` chega a 100% no fundo útil; a força máxima é alcançável antes da linha de morte.
- **Smoke E2E 7/7** (390×844), sem erro de console. O chute do caminho crítico continua `vy 306 → -754 u/s`.
- **Toques determinísticos** (câmera em 22%, queda real, offset 24 = não-perfect): a tabela acima, de 50% a 100% da tela.
- **Toque real no fundo** (mouse via CDP, obstáculos desligados): **2415 u/s**, arco **3,72 s**, pico de tela **151 u (14%)**, 111 m ao final; screenshot do pico com a bola inteira abaixo do HUD.
- **Desktop 1280×720** sem regressão visual.
- Pacote validado: 3 arquivos, 1.256,2 KiB descompactado, **345,7 KiB** zipado, maior path 25, SHA-256 `142827e4…`.

## `[CONFIRMAR]` — pendente do seu teste

- **Janela do fundo (80% → morte, ~0,27 s)**: o boost é legível? Se parecer loteria, o próximo passo é começar antes (`deepStartDrop` 590, ~77% da tela) ou reduzir a velocidade de queda; se parecer fácil demais, começar depois (660, ~83%).
- **400 u/s / curva 1.3**: o fundo virou o grande golpe? Se ainda normalizar, subir para 450–500; se o salto do meio para o fundo ficar exagerado, 300–350 ou curva 1.2.
- **Arco de ~3,9–4,1 s no fundo**: gostoso ou cansativo? Se arrastar, o primeiro trade-off é baixar `deepBonus` (o arco cai junto) antes de mexer na câmera.
- **Mola 2850 / Aimed 3000**: confirmar se continuam sendo upgrades claros e se o tiro mirado não ficou absurdamente alto (~173 m).
- **Perfect +60**: agora é 2,3% do fundo; se o centro precisar de mais peso, o próximo número é 100–120 u/s.
