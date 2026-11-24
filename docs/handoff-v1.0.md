# HANDOFF v1.0 — Keepie-Uppie

| | |
|---|---|
| **Documento** | Handoff de sessão (estado + próximos passos) |
| **Data** | 23/11/2026 |
| **Build publicada** | `0.1.3-mvp1` · F7 |
| **Commit de código** | `dc4abe7` (o SHA exibido no Pages muda a cada commit, inclusive docs) |
| **Jogar** | https://rigato.github.io/keepie-uppie/ |
| **Pacote** | `release/keepie-uppie-v0.1.3-mvp1.zip` · 344,7 KiB · SHA-256 `3a6d5992e2b56a0655f2230301b56681eea497261f4f8c15890cf8d6d6c40be6` |
| **Status** | MVP01 implementado (F0–F7); em ciclo de ajustes guiado pelo feedback do usuário, **aguardando o veredito da 0.1.3** |
| **Fonte de design** | `docs/gdd-keepie-uppie.md` (o GDD vence qualquer conflito com este documento) |

> **Atualização (24/11/2026):** a build publicada agora é **`0.3.0-mvp1`**. O veredito da 0.1.3 foi "ainda difícil e não divertido"; a resposta foi a rodada de queda/toque/câmera (`fix4`), o céu claro + paralaxe (`fix5`), nuvens + Aimed Shot estilingue (`fix6`), a força do chute pela queda (`fix7`), a bola mais alta + metade de baixo 30%+ (`fix8`), o segundo estágio do fundo (`fix9`), a queda progressiva a cada 500 m (`fix10`) e, agora, a bola de futebol + damping lateral + loja de consumíveis (`docs/release/fix11-bola-damping-e-loja.md`). O restante deste handoff descreve o estado da 0.1.3 e continua válido como mapa do projeto.

Este handoff é autossuficiente para uma nova sessão de IA continuar sem o histórico da conversa. Leia também `AGENTS.md`.

---

## 0. TL;DR

- O jogo é uma **embaixadinha vertical infinita**: a bola cai, o jogador toca para lançá-la; a altitude em metros é o placar.
- **Todas as fases F0–F7 estão concluídas e publicadas.** O MVP tem core, obstáculos, interativos, Magnet, Aimed Shot, perfect/streak/febre, pausa/mute, save local e pacote validado.
- Estamos **depois do MVP**, ajustando sensação a partir do teste no celular do usuário. Três rodadas de correção já foram publicadas: 0.1.1 (toque generoso), 0.1.2 (alvo 60 + anel oculto), 0.1.3 (elementos −20%, câmera com folga, hard estreito).
- **A 0.1.3 ainda não foi validada pelo usuário.** O primeiro passo da nova sessão é colher esse veredito — não iniciar mudanças de gameplay por conta própria.
- Próximos marcos: fechar o feel → playtest formal das 6 perguntas (`docs/playtest-mvp01.md`) → rodada de ajustes → publicação nos portais (ZIP já validado).
- **Não refaça F0–F7.** Não feche decisão de design: o design é do usuário (registre `[CONFIRMAR]`/`[A DEFINIR]`).

---

## 1. O jogo em uma página

- **Gênero:** arcade de skill/timing, endless vertical, um input (toque/mouse).
- **Core:** só se chuta bola **em queda**; o ângulo é oposto ao lado do toque; a força vem da queda desde o ápice (ápice curto, queda cheia alto).
- **Morte:** a bola cruza o fundo da tela. Nenhum obstáculo mata — ele perturba, desvia ou drena.
- **Conteúdo do MVP:** hard, soft, breakable, birds/bando; moedas, argolas, molas, pickups; Magnet e Aimed Shot; Perfect Touch, streak e febre.
- **Meta:** melhor altitude e moedas totais no dispositivo (sem loja/saves de run).
- **Plataforma:** HTML5 estático (Phaser 3), mobile-first portrait; um ZIP para portais.

---

## 2. Onde o projeto está

### Fases concluídas

