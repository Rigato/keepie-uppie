# GDD — KEEPIE-UPIE (título de trabalho; BR: "Embaixadinha")

| | |
|---|---|
| **Versão** | 1.3 — consolidado em 18/11/2026 · atualizado em 25/11/2026 (Ciclo 0.7) |
| **Fontes** | `ideia-semente.md` (rounds 1–6) · `referencias-comparativas.md` · `propostas-gameplay.md` (curadas) |
| **Status** | GDD do MVP1 com os ciclos 0.3–0.7. Seções não validadas na conversa estão marcadas `[A Definir]` — sem invenção. |
| **Regra central** | Todo número citado como "valor de TESTE" é ponto de partida de calibração, não decisão. |

---

## 1. Visão Geral

**Elevator pitch:** Embaixadinha infinita e vertical — a bola cai, você toca pra lançá-la pro alto, e a altitude em metros é o placar. Obstáculos desviam a bola, nunca a matam: o show é a recuperação.

**Gênero:** arcade de skill/timing · endless vertical scroller · one-input.

**Plataformas-alvo:** mobile-first (touch) e PC (mouse), paridade total de ponteiro único. **Sem preview de mira em nenhuma plataforma** (commit cego — round 2).

**Público:** jogadores casais de skill em sessões curtas; score-chasing leve; a promessa é "3 segundos pra aprender, pra sempre pra dominar" (padrão do gênero keepy-uppy).

**Engine/Stack-alvo:** `[A Definir — decisão do usuário/orquestrador]`. Critérios: 2D com física simples (círculo + parábola + quiques refletidos), deploy fácil web/mobile/desktop, input de ponteiro único nativo.

**Pilares de design** (testáveis contra qualquer decisão futura):
1. **O dedo é o pé.** Todo chute nasce do toque direto na bola; a posição do toque no corpo da bola define o ângulo (oposto, como chutar uma bola de verdade). *Teste:* qualquer mecânica que peça mira/aim-UI no jogo base é rejeitada — mira existe só como powerup raro.
2. **Ritmo de embaixadinha.** Só se chuta bola em queda; o toque no ápice rende uma embaixadinha curta (~0.8s de arco) e a queda cheia chega a ~4.0s — a altura é a recompensa por esperar a bola descer, e o fundo da tela é o grande golpe da run. De 80% da tela para baixo o ganho por trecho cresce: cada unidade caída vale mais que a anterior. *Teste:* qualquer pausa no tempo real precisa ser item-powerup consciente e raro (Aimed Shot é a única).
3. **Perturbar, nunca matar.** Obstáculos desviam, drenam ou estilhaçam — nenhum mata no contato. A única morte é a queda. *Teste:* cada obstáculo novo responde "isso cria recuperação ou encerra o show?". Encerrar = rejeitado.
4. **Legibilidade radical.** Todo evento tem tempo de leitura — animação/feedback antes de o jogo exigir ação de volta (round 4, do usuário). *Teste:* o jogador nunca pergunta "o que acabou de acontecer?".

---

## 2. Core Loop

**Segundo-a-segundo:** a bola sobe, desce; você espera a queda e toca nela → chute (ângulo pelo ponto de toque, força pela distância caída desde o ápice). Atravessa argolas, cata moedas, desvia ou rompe obstáculos, quica nas paredes. Errou o toque (whiff)? Nada acontece — só o tempo passa.

**Minuto-a-minuto:** densidade e mix de obstáculos crescem com a altitude; rotas ousadas (argolas altas, molas, moedas perto do perigo) pagam mais; o streak de toques limpos sobe com rótulos até a febre; pickups mudam o momento (mira carregada, íma ativo).

**Sessão-a-sessão:** best altitude local é a meta; a skill afina (janela do perfect, timing da queda); moedas acumulam (sem loja no MVP1 — coleta pura). Morte = queda; morte justa = retry imediato.

---

## 3. Mecânicas e Sistemas

