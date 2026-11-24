# Proposta de conteúdo 0.3 — obstáculos, powerups, consumíveis e meta

| | |
|---|---|
| **Status** | Proposta de design. **Bola, damping e loja v1 (Safety Net, Magnet Start, Power Kick) foram implementados na `0.3.0`.** O restante aguarda decisão do usuário. |
| **Base** | `0.3.0-mvp1` (F7) · GDD 1.0 · `docs/release/fix10-queda-progressiva.md` · `fix11-bola-damping-e-loja.md` |
| **Regra** | Números `[TESTE]` são ponto de partida; decisões de design são do usuário. |

## 1. Estado atual (0.3.0)

| Camada | O que já existe | Números que importam |
|---|---|---|
| Obstáculos | Hard, Soft, Breakable, Birds | hard 100×14; soft 152×18, dreno 45%; breakable 106×21, rompe a 1800 u/s; bird 37×21, 240 u/s, bando 4/3,6 s, desvio 260 |
| Interativos | Coin, Ring, Spring, Pickup Magnet/Aimed | coin r13; ring r50, burst 8; spring 70×18, lança 2850; pickup r21 |
| Powerups | Magnet e Aimed | Magnet 15 s, raio 144, puxão 620; Aimed 2 s, 1200–3000, arrasto 220 |
| Spawn | dois spawners por altitude | obstáculos desde 28 m, passo 190→115 até 1200 m; interativos desde 18 m, passo 62→34 até 900 m, pesos [55,20,10,10,5] |
| Economia/meta | moedas + best local + **loja 0.3.0** | `totalCoins` agora tem sink: inventário/loadout de 3 slots, preços 50/30/40 |
| Ritmo | queda progressiva | +75 u/s a cada 500 m, teto 1200 u/s |

**Lacunas que a proposta ataca:**

1. **Pouca variedade de perturbação:** três barras horizontais + pássaros; nenhum obstáculo vertical, móvel ou de área. A "mistura" só muda proporções.
2. **Powerups rasos:** só dois, ambos pickup; nenhum defensivo, de precisão ou de economia além do Magnet. Os pesos são fixos desde 18 m — Aimed pode nascer antes de o jogador entender o chute base.
3. **Economia sem saída:** _resolvido na 0.3.0_ — a loja de consumíveis é o sink. O que falta é calibrar o valor da moeda (preços 50/30/40) e provar que o loadout cria escolha.
4. **Meta única:** best altitude; não há gol, marco ou desafio. Moedas agora mudam a run, mas ainda não há meta de longo prazo.
5. **Composição frágil:** os spawners de obstáculo e interativo são independentes; um pickup/argola pode nascer dentro de uma barra. Não há orçamento de perigo nem respiro depois de um evento difícil.
6. **Feedback não escala:** 14 SFX fixos e HUD de powerups só com Magnet/Aimed; cada buff novo precisa de ícone/barra e som próprios.
7. **Bola e paredes em ajuste:** _resolvido na 0.3.0_ — a bola de futebol e o damping lateral (`wallRestitution` 0,8) estão na build publicada.

## 2. Prioridade em três tiers

| Tier | Itens | Por quê (uma frase) |
|---|---|---|
| **Agora** | Fundação (spawn/save), bola de futebol + damping lateral, loja v1 com **Safety Net**, **Magnet Start** e **Power Kick (Chutão)** | A loja é a primeira entrega decidida e precisa de save/composição antes de qualquer conteúdo; os três consumíveis reaproveitam o estado do Magnet e pedem apenas hooks pequenos no chute e na morte. **Bola, damping e loja v1 entregues na 0.3.0; o orçamento de spawn segue pendente.** |
| **Próximo** | **Bumper**, **Ramp**; **Shield**, **Sweet Spot**; **Streak Saver**; **Goal** | Depois da loja, é a expansão de menor custo por variedade: reutiliza os contratos de hard/pickup/contato, cria escolhas reais de loadout e testa recuperação sem mudar a regra do chute. |
| **Depois** | **Crosswind**, **Shutter**; **Midas**, **Volley**; **Biome**; **Daily Modifier** | Tudo aqui mexe em ritmo, verbo ou meta e só se paga se o playtest provar que o core aguenta; sem essa validação, vira complexidade e risco de balanceamento. |

