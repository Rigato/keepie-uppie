# Fix 15 — Spawn sem sobreposição, padrões de moeda, especial de 5 e ímã de 45 s

| | |
|---|---|
| **Data** | 25/11/2026 |
| **Build** | `0.5.0-mvp1` · F7 · `90acf1c` |
| **Pacote** | `release/keepie-uppie-v0.5.0-mvp1.zip` · 360,5 KiB · SHA-256 `368e9bec7aed5dc04a41cfe843b536e6e19cc479dd0225d9558af7d2cc534da7` |
| **URL** | https://rigato.github.io/keepie-uppie/ |

## O pedido

> "1. Elementos estão podendo spawnar um sobre o outro. Acho que temos que ter um check para evitar isso. Podem até spawnar no mesmo nivel mas se houver sobreposição mexer lateralmente.
> 2. O obstaculo barra horizontal rigido está perdendo o sentido com as novas coisas adicionadas. Acho que ele pode ser removido.
> 3. Precisamos pensar também em outra mecanica de conforme a altitude a densidade de obstáculos aumentar suavemente. Assim como a de moedas.
> 4. Criar outros padrões de spawnagem de moedas (formas quadradas, horizontal, estrela, etc).
> 5. Criar moeda especial que vale 5, com visual diferente e que spawna somente acima de altitude X e 1 por conjunto de moedas.
> 6. O consumivel de ímã deve ter uma duração maior de tempo. Pensei em testarmos 45 segundos."

## O que mudou

Nada de física, colisão, câmera, chute, HUD ou loja mudou. A rodada mexe em **spawn, leitura e economia**:

1. **Sobreposição de spawn** — novo resolvedor puro em `src/core/spawn-layout.ts`. Mesmo nível (mesmo y) é permitido quando há espaço lateral; se houver sobreposição, o item tenta até 16 posições laterais; sem espaço, recua para cima (4 níveis); em último caso, o spawn é pulado. A folga entre bordas é de 12 u. Vale para obstáculos, interativos e gols. A trilha/padrão de moedas se move como **grupo rígido**, sem deformar o desenho.
2. **Hard removido** — a barra horizontal rígida saiu do tipo, da fábrica, do arquivo (`src/objects/obstacles/hard.ts`), do tuning e da paleta. Os pesos restantes foram renormalizados; nenhum obstáculo novo foi inventado.
3. **Densidade contínua** — o mix de obstáculos deixou de saltar em faixas: virou interpolação suave entre âncoras de 0/300/600/1200 m. O passo entre obstáculos cai de 200 m para 110 m com smoothstep até 1500 m; o passo dos interativos cai de 70 m para 36 m até 1200 m. O peso da moeda cresce de 50 para 60 entre 0 e 1500 m.
4. **Padrões de moeda** — seis desenhos: trilha vertical, linha horizontal, quadrado (contorno 3×3), losango, estrela (5 pontas, 10 moedas) e zigue-zague. O conjunto inteiro nasce acima da câmera e é posicionado como grupo.
5. **Moeda especial** — vale **5** (10 na febre), é maior (raio 18 contra 13), tem disco laranja, estrela de 5 pontas e halo pulsante. A partir de **400 m**, todo conjunto tem **exatamente uma** especial; abaixo disso, nenhuma. O ímã também a atrai.
6. **Ímã de 45 s** — o consumível da barra dura **45 s**; o pickup do mundo continua com **15 s**. O pickup nunca encurta um consumível ativo; o consumível pode estender o pickup.

## Curvas de densidade

Passo entre eventos (smoothstep):

| Altitude | Obstáculos | Interativos |
|---:|---:|---:|
| 0 m | 200 m | 70 m |
| 500 m | 176,7 m | 57,2 m |
| 1000 m | 133,3 m | 38,5 m |
| 2000 m | 110 m | 36 m |

Mix de obstáculos (`[soft, breakable, bird, bumper, ramp]`):

| Altitude | Pesos |
|---:|---|
| 0 m | `[67, 33, 0, 0, 0]` |
| 300 m | `[42, 33, 25, 0, 0]` |
| 600 m | `[25, 28, 24, 14, 9]` |
| 1200 m | `[17, 23, 25, 19, 16]` |

Densidade empírica (40 seeds, janela de 520 m): obstáculos **0,58 / 0,77 / 0,96 / 0,96 eventos por 100 m** e lotes de interativos **5,77 / 7,60 / 10,77 / 10,79 por 100 m** em 0/500/1000/2000 m. Sem degraus.

## Padrões de moeda

