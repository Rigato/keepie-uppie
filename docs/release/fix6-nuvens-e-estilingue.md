# Fix 6 — Nuvens mais evidentes e Aimed Shot de estilingue

| | |
|---|---|
| **Data** | 23/11/2026 |
| **Build** | `0.1.6-mvp1` · F7 |
| **Pacote** | `release/keepie-uppie-v0.1.6-mvp1.zip` · 345,5 KiB · SHA-256 `aa4e1a77ff200844ee531c6e5d7bfeeed3eb109daf77728ded6558d3dff7a71c` |
| **URL** | https://rigato.github.io/keepie-uppie/ |

## O pedido

> "As nuvens eu deixaria um pouco mais evidentes; não sei se vai ter que deixar o fundo um pouco mais escuro, porque a nuvem é branca. E o Aimed Shot: o fluxo do dedo tem que ser um esquema Angry Birds — você puxa para trás, como um elástico, e a bola vai no sentido oposto."

## O que mudou

### 1. Céu um passo mais fundo, nuvens mais presentes

| Item | Antes (0.1.5) | Agora |
|---|---|---|
| Topo do céu | `#eaf6fc` | **`#dcecf8`** |
| Base do céu | `#cfe4f2` | **`#b7d4e8`** |
| Paredes | `#b3cfe2` | **`#a3c2d9`** |
| Alfa das nuvens | 0,18–0,30 | **0,32–0,42** |

As nuvens continuam brancas e geométricas, mas agora aparecem com clareza contra o céu. O fundo continua claro o bastante para os elementos escuros/saturados (hard, soft, breakable, birds, argola, mola, pickups) e para o HUD escuro. O céu, as paredes, o shell, o `theme-color` e o favicon acompanharam os novos valores.

### 2. Aimed Shot no esquema estilingue

Antes o dedo apontava **na direção do tiro**. Agora ele **puxa para trás** e a bola sai no sentido **oposto**, como um elástico:

- **Direção:** `dir = −puxão` no núcleo (`src/core/aim.ts`).
- **Força:** continua vindo do comprimento do puxão (0–220 u); puxão curto/tap usa a força média default.
- **Limite de baixo:** mesmo puxando para cima, o tiro nunca aponta para baixo (mínimo de 12% de subida).
- **UI:** a linha fraca vai da bola até o dedo (a banda puxada) e uma flecha forte mostra o lançamento oposto; o texto virou **"PULL BACK · RELEASE"**.
- O timer de 2 s, o timeout com força default e o `release` continuam iguais.

A mudança está registrada no GDD §3.7 e no roteiro de playtest (pergunta 5).

## Como testar

1. Recarregue forçado e confira o rodapé: **`F7 · 0.1.6-mvp1 · <sha>`**.
2. No gameplay, repare nas nuvens: ficaram mais evidentes sem escurecer o jogo demais? O céu ainda está agradável?
3. Confira o contraste de bola, moedas, hard, soft, breakable, argola, mola e pickups.
4. Pegue um **Aimed Shot** e teste o estilingue:
   - puxe **para baixo** → a bola sai para cima;
   - puxe **para a direita** → a bola sai para a esquerda;
   - puxe **para cima** → o tiro é limitado a subir;
   - dê um tap curto ou deixe o tempo acabar com puxão fraco → força média, tiro reto para cima.
5. Confira a leitura da banda do puxão e da flecha do lançamento no dedo real.

## Validação

- **72 testes unitários** verdes (8 arquivos), incluindo a inversão do puxão, o limite de não mirar para baixo, a força default e a saturação.
- **Smoke E2E 7/7** (390×844), sem erro de console.
- Capturas em **390×844** (título, gameplay, mira estilingue) e **1280×720** (shell desktop) revisadas.
- Pacote validado: 3 arquivos, 1,25 MB descompactado, **345,5 KiB** zipado, maior path 25, SHA-256 `aa4e1a77…`.

## `[CONFIRMAR]` — pendente do seu teste

- **Intensidade das nuvens / tom do céu**: se ainda estiverem fracas, o próximo passo é subir o alfa ou escurecer mais a base; se chamarem demais, voltar um degrau. Os knobs são `src/ui/parallax.ts` e `src/game/palette.ts`.
- **Estilingue**: a inversão é a sua direção; confirme se o fluxo "puxa para trás, solta" ficou natural no dedo. O próximo ajuste, se precisar, é a sensibilidade do puxão (`aimMaxDrag`/`aimDeadZone`), não a lógica.
- **Texto "PULL BACK · RELEASE"**: se ficar longo no celular, encurtar para "PULL BACK" é uma linha.
