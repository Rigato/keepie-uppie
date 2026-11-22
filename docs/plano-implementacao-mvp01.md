# PLANO DE IMPLEMENTAÇÃO — MVP 01 · Keepie-Uppie

| | |
|---|---|
| **Data** | 18/11/2026 |
| **Para** | Orquestrador de implementação (Opencode) — documento de DESIGN/handoff: escopo, alvos de calibração, critérios de aceite. **Nenhuma decisão técnica de engine/arquitetura está aqui** — isso é do usuário/orquestrador. |
| **Fonte de verdade** | `gdd-keepie-uppie.md` (regras) · `ideia-semente.md` (histórico de decisões) |
| **Idioma dos textos in-game** | Inglês |

## O que o MVP1 precisa PROVAR (as 6 perguntas do playtest)

1. **O kick é gostoso?** Ângulo e força legíveis no primeiro minuto; whiff parece custo justo, não bug.
2. **Perturbar > matar?** Obstáculos geram improviso e recuperação — não punição. (Se o playtester morrer por causa de um obstáculo e culpar O OBSTÁCULO, falhou.)
3. **Rota com propósito?** Argolas/molas/moedas criam decisões reais de desvio, não só decoração.
4. **Streak puxa "mais uma run"?** Perfect + rótulos geram a vontade de encadear.
5. **Aimed Shot é poder, não freio?** A pausa de 2s é um MOMENTO (sensação de carta na manga) e não quebra o flow quando volta.
6. **Magnet dá suco?** Puxar moedas satisfaz e incentiva rota por moedas.

## Critérios de aceite por bloco

### B1 — Core loop
- [ ] Chute SÓ se a bola estiver caindo (bola subindo: toque não faz nada).
- [ ] Ângulo oposto ao ponto de toque (esquerda→sobe direita); centro = reto.
- [ ] Força cresce com a velocidade de encontro; piso de força mínima (toque hesitante não condena).
- [ ] Whiff: nada acontece (sem penalidade).
- [ ] Início: bola cai do topo-centro; primeiro toque zera/inicia o placar.
- [ ] Câmera-catraca: sobe com a bola, nunca desce; fundo da tela = linha de morte.
- [ ] Paredes laterais: quique; sem wrap-around.
- [ ] Morte: bola cruza o fundo → tela de fim em ~1s → retry em 1 toque.
- [ ] Placar: metros (altitude) + moedas; best local persistente entre sessões.

### B2 — Obstáculos (nenhum mata)
- [ ] Birds: atravessam, desvio leve; bando ocasional (~3–4s de evento).
- [ ] Hard: quique refletido; feedback forte e claro.
- [ ] Soft: drena força (deformação visível no contato).
- [ ] Breakable: bola veloz rompe com estilhaço; bola lenta é desviada.
- [ ] Cada interação tem som + efeito — zero silêncio (pilar de legibilidade).
- [ ] Spawn procedural com densidade crescente por altitude (mix muda; regra nunca).

### B3 — Interativos
- [ ] Rings: bola atravessa → burst de moedas + celebração.
- [ ] Springs: lançam a bola alto sem consumir chute; posicionadas como atalho ousado.
- [ ] Coins: coleta por contato com som/contador.
- [ ] Pickups de powerup: visíveis, pegos por contato da bola.

### B4 — Powerups
- [ ] **Aimed Shot:** pickup arma o próximo toque (sem prazo); tocar a bola abre a pausa de mira com UI de arrasto (linha/indicador + timer visível); janela **2s**; soltar dispara; expirar dispara com a mira atual; força baixa demais no timeout → **força média default**.
- [ ] **Magnet:** 15s puxando só moedas; re-pegar reinicia pra 15s (não soma); ícone/estado ativo visível.

### B5 — Camadas de skill
- [ ] Perfect Touch: janela central da bola → rótulo "PERFECT" + força no topo da faixa.
- [ ] Streak: chutes limpos consecutivos → rótulos escalonados em EN → febre (moedas x2) no topo.
- [ ] Streak quebra em whiff; colisão com obstáculo NÃO quebra (variante de tuning se o playtest pedir rigor).

## Alvos de calibração (valores INICIAIS de teste — calibrar no playtest)

| Parâmetro | Valor inicial | Alvo de feel |
|---|---|---|
| Arco de chute normal | — | **1.5–2.5s de voo** (nem tempo morto, nem ping-pong) |
| Piso de força | lance mínimo alcança ~1/3 da altura da tela | hesitação não mata |
| Janela do Aimed Shot | 2.0s | dá pra decidir sem dar pra planejar |
| Força média default do timeout | meio da faixa normal | timeout não condena |
| Duração do Magnet | 15s | suco sem virar modo de jogo |
| Raio do Magnet | ~1/3 da largura da tela | puxão percebido, não tela inteira |
| Janela do Perfect | ~25% do raio central da bola | celebrado ~1 em 5 chutes bons |
| Densidade de obstáculos | 1 evento relevante a cada ~10s de subida, crescendo | sempre algo pra ler, nunca parede de ruído |
| Rótulos do Streak (EN) | NICE → GREAT → ON FIRE | crescente e pronunciável |

## Ordem sugerida de build (design-first, feel cedo)

1. **Core kick feel** — bola + chute (ângulo/força/whiff) num cenário vazio. Sem morte. É o bloco que decide se o jogo existe.
2. **Morte e câmera** — catraca, linha de morte, paredes, início de run, retry rápido.
3. **Obstáculos** — hard → birds → soft → breakable (ordem de legibilidade crescente).
4. **Interativos** — moedas → argolas → molas.
5. **Powerups** — Magnet → Aimed Shot (o aimed por último do bloco: é a exceção, exige o core redondo).
6. **Skill layers** — perfect → streak → febre.
7. **Pass de legibilidade/suco** — sons, partículas, tempos de leitura.

*A ordem é sugestão de design (feel primeiro, meta depois); a execução técnica é livre do orquestrador.*

## NÃO-escopo explícito (não construir no MVP1)

Time-Warp · Power Kick/Chutão · multiball · zero-G · câmera-creep · saves de qualquer tipo (AD ou consumível) · loja/loadout/pool · biomas · placar online · tutorial com texto.

## Notas pro orquestrador

- Engine/stack: decisão do usuário/orquestrador; critérios no GDD §1.
- Documento vivo: mudança de regra passa pelo GDD/semente primeiro — este plano segue a fonte de verdade.
- O playtest responde as 6 perguntas; TODA decisão de número aqui é substituível por elas.
