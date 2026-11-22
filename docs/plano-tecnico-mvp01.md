# PLANO TÉCNICO — MVP 01 · Keepie-Uppie

| | |
|---|---|
| **Data** | 22/11/2026 |
| **Status** | Aprovado e executado — fases F0–F7 concluídas em 22/11/2026 |
| **Deriva de** | `gdd-keepie-uppie.md` (regras) · `plano-implementacao-mvp01.md` (design/aceite) · `spec-tecnica-publicacao.md` (requisitos de build) |
| **Escopo** | Implementar o MVP1 completo, de zero, até um ZIP jogável e testável no celular |
| **Não é** | Mudança de design. Qualquer conflito com o GDD volta como `[CONFIRMAR]`, não como invenção |

---

## 0. Convenção de nomes e contrato de entrega

**Fase (F)** — etapa de implementação com entrega jogável, commit e push. Existem 8: F0 a F7.
**Lote (L)** — unidade de trabalho paralelizável dentro de uma fase, executada por um subagente com ownership de arquivos.
**Bloco (B)** — critério de aceite do documento de design (`plano-implementacao-mvp01.md`, B1–B5). Uma fase fecha um ou mais blocos.

**Fluxo de execução (o combinado):**

1. Executo F0 → F7 **sem parar** para validação intermediária.
2. Cada fase termina com commit + push; `main` e GitHub Pages passam a servir **apenas a última fase completa e jogável**.
3. Trabalho da fase seguinte não entra em `main` até estar integrado e com os gates verdes — assim o build que você está testando nunca quebra no meio.
4. Você testa a última fase publicada enquanto eu trabalho na próxima; seus comentários acumulam.
5. Ao fim de F7, você manda a lista consolidada de ajustes e eu refaço o que for necessário em uma rodada de correção.
6. **Só paro antes de F7 se houver bloqueio real**: ambiguidade de design que mude o jogo, falha de infraestrutura (Pages, conta), ou decisão que o GDD não cobre.

**Rastreio do build publicado:** o título mostra `F3 · 0.1.0-dev · <sha curto>`. Se o rótulo não mudou no celular, é cache do Pages — recarregar forçado.

---

## 1. Decisões técnicas fechadas

| Área | Decisão | Por quê |
|---|---|---|
| Stack | **Phaser 3.90 + TypeScript 5.9 + Vite 7.3** | Mesma base validada no Bricklike (spec §12), 2D/arcade/partículas/tweens/áudio resolvidos; build HTML5 estático |
| Testes | **Vitest 4.1** para lógica pura; **Playwright** só em F6 | Regras de chute, câmera, spawner, timers e save são testáveis sem render — evita regressão de feel |
| Node | 24 LTS (já instalado) | — |
| Layout | **Portrait-first com shell desktop**: mundo fixo de **540 × 1080 u** (1:2), escala FIT e canvas centralizado; no desktop, colunas laterais de HUD/enquadramento | O jogo é vertical; o shell evita a "faixa estreita" do iframe 16:9 (spec §5). Mundo fixo mantém ângulos e arcos idênticos em todas as telas — e 1:2 é o limite aceito pelos portais |
| Plataforma | `PlatformService` + `FallbackAdapter` desde F0; `StorageService` por cima; Bridge/CrazyGames só quando houver publicação | Spec §2.1/§7: gameplay nunca fala com o portal |
| Bridge Playgama | Ao integrar (publicação na Playgama), **vendorizar a versão mais recente** de `github.com/Playgama/bridge`, registrar versão + hash no `docs/release/` e conferir no review | Um projeto anterior foi avaliado com warning de Bridge desatualizada; a spec §2.4 pede runtime local, sem CDN |
| Persistência | `keepie.save.v1` via `StorageService` (localStorage no fallback), schema versionado, `?resetSave=1` | Spec §7 |
| Arte | Formas procedurais (`Graphics`/`Arc`): bola = círculo, obstáculos = silhuetas planas, cor + forma redundantes | GDD §5 (minimalismo geométrico); zero asset externo; placeholder honesto até o polimento visual |
| Áudio | WebAudio sintetizado (oscilador + envelope), sem arquivos; API `AudioBus.play(id)` | "Nenhuma interação silenciosa" desde F1 sem depender de assets; troca por ogg/mp3 depois sem tocar no gameplay |
| Hospedagem | GitHub Pages via GitHub Actions a cada push em `main`; Vite `base: './'` | AGENTS.md (teste no celular) e spec §2.2/§9 |
| Empacotamento | `npm run package` gera ZIP com `index.html` na raiz + manifest com SHA-256 e validador de paths/limites (F7) | Spec §9.3 |