### 3.1 Controle base (A — default definitivo)
- Toque/click **na bola em queda** = chute (rounds 2 e 5).
- **Ângulo:** distância do ponto de toque ao centro da bola define o ângulo lateral, sempre **oposto** (toca na esquerda → sobe pra direita), como uma bola de verdade. Centro = chute reto.
- Sem avatar; sem UI de mira; sem preview (PC incluído).
- **Força:** a bola acelera ao cair e o chute devolve essa queda em altura. Quanto mais a bola desce desde o ápice, mais forte o chute; tocar no ápice é uma embaixadinha curta. A distância caída continua contando mesmo depois do teto de velocidade de queda do estágio (`maxFallSpeed`, que sobe com a altitude — ver 3.3), então esperar mais baixo continua pagando. Da metade da tela para baixo o chute entra na faixa forte; de 80% da tela para baixo há um segundo estágio em que o ganho por trecho **cresce** (o fundo não "normaliza"), e o fundo útil vira o grande golpe da run. `[curva: teste]`
- **Faixa (banda):** arcos de ~0.8s no toque de ápice a ~4.0s na queda cheia (round 4; número = teste). O piso curto é intencional: é o custo de tocar cedo, não uma espiral de morte — o jogador recebe outro toque durante a queda.

### 3.2 Whiff
Toque que erra a bola **não faz nada**: sem chute, sem penalidade, a bola segue caindo. Custo = tempo perdido + pânico (round 3).

### 3.3 Run, câmera, espaço (round 6)
- **Início:** a bola cai do topo-centro; o primeiro toque inicia o placar.
- **Câmera:** catraca — sobe com a bola, **nunca desce**. O pico do chute chega perto do topo da tela (a câmera acompanha a subida); a altura visível é parte da recompensa da queda, não só o contador. `[posição do ápice: teste]`
- **Linha de morte:** o fundo da tela; sobe com o progresso. Bola cruza o fundo = fim da run (rounds 1–2).
- **Ritmo progressivo:** a cada 500 m de altitude de pico, o teto de queda sobe 75 u/s, de 900 até 1200 u/s; no limite a janela de toque fica em ~0,125 s. O aviso `FASTER FALLS` marca cada degrau e o ritmo reseta a cada run. A regra de chute não muda — o mesmo toque rende a mesma força; o que encolhe é o tempo de decisão. `[degraus: teste]`
- **Paredes laterais:** a bola **quica** nas bordas da tela; sem wrap-around. O quique devolve 80% da velocidade lateral (`wallRestitution`): quiques encadeados perdem energia em vez de virar pinball, e a bola continua recuperável com um toque. `[damping: teste]`
- **Perfect Touch (C1):** janela central da bola — acertar = "PERFECT", **bônus pequeno de velocidade somado ao chute** + celebração curta. O perfect não substitui o timing: no ápice, o chute continua curto. `[janela e bônus: teste]`

### 3.4 Placar
Altitude em **metros** (contador de altura) + moedas coletadas. Best pessoal **local** no dispositivo (rounds 3–4). Runs salvas pela Safety Net contam como normais (regra decidida nos rounds 3–4; a rede entrou na 0.3.0).

### 3.5 Obstáculos do MVP1 (perturbam, não matam)
| Tipo | Efeito | Feedback exigido |
|---|---|---|
| **Birds / Flock** | atravessam horizontalmente; tocam a bola = desvio leve; bando ocasional = set-piece de ~3–4s | visual de "passa e desvia", nunca de dano |
| **Soft surface** | a bola afunda e **perde força** (drena velocidade, não desvia) | folhagem: folhas pontudas sobrepostas, silhueta orgânica e deformação no contato (0.7.0) |
| **Breakable** | bola veloz **estilhaça** e passa; bola lenta é desviada | estilhaço catártico (assinatura de feedback — lição Smash Hit) |
| **Bumper** | almofada circular que reflete a bola na direção radial; tocar no topo devolve para cima, tocar na lateral desvia | anel radial + squash, som grave curto; nunca estilhaça nem drena |
| **Ramp** | barra diagonal (~35°) que reflete a bola para o lado, como uma barra rígida girada | flash de impacto rígido + risco claro ao longo da rampa; som pelo lado do impacto |

