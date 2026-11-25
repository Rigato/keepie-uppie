# Fix 16 — Estamina do jogador e força crescente do streak

| | |
|---|---|
| **Data** | 25/11/2026 |
| **Build** | `0.6.0-mvp1` · F7 · `80d7fb3` |
| **Pacote** | `release/keepie-uppie-v0.6.0-mvp1.zip` · 362,0 KiB · SHA-256 `9619d9bf0c37a245c66186c6d423ccd790060316d0a05f4d414fbccab14b34a3` |
| **URL** | https://rigato.github.io/keepie-uppie/ |

## O pedido

> "temos que repensar o streak de chutes. podemos manter a questão de bonus de moeda como está e pensar num outro bonus de força de chute gradual conforme avança nos streaks até chegar on fire. Nada super disruptivo, mas sutil.
> Mas tem um outro problema que eu acho que a gente tem que corrigir. Na maneira como está implementado, o jogador pode ter um exploit em que ele fica tocando rapidamente a bola com a bola lá em cima da tela, assim, logo que ela começa a cair. A bola sobe um pouquinho. mas vai contando para o straight. Então eu acho que a gente vai pensar num sistema de estamina do jogador. em que esse sistema ele limita quantos toques seguidos rapidamente o jogador consegue dar e ter algum feedback visual. bem claro sobre isso. Ter uma barra de estamina e quando o jogador atinge essa barra de estamina, ter um reset razoavelmente rápido para o jogador conseguir recuperar a bola que vai estar caindo, né? Mas a tela, graficamente, o fundo, alguma coisa mudar de cor, ficar cinza."

## O exploit

Tocar a bola no instante em que ela começa a cair perto do topo dá o chute mínimo (`kick.minSpeed` 500 u/s): a bola sobe ~96 u e volta em ~0,77 s. Cada toque conta como chute limpo, então o jogador encadeia ~1,3 toques/s no topo, sobe o streak sem ganhar altitude e renova a febre. O stamina taxa exatamente esse ritmo curto; quem espera a bola cair para buscar força continua com a barra cheia.

## O que mudou

1. **Estamina (`src/core/stamina.ts`)** — medidor puro, sem Phaser, DOM ou tempo real. Cada **chute normal válido** custa 30 de uma barra de 100. Ao chegar a 0, os chutes são bloqueados por **1,2 s** enquanto a barra recarrega linearmente de 0 a 100. Fora da exaustão, a barra recupera 24/s. O chute que zera a barra **acontece**; a exaustão começa depois dele. Ao fim da recarga o jogador está com a barra cheia para recuperar a bola que estiver caindo.
2. **Bloqueio sem efeitos colaterais** — em exaustão, o toque normal não chama o cálculo de chute, portanto **não registra whiff, não quebra o streak, não consome o Chutão e não move a bola**. O `applyKick` ainda tem a checagem como última barreira. O toque bloqueado dá feedback: realce na barra, som curto e `EXHAUSTED` (uma vez por exaustão, não a cada toque).
3. **Barra (`src/ui/stamina-bar.ts`)** — presa à tela no canto superior direito, abaixo do pause, longe dos chips de powerup. 140×6 em x 372–512 / y 150–156, rótulo `STAMINA` alinhado à direita em y 142. Cheia fica discreta (alpha 0,55); drenando acende; abaixo de 50% fica laranja e abaixo de 20% vermelha; na exaustão o rótulo vira `EXHAUSTED` em vermelho/bold e a barra pulsa enquanto enche.
4. **Tela cinza** — retângulo `PALETTE.exhaust` (`0x5c6a75`) sobre o mundo em alpha 0,36 durante a exaustão, depth 90: cobre bola, obstáculos e fundo, mas fica abaixo do HUD (depth 100), que continua legível. Entra em 180 ms e sai em 220 ms.
5. **Força do streak (`src/core/streak.ts` + `kick.ts`)** — `kickBoostFor(count)` soma **+0,5% de velocidade por chute limpo**, com teto de **+5%**. O multiplicador usa o streak **antes** do chute atual e entra só na curva normal: `chargedSpeed = overrideSpeed ?? (baseSpeed + deepBoost) × (1 + bônus)`. O **Chutão ignora** o multiplicador (`overrideSpeed`) e o **Perfect continua somando +60 depois**, sem ser multiplicado. Chutão e Aimed mantêm a força calibrada; o bônus de moedas/febre não mudou.
6. **HUD** — o texto do streak passa a mostrar o bônus: `STREAK 4 · NICE · +2.0%`, `STREAK 7 · GREAT · +3.5%`, `STREAK 10 · ON FIRE · +5.0%`. Sem tier, `STREAK 1 · +0.5%`.
7. **Aimed Shot** — segue disponível durante a exaustão e **não gasta estamina**: é powerup, não toque normal.