**Texto in-game:** inglês (GDD §5). **Documentação:** português.

---

## 2. Arquitetura

```text
src/
  main.ts                     # shell HTML, escolha do adapter, boot do Phaser
  platform/
    types.ts                  # contrato PlatformService (storage, lifecycle, audio, pause)
    fallback.ts               # localStorage + memória
    storage.ts                # StorageService + schema v1 + reset/corrupção
    boot.ts                   # detectHost() → adapter (hoje sempre fallback)
  game/
    tuning.ts                 # TODOS os números de calibração — fonte única
    events.ts                 # event bus tipado (chute, quique, coleta, hit, morte, powerup)
    contracts.ts              # tipos de entidade, contato, contexto de run
    run-state.ts              # altitude, moedas, streak, febre, powerups (puro, testável)
    config.ts                 # Phaser config, escala, cores, DPR
  core/                       # lógica pura, sem Phaser
    kick.ts                   # computeKick(pontoNoToque, velocidade) → {vx, vy, perfect}
    camera-ratchet.ts
    spawner.ts                # densidade, mix por altitude, RNG com seed
    altitude.ts               # mundo → metros
  objects/
    ball.ts
    obstacles/{hard,soft,breakable,birds}.ts
    interactives/{coin,ring,spring,pickup}.ts
  scenes/
    BootScene.ts · TitleScene.ts · PlayScene.ts · DeathOverlay.ts · DebugOverlay.ts
  fx/
    audio.ts                  # sintetizador + registro de sons
    particles.ts · shake.ts
  ui/
    hud.ts · aim.ts · labels.ts
tests/
  kick.test.ts · camera.test.ts · spawner.test.ts · run-state.test.ts · storage.test.ts
```

**Contratos centrais** (definidos por mim antes de disparar os lotes; ninguém mais edita):

```ts
// contracts.ts
export interface BallLike { x: number; y: number; vx: number; vy: number; r: number }
export type EntityKind = 'hard'|'soft'|'breakable'|'bird'|'coin'|'ring'|'spring'|'pickupMagnet'|'pickupAimed'
export type ContactResult = 'none'|'reflect'|'damp'|'shatter'|'collect'|'launch'|'deflect'
export interface EntityDef {
  kind: EntityKind
  spawn(scene: Phaser.Scene, x: number, y: number, opts?: unknown): Phaser.GameObjects.GameObject
  onBallContact(obj: Phaser.GameObjects.GameObject, ball: BallLike, ctx: RunContext): ContactResult
}
```

**Desacoplamento para paralelizar:** nenhuma entidade conhece som ou partícula. Ela emite evento no bus (`EVT.HIT`, `EVT.COLLECT`, `EVT.SHATTER`) e a camada `fx/` reage. Assim o lote de FX e o lote de entidade trabalham sem se tocar.

**Física do chute** (ponto de partida em `tuning.ts`, calibrado em F1):

