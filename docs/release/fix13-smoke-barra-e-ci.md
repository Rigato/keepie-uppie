# Fix 13 — Smoke da barra de ativáveis e E2E no CI

| | |
|---|---|
| **Data** | 25/11/2026 |
| **Build** | `0.4.0-mvp1` (sem mudança de gameplay; o build publicado ganha o SHA novo) |
| **Pacote** | `release/keepie-uppie-v0.4.0-mvp1.zip` (inalterado: 357,9 KiB · SHA-256 `dbc1ca4e…`) |
| **Escopo** | testes e entrega — nenhum número de gameplay mudou |

## O que motivou

O usuário aprovou a barra de ativáveis no celular, a carga gasta na ativação e o travessão sensor do Goal. As duas dívidas técnicas aceitas no digest foram:

1. **automatizar a barra de ativáveis no smoke E2E;**
2. **mover o smoke E2E para o CI.**

A terceira sugestão (medir renda média de moedas) foi recusada e não volta.

## Smoke: barra de ativáveis

O roteiro agora tem **10 passos** (antes 8). Os novos:

- **Save: loadout de teste** — antes do primeiro toque, o save do registry recebe `inventory { net:1, magnet:1, chutao:1, streak:1 }` e `loadout [magnet, chutao, streak]`. O caminho de compra/equipar já é coberto pela loja e pela validação manual; aqui o alvo é a barra.
- **Barra: ativáveis gastam a carga** — depois do retry, congela spawners/goals e a morte, posiciona a bola e usa **cliques reais** nos ícones:
  - **Magnet**: liga ~15 s, gasta a unidade, sai da barra e persiste no `localStorage`.
  - **Power Kick**: arma com anel, gasta a unidade; o próximo chute válido sai a **2750 u/s** e o ícone some ao disparar.
  - **Streak Saver**: arma, gasta a unidade; um whiff não altera o contador.
  - **Safety Net** continua com 1 unidade no inventário (passiva, sem ícone) e o loadout esvazia quando as três cargas acabam.

O passo **Play: cena ativa e bola** passou a exigir a barra com os três ativáveis.

O runner do smoke agora aceita o Chromium instalado por `playwright-core` como fallback, além de `CHROME_PATH` e dos caminhos do sistema.

## CI: deploy só publica com E2E verde

`.github/workflows/deploy.yml` roda, depois do typecheck/testes/build:

1. `npx playwright-core install --with-deps chromium`;
2. `vite preview` em `127.0.0.1:4173` com espera ativa;
3. `npm run test:e2e`.

Se o smoke falhar, o artefato do Pages não é enviado e o deploy não acontece — `main` nunca publica uma build quebrada. O histórico do Actions mostra o smoke como etapa do job `build`.

## Validação

- `node --check scripts/smoke.mjs` limpo.
- Typecheck limpo, **121/121 testes** (11 arquivos), build ok.
- Smoke local **10/10**, incluindo o passo novo, sem erro de console.
- Workflow YAML revisado; o próximo push em `main` é o teste real do caminho de CI.

## Decisões registradas (25/11/2026)

- Barra de ativáveis no **canto inferior esquerdo**: manter.
- Carga gasta **na ativação**: manter.
- Travessão do Goal **sensor**: manter.

GDD §3.7.1/§3.11 e `docs/proposta-conteudo-0.3.md` foram atualizados. Preços, uma carga por run e recompensa do Goal continuam `[CONFIRMAR]`.