**Spawn/composição do mundo:** procedural, densidade crescente com altitude (lição Doodle Jump: dificuldade por MISTURA). **Ciclo 0.5:** o **Hard** (barra horizontal rígida) foi removido — perdeu função com Bumper, Ramp e Goal. Os pesos restantes foram renormalizados e o mix virou **curvas contínuas** com âncoras em 0/300/600/1200 m, ordem `[soft, breakable, bird, bumper, ramp]`: 0 m `[67,33,0,0,0]` · 300 m `[42,33,25,0,0]` · 600 m `[25,28,24,14,9]` · 1200 m `[17,23,25,19,16]`. O passo entre obstáculos cai de **200 m para 110 m** com smoothstep até 1500 m (200 / 176,7 / 133,3 / 110 m em 0/500/1000/2000 m), sem degrau de faixa. `[TESTE]`

**Sobreposição de spawn (0.5.0):** obstáculos, interativos e gols não nascem mais em cima uns dos outros. O resolvedor puro (`src/core/spawn-layout.ts`) permite o mesmo nível (mesmo y) quando há espaço lateral; se houver sobreposição, move lateralmente; sem espaço, recua para cima (mais longe da câmera); em último caso, pula o spawn. A trilha/padrão de moedas se move como grupo rígido, sem deformar o desenho. Folga padrão de 12 u. `[TESTE]`

### 3.6 Interativos (0.4.0; padrões na 0.5.0)
- **Rings (argolas):** a bola atravessa = burst de moedas. Dá propósito positivo ao ângulo.
- **Springs (molas):** lançam a bola alto **sem consumir chute** — rota planejada, atalho ousado (não elevador: posicionamento ganha o valor).
- **Coins (moedas):** coleta por contato; posicionadas em rota ousada. **Sink desde a 0.3.0:** a loja de consumíveis (ver 3.11).
  - **Padrões (0.5.0):** o conjunto de moedas pode nascer em **trilha vertical, linha horizontal, quadrado (contorno 3×3), losango, estrela (5 pontas, 10 moedas) ou zigue-zague**. O conjunto é posicionado como grupo rígido, então o desenho nunca se deforma; os pesos são `[TESTE]` (trilha 34, horizontal 18, quadrado 16, zigue-zague 16, losango 9, estrela 7).
  - **Moeda especial (0.5.0):** maior, com estrela e halo próprios, vale **5** (10 na febre) e aparece **exatamente uma por conjunto** a partir de **400 m**. `[CONFIRMAR]` altitude mínima; o ímã também a atrai.
- **Pickups de powerup:** spawnam como itens de rota (pegar = decisão de desvio): Magnet, Aimed Shot, Shield e Sweet Spot.

### 3.7 Powerups (pickups na fase)
**Aimed Shot** (rounds 3–5):
- Pickup **arma o próximo toque na bola** — sem prazo (padrão aplicado no round 6; alternativa "expira em X s" fica como variante de tuning).
- No próximo toque (bola em queda), abre a **pausa de mira**: o arrasto é um **estilingue** — o dedo puxa para trás e a bola sai no sentido **oposto** ao puxão; o comprimento do puxão vira força (limites próprios, fora da faixa normal).
- **Janela: 2s (valor de TESTE).** Solta antes = dispara. Expira = dispara com a mira/força atuais; **se a força estiver muito baixa, aplica força média default** (a bola não pode só cair do timeout).
- UI da mira: banda do puxão até o dedo + flecha indicando o lançamento oposto; o tempo visível (legibilidade).