| Fase | Entrega | Commit |
|---|---|---|
| F0 | Fundação (Vite/Phaser, shell, save, áudio synth, Pages) | `568f97d` · `2a7b08d` |
| F1 | Core loop: chute, catraca, paredes, morte, retry | `f513078` |
| F2 | Hard/soft/breakable/birds + spawner por altitude | `bda2735` |
| F3 | Moedas, argolas, molas, pickups | `ff7cb2d` |
| F4 | Magnet e Aimed Shot (mira de 2 s) | `6539236` |
| F5 | Perfect, streak e febre | `b74aa74` |
| F6 | Pausa/mute, rastro, hit-stop, E2E | `44c32b2` |
| F7 | ZIP + validador + manifest, release, playtest | `1955c73` |
| Docs | Status do MVP e playtest | `300a66f` |

### Rodadas de correção pós-MVP

| Versão | O que mudou | Motivo (feedback) |
|---|---|---|
| **0.1.1** (`6287c4c`) | Alvo de toque 26→100, anel visível, queda mais lenta, bola 30 | "hitbox absurdamente difícil; máximo 2 toques" |
| **0.1.2** (`be95a33`) | Alvo 100→60 (−40%), anel oculto, flag `?ring=1` | "melhorou muito, mas ficou muito fácil; não precisa ser visível" |
| **0.1.3** (`dc4abe7`) | Elementos −20%, hard 150→100, câmera com folga/atraso | "reduzir os outros elementos 20%; bola presa na altura; hard gera derrota automática" |

### O que está comprovado

- 66 testes unitários (8 arquivos); smoke E2E 7/7; ZIP em subpasta 7/7; zero erro de console; zero request externo.
- Câmera: a bola atinge **151 px do topo** (~14%) num chute perfeito (antes parava em ~432 px / 40%).
- Layout sem scrollbar/corte em 390×844, 907×510, 800×450, 1216×684, 1280×720, 1920×1080; rotação preserva a run.

### O que está pendente

- **Veredito da 0.1.3:** toque (fácil/difícil), câmera (solta demais?), elementos −20% (legíveis?), hard (ainda causa derrota automática?).
- **Playtest formal das 6 perguntas** (`docs/playtest-mvp01.md`) ainda não aconteceu.
- Sensação em dedo real do Aimed Shot e do arrasto (validado com mouse).
- Auto-pausa por visibilidade (código existe; sem teste automatizado).
- Publicação nos portais (nada foi enviado; sem tag/release).

---

## 3. Primeiros 30 minutos (checklist da nova sessão)

1. Leia, nesta ordem: `AGENTS.md` → este handoff → `docs/gdd-keepie-uppie.md` → `docs/plano-implementacao-mvp01.md` → `docs/plano-tecnico-mvp01.md` → `docs/playtest-mvp01.md`.
2. Confira o estado:
   ```bash
   git log --oneline -8
   git status
   npm ci
   npm run typecheck
   npm test          # 66 testes
   npm run build
   ```
3. Abra https://rigato.github.io/keepie-uppie/ e confirme o rótulo `F7 · 0.1.3-mvp1 · <sha>`. Se o celular mostrar versão antiga, recarregue forçado.
4. **Pergunte ao usuário o veredito da 0.1.3** (toque, câmera, tamanho dos elementos, hard) antes de mexer em gameplay.
5. Se for implementar: siga a convenção **Fase / Lote / Bloco** e o contrato de entrega do `AGENTS.md`; commit + push ao concluir; atualize `docs/release/` e suba a versão (`0.1.4-dev` / `0.1.4-mvp1`).
6. Não crie tag nem GitHub Release antes de teste humano e aprovação (spec §9.4).

---

## 4. Como rodar, testar, empacotar e publicar

| Comando | O que faz |
|---|---|
| `npm run dev` | Vite com `host: true` (abre no celular na mesma rede) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest (66 testes) |
| `npm run build` | typecheck + build estático em `dist/` |
| `npm run preview` | serve `dist/` (HTTP, nunca `file://`) |
| `npm run test:e2e` | smoke Playwright **contra um preview em :4173** (`BASE_URL=` para outra URL) |
| `npm run package` | build + validação + ZIP/manifest em `release/` |

### Publicação no Pages

- Push em `main` dispara `.github/workflows/deploy.yml` (typecheck + test + build + deploy).
- **A fonte do Pages precisa ser GitHub Actions.** Se voltar para "Deploy from a branch", o site publica o `index.html` de origem e quebra. Conferir com:
  ```bash
  gh api repos/Rigato/keepie-uppie/pages
  ```
  `build_type` deve ser `workflow`. Já houve um incidente assim; corrigido na F2.
