# Fix 1 — Toque generoso (jogabilidade)

| | |
|---|---|
| **Data** | 22/11/2026 |
| **Build** | `0.1.1-mvp1` · F7 |
| **Motivo** | O toque na bola estava difícil a ponto de impedir o teste das outras fases |
| **URL** | https://rigato.github.io/keepie-uppie/ |
| **Pacote** | `release/keepie-uppie-v0.1.1-mvp1.zip` · 344,5 KiB · SHA-256 `7fcc3485ad0d1daba6aadd0d52dd4902e9ccbbd7d97387838faa16f1ccfb9814` |

> **Ajuste seguinte:** a `0.1.2` reduziu o alvo de 100 para 60 u e ocultou o anel; ver [`fix2-alvo-60.md`](fix2-alvo-60.md).

## O problema

O alvo era o **círculo da bola** (raio 26) com 6 u de folga: ~46 px de diâmetro num celular de 390 px. A bola cai a 1.500–2.000 u/s e o toque humano chega com atraso; o resultado era errar por pouco, ouvir o whiff e não encadear dois chutes. Também era impossível diferenciar "errei a bola" de "toquei na bola subindo" (os dois não faziam nada).

## O que mudou

- **Área de chute = área de mira**: raio de **100 u** (~144 px de diâmetro num celular), não mais o corpo da bola. O ângulo usa essa mesma área: centro = reto, borda = ângulo máximo. Tocar longe da bola não é mais "quase acerto"; é um chute de ângulo máximo.
- **Anel de pontos** ao redor da bola, visível **só quando ela pode ser chutada**. Some enquanto a bola sobe: o jogador aprende a esperar a queda sem ler texto.
- **Bola maior** (raio 30) e **queda mais lenta** (gravidade 1700 em vez de 2000; chute 1000–2100).
- **Âncora da catraca em 40%** (antes 45%): mais tela abaixo da bola, mais tempo de reação.
- **Tolerância de ápice**: toque com a bola quase parada no topo (`vy ≥ -120`) conta; só uma subida de verdade recusa o chute.
- **Feedback de erro**: um anel vermelho curto no ponto do toque e o som de whiff; tocar na bola subindo dá um clique baixo, sem quebrar o streak.
- O primeiro saque continua com gravidade reduzida (60%).

## Como testar

1. Abra no celular. A bola cai e aparece o **anel de pontos**.
2. Toque **dentro do anel**, mesmo que não seja exatamente na bola. O chute deve sair.
3. Toque na metade esquerda/direita do anel: o ângulo abre para o lado oposto. Perto do centro: mais reto.
4. Toque com a bola subindo: o anel some e nada acontece. Espere a queda.
5. Jogue sem tentar acertar o centro: o objetivo é sentir que o jogo responde ao dedo.

## Validação

- Bot "descuidado" (erro aleatório de ±55 px na horizontal e ±40 px na vertical, a cada ~60 ms): **409 m e streak 17**, sem morrer no teste.
- Smoke E2E 7/7, sem erro de console.
- 65 testes unitários verdes (chute, ápice, hitbox generosa, câmera, save, spawners, streak, mira).
- Anel verificado: visível com `vy > 0`, oculto com a bola subindo.

## Números novos (todos em `src/game/tuning.ts`)

| Knob | Antes | Agora |
|---|---|---|
| Raio do alvo/mira | 26 + 6 de folga | **100** |
| Raio visual da bola | 26 | 30 |
| Gravidade | 2000 | **1700** |
| Chute (faixa) | 1130–2300 | **1000–2100** |
| Perfect | ±16% do raio da bola | **±22% do raio do anel** |
| Âncora da catraca | 45% | **40%** |
| Tolerância de ápice | 0 | **120 u/s** |

## Decisões

- **O ângulo agora nasce da área do anel, não do corpo da bola.** É a mudança "menos física, mais lúdica" pedida. `[CONFIRMAR]` — se o playtest achar que tirou a leitura de "tocar de lado", voltamos a normalizar pelo raio da bola mantendo o alvo grande.
- **A regra "só chuta em queda" continua.** A diferença é que o anel ensina o momento em vez de o jogador adivinhar.
- **O Perfect usa o anel** para ser alcançável com dedo (janela de ~16 px no celular), em vez dos ~4 px anteriores.

## Se ainda estiver difícil

O próximo degrau é ignorar a posição vertical do toque: qualquer toque **na coluna horizontal da bola**, com ela caindo, chuta (ângulo pela posição horizontal). Isso vira quase "toque em qualquer lugar" e é uma mudança de design maior; não fiz agora para não descaracterizar o "dedo é o pé" sem o seu aval.
