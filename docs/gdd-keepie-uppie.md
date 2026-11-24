# GDD — KEEPIE-UPIE (título de trabalho; BR: "Embaixadinha")

| | |
|---|---|
| **Versão** | 1.0 — consolidado em 18/11/2026 |
| **Fontes** | `ideia-semente.md` (rounds 1–6) · `referencias-comparativas.md` · `propostas-gameplay.md` (curadas) |
| **Status** | GDD do MVP1. Seções não validadas na conversa estão marcadas `[A Definir]` — sem invenção. |
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
- **Paredes laterais:** a bola **quica** nas bordas da tela; sem wrap-around.
- **Perfect Touch (C1):** janela central da bola — acertar = "PERFECT", **bônus pequeno de velocidade somado ao chute** + celebração curta. O perfect não substitui o timing: no ápice, o chute continua curto. `[janela e bônus: teste]`

### 3.4 Placar
Altitude em **metros** (contador de altura) + moedas coletadas. Best pessoal **local** no dispositivo (rounds 3–4). Runs com save contarão como normais (decidido — save não existe no MVP1).

### 3.5 Obstáculos do MVP1 (perturbam, não matam)
| Tipo | Efeito | Feedback exigido |
|---|---|---|
| **Birds / Flock** | atravessam horizontalmente; tocam a bola = desvio leve; bando ocasional = set-piece de ~3–4s | visual de "passa e desvia", nunca de dano |
| **Hard surface** | quique refletido, ângulo espelhado | sonoro/visual forte e legível |
| **Soft surface** | a bola afunda e **perde força** (drena velocidade, não desvia) | deforma no contato (varal/toldo) |
| **Breakable** | bola veloz **estilhaça** e passa; bola lenta é desviada | estilhaço catártico (assinatura de feedback — lição Smash Hit) |

**Spawn/composição do mundo:** procedural, densidade crescente com altitude, mix por faixa de altura (lição Doodle Jump: dificuldade por MISTURA). `[regras de spawn e curva de densidade: A Definir — tuning no protótipo; pergunta-chave: densidade por metro ou por tempo de jogo?]`

### 3.6 Interativos do MVP1
- **Rings (argolas):** a bola atravessa = burst de moedas. Dá propósito positivo ao ângulo.
- **Springs (molas):** lançam a bola alto **sem consumir chute** — rota planejada, atalho ousado (não elevador: posicionamento ganha o valor).
- **Coins (moedas):** coleta por contato; posicionadas em rota ousada. **Sem sink no MVP1** (round 6).
- **Pickups de powerup:** spawnam como itens de rota (pegar = decisão de desvio).

### 3.7 Powerups do MVP1 (canal: pickups na fase — round 4)
**Aimed Shot** (rounds 3–5):
- Pickup **arma o próximo toque na bola** — sem prazo (padrão aplicado no round 6; alternativa "expira em X s" fica como variante de tuning).
- No próximo toque (bola em queda), abre a **pausa de mira**: o arrasto é um **estilingue** — o dedo puxa para trás e a bola sai no sentido **oposto** ao puxão; o comprimento do puxão vira força (limites próprios, fora da faixa normal).
- **Janela: 2s (valor de TESTE).** Solta antes = dispara. Expira = dispara com a mira/força atuais; **se a força estiver muito baixa, aplica força média default** (a bola não pode só cair do timeout).
- UI da mira: banda do puxão até o dedo + flecha indicando o lançamento oposto; o tempo visível (legibilidade).

**Magnet** (round 5):
- Puxa moedas próximas por **15s** (valor de TESTE). Re-pegar **reinicia** pra 15s (não soma).
- Puxa **apenas moedas** — argolas exigem trajetória da bola, não sucção. `[raio de puxão: teste]`

### 3.8 Camadas de skill do MVP1
- **Perfect Touch:** ver 3.3.
- **Streak (combo de toques limpos):** chutes limpos consecutivos sobem multiplicador com **rótulos escalonados em EN** (padrão GOOD → SWEET → EXTREME do Icy Tower, nomes finais `[A Definir — tuning]`). No topo: **febre** — moedas valem dobrado por um tempo (padrão fever do Tiny Wings). Quebra em **whiff** (proposta base); se colisão com obstáculo também quebra = `[variante de tuning a testar]`.

### 3.9 Feedback e legibilidade (pilar 4)
Nenhuma interação silenciosa: chute (som + squash proporcionais à força — fraco é leve, forte é pesado), desvio (traço + som), drenagem (deformação), estilhaço (partículas), powerup (anúncio + ícone de estado ativo), febre (mudança perceptível do estado). O degrau de ritmo também se anuncia (`FASTER FALLS`), para a dificuldade não parecer bug. Tempo de leitura em toda ativação.

