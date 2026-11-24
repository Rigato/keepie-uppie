# Fix 12 — Consumíveis ativáveis, Bumper/Ramp/Shield/Sweet/Streak/Goal

| | |
|---|---|
| **Data** | 24/11/2026 |
| **Build** | `0.4.0-mvp1` · F7 |
| **Pacote** | `release/keepie-uppie-v0.4.0-mvp1.zip` · SHA-256 a preencher |
| **URL** | https://rigato.github.io/keepie-uppie/ |

## O pedido

> "Acho que alguns consumíveis têm que ser ativáveis. Precisamos dos ícones deles na tela de jogo para o jogador poder ativá-los quando quiser. O maior exemplo deles é o magnet (que deixa de ser start). Também o chutão deveria ser ativável."
>
> "Temos um problema no botão back da store que ao soltar o botão a tela já vira pro menu e ativa novamente o botão de store e fica difícil sair da store de fato."
>
> "Pode seguir com a implementação de todos do tier próximo na sua tabela."

## Consumíveis ativáveis

A loja agora tem **quatro** itens; três são ativáveis e um é passivo:

| Item | Tipo | Efeito | Preço |
|---|---|---|---:|
| Safety Net | passivo | salva uma morte (bola 180 u acima da linha, 1500 u/s para cima) | 50 |
| Magnet | ativável | 15 s de puxão de moedas ao tocar no ícone | 30 |
| Power Kick | ativável | arma; o próximo chute válido sai a 2750 u/s | 40 |
| Streak Saver | ativável | arma; o próximo whiff não quebra o streak | 25 |

A **barra de ativáveis** fica no canto inferior esquerdo, presa à tela, com até três slots de 72×72 (área de toque 86×94): ícone, rótulo curto e anel pulsante quando Chutão/Streak Saver estão armados. Tocar no ícone gasta **uma unidade** e aplica o efeito; cada tipo equipado dá **uma carga por run**. A Safety Net não tem ícone porque é passiva.

O antigo "Magnet Start" automático morreu: o Magnet agora é um botão. O Chutão também: ativar primeiro, chutar depois; se o jogador ativar e morrer antes de chutar, a carga foi gasta (decisão `[CONFIRMAR]`).

## Bug do BACK da loja

A causa era o `ShopButton` disparar `onClick` no **`pointerdown`**. A cena Title nascia com o dedo ainda pressionado; ao soltar, o mesmo release caía no botão SHOP do título — que fica na mesma coordenada (y≈976) — e reabria a loja.

Correções:
- `ShopButton` agora dispara no **`pointerup`**, com squash no `pointerdown` e guarda de `pressed` (clique duplo/release herdado não conta).
- O botão SHOP do título escuta **`pointerdown`** (não `pointerup`).
- `TitleScene` tem um **lock de 320 ms** depois de nascer; nenhum toque acidental abre loja ou começa a run nesse intervalo.
- O smoke E2E ganhou o passo de regressão **"Loja: BACK não reabre a loja"**.

## Tier "Próximo" entregue

### Bumper
Almofada circular de raio 34, restituição 0,9, cooldown 350 ms. Reflete a bola na direção radial (sem subida garantida): tocar no topo devolve para cima, tocar na lateral desvia. Visual teal com anel interno, oito ranhuras radiais e squash/flash.

### Ramp
Barra de 120×14 rotacionada em 35°, restituição 0,95. A colisão usa `circleRotatedRectHit` (círculo × retângulo girado, com testes puros). Visual steel com face clara, vinco e rebites. Hoje todas as rampas são "\" (ângulo positivo); rampas espelhadas ficam como `[A DEFINIR]`.

### Shield
Pickup a partir de 200 m (peso 4%): 12 s, uma carga. O próximo contato com obstáculo vira um quique amigável para cima (`vy = −750`), ignorando dreno/estilhaço/desvio; não salva de queda. Chip próprio no HUD e bolha azul na bola.

### Sweet Spot
Pickup a partir de 300 m (peso 4%): 10 s, janela do Perfect ×1,8 (0,22 → 0,396) e bônus de velocidade ×1,5 (60 → 90). Ponto magenta no centro da bola + chip. É um buff de precisão, não uma linha de trajetória.