**Fora dos três tiers:** Time-Warp, multiball, zero-G, preview de mira e obstáculos que matam ou escondem a bola (ver §5).

## 3. Conteúdo proposto

**Legenda dos pilares:** **L** legibilidade radical · **S** skill/timing · **R** recuperação (perturbar, nunca matar) · **3s** aprendizado em 3 segundos. Todos os números são `[TESTE]`.

### 3.1 Obstáculos

#### Bumper — "Cogumelo" · `[PRÓXIMO]`

- **O que faz:** almofada circular estática; no contato, reflete a bola na direção radial (como um hard curvo). Um toque no topo devolve a bola para cima; um toque na lateral desvia. Não é elevador grátis.
- **Pilares:** L (círculo + anel, distinto das barras); S (mirar o topo para recuperar); R (um toque no topo pode devolver altura; a recuperação é da mira, não do objeto); 3s (toque = boing).
- **Feedback:** anel radial + squash, som grave curto, shake leve, rastro na direção do impulso; nunca estilhaça nem drena.
- **Knobs:** raio 34, restituição 0.9, impulso radial sem `minUp`, cooldown 350 ms, peso 10% depois de 250 m, no máximo 1 a cada 350 m.
- **Risco:** se garantir subida, vira elevador e esvazia a linha de morte; se for comum, a run fica pinball.
- **[CONFIRMAR]** Reflexão radial pura (recomendada) ou subida garantida (`minUp` 650)? Recomendo radial: a recuperação vem da mira.

#### Ramp — "Rampa" · `[PRÓXIMO]`

- **O que faz:** barra diagonal fixa (35°) que reflete a bola para o lado; mesma matéria do hard, só girada. Serve para rotas laterais e para tirar a bola de perto da parede.
- **Pilares:** L (diagonal lê como rampa); S (ângulo de entrada e saída); R (pode redirecionar uma queda de volta ao campo); 3s (é um hard inclinado).
- **Feedback:** mesmo flash do hard + risco claro ao longo da rampa; som com pitch pelo lado do impacto.
- **Knobs:** largura 120, espessura 14, ângulo 35°, restituição 0.95, peso 12% depois de 300 m; nunca duas rampas formando bolsão a menos de 200 u.
- **Risco:** canto/pocket prende a bola e parece bug; normais em diagonal exigem teste de colisão.
- **[CONFIRMAR]** 35° (leitura suave) ou 45° (desvio forte)? Recomendo 35° no v1; 45° como variação rara.

#### Crosswind — "Rajada" · `[DEPOIS]`

- **O que faz:** zona vertical com setas animadas; enquanto a bola está dentro, recebe aceleração lateral constante. Avisa 0,5 s antes, dura 2,5 s, não encosta e nunca empurra para baixo.
- **Pilares:** L (setas + whoosh antes da força); S (pré-mirar contra o vento); R (pode afastar a bola da parede ou empurrá-la para uma rota); 3s (setas são universais).
- **Feedback:** linhas de fluxo, whoosh curto, rastro da bola encurvando, borda da zona pulsando; sem shake.
- **Knobs:** largura 70, altura 320, aceleração lateral 800 u/s², lateral máx. 450, aviso 500 ms, ativo 2500 ms, cooldown 6000 ms, peso 8% depois de 600 m.
- **Risco:** tira controle; se empurrar para baixo ou para um canto, parece morte por vento.
- **[A DEFINIR]** Só lateral ou também updraft? Recomendo só lateral; updraft é recuperação grátis e compete com o Bumper.

#### Shutter — "Portão" · `[DEPOIS]`