```text
n = clamp((pontoX - bolaX) / raio, -1, 1)
se bola.vy <= 0 → whiff (nada acontece; quebra streak)
v = clamp(1100 + 0.55 * |bola.vy|, 1130, 2300)      // força pela velocidade de encontro, com piso
lateral = 0.75 * |n|                                 // centro = reto; borda = diagonal
vx = -sign(n) * v * lateral
vy = -v * sqrt(1 - lateral²)
perfect se |n| <= 0.25 → v = teto da faixa + "PERFECT"
```
Gravidade `2000 u/s²`: `T = 2v/g` → ~1.5–2.3 s de voo e apex de 0.58 a 1.6 telas. **Nota de calibração:** o piso do GDD (1/3 da tela) implica arco de ~1.1 s, abaixo da faixa 1.5–2.5 s — trato o piso como exceção (toque hesitante) e o playtest decide. Registrado como `[CONFIRMAR]` na nota da fase, sem mudar regra.

**Câmera/placar:** `camY = min(camY, bolaY - 0.58·H)` (catraca, nunca desce). Metros = `(startY - menorYDaBola) / 20` → ~48 m por tela. Morte quando a bola cruza o fundo.

**Spawner:** RNG com seed (testável), passo de altitude com densidade crescente (alvo do plano: 1 evento relevante a cada ~10 s de subida), mix por faixa; regras de segurança: nunca obstáculo no corredor imediato da bola, nunca superfície que bloqueie a largura inteira.

---

## 3. Fases

Visão geral:

| Fase | Entrega | Blocos | Lotes | O que você testa |
|---|---|---|---|---|
| **F0** | Fundação + esteira de publicação | — | 4 | Abre no celular, melhor score persiste |
| **F1** | Core loop jogável | B1 | 4 | Sensação do chute, morte e retry |
| **F2** | Obstáculos | B2 | 6 | Legibilidade e "não mata" |
| **F3** | Interativos | B3 | 6 | Rota com propósito |
| **F4** | Powerups | B4 | 4 | Magnet e Aimed Shot |
| **F5** | Camadas de skill | B5 | 4 | Perfect, streak, febre |
| **F6** | Legibilidade, áudio e compatibilidade | — | 5 | Vários tamanhos de tela, som, polimento |
| **F7** | Empacotamento e kit de playtest | — | 4 | ZIP, release notes, guia |

### F0 — Fundação e esteira de publicação

**Objetivo:** sair do zero para um build publicado que abre no celular e guarda o melhor score.

**Entregáveis**
- `git init`, remote, `.gitignore`, README curto, `package.json` com scripts (`dev`, `build`, `typecheck`, `test`).
- Vite + TS strict + Phaser 3.90; `base: './'`; build estático sem recurso externo.
- Workflow de GitHub Pages (build + deploy em `main`), repo `Rigato/keepie-uppie`.
- Shell de escala (portrait + colunas laterais no desktop), cenas Boot/Title/Play, máquina de estados `TITLE → PLAY → DEAD → retry`.
- `PlatformService` + `FallbackAdapter` + `StorageService` (schema v1) e melhor score local.
- `tuning.ts`, `events.ts`, `contracts.ts`, HUD vazio, overlay `?debug=1` v0, rótulo de build.
- Áudio synth mínimo (unlock no primeiro gesto; mute em background).
- Testes: boot/storage; `typecheck` + `build` no CI.

**Lotes:** L1 build/deploy/CI · L2 platform+storage · L3 shell de escala + debug overlay · L4 cenas/estado + título com melhor score.

**Aceite:** Pages verde; abre em 390×844, 1280×720 e 1920×1080 sem scrollbar/corte; tap inicia e o áudio destrava; melhor score sobrevive a reload; console limpo; `?debug=1` mostra painel.

**Risco:** permissões de Pages no Actions e cache do CDN do Pages (mitigado pelo rótulo de build + recarga forçada).

---

### F1 — Core loop jogável (B1)

**Objetivo:** o bloco que decide se o jogo existe. Chute gostoso em cenário vazio, com morte e retry.

