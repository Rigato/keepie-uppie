# Fix 3 — Elementos −20%, câmera livre e hard estreito

| | |
|---|---|
| **Data** | 22/11/2026 |
| **Build** | `0.1.3-mvp1` · F7 |
| **Pacote** | `release/keepie-uppie-v0.1.3-mvp1.zip` · 344,7 KiB · SHA-256 `3a6d5992e2b56a0655f2230301b56681eea497261f4f8c15890cf8d6d6c40be6` |
| **URL** | https://rigato.github.io/keepie-uppie/ |

## O que mudou

### 1. Todos os elementos −20% (bola intacta)

| Elemento | Antes | Agora |
|---|---|---|
| Hard | 150 × 18 | **100 × 14** (−33%, além dos 20%) |
| Soft | 190 × 22 | 152 × 18 |
| Breakable | 132 × 26 | 106 × 21 |
| Birds | 46 × 26 · raio 14 | 37 × 21 · raio 11 |
| Moeda | raio 16 | raio 13 |
| Argola | raio 62 · aro 10 | raio 50 · aro 8 |
| Mola | 88 × 22 | 70 × 18 |
| Pickup | raio 26 | raio 21 |
| Aura do Magnet | raio 180 | raio 144 |
| Aura da febre | raio 70 | raio 56 |
| **Bola** | **raio 30** | **raio 30 (intacta)** |
| **Alvo de chute** | 60 | 60 (intacto) |

O hard recebeu um corte extra: 150 → 100 de largura. Refletir a bola para baixo com uma barra larga estava criando derrota automática; agora ela é mais fácil de desviar.

### 2. Câmera-catraca com folga e atraso

- A bola sobe **livre até 20% do topo** antes de a catraca começar a segui-la (antes ela era segurada em 40%).
- O acompanhamento tem atraso (`followSpeed = 6`): a bola pode chegar a **14% do topo** (~151 px) antes de o clamp de segurança impedir que ela saia da tela.
- A câmera continua **nunca descendo**.

Medição: num chute perfeito, a menor posição da bola na tela passou de **~432 px** (40%) para **151 px** (14%). Ela aparece logo abaixo do HUD, com o campo inteiro abaixo — a subida ficou visível e não parece mais travada.

### 3. Hard menos punitivo

Além dos 100 de largura: a bola pode subir mais alto e a catraca espera mais, então sobra mais espaço abaixo para recuperar depois de um quique. Se o playtest ainda culpar o hard, o próximo knob é a posição de spawn (garantir um corredor maior acima da bola), não reduzir mais a barra.

## Como testar

1. Suba e chute no centro: a bola deve passar perto do HUD antes de a câmera acompanhar.
2. Repare no tamanho dos elementos: moedas, argola, mola e pickups estão 20% menores; a bola não mudou.
3. Procure uma barra hard: ela está visivelmente mais curta. Tente passar por baixo/dos lados.
4. Jogue algumas runs e julgue: a câmera ficou mais gostosa? O hard ainda gera derrota que parece automática? Os elementos pequenos ficaram difíceis de ler?
5. `?ring=1` continua ligando o anel de tuning (60 u); `?debug=1` mostra os números.

## Validação

- 66 testes unitários verdes (câmera, chute, colisão, spawners, save, streak, mira).
- Smoke E2E 7/7, sem erro de console.
- Câmera medida em 151 px de topo num chute perfeito.
- Captura de gameplay confirma hard/argola menores e a bola preservada.

## Números da câmera (`src/game/tuning.ts`)

| Knob | Valor |
|---|---|
| `ratchetAt` (linha de espera) | 0.20 |
| `followSpeed` (atraso) | 6 |
| `maxTop` (clamp) | 0.14 |
