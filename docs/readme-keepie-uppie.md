# Keepie-Uppie — readme executivo

**O que é:** embaixadinha infinita e vertical — a bola cai, o jogador toca pra lançá-la pro alto; altura em metros é o placar; obstáculos desviam a bola e powerups/consumíveis variam a run.
**Título de trabalho:** *Keepie-Uppie* (EN) / *Embaixadinha* (BR) — nome TBD.
**Feel:** "um sidescroller infinito, mas para cima".
**Status:** MVP01 implementado (F0–F7) e em ciclo de ajustes de feel. Build atual: **`0.1.4-mvp1`** — queda mais lenta (teto 900 u/s), toque de 75 u com ângulo de 60 u, buffer de ápice e câmera com ápice abaixo do HUD (`docs/release/fix4-queda-e-toque.md`). Próximo: validar o feel no celular; depois o playtest das 6 perguntas (`docs/playtest-mvp01.md`).
**Documento principal:** `ideia-semente.md`
**Como retomar:** ler `gdd-keepie-uppie.md` (regras consolidadas) e `plano-implementacao-mvp01.md` (handoff pro orquestrador). Histórico completo: `ideia-semente.md` (decisões rounds 1-6). MVP1: core kick (ângulo por ponto de toque oposto, força por velocidade de encontro com piso, whiff neutro), catraca + linha de morte, paredes, obstáculos (birds/hard/soft/breakable), argolas/molas/moedas, Aimed Shot (2s, timeout com força média default, armado sem prazo) e Magnet (15s reset), perfect + streak. FORA: time-warp, chutão, multiball, zero-G, saves/AD, loja, biomas. PRÓXIMO: orquestrador implementa MVP1 → playtest responde as 6 perguntas do plano → aí pós-MVP.

**Regra mais importante já definida:** só se chuta a bola pro alto se ela estiver caindo (anti-spam, gera ritmo).