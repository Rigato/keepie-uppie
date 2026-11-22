# Keepie-Uppie

Embaixadinha vertical infinita: a bola cai, você toca para lançá-la ao alto e a altitude em metros é o placar.

## Stack

- [Phaser 3.90](https://phaser.io/) + TypeScript 5.9 + Vite 7.3
- Vitest para a lógica pura
- Node.js 24 (LTS)

## Como rodar

```bash
npm ci
npm run dev
```

O Vite sobe o servidor com `host: true`, então a página também abre pelo celular na mesma rede.

| Script | O que faz |
|---|---|
| `npm run dev` | servidor de desenvolvimento |
| `npm run typecheck` | checagem de tipos (`tsc --noEmit`) |
| `npm run test` | testes unitários (Vitest) |
| `npm run build` | typecheck + build estático em `dist/` |
| `npm run preview` | serve o build de `dist/` |

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/platform` | adaptador de plataforma, armazenamento local e boot |
| `src/game` | configuração, tuning, eventos, contratos e estado da run |
| `src/core` | lógica pura, sem Phaser (chute, câmera, spawner) |
| `src/scenes` | cenas do Phaser e painel de debug |
| `src/ui` | HUD e elementos de interface |
| `src/fx` | áudio sintetizado, partículas e shake |
| `tests` | testes unitários |

## Publicação

Push em `main` dispara `.github/workflows/deploy.yml`: instala com `npm ci`, roda `typecheck`, `test` e `build`, e publica `dist/` no GitHub Pages — https://rigato.github.io/keepie-uppie/

O workflow também pode ser disparado manualmente (`workflow_dispatch`). Se o celular mostrar uma versão antiga, recarregue forçado: o Pages tem cache de CDN.

## Estado do projeto

**Fase F2 (obstáculos):** hard, soft, breakable e birds/bando com spawner procedural por altitude; nenhum contato mata (só a queda). O core loop da F1 segue: chute só em queda, catraca, morte e retry, altitude e melhor score local. Interativos e powerups entram nas fases seguintes.

## Documentação

- `docs/gdd-keepie-uppie.md` — fonte única de verdade de design
- `docs/plano-implementacao-mvp01.md` — escopo, blocos de aceite e playtest
- `docs/plano-tecnico-mvp01.md` — arquitetura, fases e gates
- `AGENTS.md` — regras de trabalho e convenção Fase / Lote / Bloco

Repositório: https://github.com/Rigato/keepie-uppie