**Entregáveis**
- Bola com física de parábola, raio e squash no chute.
- Chute só em queda; ângulo oposto ao ponto de toque; força pela velocidade de encontro com piso; whiff neutro.
- Paredes laterais com quique; câmera-catraca; linha de morte; morte em ~1 s; retry em 1 toque.
- Início: bola cai do topo-centro; primeiro toque zera/inicia o placar.
- HUD: metros + moedas; melhor score local; pausa ao trocar de aba.
- Feedback mínimo: som de chute/quique/morte, squash, flash; sem silêncio em interação.
- Painel de tuning ao vivo no `?debug=1` (força, ângulo, tempo de voo, impacto) e `?slow=`.

**Lotes:** L1 `core/kick.ts` + testes · L2 câmera/morte/HUD/estado · L3 FX (áudio+partículas) · L4 painel de debug.

**Aceite (B1):** todos os itens do bloco B1 do plano de design, com tempo de voo medido no debug entre 1.5 e 2.5 s nos chutes normais.

**Teste seu:** dez chutes tentando ângulos diferentes; tocar no centro e nas bordas; tocar a bola subindo (nada deve acontecer); deixar cair de propósito (morte e retry); recarregar (melhor score).

**Decisão registrada:** tela de título mínima (tap para jogar) porque o áudio precisa de gesto e o portal exige entrada em ≤1 clique.

---

### F2 — Obstáculos (B2)

**Objetivo:** perturbar sem matar. Cada peça deve ser lida e sentida antes de exigir reação.

**Entregáveis**
- **Hard**: quique refletido com ângulo espelhado, feedback forte (som + flash + shake curto).
- **Soft**: drena velocidade sem desviar; deformação visível no contato.
- **Breakable**: bola veloz estilhaça e passa; bola lenta desvia; partículas de estilhaço.
- **Birds + bando**: travessia horizontal, desvio leve ao tocar a bola; bando ocasional de ~3–4 s.
- Spawner procedural com densidade crescente por altitude e mix por faixa; regras de segurança (sem bloqueio total, sem corredor imediato).
- FX reativo a todos os contatos.

**Lotes:** L1 hard · L2 soft · L3 breakable · L4 birds+bando · L5 spawner/densidade · L6 FX.

**Aceite (B2):** checklist do bloco; **nenhuma morte pode ter causa em obstáculo**; todo contato tem som + efeito; densidade cresce sem virar parede de ruído.

**Teste seu:** identificar cada obstáculo pela silhueta e pelo som; tentar morrer batendo em obstáculo (não deve ser possível); jogar 3 minutos e dizer se a subida ficou legível ou caótica.

---

### F3 — Interativos (B3)

**Objetivo:** dar propósito positivo ao ângulo — rotas ousadas pagam.

**Entregáveis**
- **Coins**: coleta por contato, som e contador; trilhas em arco e em coluna.
- **Rings**: atravessar dispara burst de moedas + celebração; spawn em posições que exigem ângulo.
- **Springs**: lançam alto sem consumir chute, posicionadas como atalho de risco.
- **Pickups**: Magnet e Aimed Shot visíveis, coletados por contato (efeito entra em F4; aqui só spawn/coleta/estado armado).
- Spawner integrado com mix de interativos; FX e HUD de estado.

**Lotes:** L1 coins · L2 rings · L3 springs · L4 pickups · L5 mix do spawner · L6 FX/HUD.

**Aceite (B3):** checklist do bloco; argolas celebram; mola dá atalho perceptível; moedas em rota ousada.

**Teste seu:** buscar moedas de propósito; errar argolas; usar mola para subir; dizer se as rotas parecem decisão ou decoração.

---

### F4 — Powerups (B4)

**Objetivo:** dois poderes com identidade — um abre um momento, o outro dá suco.