- **O que faz:** barra dura que abre e fecha em ciclo; aberta = passa, fechada = hard. Luz de aviso 0,4 s antes de fechar, transição de 0,25 s; nunca prensa a bola.
- **Pilares:** L (luz + movimento); S (timing de passagem); R (esperar abrir ou quicar no fechado); 3s (portão).
- **Feedback:** clack mecânico, luz piscando, deslize; fechado usa o flash do hard.
- **Knobs:** largura 140, altura 14, aberto 1600 ms, fechado 1200 ms, transição 250 ms, aviso 400 ms, peso 8% depois de 800 m.
- **Risco:** "gotcha" se o ciclo não estiver legível quando entra na tela; se fechar com a bola dentro, empurrar para fora, nunca travar.
- **[CONFIRMAR]** Portão fechado deve ser hard (recomendado) ou soft? Hard mantém a regra "nunca mata".

### 3.2 Powerups (pickup na fase)

#### Shield — "Escudo" · `[PRÓXIMO]`

- **O que faz:** uma carga, janela de 12 s; o próximo contato com obstáculo vira um quique amigável para cima, ignorando dreno/estilhaço/desvio. Bolha na bola; não salva de queda (isso é da rede).
- **Pilares:** L (bolha + crack); S (escolher quando gastar; encarar um breakable sem perder o chute); R (transforma contato ruim em recuperação); 3s (bolha = proteção).
- **Feedback:** shimmer, crack + pop, microtexto "SAFE", som próprio; ícone no HUD.
- **Knobs:** duração 12 000 ms, 1 carga, `rescueVy −750`, sem mudar lateral, peso 5% depois de 200 m.
- **Risco:** sobrepõe a Safety Net; se as duas coexistirem sem regra, a run fica invulnerável demais.
- **[CONFIRMAR]** Uma carga em 12 s (recomendado) ou todos os contatos por 6 s? E Shield + Safety Net podem coexistir na mesma run?

#### Sweet Spot — "Ponto Doce" · `[PRÓXIMO]`

- **O que faz:** 10 s; janela do Perfect ×1,8 e bônus de velocidade do Perfect +50%; um ponto central discreto aparece na bola. É um alvo, nunca uma linha de trajetória.
- **Pilares:** L (ponto + "PERFECT" mais forte); S (premia precisão); R (não é recuperação); 3s (ponto no centro).
- **Feedback:** ponto brilha, som de perfect mais agudo, timer no HUD.
- **Knobs:** duração 10 000 ms, `perfectWindow 0.22→0.40`, `speedBonus 60→90`, peso 5% depois de 300 m.
- **Risco:** "win more" (só quem já mira bem ganha); o ponto pode ser lido como UI de mira.
- **[CONFIRMAR]** O ponto central é aceitável ou o powerup deve ser invisível (só o feedback do Perfect muda)? Recomendo o ponto só durante o buff.

#### Midas — "Toque de Midas" · `[DEPOIS]`

- **O que faz:** 6 s; a bola deixa uma moeda atrás de si (no sentido oposto ao movimento) a cada 0,4 s de voo (máx. 10); a moeda só pode ser coletada 300 ms depois. Moedas normais, puxáveis pelo Magnet; não solta durante a mira.
- **Pilares:** L (rastro dourado); S (rota para catar o próprio rastro); R (não é recuperação); 3s (dourado = moeda).
- **Feedback:** faísca dourada, plin de moeda, timer; rastro some em ~4 s.
- **Knobs:** duração 6000 ms, intervalo 400 ms, teto 10, valor 1, coleta armada após 300 ms, sem spawn durante a mira, peso 4% depois de 400 m.
- **Risco:** inflaciona a moeda antes de a economia estabilizar; combo com Magnet; poluição visual.
- **[A DEFINIR]** Moeda gerada por powerup é aceitável antes de a economia validar? Se sim, teto 10 e sem mira; se não, fica para 0.4.

#### Volley — "Voleio" · `[DEPOIS]`