**Magnet** (round 5; durações separadas na 0.5.0):
- O **pickup do mundo** puxa moedas próximas por **15 s** (valor de TESTE); re-pegar **reinicia** pra 15 s (não soma).
- O **consumível da barra** dura **45 s** (valor de TESTE, pedido do usuário em 25/11/2026); raio e puxão são os mesmos do pickup.
- Puxa **apenas moedas** (incluindo a especial) — argolas exigem trajetória da bola, não sucção. `[raio de puxão: teste]`

**Shield** (0.4.0):
- Uma carga, janela de **12 s**: o próximo contato com obstáculo vira um quique amigável para cima, ignorando dreno/estilhaço/desvio. Bolha na bola; **não** salva de queda (isso é da Safety Net).
- `[CONFIRMAR]` uma carga em 12 s ou todos os contatos por 6 s; Shield + Safety Net podem coexistir na mesma run? A implementação atual permite (a rede é da morte, o escudo é de obstáculo).

**Sweet Spot** (0.4.0):
- **10 s**: janela do Perfect ×1,8 (0,22 → 0,396) e bônus de velocidade do Perfect ×1,5 (60 → 90). Um ponto central discreto aparece na bola; é alvo, nunca linha de trajetória.
- `[CONFIRMAR]` o ponto central é aceitável ou o powerup deve ser invisível (só o feedback do Perfect muda)? A implementação mostra o ponto só durante o buff.

#### 3.7.1 Goal — trave/gol (0.4.0)
Set piece a cada **400–600 m**, nunca antes de 100 m (primeiro em 200 m): moldura de gol com **vão 180×120** e postes de 14. Passar pelo vão = `GOAL!` + **15 moedas**.
- **Postes** são rígidos (refletem a bola); o **travessão é sensor visual** (não colide) para o jogador conseguir atravessar o vão. **Decidido pelo usuário (25/11/2026): sensor mantido**; a proposta original pedia os dois duros, mas um travessão rígido fecha a passagem num jogo vertical.
- `[CONFIRMAR]` recompensa: 15 moedas (recomendado na proposta: 15–25, ou febre curta). O goal nasce acima da câmera e é descartado ao sair por baixo.

### 3.8 Camadas de skill do MVP1
- **Perfect Touch:** ver 3.3.
- **Streak (combo de toques limpos):** chutes limpos consecutivos sobem multiplicador com **rótulos escalonados em EN** (padrão GOOD → SWEET → EXTREME do Icy Tower, nomes finais `[A Definir — tuning]`). No topo: **febre** — moedas valem dobrado por um tempo (padrão fever do Tiny Wings). Quebra em **whiff** (proposta base); se colisão com obstáculo também quebra = `[variante de tuning a testar]`.
- **Força do streak (0.6.0):** além do bônus de moedas/febre, cada chute limpo soma **+0,5% de velocidade de chute**, com teto de **+5%** (alcançado no ON FIRE, 10 chutes) `[TESTE]`. O bônus entra na curva normal, depois da queda e antes do +60 do Perfect; não se aplica ao Chutão nem ao Aimed Shot, que mantêm a calibração própria. É sutil de propósito: no NICE são +1,5%, no GREAT +3% e no ON FIRE +5% — o jogador sente o chute render um pouco mais, sem virar outro jogo. O multiplicador usa o streak **antes** do chute atual.

### 3.9 Feedback e legibilidade (pilar 4)
Nenhuma interação silenciosa: chute (som + squash proporcionais à força — fraco é leve, forte é pesado), desvio (traço + som), drenagem (deformação), estilhaço (partículas), powerup (anúncio + ícone de estado ativo), febre (mudança perceptível do estado). A bola rola com o movimento e recebe o giro do chute — só o padrão gira; brilho e sombra ficam fixos (0.4.1). O degrau de ritmo também se anuncia (`FASTER FALLS`), para a dificuldade não parecer bug. Consumíveis têm anúncio e efeito próprios (`SAVED!`, `CHUTÃO!`, `STREAK SAFE`, chips de Magnet/Shield/Sweet). O Goal anuncia `GOAL!` com flash e burst, e o objetivo é lido antes de o jogador chegar. Tempo de leitura em toda ativação. A estamina (0.6.0) avisa antes de punir: barra que drena, `EXHAUSTED` e tela cinza durante o bloqueio; nunca um toque que “não funciona” sem explicação.