- O rótulo no rodapé mostra fase, versão e SHA do commit. Docs-only também geram commit e mudam o SHA exibido.

### Pacote para portais

- `npm run package` gera `release/keepie-uppie-vX.Y.Z-mvp1.zip` (conteúdo de `dist/` na raiz) + `release/manifest.json` (nome, versão, data, tamanho, SHA-256, nº de arquivos, maior path, paths).
- A pasta `release/` é **gitignored**; o ZIP fica só local. Regenerar antes de enviar a um portal.
- O ZIP local mostra `dev` no SHA do rótulo; no Pages/CI aparece o SHA do commit.
- Limites validados: 3 arquivos, ~1,25 MB descompactado, 344 KB zipado, maior path 25.
- Publicação futura: itch.io → GameFlare → Playgama → CrazyGames Basic. **Na Playgama, vendorizar a Bridge mais recente** (`github.com/Playgama/bridge`) e registrar versão + hash — um projeto anterior foi avaliado com warning de Bridge desatualizada.

---

## 5. Mapa do repositório

```text
src/
  main.ts                 # shell, escolha do adapter, boot do Phaser, registry
  styles.css              # shell portrait + rails desktop
  platform/               # PlatformService, fallback localStorage, save v1
  game/
    tuning.ts             # TODOS os números de gameplay (fonte única)
    features.ts           # flags de apresentação (?ring=1)
    contracts.ts          # BallLike, EntityKind, ObstacleSpawn, InteractiveSpawn...
    events.ts             # event bus tipado
    palette.ts / config.ts / build-info.ts / debug-state.ts
  core/                   # lógica pura sem Phaser (testável)
    kick.ts camera.ts collision.ts math.ts
    spawner.ts interactive-spawner.ts aim.ts streak.ts
  objects/
    obstacles/            # hard, soft, breakable, birds + registry
    interactives/         # coin, ring, spring, pickup + registry
  scenes/
    TitleScene.ts (Boot+Title) PlayScene.ts PauseScene.ts DebugOverlay.ts
  ui/                     # hud.ts, powerup-hud.ts, aim.ts, backdrop.ts
  fx/audio.ts             # WebAudio sintetizado, sem arquivos
tests/                    # 8 arquivos Vitest
scripts/
  smoke.mjs               # E2E Playwright
  package.mjs             # validador + ZIP + manifest
docs/                     # GDD, planos, playtest, release/ e old/
```

**Padrões importantes:**

- **Tuning é fonte única:** qualquer número de gameplay vive em `src/game/tuning.ts`. Não hardcodar em cena/entidade.
- **Core puro:** regras que decidem o jogo (chute, câmera, colisão, spawn, mira, streak) não importam Phaser e têm teste.
- **Entidades não conhecem áudio/score/HUD:** devolvem um contato (result + normal/impulso); a cena aplica e emite evento.
- **Contratos de entidade:** `objects/obstacles/types.ts` e `objects/interactives/types.ts`; registries em `index.ts`.
- **Plataforma:** o gameplay nunca pergunta o host; `PlatformService` com fallback (localStorage + memória). Bridge/CrazyGames ainda não integrados.
- **Save:** `keepie.save` (schema v1: `bestMeters`, `totalCoins`, `muted`), via storage do serviço. `?resetSave=1`.
- **Áudio:** WebAudio sintetizado; nada de arquivo; unlock no primeiro gesto; suspende com a aba oculta.

---

## 6. Toque, câmera e calibração atual

### Toque (a parte mais sensível do jogo)

- **Alvo/mira:** raio **60 u** (não o corpo da bola). No celular 390 px, ~87 px de diâmetro.
- **Ângulo:** `offset = (toqueX − bolaX) / 60`, limitado a ±1. Centro = reto; borda do alvo = ângulo máximo.
- **Perfect:** ±22% do alvo (≈13 u / 9,5 px).
- **Só chuta em queda**, com tolerância de ápice (`vy ≥ -120`) para o toque não "sumir" perto do topo.
- **Anel de pontos:** desligado por padrão. `?ring=1` liga para tuning. Não é UI de jogo.
- **Whiff:** anel vermelho no ponto + som; tocar na bola subindo dá um clique baixo, sem quebrar streak.