- **O que faz:** 8 s; o jogador também pode chutar a bola enquanto ela sobe. O chute de subida usa 60% da força e o próximo chute de queda conta a partir do novo ápice; um voleio por queda.
- **Pilares:** L (bola brilha quando o voleio está disponível); S (novo teto de skill, corrige um lançamento ruim); R (recuperação de ângulo); 3s (brilho = pode chutar subindo).
- **Feedback:** som de chute diferente, tag "VOLLEY", squash menor, rastro mais fraco; timer no HUD.
- **Knobs:** duração 8000 ms, velocidade de subida 1400–1700, 1 por queda, cooldown 250 ms, whiff não quebra streak, peso 4% depois de 500 m.
- **Risco:** muda a regra central "só se chuta bola em queda"; ambiguidade de input; pode parecer outro jogo.
- **[A DEFINIR]** Isso preserva a identidade de um input? Recomendo 1 voleio por queda e só depois do playtest do core.

### 3.3 Consumíveis (loja/loadout)

Modelo já decidido no GDD: **3 slots, sem duplicatas, devolução ao pool**, preços em moedas soft. A loja v1 valida o sink com três itens; o quarto (Streak Saver), no Próximo, é o mínimo para o loadout ter escolha real.

#### Safety Net — "Rede de Proteção" · `[ENTREGUE 0.3.0]`

- **O que faz:** auto-ativa na morte; coloca a bola 180 u acima da linha com 1500 u/s para cima, uma carga; a run continua e conta como normal. Sem perda de moedas.
- **Pilares:** L (rede estica + "SAVED"); S (não exige skill, mas a run segue); R (a recuperação máxima); 3s (rede = salvamento).
- **Feedback:** flash, banner "SAVED!", som de febre; o item sai do loadout ao acabar.
- **Knobs:** `netRescueY` 180, `netLaunchSpeed` 1500, 1 carga, preço 50 moedas `[TESTE]`.
- **Risco:** integridade do best; se dispara tarde parece injusto, se dispara cedo parece trapaça.
- **[CONFIRMAR]** Run salva conta para o best? O GDD diz que sim. A implementação só dispara depois de a run começar (primeiro toque), para não gastar a carga em 0 m.

#### Magnet Start — "Ímã Inicial" · `[ENTREGUE 0.3.0]`

- **O que faz:** começa a run com Magnet por 15 s, a partir do primeiro toque (quando o placar começa), não do spawn; mesmo raio/puxão do pickup. Se pegar outro Magnet, vale a regra atual do GDD (reinicia 15 s, não soma).
- **Pilares:** L (aura + timer); S (rota por moedas desde o início); R (não é recuperação); 3s (aura = ímã).
- **Feedback:** aura e timer ligados no primeiro toque; som de pickup na primeira moeda.
- **Knobs:** duração 15 000 ms, raio 144, puxão 620, preço 30, 1 por run.
- **Risco:** adianta muitas moedas; com Midas, inflaciona; torna a rota inicial trivial.
- **[CONFIRMAR]** 15 s a partir do primeiro toque (implementado) ou 20 s a partir do spawn? O pickup reinicia para 15 s ou mantém o maior? Mantida a regra atual, sem soma.

#### Power Kick — "Chutão" · `[ENTREGUE 0.3.0]`

- **O que faz:** uma carga; o primeiro toque válido da run vira Chutão: velocidade fixa de 2750 u/s (o chute de fundo normal chega a 2600; a mola lança 2850), ângulo ainda definido pelo ponto de toque. Whiff não gasta; o primeiro toque válido consome.
- **Pilares:** L (banner + som); S (o ângulo continua seu); R (não é recuperação); 3s (um chute especial no começo).
- **Feedback:** som pesado, squash grande, shake, banner "CHUTÃO!", flash; o item sai do loadout ao acabar.
- **Knobs:** `chutaoSpeed` 2750, 1 carga, sem bônus lateral, Perfect soma +60 (2810, abaixo da mola), preço 40.
- **Risco:** subverte "força vem da queda" por um chute; se empilhar com Perfect/Aimed, estoura a hierarquia de forças.
- **[CONFIRMAR]** Gatilho: primeiro toque (implementado) × primeiro toque abaixo de 50% × botão manual. Ver §4.

