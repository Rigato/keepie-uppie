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
| `npm run test:e2e` | smoke E2E com Playwright contra um preview (Chromium do sistema) |
| `npm run package` | build + validação + ZIP e manifest em `release/` |

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
| `scripts` | smoke E2E e empacotamento |
| `release` | artefatos gerados (ZIP + manifest), fora do git |

## Publicação

Push em `main` dispara `.github/workflows/deploy.yml`: instala com `npm ci`, roda `typecheck`, `test` e `build`, e publica `dist/` no GitHub Pages — https://rigato.github.io/keepie-uppie/

A fonte do Pages precisa estar em **GitHub Actions**. Se voltar para "Deploy from a branch", o Pages publica o `index.html` de origem (que aponta para `/src/main.ts`) e o site quebra.

O workflow também pode ser disparado manualmente (`workflow_dispatch`). Se o celular mostrar uma versão antiga, recarregue forçado: o Pages tem cache de CDN.

## Estado do projeto

**MVP01 completo (F7):** core loop, obstáculos, interativos, Magnet, Aimed Shot, perfect/streak/febre, pausa/mute, save local e pacote validado para portais. Jogável em https://rigato.github.io/keepie-uppie/. O alvo de toque é generoso (75 u; o ângulo usa 60) desde a `0.1.4`; o anel de pontos é ferramenta de tuning (`?ring=1`) e fica oculto na build normal. A `0.1.4` ajustou a queda e a câmera; a `0.1.5`/`0.1.6` clarearam o visual e puseram o Aimed Shot em estilingue; a `0.1.7` fez a força do chute pagar a queda (ápice curto, fundo alto); a `0.1.8` levou a bola a ~14% do topo e deixou a metade de baixo da tela 30%+ mais forte; a `0.1.9` fez o ganho crescer de 80% da tela para baixo (fundo útil ~2600 u/s / ~130 m); a `0.2.0` começou a dificuldade por ritmo (queda +75 u/s a cada 500 m, até 1200). O próximo passo é o **playtest** — ver `docs/playtest-mvp01.md` — e só depois a publicação nos portais.

## Documentação

- `docs/gdd-keepie-uppie.md` — fonte única de verdade de design
- `docs/plano-implementacao-mvp01.md` — escopo, blocos de aceite e playtest
- `docs/plano-tecnico-mvp01.md` — arquitetura, fases e gates
- `docs/playtest-mvp01.md` — roteiro e formulário das 6 perguntas
- `docs/release/v0.1.0-mvp1.md` — release do MVP, hash do pacote e limitações
- `AGENTS.md` — regras de trabalho e convenção Fase / Lote / Bloco

Repositório: https://github.com/Rigato/keepie-uppie