## Números (`src/game/tuning.ts`)

| Knob | Valor | Papel |
|---|---:|---|
| `stamina.max` | 100 | capacidade da barra |
| `stamina.kickCost` | 30 | custo por chute válido; 4 chutes cheios esgotam |
| `stamina.regenPerSecond` | 24 | recarga normal; 1 chute a cada ~1,25 s é sustentável |
| `stamina.recoverMs` | 1200 | bloqueio após esgotar; a barra enche de 0 a 100 nesse intervalo |
| `streak.kickBoostPerKick` | 0,005 | +0,5% de força por chute limpo |
| `streak.kickBoostMax` | 0,05 | teto de +5%, alcançado no ON FIRE (10) |

Todos são `[TESTE]`; o teste no celular decide se a barra pesa demais no início e se o bloqueio é curto o bastante.

## Como o exploit fica taxado

No ritmo do topo (~0,77 s por toque), a recarga entre toques devolve ~18,5 por ciclo. A barra aguenta cerca de **8 toques em ~6 s**, quando então zera e bloqueia por 1,2 s com a barra enchendo. O ritmo de streak cai de ~1,3/s para ~1,1/s e, mais importante, o jogador passa a ver o custo: a barra drena, a tela fica cinza e o toque para de contar. O ciclo deixa de ser silencioso e ganha um ponto de parada legível. Se o teste mostrar que ainda compensa, os knobs para endurecer são `kickCost` (para cima) ou `recoverMs` (para cima); a estrutura não muda.

## Validação

- Typecheck limpo; **195/195 testes** (16 arquivos; 15 novos: 9 de estamina, 2 de `kickBoostFor` e 4 de `computeKick`); build ok; `git diff --check` limpo.
- Smoke E2E **12/12** (390×844 @2×), zero `pageerror`/`console.error`. O passo novo **"Estamina: 4 toques esgotam, bloqueia e recupera"** faz quatro cliques reais na bola, confere barra em 0, `EXHAUSTED`, streak 4 com `NICE · +2.0%` e o cinza em alpha 0,36; o 5º clique não muda streak nem `vy`; após `recoverMs + 400 ms` a barra está cheia, o cinza sumiu e o rótulo voltou a `STAMINA`.
- Prova visual em 390×844 @2×:
  - `/tmp/opencode/keepie-stamina-full.png` — barra cheia.
  - `/tmp/opencode/keepie-stamina-low.png` — 15%, vermelha.
  - `/tmp/opencode/keepie-stamina-exhausted.png` — tela cinza, `EXHAUSTED` e barra enchendo.
- Conferido nas capturas: a barra não colide com pause nem com os chips; o cinza cobre o mundo e o HUD continua legível; os três estados são distinguíveis.

## Ressalvas

- Os rótulos `NICE`/`PERFECT` dos chutes anteriores podem coincidir por ~900 ms com o `EXHAUSTED` no centro; é transitório.
- O `EXHAUSTED` central aparece no chute que zera a barra, antes de qualquer toque bloqueado; é o aviso, não uma punição dupla.
- O bundle continua acima do aviso de 500 kB do Vite (pré-existente).
- O pacote foi gerado no commit de código `80d7fb3`; o Pages publica o commit de docs mais recente, então o label do site mostra esse SHA. O código é o mesmo.