#### Streak Saver — "Salva-Streak" · `[PRÓXIMO]`

- **O que faz:** uma carga; o próximo whiff não quebra o streak. Ícone de escudo ao lado do streak; se a febre estiver ativa, ela continua. Não protege contra morte nem contra obstáculo (regra do v1).
- **Pilares:** L (escudo + "STREAK SAFE"); S (protege a corrente de skill); R (recuperação de erro); 3s (escudo = proteção).
- **Feedback:** escudo racha, microtexto, ícone consumido; som curto.
- **Knobs:** 1 carga, só whiff, preço 20–30; sem efeito na morte.
- **Risco:** estado invisível; se obstáculo também quebra streak, a regra fica ambígua.
- **[A DEFINIR]** O que quebra o streak hoje: só whiff ou obstáculo também? Decidir antes do preço; recomendo só whiff no v1.

### 3.4 Outros elementos

#### Goal — "Trave/Gol" · `[PRÓXIMO]`

- **O que faz:** moldura de gol (dois postes + travessão) a cada 400–600 m; passar pelo vão = "GOAL!" + burst de moedas ou febre curta; postes e travessão são hard. Combina argola + hard, sem física nova.
- **Pilares:** L (silhueta universal); S (mirar um alvo com bordas duras); R (postes podem devolver a bola ao campo); 3s (é um gol).
- **Feedback:** rede estica, torcida sintética, banner "GOAL!", burst; postes com flash de hard.
- **Knobs:** vão 180×120, poste 14, a cada 400–600 m, bônus 15–25 moedas ou febre de 5 s, nunca antes de 100 m, 1 por tela.
- **Risco:** lê como argola gigante; poste duro pode desviar para a morte (nunca mata direto); celebração pode esconder a bola.
- **[CONFIRMAR]** Recompensa: moedas + febre curta (recomendado), bônus de altitude ou multiplicador? Altitude é o placar; evito bônus direto.

#### Biome — "Bioma" · `[DEPOIS]`

- **O que faz:** faixas visuais por altitude — rua 0–500, telhados 500–1500, céu 1500–3000, estratosfera 3000+ — mudando backdrop, paleta e parallax. No v1, nenhuma regra muda; a mistura pode mudar na fronteira numa fase seguinte.
- **Pilares:** L (cor como dica de dificuldade); S (não); R (não); 3s (transição gradual).
- **Feedback:** crossfade de 3 s, banner no limiar, camada de ambiência (depois); contraste dos elementos preservado.
- **Knobs:** limiares 0/500/1500/3000, transição 3000 ms, 4 paletas, contraste ≥ 4,5:1 para gameplay; mix só na fronteira.
- **Risco:** escopo de arte; contraste/legibilidade; tema indefinido no GDD; obstáculos por bioma multiplicam a matriz.
- **[A DEFINIR]** Tema: rua → telhados → céu → estratosfera (direção recomendada) ou abstrato? Decisão do usuário/Hefesto; v1 só visual, mix numa fase seguinte.

#### Daily Modifier — "Desafio do Dia" · `[DEPOIS]`

- **O que faz:** um modificador pré-run por dia (ex.: "No Springs", "Double Coins", "Fast Start"), mesma seed para todos, best local por modificador. Sem online no v1.
- **Pilares:** L (card legível); S (força rotas diferentes); R (varia); 3s (texto curto).
- **Feedback:** card no título, badge no HUD, resultado no fim.
- **Knobs:** 1/dia, 3 modificadores no pool, seed fixa, recompensa só cosmética ou bônus pequeno de moedas; sem afetar o best normal.
- **Risco:** vira treadmill de conteúdo; daily local sem online tem pouco retorno; precisa de save schema.
- **[A DEFINIR]** Daily local (recomendado no v1) ou só quando houver online? O online não está no escopo.

