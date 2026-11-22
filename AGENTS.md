# AGENTS.md — Trails

Instruções permanentes para agentes de IA trabalhando neste projeto. O usuário fala português; a documentação é mantida em português.

## O projeto

**Keepie-uppie** - game de embaixadinhas de futebol para telas de toque e mouse no PC.

- Fonte única de verdade de design: `docs/gdd-keepie-uppie.md`.
- Requisitos técnicos a considerar na implementação pensando na publicação: `docs/spec-tecnica-publicacao.md` (referência ativa, herdada do projeto anterior).

## Regras

1. **Nome do jogo é Keepie-uppie.**
2. **Toda documentação vive em `docs/`.** Documento substituído move-se para `docs/old/` — nunca apagar sem decisão explícita do usuário.
3. **Estrutura de pastas é similar entre os projetos** (`old/`; no futuro `release/`, `research/`) — use esses nomes quando as pastas surgirem. **Não acesse a estrutura de pastas de outros projetos** (ex.: Bricklike).
4. **Subagentes usam DeepSeek V4.1 Flash com reasoning MAX**: `opencode-go/deepseek-v4.1-flash#max`, salvo indicação explícita do usuário em contrário.
5. **Design é decisão do usuário** (com o agente de design dele, Hefesto). Agentes não fecham decisões de design sozinhos: registram no GDD como `[CONFIRMAR]` (recomendação pendente de aprovação) ou `[A DEFINIR]` (fronteira aberta).
6. **Git e GitHub.** O projeto é versionado com git e o remote é [`https://github.com/Rigato/keepie-uppie`](https://github.com/Rigato/keepie-uppie). Ao completar uma mudança, faça commit e push. O GitHub Pages do repositório servirá o jogo para testes — principalmente no celular — então o que estiver publicado precisa refletir sempre o estado mais recente jogável.

## Convenção de etapas e contrato de entrega

Vocabulário padrão para planejar e executar trabalho. É genérico de propósito: vale para qualquer projeto e não fixa quantidade de etapas.

- **Fase (F)** — etapa de implementação com entrega funcional/jogável, commit e push. A quantidade e o conteúdo das fases são definidos no plano de cada projeto.
- **Lote (L)** — unidade de trabalho paralelizável dentro de uma fase, com escopo e ownership de arquivos próprios, normalmente executada por um subagente.
- **Bloco (B)** — critério de aceite definido no documento de design/requisitos. Uma fase pode fechar um ou mais blocos.

Contrato de entrega:

1. **Executar as fases em sequência, sem pausa para validação intermediária**, salvo dúvida ou problema importante que exija decisão do usuário. Dúvidas menores são decididas pelo agente e documentadas com a justificativa.
2. **Cada fase termina com commit e push.** O branch principal e a publicação servem apenas a última fase **completa e funcional**.
3. **Trabalho da fase seguinte não entra no branch principal** até estar integrado e com os gates verdes — o build publicado nunca quebra no meio de uma fase.
4. O usuário testa a última fase publicada **enquanto** a próxima é implementada; os comentários acumulam para uma rodada de correção ao final.
5. **Rótulo de build visível** (fase, versão e sha curto) para o usuário saber o que está testando; recarga forçada quando houver suspeita de cache.
6. Ao concluir todas as fases, o usuário entrega a lista consolidada de ajustes e o agente refaz o que for necessário.
7. Decisão de design continua sendo do usuário; o agente registra `[CONFIRMAR]`/`[A DEFINIR]` em vez de fechar sozinho. Decisão técnica é do agente.