### 3.10 Casos de borda
- Whiff com Aimed Shot armado → powerup **permanece armado**.
- Aimed Shot ativo + bola quica em parede/mola antes do chute → mira abre no próximo toque na bola mesmo assim.
- Timeout do Aimed Shot com força baixa → força média default (round 5).
- Bola paralela à parede → quique lateral simples; parede **não** quebra streak `[proposta — tuning]`.
- Magnet não interage com argolas/pickups (só moedas) `[proposta — tuning]`.
- Bola lenta no Breakable → desvia; `[velocidade mínima de rompimento: teste]`.
- Safety Net só dispara depois de a run começar; se o jogador nunca tocou na bola, o consumível não é gasto.
- Chutão com Aimed Shot armado → o Aimed tem prioridade; o Chutão armado espera o próximo chute normal.
- Chutão ativado não dispara em whiff nem em toque antes do ápice; o próximo chute válido usa 2750 u/s. A unidade é gasta na ativação, não no chute.
- Magnet agora é ativável: o ícone gasta a unidade no toque e liga 45 s na hora (o pickup do mundo continua 15 s); não existe mais o "Magnet Start" automático no primeiro toque. Um pickup de 15 s **não encurta** um Magnet de 45 s já ativo; o consumível pode estender o pickup.
- Moeda especial: a partir de 400 m, todo conjunto tem exatamente uma; o ímã a atrai e a febre multiplica o valor de 5 para 10.
- Streak Saver ativado protege o próximo whiff; se o streak estiver em 0, o whiff não gasta a proteção (não há o que salvar).
- Shield e Safety Net podem coexistir: o Shield cobre contato com obstáculo, a rede cobre a morte.
- Goal: o travessão é sensor, não rígido; os postes refletem. Passar pelo vão conta mesmo tocando a rede visual.

### 3.11 Consumíveis da loja (0.4.0)
Modelo: **3 slots, sem duplicatas, com devolução ao pool**. Comprar adiciona ao inventário; equipar não gasta; usar gasta uma unidade. Quando a última unidade sai, o item também sai do loadout. A loja é o sink das moedas e abre pelo título e pela tela de morte.

**Ativação na run:** os consumíveis ativáveis equipados ganham **um ícone na barra inferior esquerda** (até 3). Tocar no ícone gasta **uma unidade** e aplica o efeito na hora; a barra mostra anel pulsante enquanto Chutão/Streak Saver esperam o gatilho. Cada tipo equipado dá **uma carga por run** (comprar mais unidades serve para runs futuras). A Safety Net é passiva: não tem ícone e gasta a unidade só quando salva.

| Consumível (EN/PT) | Efeito | Preço `[TESTE]` |
|---|---|---:|
| **Safety Net** / Rede de Proteção | Passiva. Na morte, depois de a run ter começado, a bola reaparece 180 u acima da linha de morte com 1500 u/s para cima. Uma carga; a run continua e conta como normal. | 125 |
| **Magnet** / Ímã | Ativável. Toque no ícone = Magnet por **45 s** (0.5.0; o pickup do mundo continua 15 s), com o mesmo raio/puxão do pickup. | 75 |
| **Power Kick** / Chutão | Ativável. Toque no ícone arma; o próximo chute válido sai a **2750 u/s**, mantendo o ângulo do ponto de toque; o Perfect soma +60 (2810, abaixo da mola em 2850). Whiff não dispara. | 100 |
| **Streak Saver** / Salva-Streak | Ativável. Toque no ícone arma; o próximo whiff não quebra o streak. Não protege contra morte nem contra obstáculo. | 60 |