## 4. Chutão em destaque

**Pergunta:** o Chutão deve ser um pickup que aparece na fase ou um consumível comprado na loja?

| Critério | Pickup na fase | Consumível da loja |
|---|---|---|
| Descoberta | Orgânica, mas dependente de sorte de spawn | Garantida, escolhida antes da run |
| Conflito com Aimed | Disputa o mesmo estado "próximo toque" | Nenhum: Aimed continua o único "armed" |
| Orçamento de spawn | Ocupa peso de pickup e dilui Aimed/Magnet | Não ocupa spawn |
| Identidade da loja | Loja nasce com 2 itens (net, magnet start) | Loja nasce com 3 escolhas claras |
| Teste | Pode entrar antes da loja | Depende de save/loja/loadout |
| Falha | Regra de prioridade entre dois "armed" fica confusa | Quem não compra nunca vê o efeito |
| Economia | Grátis; não ensina o valor da moeda | Cria sink e ensina a economia |

**Recomendação (implementada na 0.3.0):** consumível da loja. Ele não colide com o Aimed, não consome o orçamento de spawn e dá à loja uma terceira âncora de poder. O gatilho é o **primeiro toque válido da run**, a **2750 u/s**, com `overrideSpeed` em `computeKick`; Perfect soma +60 (2810, abaixo da mola). O pickup pode voltar depois como "Power Boot", com prioridade explícita (Aimed > Chutão) ou armazenando o Chutão até o Aimed ser usado — mas isso é uma regra a mais para o jogador aprender.

**Efeito e gatilho recomendados:** uma carga; o **primeiro toque válido da run** vira Chutão a **2750 u/s**, mantendo o ângulo do ponto de toque; Perfect soma +60 (2810, ainda abaixo da mola); whiff não gasta; banner e som pesados. O gatilho "primeiro toque" é o único que não exige UI nova, não pode ficar preso (como "abaixo de 50%") e não cria um segundo input. O valor está em garantir o teto sem esperar, não em superar o chute de fundo; por isso 2750, não 3000. O custo é que ele ensina "força se compra" por um chute; por isso é uma carga, não um modo.

**Decisões do usuário:**

1. **Gatilho:** primeiro toque (recomendado) × primeiro toque abaixo de 50% × botão manual.
2. **Força:** 2700 (sutil) × 2750 (recomendado) × 2800 (quase mola); abaixo de 2600 seria downgrade do chute de fundo.
3. **Ângulo:** manter o toque (recomendado) × subir reto.
4. **Perfect:** soma +60, saturando no lançamento da mola (2850) × não soma.
5. **Preço:** 25–40 moedas `[TESTE]`; com 3 slots, o que ele tira?
6. **Contagem:** conta como chute limpo/streak? Recomendo sim; Perfect conta.
7. **Whiff:** não gasta (recomendado) × gasta.
8. **Se virar pickup:** qual a prioridade contra Aimed? Recomendo não ter os dois armados no v1.

## 5. O que NÃO fazer agora

