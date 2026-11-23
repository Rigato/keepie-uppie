# Fix 5 — Céu claro, contraste e paralaxe de duas camadas

| | |
|---|---|
| **Data** | 23/11/2026 |
| **Build** | `0.1.5-mvp1` · F7 |
| **Pacote** | `release/keepie-uppie-v0.1.5-mvp1.zip` · 345,4 KiB · SHA-256 `2f8e9c61d133e779a19a395fcf3aaa641cb9adfffeab5e272b5449687d626eb3` |
| **URL** | https://rigato.github.io/keepie-uppie/ |

## O pedido

> "O visual atual prejudica um pouco: é um fundo escuro e às vezes não dá sensação de movimento. De maneira simples, trocar por um fundo mais claro, que dê contraste com os elementos, e uma leve paralaxe com dois elementos para dar sensação de movimento."

## O que mudou

### 1. Fundo claro, sem perder contraste

O céu agora vai de `#eaf6fc` no topo a `#cfe4f2` embaixo. O HUD, a grade e os textos viraram escuros; o scrim do topo ficou claro para o placar continuar legível. As paredes, a linha de morte, o título, a pausa, o game over e o shell desktop acompanharam o tema.

Os elementos que eram claros demais para o céu foram aprofundados:

| Elemento | Antes | Agora |
|---|---|---|
| Bola / moeda | amarelo claro | **amarelo quente com aro escuro** |
| Hard | azul claro | **azul-ardósia** |
| Soft | verde claro | **verde médio** |
| Breakable | terracota claro | **terracota profundo** |
| Bird | azul-lilás claro | **azul-lilás profundo** |
| Argola | menta | **teal profundo** |
| Mola | rosa claro | **rosa profundo** |
| Magnet / Aimed | lilás / laranja claro | **roxo / laranja mais saturados** |

O dourado da bola continua o mesmo na forma; só o **texto** de moedas virou um dourado escuro (`#9a5c0a`) para não sumir no céu.

### 2. Paralaxe de duas camadas

Duas camadas bem discretas, desenhadas com formas geométricas:

- **Distante:** 7 nuvens elípticas brancas, grandes e lentas, a **12%** da velocidade da câmera.
- **Próxima:** 11 riscos de vento teal, curtos, a **30%** da câmera.

O mundo do gameplay continua a **100%**. As duas camadas ainda têm um drift mínimo de tempo (1,2 u/s e 4 u/s) para o céu não congelar quando a câmera está parada — por exemplo, enquanto a bola cai.

As nuvens e os riscos ficam dentro da área de jogo, sem invadir as paredes. A paralaxe aparece no título (drift lento) e no gameplay; a pausa e a morte congelam junto com a cena.

## Como testar

1. Recarregue forçado e confira o rodapé: **`F7 · 0.1.5-mvp1 · <sha>`**.
2. Jogue 2 runs olhando o fundo: as nuvens e os riscos dão sensação de subida? O céu ficou claro demais ou ainda está bom?
3. Confira a leitura dos elementos no celular: bola, moedas, hard, soft, breakable, argola, mola e pickups continuam distinguíveis? Alguma cor sumiu no fundo?
4. Abra a pausa e deixe morrer uma vez: textos e botões continuam legíveis no tema claro?
5. `?ring=1` e `?debug=1` continuam funcionando; o painel de debug também ficou claro.

## Validação

- **70 testes unitários** verdes; `typecheck` e `build` limpos.
- **Smoke E2E 7/7** (390×844), sem erro de console.
- Capturas em **390×844** (título, gameplay, ápice, pausa, game over) e **1280×720** (shell desktop) revisadas.
- Pacote validado: 3 arquivos, 1,25 MB descompactado, **345,4 KiB** zipado, maior path 25, SHA-256 `2f8e9c61…`.

## `[CONFIRMAR]` — decisões de visual pendentes do seu teste

- **Céu claro abstrato** é uma direção de placeholder; o tema/mundo final continua `[A DEFINIR]` no GDD §5. Se aprovar, isto vira a base provisória.
- **Densidade da paralaxe**: 7 nuvens + 11 riscos. Se estiver chamativo, reduzir alfas/quantidade é uma linha em `src/ui/parallax.ts`.
- **Contraste das cores**: a paleta está centralizada em `src/game/palette.ts`. Se alguma peça ainda sumir no céu, o ajuste é local.
- **Texto dourado** `#9a5c0a` para moedas: se preferir outro tom, é uma linha em `CSS_PALETTE.ball`.