**Decidido pelo usuário (25/11/2026):** a barra fica no canto inferior esquerdo e funciona no celular; a carga é gasta **na ativação** (não quando o efeito dispara); o Chutão é ativado e depois chutado. `[CONFIRMAR]` preços 125/75/100/60 (2,5× a tabela anterior, pedido do usuário em 25/11/2026), a regra de **uma carga por tipo por run** e a força da rede (1500 u/s / 180 u). A Safety Net foi decidida nos rounds 3–4; Magnet, Power Kick e Streak Saver entraram no Ciclo 0.4. O detalhamento de design e as alternativas estão em `docs/proposta-conteudo-0.3.md`.

### 3.12 Estamina do jogador (0.6.0)
**Problema:** tocar a bola assim que ela começa a cair, no topo da tela, dá um chute mínimo (500 u/s) que volta em ~0,77 s. Cada toque conta streak, então o jogador consegue encadear ~1,3 toques/s no topo, subindo o combo sem ganhar altitude. É um farm de streak/moedas, não uma rota.

**Solução:** uma estamina que taxa o ritmo curto de toques, sem punir quem deixa a bola cair para buscar força.

| Regra | Valor `[TESTE]` |
|---|---|
| Capacidade | 100 |
| Custo por **chute válido** | 30 (4 chutes cheios esgotam) |
| Recarga fora da exaustão | 24/s (1 chute a cada ~1,25 s é sustentável) |
| Exaustão ao chegar a 0 | bloqueia chutes por 1,2 s; a barra recarrega rápido de 0 a 100 nesse intervalo |
| Whiff, toque antes do ápice e toque bloqueado | não gastam estamina (o Chutão armado permanece) |
| Aimed Shot | não gasta estamina (é powerup, não toque normal) |

- O chute que zera a barra **acontece**; a exaustão começa depois dele. Ao fim da recarga, o jogador tem a barra cheia para recuperar a bola que estiver caindo.
- **Feedback:** barra fixa no canto superior direito, abaixo do botão de pausa, com rótulo `STAMINA`; fica discreta quando cheia, acende ao drenar e fica **vermelha com `EXHAUSTED`** quando esgota. A tela inteira ganha uma camada cinza (mundo dessaturado, HUD legível) durante a exaustão. Toques bloqueados não quebram o streak.
- A estamina **não** altera física, hitbox, câmera ou a curva de força; ela só decide se um chute normal pode acontecer.
- `[CONFIRMAR]` os quatro números (capacidade, custo, recarga, bloqueio) e a leitura visual; o teste no celular decide se a barra pesa demais no início.

---

## 4. Progressão e Economia

**Dificuldade:** cresce com altitude por MISTURA (proporção de obstáculos/riscos muda) e, desde a 0.2.0, também por RITMO (o teto de queda sobe 75 u/s a cada 500 m, de 900 até 1200). As regras de input e chute são as mesmas do primeiro ao último metro; mudam a densidade e o tempo de decisão. Curva com vales — respira entre picos. `[números: A Definir — tuning]`

**Dentro da run:** altitude (placar), streak (multiplicador), moedas (coleta), rotas ousadas vs. seguras.

**Economia (0.7.0):** a **loja de consumíveis** é o sink. Preços `[TESTE]` 125 (Safety Net), 75 (Magnet), 100 (Power Kick) e 60 (Streak Saver) — 2,5× a tabela da 0.4.0, porque a coleta estava fácil demais. A moeda compra segurança, ritmo ou proteção para uma run — nunca poder permanente. O MVP1 nasceu sem sink para validar a coleta e o Magnet; a 0.3.0 adicionou a saída e a 0.4.0 tornou três dos quatro itens ativáveis na barra da run.

**Pós-MVP (já decidido em rounds 3–4):** save por AD 1x/run opt-in na tela de morte; placar online só se o jogo merecer. A loja, o loadout de 3 slots e a rede de proteção saíram do pós-MVP e entraram na 0.3.0.

