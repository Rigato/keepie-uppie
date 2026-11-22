# Fix 2 — Alvo de 60 u e anel oculto

| | |
|---|---|
| **Data** | 22/11/2026 |
| **Build** | `0.1.2-mvp1` · F7 |
| **Pacote** | `release/keepie-uppie-v0.1.2-mvp1.zip` · 344,6 KiB · SHA-256 `6f871b19cf6fc589dfabd02b4bd7b11a8e625622b8265455582b4ff506e14789` |
| **URL** | https://rigato.github.io/keepie-uppie/ |

> **Ajuste seguinte:** a `0.1.3` reduziu os elementos em 20%, estreitou o hard e deu folga à câmera; ver [`fix3-elementos-camera.md`](fix3-elementos-camera.md).

## O que mudou

- **Raio do alvo/mira: 100 → 60 u** (−40%). O alvo agora tem ~87 px de diâmetro num celular de 390 px, contra 144 px antes.
- **O anel de pontos fica oculto por padrão.** Ele era uma ferramenta de leitura para o primeiro ajuste; a build publicável não mostra a área de chute.
- **Toggle de tuning:** `?ring=1` liga o anel (pontos na borda do alvo de 60 u). Sem o parâmetro, nenhum ponto é criado.
- O resto da correção anterior permanece: queda mais lenta, bola raio 30, tolerância de ápice, catraca em 40%, feedback de whiff.

## Como testar

1. Abra na URL normal: a bola cai **sem** anel. Toque perto dela (até ~2× o raio visual).
2. Sinta o equilíbrio: deve ser mais difícil que a `0.1.1`, mas ainda possível encadear.
3. Para ver o alvo: `?ring=1`. O anel de 60 u aparece só enquanto a bola pode ser chutada.
4. `?debug=1` mostra `KICK arc/power` para conferir se o chute saiu como você esperava.

## Validação

- 66 testes unitários verdes (inclui borda do alvo de 60 e rejeição em 70).
- Smoke E2E 7/7, sem erro de console.
- Bot "descuidado" (erro de ±30 px na horizontal e ±25 px na vertical): **438 m e streak 16** — jogável, com folga bem menor que a `0.1.1`.
- Sem `?ring=1`: container do anel com 0 pontos e invisível. Com a flag: 10 pontos, visível na queda.

## Números atuais (`src/game/tuning.ts`)

| Knob | Valor |
|---|---|
| Alvo/mira | **60 u** (raio) |
| Anel de tuning | mesmo 60 u; `?ring=1` |
| Bola | raio 30 |
| Gravidade | 1700 |
| Chute | 1000–2100 |
| Perfect | ±22% do alvo (≈13 u / 9,5 px) |
| Catraca | 40% |
| Ápice tolerado | `vy ≥ -120` |

## Decisão

O anel **não é UI de jogo** nesta fase: é um instrumento de calibração. A flag `?ring=1` pode ficar no código para futuros ajustes sem aparecer para o jogador. Se o playtest pedir feedback de "quando chutar", a alternativa é um pulso curto na própria bola (não um anel permanente).