**Entregáveis**
- **Magnet**: 15 s, raio ~1/3 da largura, só moedas, re-pegar reinicia para 15 s (não soma), ícone/estado visível.
- **Aimed Shot**: pickup arma o próximo toque sem prazo; tocar a bola em queda abre pausa de mira (máx. 2 s) com arrasto (ângulo + força, limites próprios), timer visível; soltar dispara; expirar dispara com a mira atual; força baixa → força média default.
- Casos de borda do GDD §3.10: whiff mantém armado; quique em parede/mola antes do chute não cancela; timeout não condena.
- FX/HUD: anúncio de pickup, ícone ativo, contagem.

**Lotes:** L1 magnet · L2 máquina de estados do aimed · L3 UI/input de mira · L4 FX/HUD.

**Aceite (B4):** checklist do bloco + os 4 casos de borda; nenhum soft-lock.

**Teste seu:** pegar Magnet e conferir re-pega; armar Aimed Shot, mirar, deixar expirar, mirar com força mínima; dizer se a pausa é "carta na manga" ou freio.

---

### F5 — Camadas de skill (B5)

**Objetivo:** construir o vício de "mais uma run".

**Entregáveis**
- **Perfect Touch**: janela central (~25% do raio) → "PERFECT", força no topo da faixa, celebração curta.
- **Streak**: chutes limpos consecutivos; rótulos EN `NICE → GREAT → ON FIRE`; quebra só em whiff; colisão com obstáculo não quebra.
- **Febre** no topo: moedas x2 por tempo limitado, mudança de estado perceptível.
- HUD de streak e febre; FX e sons escalonados.

**Lotes:** L1 perfect · L2 streak/rótulos · L3 febre · L4 HUD/FX.

**Aceite (B5):** checklist do bloco; perfect em ~1 a cada 5 chutes bons; rótulos legíveis; febre óbvia.

**Teste seu:** encadear chutes limpos e ver os rótulos; errar de propósito e ver a quebra; dizer se dá vontade de tentar de novo.

---

### F6 — Legibilidade, áudio e compatibilidade

**Objetivo:** transformar sistemas em experiência — o "pass de suco" do plano de design, ainda com arte geométrica.

**Entregáveis**
- Vocabulário completo de sons synth (chute, perfect, quique, dreno, estilhaço, moeda, argola, mola, pickup, febre, morte, UI).
- Partículas, shake, hit-stop curto no chute, tempos de leitura por evento.
- Tela de pausa (mute, retomar, reiniciar), safe area, DPI, rotação preservando a run.
- Compatibilidade: HUD legível em DPR 1 em 907×510, 800×450, 1216×684, 1280×720, 1920×1080; sem corte/sobreposição; sem aviso de WebGL.
- Performance: pooling, zero alocação por frame, teste em Chromebook 4 GB (via throttling quando não houver hardware).
- Playwright smoke: boot → título → toque → chute → morte → retry, sem erro de console.

**Lotes:** L1 áudio completo · L2 partículas/shake/hit-stop · L3 pausa/settings · L4 responsivo/QA · L5 e2e.

**Aceite:** nenhuma interação silenciosa; HUD legível em todos os tamanhos; e2e verde; sem request externo.

---

### F7 — Empacotamento e kit de playtest

**Objetivo:** entregar o MVP1 como candidato a playtest, não como pasta de código.

**Entregáveis**
- `npm run package`: `dist/` + config + runtime se houver, ZIP com **conteúdo** de `dist/`, manifest (nome, versão, data, tamanho, SHA-256, nº de arquivos, maior path) e validador que falha em path absoluto, `index.html` fora da raiz, URL externa e limites.
- `docs/release/v0.1.0-mvp1.md` com escopo entregue, números calibrados, riscos e o que ficou de fora.
- `docs/playtest-mvp01.md`: as 6 perguntas do plano, o que observar, formulário de coleta, `?resetSave=1` e `?debug=1`.
- Auditoria de console/network, matriz de QA executada, correções finais.
- Nenhuma tag/release formal antes da sua aprovação (spec §9.4).

**Lotes:** L1 empacotador/validador · L2 doc de release · L3 guia de playtest · L4 bugfix final.

---

## 4. Paralelização com subagentes