**Progressão de skill:** perfect/streak/rotas — o jogador é o próprio placar.

---

## 5. Direção Temática e Estética

**Tema/mundo:** `[A Definir — Próximos Passos]`. Direção não-comprometida registrada: biomas por altitude (rua → telhados → céu → estratosfera), mudando MISTURA de obstáculos, nunca regras. Pergunta-chave: **qual é o cenário emocional?** (rua urbana brasileira nostálgica? céu onírico/abstrato? sátira esportiva?)

**MVP1 visual:** backdrop único, **minimalismo geométrico** — formas simples de leitura instantânea, com a bola como exceção deliberada: uma **bola de futebol estilizada** (textura gerada a partir de um icosaedro truncado, contorno escuro e sombreado) para dar identidade ao jogo. A bola **gira livremente**: só o padrão dos gomos rola com o movimento horizontal e recebe o giro do chute; brilho, sombra e contorno ficam estáticos (0.4.1). Os obstáculos continuam silhuetas planas. Justificativa: restrição de arte zero + pilar de legibilidade; cores/símbolos redundantes (daltonismo de graça).

**Áudio:** `[A Definir — Próximos Passos]`. Pergunta-chave: primeiro o vocabulário de feedback (chute/quique/estilhaço/moeda) ou tudo de uma vez? Música dinâmica é pós-MVP.

**Textos in-game:** **inglês** (diretriz de audiência internacional). Nomenclatura oficial: Keepie-Uppie (título de trabalho), Perfect Touch, Streak, Aimed Shot, Magnet, Shield, Sweet Spot, Power Kick (consumível; PT: Chutão), Safety Net, Streak Saver, Bumper, Ramp, Goal.

---

## 6. Escopo e Roadmap (MVP vs. Pós-MVP)

**Ritmo de referência:** ~7h/semana em sessões curtas. O MVP1 foi o foco único até o playtest; o **Ciclo 0.3** abriu identidade (bola/damping) e economia (loja); o **Ciclo 0.4** adicionou os seis itens do tier "Próximo" da proposta (Bumper, Ramp, Shield, Sweet Spot, Streak Saver e Goal) e transformou Magnet/Chutão em ativáveis. Ainda falta o playtest formal antes da publicação.

### MVP1 (base entregue na F7 — validado em rounds 5–6)
| Bloco | Conteúdo |
|---|---|
| Core | controle A, força pela queda desde o ápice + piso curto, whiff neutro, início de run, câmera-catraca, paredes, morte por queda |
| Placar | altitude em metros + moedas; best local |
| Obstáculos | Birds (+bando), Hard, Soft, Breakable |
| Interativos | Rings, Springs, Coins, pickups |
| Powerups | Aimed Shot (2s, piso no timeout, armado sem prazo) · Magnet (15s, reset) |
| Skill | Perfect Touch · Streak com rótulos + febre |

*O **Hard** listado acima é histórico da F7; ele foi removido no Ciclo 0.5 (ver abaixo).*

### FORA do MVP1 (explícito — não construir)
Time-Warp · multiball · zero-G · câmera-creep (vira knob de tuning só no playtest) · saves/AD · biomas/tema final · placar online · tutorial extenso (a run É o tutorial). **Nota:** Power Kick/Chutão e loja/loadout/pool saíram desta lista e foram implementados no Ciclo 0.3.

### Ciclo 0.3 — identidade e economia (implementado)
| Bloco | Conteúdo |
|---|---|
| Identidade | bola de futebol gerada em runtime (icosaedro truncado), halo dourado, rastro escuro |
| Feel | damping lateral: `wallRestitution` 0.8 (quiques encadeados perdem 20% por parede) |
| Economia | loja de consumíveis, inventário e loadout de 3 slots no save; compra no título e na tela de morte |
| Consumíveis | Safety Net (rede), Magnet Start (ímã no primeiro toque), Power Kick/Chutão (primeiro chute a 2750) |
| Docs | `docs/release/fix11-bola-damping-e-loja.md` · `docs/proposta-conteudo-0.3.md` |

