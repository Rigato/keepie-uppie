# Fix 7 — A força do chute volta a pagar a queda

| | |
|---|---|
| **Data** | 24/11/2026 |
| **Build** | `0.1.7-mvp1` · F7 |
| **Pacote** | `release/keepie-uppie-v0.1.7-mvp1.zip` · 345,6 KiB · SHA-256 `79363d3d2ff45bb23832b5792c8e4c2c387bb797b57c5acd8a014398eda0d159` |
| **URL** | https://rigato.github.io/keepie-uppie/ |

## O pedido

> "Quanto mais a gente deixar a bola cair e tocar nela, mais forte é o chute... me parece que não tem diferença nenhuma de eu tocar na bola no topo da tela versus esperar ela cair e tocar mais na parte de baixo. Ficar dando essa embaixadinha curta no topo devia chutar a bola para o alto muito pouco. A gente precisa aumentar a força do chute conforme a bola vai caindo."

## Por que não aparecia

Duas coisas anulavam a recompensa da queda:

1. **O Perfect era um atalho para a força máxima.** `computeKick` usava `TUNING.perfect.speed = 1550` sempre que o toque caía na janela central (`|offset| ≤ 0.22`). Como o centro da bola é onde o jogador naturalmente toca, quase todo toque virava 1550 — independente da queda.
2. **A faixa era estreita e a velocidade de queda saturava.** A fórmula era `1100 + 0.4 × vy`, com piso 1100 e teto 1550. Como `vy` satura em 900, o máximo fora do perfect era 1460: só 33% acima do piso. Depois de ~0,7 s de queda, esperar mais não aumentava nada — e o teto de 1550 do perfect apagava até essa diferença.

## O que mudou

### 1. Força pela distância caída desde o ápice

A cena agora guarda o ponto mais alto da trajetória desde o último chute (`arcApexY`) e passa `fallDistance = ball.y − arcApexY` para o núcleo. A força cresce com essa distância:

```text
queda = (fallDistance / 640) ^ 0.85        // 0..1
velocidade = 500 + 1050 × queda            // 500..1550
perfect: +60 u/s depois da curva
```

Como a velocidade de queda tem teto em 900, é a **distância** que continua pagando o risco de esperar. O ápice é zerado no chute normal, no Aimed Shot e na mola; sobe junto com a bola durante a subida.

| Toque (centro/perfect) | Queda | Força | Arco | Sobe acima do toque | Ganho líquido* |
|---|---:|---:|---:|---:|---:|
| Ápice | 0 u | 560 u/s | 0,86 s | 121 u (6,0 m) | **6,0 m** |
| Meio da queda | 320 u | 1143 u/s | 1,76 s | 502 u (25,1 m) | **9,1 m** |
| Queda cheia | 640 u | 1610 u/s | 2,48 s | 997 u (49,9 m) | **17,9 m** |

\* Ganho líquido = novo ápice menos o ápice anterior. O chute no fundo começa 640 u abaixo, então parte da altura só recupera a queda; ainda assim, o ganho por chute é ~3× o do toque no ápice, e o arco visível é ~8× maior.

Sem o perfect (toque fora da janela central), o ápice fica em 500 u/s / 0,77 s / 96 u (4,8 m) e a queda cheia em 1550 u/s / 2,38 s / 924 u (46,2 m).

### 2. Perfect deixa de substituir o timing

O Perfect Touch continua sendo a janela central da bola e a celebração curta, mas agora soma **+60 u/s** ao chute em vez de forçar o topo da faixa. No ápice, um toque central ainda é um chute curto; no fundo, é um pouco mais forte que um toque fora do centro. O GDD §3.3 foi atualizado.

### 3. Feedback proporcional à força

O chute fraco agora parece fraco e o forte parece forte:

- som: pitch `0.90–1.06`, volume `0.70–1.00`;
- shake da câmera: `0.5×–1.5×` do valor base;
- squash da bola: `1.10/0.90` (fraco) a `1.22/0.78` (forte);
- o rastro só aparece acima de 900 u/s — um toque no ápice não deixa rastro.

### 4. Faixa de arco e documentos

- A banda passou de ~1,5–2,5 s para **~0,8–2,5 s**. O piso curto é intencional: é o custo de tocar cedo, e o jogador recebe outro toque durante a queda. O GDD (pilares, §3.1, §3.3, §3.9) e o roteiro de playtest foram atualizados.
- O `tests/kick.test.ts` cobre a curva, o ápice curto, a queda cheia, a saturação, o bônus do perfect e a faixa de arco.

## Como testar

1. Recarregue forçado e confira o rodapé: **`F7 · 0.1.7-mvp1 · <sha>`**.
2. Toque a bola **no ápice** (de preferência no centro): deve ser um pulinho de ~5–6 m, com arco de menos de 1 s.
3. Deixe a bola cair até o **meio/fundo** e toque: o chute deve subir muito mais (~9 m no meio, ~18 m de ganho líquido no fundo) e durar ~2,4 s.
4. Repita algumas vezes: a diferença deve ser legível sem o painel de debug. Com `?debug=1`, a linha **KICK** mostra `arc/power` (ápice ~0,86 s / 6; queda cheia ~2,48 s / 100).
5. Confira o Perfect: no ápice, o centro ainda mostra "PERFECT" mas o chute é curto; no fundo, o centro é um pouco mais forte que a borda.
6. Confira os **breakables**: agora precisam de uma queda funda (força ≳1350) para estilhaçar; um toque no ápice deve desviar.

## Validação

- **70 testes** (8 arquivos) verdes; typecheck limpo.
- **Smoke E2E 7/7** (390×844), sem erro de console. O primeiro clique do smoke é perto do ápice e agora resulta em um chute fraco (`vy 306 → -629 u/s`); o caminho morte → save → retry continua passando.
- Sondagem natural (toque real, câmera e ápice reais): quedas de 0/325/641 u → arcos de 0,90/1,72/2,38 s no centro; sem erros.
- Capturas em 390×844 revisadas: o mesmo ponto de tela mostra **5 m · arco 0,86 s · power 6** no ápice e **17 m · arco 2,48 s · power 100** na queda cheia; desktop 1280×720 sem regressão visual.
- Pacote validado: 3 arquivos, 1.255,9 KiB descompactado, **345,6 KiB** zipado, maior path 25, SHA-256 `79363d3d…`.

## `[CONFIRMAR]` — pendente do seu teste

- **Piso 500 / queda cheia 640 / curva 0.85**: são os primeiros knobs. Se o toque no ápice ainda parecer alto, baixar `minSpeed`; se a queda cheia estiver difícil de alcançar, baixar `fullPowerDrop`; se o meio da queda parecer fraco demais, subir `powerCurve` em direção a 1.
- **Perfect**: agora é um bônus pequeno (+60 u/s). No ápice ele ainda celebra um chute curto; se isso soar contraditório no dedo, o próximo passo é condicionar a celebração a uma queda mínima ou reduzir o bônus.
- **Banda 0,8–2,5 s**: o piso antigo do GDD era 1,5 s; o piso curto é a sua direção. Confirmar no celular se o toque no ápice não fica rápido demais.
- **Ritmo de pontuação**: o toque no ápice ganha ~6 m por arco curto; a queda cheia ganha ~18 m líquidos por arco de ~2,5 s. O ganho por chute favorece a queda; se no dedo o spam de toques no ápice ainda parecer eficiente demais, o primeiro lever é baixar o piso.
- **Breakables**: a exigência de queda funda para romper é uma consequência da curva; confirmar se ainda vale a pena buscá-los.