> `[CONFIRMAR]` O ângulo agora nasce da **área do alvo**, não do corpo da bola. É a mudança "menos física, mais lúdica" pedida. Se o usuário quiser voltar a normalizar pelo raio da bola mantendo o alvo grande, é uma linha em `core/kick.ts`.

### Câmera

- `ratchetAt = 0.20`: a bola sobe livre até 20% do topo antes de a catraca reagir.
- `followSpeed = 6`: acompanhamento com atraso.
- `maxTop = 0.14`: a bola nunca sai acima de 14% (clamp). Medição: 151 px no chute perfeito.
- Nunca desce.
- `[CONFIRMAR]` Se o usuário achar solto demais, mexer em `ratchetAt` (subir) / `maxTop` (subir) — não reescrever a lógica.

### Snapshot de números (`src/game/tuning.ts`)

| Grupo | Valores atuais |
|---|---|
| Mundo | 540×1080 · 20 u = 1 m |
| Bola | raio 30 (intacta nas reduções) |
| Física | gravidade 1700 · queda máx. 2600 |
| Chute | 1000–2100 u/s · base 950 + 0,5×vy · lateral 0,75 · perfect 2100 |
| Toque | alvo 60 · ápice 120 · anel 60 (flag) |
| Câmera | 0.20 / 6 / 0.14 |
| Obstáculos | hard 100×14 · soft 152×18 · breakable 106×21 (rompe ≥1400) · bird 37 / r11 |
| Spawner obst. | 1º em 28 m · passo 190→115 m · safeX 110 · mix por faixa |
| Coleta | moeda r13 · argola r50/aro 8/pass 55% · burst 8 · mola 70×18 (2650, cd 350) · pickup r21 |
| Interativos | passo 62→34 m · trilha 6 · mix 55/20/10/10/5 |
| Magnet | 15 s · raio 144 · puxão 620 |
| Aimed | janela 2 s · arrasto 220 · zona morta 24 · 1300–2650 · default 50% |
| Streak | NICE 3 · GREAT 6 · ON FIRE 10 · febre 8 s x2 · aura 56 |
| UI | margem 28 · scrim 170 |

---

## 7. O que ler (fonte de verdade)

| Documento | Para quê |
|---|---|
| `AGENTS.md` | Regras permanentes + convenção Fase/Lote/Bloco + contrato de entrega |
| `docs/gdd-keepie-uppie.md` | **Design.** Regras, pilares, escopo, `[A DEFINIR]` |
| `docs/plano-implementacao-mvp01.md` | Escopo do MVP, critérios B1–B5, 6 perguntas do playtest |
| `docs/plano-tecnico-mvp01.md` | Arquitetura, fases F0–F7, gates (histórico de execução) |
| `docs/playtest-mvp01.md` | Roteiro e formulário das 6 perguntas |
| `docs/release/v0.1.0-mvp1.md` | Release do MVP (escopo, validação, limitações) |
| `docs/release/f0.md` … `f6.md` | Nota de cada fase |
| `docs/release/fix1…` `fix2…` `fix3…` | Histórico dos ajustes de toque/câmera/elementos |
| `docs/readme-keepie-uppie.md` | Readme executivo (status) |
| `docs/spec-tecnica-publicacao.md` | Requisitos de publicação (referência ativa) |

---

## 8. Aberto: decisões e dívidas

### 8.1 Decisões de feel aguardando o usuário (0.1.3)

- Alvo de 60 u está no ponto? (100 era fácil; 26 era impossível)
- Anel oculto está certo, ou precisa de um cue sutil (pulso na bola)?
- Câmera: a bola subindo a 14% e a catraca esperando em 20% ficou boa?
- Elementos −20% continuam legíveis no celular?
- Hard de 100 ainda gera derrota automática? Se sim, o próximo ajuste é o **corredor de spawn** acima da bola (não a largura).
- Magnet com raio 144 ainda dá suco?

### 8.2 Playtest formal (6 perguntas)