| Padrão | Moedas | Geometria |
|---|---:|---|
| Trilha | 6 | arco vertical de 28 u, passo 44 u |
| Horizontal | 4 | linha de 132 u |
| Quadrado | 8 | contorno 3×3, lado 88 u, sem centro |
| Losango | 8 | extremos em ±88 u nos dois eixos |
| Estrela | 10 | 5 pontas externas (raio 96,8 u) e 5 internas (46,2 u) |
| Zigue-zague | 6 | ±28,6 u alternando, passo vertical 39,6 u |

Pesos `[TESTE]`: trilha 34, horizontal 18, quadrado 16, zigue-zague 16, losango 9, estrela 7. Todos os padrões existem desde o início; a estrela é a mais rara. O espaçamento interno garante a folga AABB de 43 u usada pelo layout.

## Knobs (`src/game/tuning.ts`)

| Knob | Valor | Papel |
|---|---:|---|
| `spawn.startStepMeters` / `minStepMeters` / `stepAtMeters` | 200 / 110 / 1500 | passo dos obstáculos |
| `interactive.startStepMeters` / `minStepMeters` / `stepAtMeters` | 70 / 36 / 1200 | passo dos interativos |
| `spawn.overlapGap` | 12 u | folga mínima entre retângulos |
| `spawn.placementAttempts` / `placementLevels` | 16 / 4 | tentativas laterais e recuos verticais |
| `collect.coinSpecialRadius` | 18 u | raio da especial |
| `collect.coinSpecialValue` | 5 | valor normal (10 na febre) |
| `collect.coinSpecialMinMeters` | 400 | altitude mínima da especial `[CONFIRMAR]` |
| `consumable.magnetDurationMs` | 45000 | ímã da barra |
| `powerup.magnetDurationMs` | 15000 | ímã do pickup |

## Validação

- Typecheck limpo; **180/180 testes** (15 arquivos; 38 novos nesta rodada sobre os 142 da 0.4.1); build ok; `git diff --check` limpo.
- Teste de propriedade: 0..3000 m, várias seeds, janela de entidades vivas com descarte abaixo da câmera, incluindo obstáculos, padrões de moeda e gols → **zero sobreposições** com a folga de 12 u.
- Testes de moeda: contagem e forma dos seis padrões; espaçamento interno; determinismo; especial só acima de 400 m e exatamente uma por conjunto; especial 36×36 no layout; `setId` agrupa o conjunto; ímã atrai a especial; valor 5/10.
- Testes do ímã: pickup 15 s, consumível 45 s, pickup não encurta o consumível, consumível estende o pickup, reativar renova.
- Smoke E2E **11/11** (390×844 @2×), zero erro de console. O passo da barra agora mostra **Magnet 45000 ms**.
- Prova visual em 390×844 @2×: os seis padrões reconhecíveis, sem sobreposição, e a especial distinguível por forma (estrela + halo), não só por cor:
  - `/tmp/opencode/keepie-coins-patterns-a.png`
  - `/tmp/opencode/keepie-coins-patterns-b.png`
  - `/tmp/opencode/keepie-coins-special-close.png`
  - capturas do Lote A: `/tmp/opencode/keepie-spawn-800-a.png`, `/tmp/opencode/keepie-spawn-1000-b.png`
- Browser: pickup **15000 ms**, consumível **45000 ms**, especial puxada pelo ímã, valor **5** normal e **10** na febre, unidade gasta. Um pickup de 15 s aplicado durante um consumível de 45 s **não encurtou** o efeito (45000 ms mantidos).
- Contagem por banda de 100 m (60 seeds): `hard` **0 em todas**; bumper 0 até 300 m, 8 em 400 → 124 em 1200; ramp 0 até 300 m, 1 em 400 → 94 em 1200.

## Ressalvas

- A altitude da moeda especial (400 m) é `[CONFIRMAR]` com o usuário; trocar só `collect.coinSpecialMinMeters`.
- Os pesos dos padrões, as curvas de densidade e a duração de 45 s são `[TESTE]`; o teste no celular decide.
- Birds continuam móveis por design: a garantia de não sobreposição é **no instante do spawn**; a travessia posterior pode cruzar itens parados.
- A economia fica mais generosa acima de 400 m: um conjunto de 4–10 moedas com uma especial vale 8–14 (16–28 na febre), contra 6 da trilha antiga. É intencional para testar a leitura dos padrões; se os preços da loja ficarem triviais, o próximo ajuste é o peso da moeda ou o valor da especial.
- O bundle continua acima do aviso de 500 kB do Vite (pré-existente).
- O pacote foi gerado no commit de código `90acf1c`; o Pages publica o commit de docs mais recente, então o label do site mostra esse SHA. O código é o mesmo.
