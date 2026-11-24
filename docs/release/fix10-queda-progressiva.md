# Fix 10 — Queda progressiva: +75 u/s a cada 500 m, com teto jogável

| | |
|---|---|
| **Data** | 24/11/2026 |
| **Build** | `0.2.0-mvp1` · F7 |
| **Pacote** | `release/keepie-uppie-v0.2.0-mvp1.zip` · 346,0 KiB · SHA-256 `c860545a4e4bde88a681ffbe0c752cd209fbb51d89a325572b8658f1733e99a0` |
| **URL** | https://rigato.github.io/keepie-uppie/ |

## O pedido

> "Agora temos que começar a dificultar a vida do jogador. Suavemente aumentando a velocidade de queda, mas com um limite aceitavel para manter jogável. E fazer isso a cada X metros. Pensei a cada 500m."

## O que muda

O teto de queda (`physics.maxFallSpeed`, 900 u/s desde a 0.1.4) deixa de ser fixo: a cada **500 m de altitude de pico** ele sobe **75 u/s**, até o limite de **1200 u/s**.

| Altitude de pico | Estágio | Teto de queda | Janela de toque |
|---|---:|---:|---:|
| 0–499 m | 0 | 900 u/s | 167 ms |
| 500–999 m | 1 | 975 u/s | 154 ms |
| 1000–1499 m | 2 | 1050 u/s | 143 ms |
| 1500–1999 m | 3 | 1125 u/s | 133 ms |
| 2000 m+ | 4+ | 1200 u/s | 125 ms |

A "janela de toque" é o tempo que a bola leva para cruzar o diâmetro do alvo generoso (150 u) na velocidade máxima. A 0.1.4 fixou 900 u/s justamente para essa janela não virar sorte; 1200 mantém **~7 frames a 60 fps**, contra ~10 na base. A 0.1.3, com 2600 u/s, a janela era de ~3 frames — o limite novo está longe daquele problema.

## Por que 500 m, 75 u/s e 1200 u/s

- **500 m** é o passo pedido. Uma embaixadinha de fundo cheia já rende ~110–130 m de altitude, então o primeiro degrau aparece depois de ~5–10 chutes bons, não de uma run inteira. O quarto degrau (1200) fica em 2000 m, território de run longa.
- **75 u/s** é ~8% por degrau: perceptível ao longo de duas ou três subidas, sem parecer que o jogo trocou de regra no meio da run. A velocidade acumulada no topo é +33%.
- **1200 u/s** é o teto de segurança. Cada degrau encolhe a janela em ~11 ms; no limite ela ainda tem 125 ms. Subir mais (1300+) começa a encostar na latência de toque de celular.

## O que NÃO muda

- A curva do chute (`kick.ts`) e o segundo estágio do fundo (0.1.9) ficam intactos: **o mesmo toque na mesma posição da tela rende a mesma força**. O que encolhe é o tempo para decidir e tocar.
- A câmera, o spawn, a mistura de obstáculos, breakables, molas e Aimed Shot continuam iguais.
- O placar e o best não mudam; a queda progressiva reseta a cada run (o estágio é o pico daquela run, não o best).

## Como o jogador percebe

Quando o pico da run cruza 500, 1000, 1500 ou 2000 m, aparece **`FASTER FALLS`** no topo da tela por ~1,2 s. O aviso é só informativo: não pausa, não mexe na bola. Depois do limite, não há mais avisos — o ritmo estabiliza em 1200.

O overlay `?debug=1` ganhou a linha **`PACE`** com o estágio e o limite atual, para conferir o degrau sem esperar a sorte da run.

## Validação

- **82 testes** (9 arquivos) verdes; typecheck limpo. Novos testes de `core/difficulty.ts`: o degrau começa exatamente aos 500 m, sobe um por estágio, satura em 1200, nunca diminui, não quebra com entrada inválida, fecha em degraus inteiros e mantém a janela ≥ 0,12 s.
- **Smoke E2E 7/7** (390×844), sem erro de console.
- **Bancada determinística no browser** (câmera e queda reais, obstáculos desligados): 0 m → 900; 499 m → 900; 500 m → 975; 1000 m → 1050; 1500 m → 1125; 2000 m → 1200; 4000 m → 1200. O `vy` de queda foi clampado no valor do estágio em todos os pontos, e o aviso apareceu na subida de 500 m.
- **Retry:** depois de subir para 975 e reiniciar, o teto volta a 900 e o estágio a 0.
- **Captura 390×844** do aviso `FASTER FALLS` no topo, abaixo do streak e longe da bola.
- Pacote validado: 3 arquivos, 1.257,4 KiB descompactado, **346,0 KiB** zipado, maior path 25.

## `[CONFIRMAR]` — pendente do seu teste

- **Passo de 500 m**: o primeiro degrau chega na hora certa? Se a maioria das runs morrer antes e você nunca sentir o ritmo subir, o próximo número é `stageMeters` 250–300; se quiser que o jogo "acorde" mais tarde, 750.
- **Degrau de 75 u/s**: no celular, a diferença de 500 para 1000 m é perceptível? Se ainda parecer o mesmo jogo, subir para 100 u/s por degrau; se o primeiro degrau assustar, 50.
- **Teto de 1200 u/s**: a janela de 125 ms continua confortável? Se o toque passar a falhar por reflexo (não por leitura), baixar para 1100 (143 ms) — e o número de degraus cai junto.
- **Aviso `FASTER FALLS`**: texto, posição e duração funcionam? Faz falta um som curto de "vento" ou o aviso visual basta? (O áudio entra depois da rodada de tema; por ora é silencioso.)
- **Queda progressiva vs. obstáculos**: o ritmo mais rápido soma com a densidade crescente de obstáculos (que já saturava em 1200 m). A dificuldade composta fica justa ou empilha demais no fim da run?

## Como testar

1. Recarregue forçado e confirme no rodapé: **`F7 · 0.2.0-mvp1 · <sha>`**.
2. Jogue até passar de **500 m**: deve aparecer `FASTER FALLS` e a queda fica um pouco mais rápida.
3. Continue até **1000, 1500 e 2000 m**: cada cruzamento sobe mais um degrau; depois de 2000 m não há mais aviso.
4. Morra e recomece: o ritmo volta ao normal (900) desde o primeiro chute.
5. Com `?debug=1`, confira a linha `PACE` acompanhando o estágio e o limite.