1. O kick é gostoso?
2. Perturbar > matar?
3. Rota com propósito?
4. Streak puxa "mais uma run"?
5. Aimed Shot é poder, não freio?
6. Magnet dá suco?

Formulário e roteiro em `docs/playtest-mvp01.md`. Nenhuma resposta ainda.

### 8.3 Decisões de design em aberto

- `[A DEFINIR]` Tema/mundo e direção de arte final (MVP é minimalismo geométrico).
- `[A DEFINIR]` Áudio/música final (MVP tem SFX sintetizados; sem música).
- `[A DEFINIR]` Layout desktop: hoje portrait-first; em 16:9 o campo fica estreito (255 px em 907×510; 360 em 1280×720). Em 1920×1080 fica 1:1 (540×1080).
- `[CONFIRMAR]` Ângulo pela área do alvo (não pelo corpo da bola).
- `[CONFIRMAR]` Tiers intermediários do streak são só rótulos; só a febre multiplica moedas (x2). Renovação da febre a cada 10 chutes limpos.
- `[CONFIRMAR]` Perfect em ±22% do alvo; frequência alvo ~1 em 5 chutes bons.
- `[A DEFINIR]` Regras de densidade/mix de obstáculos e interativos — calibração de playtest.

### 8.4 Dívidas técnicas / limitações

- **Sem SDK de portal:** storage fallback local; Bridge Playgama e adapter CrazyGames não integrados. Publicação é o próximo grande bloco.
- **Sem música** e arte ainda placeholder.
- **E2E local, fora do CI:** `scripts/smoke.mjs` depende de `?debug=1` e dos nomes dos campos da cena (renomear quebra; falha explícita). Roda com `npm run test:e2e` e um preview.
- **Auto-pausa por visibilidade** não tem teste automatizado.
- **Aimed Shot/arrasto** validado com mouse; falta dedo real.
- **ZIP local** mostra `dev` no rótulo; no CI/Pages mostra o SHA.
- **`release/` é gitignored**; o ZIP não está versionado. Nenhuma tag/release criada.
- **Nextcloud:** é só o nome da pasta; o usuário pediu para ignorar o sync. Não trabalhar fora da pasta do projeto.

---

## 9. Regras de trabalho (resumo do AGENTS)

1. Nome do jogo: **Keepie-Uppie**.
2. Toda documentação em `docs/`; documento substituído vai para `docs/old/` (nunca apagar sem decisão).
3. **Design é do usuário** (com o agente de design dele). Não feche decisão: registre `[CONFIRMAR]`/`[A DEFINIR]`.
4. **Subagentes:** `opencode-go/deepseek-v4.1-flash#max`.
5. **Git:** commit + push ao concluir; `main` sempre com a última fase completa e jogável. Pages é o canal de teste do usuário (celular).
6. **Convenção:** Fase (entrega), Lote (trabalho paralelo), Bloco (critério B1–B5).
7. **Contrato de entrega:** fases sem pausa para validação; parar só por dúvida/problema importante; cada fase commit/push; a fase seguinte não entra no `main` até gates verdes; o usuário testa a última publicada e acumula comentários; decisões menores são documentadas.

---

## 10. Próximos passos recomendados

1. **Colher o veredito da 0.1.3** (5 itens da §8.1). Sem isso, não mudar gameplay.
2. Aplicar os ajustes pontuais, subir para `0.1.4`, documentar em `docs/release/fix4-…`, rodar testes/E2E, publicar.
3. Quando o feel estiver aceito, rodar o **playtest das 6 perguntas** no celular e registrar as respostas.
4. Rodada de correções pós-playtest (nova versão + nota).
5. Só então: **publicação** (itch.io → GameFlare → Playgama com a Bridge mais recente → CrazyGames Basic), assets de loja, e tag/release **após** aprovação humana.
6. Pós-MVP (fora do escopo atual): loja/loadout, save-AD, biomas/tema, música, online, multiball, Time-Warp.

---

## 11. Prompt de kickoff (copiar para a nova sessão)