### Pós-MVP (decidido, aguardando o playtest)
Save-AD · Time-Warp · biomas · multiball (se provar valor) · online (se merecer) · os itens do tier "Depois" da proposta 0.3 (Crosswind, Shutter, Midas, Volley, Biome, Daily Modifier), aprovados pelo usuário antes de entrar.

### Ciclo 0.4 — ativáveis e conteúdo "Próximo" (implementado)
| Bloco | Conteúdo |
|---|---|
| Ativação | barra de consumíveis na run (canto inferior esquerdo) com Magnet, Power Kick e Streak Saver; toque gasta a unidade e aplica/arma. Safety Net continua passiva. |
| Objetos | Bumper (almofada radial), Ramp (barra diagonal 35°), Goal (trave a cada 400–600 m, +15 moedas) |
| Powerups | Shield (12 s, 1 carga contra obstáculo) · Sweet Spot (10 s, Perfect ×1,8 e +90) |
| Consumíveis | Magnet (15 s), Power Kick (próximo chute 2750), Streak Saver (próximo whiff), Safety Net (passiva) |
| Loja | 4 cards compactos; BACK corrigido (sem reabrir a loja no release) |
| Docs | `docs/release/fix12-ativaveis-e-conteudo.md` · `docs/proposta-conteudo-0.3.md` |

### Ciclo 0.4.1 — rotação livre da bola (implementado)
| Bloco | Conteúdo |
|---|---|
| Visual | textura em 3 camadas (corpo, padrão, acabamento); só o padrão gira. Rolagem por `vx`, giro residual do chute (central = backspin), Aimed Shot e giro lento no título. Física e colisão inalteradas. |
| Docs | `docs/release/fix14-rotacao-da-bola.md` |

### Ciclo 0.5 — spawn, moedas e ímã (implementado)
| Bloco | Conteúdo |
|---|---|
| Spawn | resolvedor de sobreposição (lateral → vertical → skip) para obstáculos, interativos e gols; grupos de moedas se movem inteiros; folga de 12 u. |
| Obstáculos | **Hard removido**; mix e densidade viram curvas contínuas (âncoras 0/300/600/1200 m; passo 200→110 m até 1500 m). |
| Moedas | padrões trilha/horizontal/quadrado/losango/estrela/zigue-zague; **moeda especial de 5** acima de 400 m, 1 por conjunto, visual próprio. |
| Ímã | consumível da barra passa a **45 s**; pickup do mundo continua 15 s. |
| Docs | `docs/release/fix15-spawn-moedas-e-ima.md` |

### Ciclo 0.6 — estamina e força do streak (implementado)
| Bloco | Conteúdo |
|---|---|
| Estamina | barra no topo direito; 100 de capacidade, 30 por chute válido, recarga 24/s, exaustão de 1,2 s com tela cinza e `EXHAUSTED`; impede o farm de toques curtos no topo. |
| Streak | +0,5% de força por chute limpo até +5% no ON FIRE; bônus de moedas/febre inalterado; Chutão e Aimed mantêm a força própria. |
| Docs | `docs/release/fix16-estamina-e-forca-do-streak.md` |

### Ciclo 0.7 — soft de folhagem e economia (implementado)
| Bloco | Conteúdo |
|---|---|
| Soft | o toldo retangular vira **folhagem**: folhas pontudas sobrepostas, sem aresta reta, em duas camadas de verde; a bola atravessa e perde força. Hitbox e dreno não mudaram. |
| Economia | preços da loja **2,5×**: Safety Net 125, Magnet 75, Power Kick 100 e Streak Saver 60. |
| Docs | `docs/release/fix17-soft-folhagem-e-economia.md` |

**Gate de validação:** o playtest do MVP1 decide tudo que vem depois — diversão se valida no jogável, não no documento.