### 3.10 Casos de borda
- Whiff com Aimed Shot armado → powerup **permanece armado**.
- Aimed Shot ativo + bola quica em parede/mola antes do chute → mira abre no próximo toque na bola mesmo assim.
- Timeout do Aimed Shot com força baixa → força média default (round 5).
- Bola paralela à parede → quique lateral simples; parede **não** quebra streak `[proposta — tuning]`.
- Magnet não interage com argolas/pickups (só moedas) `[proposta — tuning]`.
- Bola lenta no Breakable → desvia; `[velocidade mínima de rompimento: teste]`.

---

## 4. Progressão e Economia

**Dificuldade:** cresce com altitude por MISTURA (proporção de obstáculos/riscos muda) e, desde a 0.2.0, também por RITMO (o teto de queda sobe 75 u/s a cada 500 m, de 900 até 1200). As regras de input e chute são as mesmas do primeiro ao último metro; mudam a densidade e o tempo de decisão. Curva com vales — respira entre picos. `[números: A Definir — tuning]`

**Dentro da run:** altitude (placar), streak (multiplicador), moedas (coleta), rotas ousadas vs. seguras.

**Economia MVP1:** moedas **sem sink** — coleta pura pra validar o loop de catação e o Magnet (round 6).

**Pós-MVP (já DECIDIDO em rounds 3–4, fora da build):** moeda-soft → loja de consumíveis; loadout pré-run de 3 slots sem duplicatas com devolução ao pool; consumível-salva (rede de proteção) auto-ativa na morte; save por AD 1x/run opt-in na tela de morte; runs salvas contam como normais; placar online só se o jogo merecer.

**Progressão de skill:** perfect/streak/rotas — o jogador é o próprio placar.

---

## 5. Direção Temática e Estética

**Tema/mundo:** `[A Definir — Próximos Passos]`. Direção não-comprometida registrada: biomas por altitude (rua → telhados → céu → estratosfera), mudando MISTURA de obstáculos, nunca regras. Pergunta-chave: **qual é o cenário emocional?** (rua urbana brasileira nostálgica? céu onírico/abstrato? sátira esportiva?)

**MVP1 visual:** backdrop único, **minimalismo geométrico** — formas simples de leitura instantânea (círculo = bola, silhuetas planas = obstáculos). Justificativa: restrição de arte zero + pilar de legibilidade; cores/símbolos redundantes (daltonismo de graça).

**Áudio:** `[A Definir — Próximos Passos]`. Pergunta-chave: primeiro o vocabulário de feedback (chute/quique/estilhaço/moeda) ou tudo de uma vez? Música dinâmica é pós-MVP.

**Textos in-game:** **inglês** (diretriz de audiência internacional). Nomenclatura oficial: Keepie-Uppie (título de trabalho), Perfect Touch, Streak, Aimed Shot, Magnet, Power Kick (futuro).

---

## 6. Escopo e Roadmap (MVP vs. Pós-MVP)

**Ritmo de referência:** ~7h/semana em sessões curtas — o MVP1 é o foco único até o playtest; nada de pós-MVP antes de o core se provar gostoso.

### MVP1 (ESTE build — validado em rounds 5–6)
| Bloco | Conteúdo |
|---|---|
| Core | controle A, força pela queda desde o ápice + piso curto, whiff neutro, início de run, câmera-catraca, paredes, morte por queda |
| Placar | altitude em metros + moedas; best local |
| Obstáculos | Birds (+bando), Hard, Soft, Breakable |
| Interativos | Rings, Springs, Coins, pickups |
| Powerups | Aimed Shot (2s, piso no timeout, armado sem prazo) · Magnet (15s, reset) |
| Skill | Perfect Touch · Streak com rótulos + febre |

### FORA do MVP1 (explícito — não construir)
Time-Warp · Power Kick/Chutão · multiball · zero-G · câmera-creep (vira knob de tuning só no playtest) · saves/AD · loja/loadout/pool · biomas/tema final · placar online · tutorial extenso (a run É o tutorial).

### Pós-MVP (decidido, aguardando o playtest)
Loja + loadout + rede de proteção + save-AD (estrutura de rounds 3–4) · Time-Warp · Chutão (canal ainda aberto: powerup vs. consumível) · biomas · multiball (se provar valor) · online (se merecer).

**Gate de validação:** o playtest do MVP1 decide tudo que vem depois — diversão se valida no jogável, não no documento.