```text
Você é o agente de implementação do Keepie-Uppie, um arcade HTML5 vertical em Phaser 3 + TypeScript + Vite, no diretório /mnt/SSD-Secundario/Nextcloud/5-GameProjects/5-keepie-uppie.

O MVP01 (fases F0–F7) está implementado, publicado em https://rigato.github.io/keepie-uppie/ e empacotado em release/keepie-uppie-v0.1.3-mvp1.zip. Estamos no ciclo de ajustes guiado pelo teste do usuário; a build 0.1.3 ainda não foi validada.

Antes de qualquer coisa:
1. Leia AGENTS.md, docs/handoff-v1.0.md, docs/gdd-keepie-uppie.md, docs/plano-implementacao-mvp01.md, docs/plano-tecnico-mvp01.md e docs/playtest-mvp01.md.
2. Rode git log --oneline -8, git status, npm ci, npm run typecheck e npm test (66 testes). Confira o rótulo publicado (F7 · 0.1.3-mvp1 · <sha>).
3. Não refaça as fases. Não feche decisão de design: o design é do usuário; registre [CONFIRMAR]/[A DEFINIR].
4. Siga a convenção Fase/Lote/Bloco e o contrato de entrega do AGENTS.md (commit + push ao concluir; main sempre jogável; subagentes em opencode-go/deepseek-v4.1-flash#max).
5. O primeiro passo é perguntar ao usuário o veredito da 0.1.3: dificuldade do toque, câmera (a bola chega a ~14% do topo), tamanho dos elementos (−20%) e o hard de 100 u. Não altere gameplay antes dessa resposta.

Quando for implementar, mantenha os números de gameplay em src/game/tuning.ts, a lógica pura em src/core/ com testes, e documente cada correção em docs/release/ com versão e SHA do pacote.
```

---

## 12. Histórico de commits (para referência)

```text
dc4abe7 fix(scale): elementos -20%, hard de 100u e camera com folga/atraso (0.1.3)
be95a33 fix(touch): alvo de 60u, anel oculto por padrão e flag ?ring=1 (0.1.2)
6287c4c fix(touch): alvo generoso de 100u, anel de chute e queda mais lenta (0.1.1)
300a66f docs: status do MVP01 implementado e em playtest
1955c73 feat(f7): empacotamento validado, release do MVP e guia de playtest
44c32b2 feat(f6): pausa com mute persistente, rastro, hit-stop e smoke E2E
b74aa74 feat(f5): perfect touch, streak com rótulos e febre de moedas x2
6539236 feat(f4): magnet e aimed shot com mira de 2s, HUD de estado e força default
ff7cb2d feat(f3): moedas, argolas, molas e pickups com spawner de interativos
bda2735 feat(f2): obstáculos hard/soft/breakable/birds, colisão e spawner por altitude
f513078 feat(f1): core loop jogável — chute, catraca, morte, retry e melhor score
2a7b08d feat(f0): áudio sintetizado, overlay de debug, CI de Pages e README
568f97d feat(f0): fundação Vite+Phaser, shell portrait, save local e esqueleto de cenas
```

---

## 13. Gotchas e troubleshooting

| Sintoma | Causa provável / o que fazer |
|---|---|
| Site sem estilo/JS, HTML com `src/main.ts` | Pages voltou para "Deploy from a branch"; pôr em GitHub Actions e reexecutar o Deploy |
| Celular mostra build antigo | cache do Pages; recarregar forçado; conferir o rótulo `F7 · 0.1.3-mvp1 · sha` |
| Anel de pontos não aparece | é o padrão (build publicável); `?ring=1` liga |
| `window.keepie` undefined | precisa de `?debug=1`; o smoke usa isso |
| Save antigo/lixo | `?resetSave=1` |
| E2E falha no boot | precisa de preview em :4173 (`BASE_URL=`) e Chromium (`CHROME_PATH` ou `/usr/bin/chromium`) |
| `npm run package` falha "dist/index.html ausente" | rodar `npm run build` antes (o script `package` já faz) |
| ZIP rejeitado por path/arquivos | o validador falha antes; ver `release/manifest.json` |
| Áudio sem som no iOS | primeiro gesto destrava; não criar AudioContext no load |
| Mute não persiste | conferir `keepie.save` e o botão da pausa |
| Bola "presa" no topo | conferir `camera.ratchetAt/maxTop` (0.20/0.14) |
| Hard ainda "mata" | ajustar spawn/corredor; não é contato que mata, é a queda |