### Streak Saver
Consumível ativável (25). Ativa e arma; o próximo whiff não zera o streak. Não protege contra morte nem contra obstáculo. Se o streak já estiver em zero, o whiff não consome a proteção.

### Goal
Set piece a cada 400–600 m, primeiro em 200 m: moldura de 208×134 com vão 180×120 e postes de 14. Os postes são hard (restituição 0,9); o **travessão é sensor visual**, para a bola atravessar o vão. Passar = banner `GOAL!`, flash e **15 moedas**. `[CONFIRMAR]` travessão sensor × hard e recompensa.

## Balanceamento

- Spawn de obstáculos: Bumper/Ramp entram depois de 300 m. Pesos: 300–600 m `[28,18,20,17,10,7]`, acima de 600 m `[20,14,18,20,15,13]` (hard/soft/breakable/bird/bumper/ramp).
- Interativos: pesos `[50,18,10,9,5,4,4]` (coin/ring/spring/magnet/aimed/shield/sweet); Shield ≥200 m, Sweet ≥300 m.
- O Goal tem spawner próprio e determinístico por seed, independente do spawner de obstáculos.

## Validação

- **121 testes** (11 arquivos) verdes; typecheck limpo.
- **Smoke E2E 8/8** (390×844), incluindo o BACK da loja, sem erro de console.
- **Loja 4 cards** a 390×844: compra no release, equipar/desequipar, botões desabilitados, loadout 3/3, sem corte.
- **Barra**: clique real nos três slots; refresh/armed/contains; `camera.scrollY` não desloca.
- **Live determinístico** (script de browser):
  - Magnet pelo ícone: 14733 ms restantes, unidade consumida, loadout atualizado.
  - Chutão armado pelo ícone, chute seguinte a **2750 u/s**, ícone some ao disparar.
  - Streak Saver: streak 3 → whiff → streak 3, proteção consumida.
  - Shield: 12000 ms; contato com obstáculo → `vy = −750`, carga gasta.
  - Sweet: 10000 ms; chute com offset 18 (fora da janela normal, dentro da doce) → Perfect, 1593 u/s (base + 90).
  - Bumper e Ramp refletem; Goal pontua (+15 moedas) e anima a rede.
- Capturas: loja 4 cards, barra na run, Goal, Bumper/Ramp, pickups.

## `[CONFIRMAR]` — pendente do seu teste

- **Ativação:** a barra no canto inferior esquerdo atrapalha o toque na bola? Os ícones são grandes o suficiente? A carga gasta na ativação (mesmo se o efeito não for usado) é a regra certa?
- **Magnet:** 15 s continua bom agora que é manual? Você sentiu falta do automático?
- **Chutão:** ativar e depois chutar ficou claro? O próximo chute a 2750 é forte o bastante para justificar o slot?
- **Streak Saver:** 25 moedas e uma carga por run é útil, ou o item é raro demais para competir com Magnet/Chutão?
- **Bumper/Ramp:** os dois aparecem com frequência boa depois de 300 m? O Bumper virou pinball? A Ramp de 35° é legível?
- **Shield/Sweet:** o Shield segurou o tranco? O ponto do Sweet Spot ajuda a mirar ou virou poluição?
- **Goal:** passar pelo vão é gostoso? 15 moedas é recompensa suficiente? O travessão sensor é a escolha certa?
- **Preços:** 50/30/40/25 continuam alcançáveis?
- **Loja:** o BACK agora sai de primeira? Os quatro cards ficaram legíveis no celular?

## Como testar

1. Recarregue forçado e confirme no rodapé: **`F7 · 0.4.0-mvp1 · <sha>`**.
2. Abra **SHOP**: compre itens, equipe até 3, toque em **BACK**. A loja não deve reabrir.
3. Jogue: os ícones dos ativáveis aparecem no canto inferior esquerdo. Toque em **MAGNET** e colete; toque em **KICK**, depois chute; toque em **STREAK** e dê um whiff perto do streak.
4. Suba até 300 m+ para ver Bumper/Ramp e os pickups Shield/Sweet; até 200 m para o primeiro Goal.
5. Confira chips de Magnet/Shield/Sweet no topo, `GOAL!`, `SAVED!`, `CHUTÃO!` e `STREAK SAFE`.