- **Modelo:** `opencode-go/deepseek-v4.1-flash#max` (AGENTS.md, regra 4).
- **Ownership estrito:** cada lote cria/edita apenas os arquivos do seu escopo. **Arquivos compartilhados — `contracts.ts`, `tuning.ts`, `events.ts`, registries, cenas e HUD — são exclusivos meus.** O lote devolve no relatório um trecho de "wiring" que eu aplico.
- **Contract-first:** antes de disparar lotes de uma fase, eu escrevo/atualizo os contratos, o tuning e o registry, e commito. Só então os lotes começam em paralelo.
- **Lotes não rodam** `dev`, `build` ou servidor (evita disputa de porta e arquivos); escrevem código + testes do próprio domínio. Eu integro, rodo `typecheck`/`test`/`build` e devolvo o erro ao mesmo lote quando houver.
- **Teto prático:** 3–4 subagentes simultâneos. Acima disso o gargalo vira revisão/integração e o ganho some. Picos de paralelismo em F2 (6 lotes) e F3 (6 lotes), executados em 2 ondas de 3.
- **Fluxo de git:** branches `fase/f2-obstaculos`; commits convencionais por lote integrado; merge em `main` ao fim da fase, com gates verdes; push imediato.
- **Prompt de lote** (padrão): contexto do GDD relevante · contrato exato · arquivos permitidos · arquivos proibidos · critérios de aceite e testes esperados · "não rode build/dev; devolva resumo + wiring + riscos".

---

## 5. Gates e definição de pronto (toda fase)

1. `npm run typecheck` limpo.
2. `npm run test` verde (novos testes para a lógica nova).
3. `npm run build` ok.
4. Smoke manual no preview local (desktop + viewport de celular).
5. Critérios de aceite da fase atendidos; desvios anotados como `[CONFIRMAR]`/`[A DEFINIR]`, nunca silenciados.
6. `docs/release/fN.md` com: o que entrou, o que testar, números calibrados, riscos e pendências.
7. Commit + push; Pages verde; rótulo de build atualizado.

---

## 6. Riscos e mitigação

| Risco | Mitigação |
|---|---|
| Cache do Pages mostra build antigo no celular | Rótulo de build visível + recarga forçada documentada na nota da fase |
| Áudio suspenso no iOS | `AudioContext.resume()` no primeiro `touchend`/`click`; mute em blur/pause |
| Spawner injusto (morte por obstáculo) | Regras de segurança no spawner + teste automatizado "obstáculo nunca mata" |
| Conflito de calibração (piso × faixa de 1.5–2.5 s) | Piso tratado como exceção; números só em `tuning.ts`; playtest decide |
| Phaser 4 vs 3 | Fixar 3.90 (estável, tipagem madura, base do Bricklike) |
| `node_modules` dentro do Nextcloud | Pasta fora do git; se houver sync nesta máquina, confirmar que `node_modules`/`dist` estão ignorados pelo cliente |
| Paralelismo gerar retrabalho | Contratos antes dos lotes, ownership estrito, teto de 3–4 agentes |
| Escopo crescer durante a execução | Lista de não-escopo do GDD repetida em cada prompt de lote |

---

## 7. Fora de escopo (não construir no MVP1)

Time-Warp · Power Kick/Chutão · multiball · zero-G · câmera-creep · saves de qualquer tipo (AD ou consumível) · loja/loadout/pool · biomas/tema final · placar online · tutorial com texto · música dinâmica · localização além de inglês.

---

## 8. O que preciso de você

1. **Aprovar este plano** (ou apontar ajustes antes de eu começar).
2. Confirmar a convenção **Fase / Lote / Bloco**.
3. Confirmar que sigo **sem pausas** até F7, acumulando seus comentários para a rodada final.
4. Dizer se a pasta do projeto está sincronizando pelo Nextcloud em outra máquina — se sim, garantir que `node_modules` e `dist` fiquem fora do sync.