- **Multiball:** multiplica alvos e quebra a leitura de uma bola; exige retunar câmera, spawn, chute e morte. Nenhuma evidência de que adiciona diversão — só complexidade.
- **Time-Warp / slow-mo / "Feather":** o pilar 2 só permite pausa consciente e rara (Aimed). Queda lenta é Time-Warp disfarçado; se entrar, só depois de o playtest mostrar que a queda é o gargalo, e como consumível raro, não pickup.
- **Zero-G:** remove a queda, que é o recurso central.
- **Preview de mira / linha de trajetória:** viola "o dedo é o pé"; o Aimed já é a exceção.
- **Obstáculos que matam ou escondem:** espinhos, névoa, projétil teleguiado. Quebram "perturbar, nunca matar" e legibilidade.
- **Bioma com regras próprias:** primeiro o visual; obstáculos por bioma multiplicam a matriz de balanceamento.
- **Online / ranking / daily online / ads/saves:** nada disso antes de retenção local e economia validadas.
- **Loja cosmética / skins de bola:** o sink de consumíveis precisa provar valor antes de abrir uma segunda loja.
- **Mais obstáculos sem orçamento de spawn:** a mistura atual já compõe com a queda progressiva; sem orçamento, vira injustiça.
- **Segunda vida / "extra life" além da Safety Net:** duas redes na mesma run anulam a tensão da morte.
- **Powerup que joga pelo jogador:** auto-chute fora da rede de proteção tira o skill; o jogo é o toque.

## 6. Nota sobre o GDD (sem editar)

A lista **"FORA do MVP1"** do GDD §6 não é mais uma declaração de escopo do próximo ciclo: ela mistura "fora do MVP1" com "fora da 0.2.0". Quando esta proposta for aprovada, o GDD deve ganhar uma seção **"Ciclo 0.3"** e mover para lá o que já estava em Pós-MVP (loja/loadout, rede de proteção, Chutão) e os novos itens desta entrega (Magnet Start, bola de futebol, damping lateral). Continuam fora: Time-Warp, multiball, zero-G, saves/AD, bioma com regras, online, placar online. Também vale fixar a nomenclatura: **Power Kick** é o nome EN oficial e **Chutão** o PT; se o usuário preferir "Chutão" como nome in-game, o GDD §5 muda junto. Nada disso foi editado agora.

## 7. Ordem recomendada de implementação

| # | Entrega | Depende de | Pode ir em paralelo com |
|---|---|---|---|
| 0 | **Fundação:** orçamento de spawn por 100 m, regras de quando cada pickup pode nascer, registro de conteúdo, flags de debug — **save/inventário/loadout entregues na 0.3.0; orçamento de spawn pendente** | — | Bola de futebol + damping (1) |
| 1 | **Bola de futebol + damping lateral:** visual da bola, `wallRestitution 0.8`, teste de quique — **entregue na 0.3.0** | — | Fundação (0) |
| 2 | **Loja v1:** Safety Net, Magnet Start, Power Kick; loadout de 3 slots; tela da loja/loadout (título) e tela de morte; preços — **entregue na 0.3.0** | 0 (save; o hook `overrideSpeed` já existe em `computeKick`) | 1 (visual) e partes da UI |
| 3 | **Onda de recuperação:** Bumper + Shield + Goal | 0 (spawn), 2 (regra de stacking do Shield com a rede) | Os três entre si, se os contratos de contato/spawn estiverem fechados |
| 4 | **Onda de skill:** Ramp + Sweet Spot + Streak Saver | 0 (spawn da Ramp) e 2 (HUD/loja do Streak Saver) | Ramp e Sweet Spot entre si; Streak Saver depende da regra de streak |
| 5 | **Onda de risco:** Crosswind + Shutter + Midas + Volley | 0 (zonas/força contínua), 2 (economia), playtest | Por arquivo, mas validação de design é sequencial |
| 6 | **Bioma + Daily Modifier** | decisão de tema, save schema, dados de retenção | Visual e meta entre si |

**Regras de paralelização:** cada item novo deve ser um arquivo/contrato próprio (`objects/obstacles/*`, `objects/interactives/*`, `ui/*`), com peso e tuning no `tuning.ts`; a UI da loja pode ser construída em paralelo aos efeitos dos consumíveis se o contrato de `ConsumableEffect` for fechado antes. **O que não paraleliza:** save v2 antes da loja; orçamento de spawn antes de qualquer novo spawnável; override de chute antes do Chutão; interceptação de contato antes do Shield; regra de streak antes do Streak Saver; regra de input antes do Volley. Tudo atrás de flag (como `FEATURES`) para a publicação não mostrar conteúdo pela metade.
