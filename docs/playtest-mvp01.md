# Playtest — Keepie-Uppie MVP01

**Build:** `0.1.1-mvp1` · F7 · https://rigato.github.io/keepie-uppie/
**Objetivo:** responder as 6 perguntas do plano de design. O playtest decide o que vem depois; o documento não.

## Antes de começar

- **10–15 minutos**, som ligado, celular na mão (é o alvo principal). Se possível, repita no desktop.
- **Três runs livres** antes de analisar: a primeira é para aprender, não para julgar.
- **Toque dentro do anel de pontos** ao redor da bola; ele só aparece quando ela pode ser chutada (na queda). Não tente acertar o círculo exato.
- Não há tutorial de texto: a run é o tutorial. "TAP THE BALL" é a única instrução.
- `?resetSave=1` zera melhor score e moedas.
- `?debug=1` mostra chute (arco/força), posição da bola, streak, powerup e um botão de reset do save. Use só se precisar de número; o painel cobre parte da tela.
- **Não são bugs conhecidos:** desktop estreito (portrait-first), arte geométrica de placeholder, ausência de música, reiniciar pela pausa descartar a run atual.

## Roteiro rápido

1. **Aquecimento (2 runs):** jogue sem pensar em nada. Só sinta o chute e a queda.
2. **Ângulo e força:** toque no centro, na esquerda e na direita da bola. Tente chutar fraco e forte (deixando a bola cair mais).
3. **Whiff:** erre o toque de propósito; note o custo (tempo, pânico, streak).
4. **Obstáculos:** identifique cada um pela silhueta/som. Tente morrer batendo em um: não deve ser possível.
5. **Rota:** busque uma trilha de moedas, atravesse uma argola, pise numa mola. Vale o desvio?
6. **Powerups:** pegue o ímã e passe perto de moedas; pegue a mira, arraste e solte. Deixe a mira expirar uma vez.
7. **Streak:** encadeie chutes limpos até a febre; erre um whiff e veja a quebra.

## As 6 perguntas

Dê uma nota de **1 a 5** e escreva uma frase. "1" = falhou, "5" = promessa cumprida.

### 1. O kick é gostoso?

*O que observar:* ângulo e força legíveis no primeiro minuto; o chute parece resposta ao dedo ou sorte? O whiff parece custo justo, não bug? O arco dá tempo de ler a queda?

Nota: ___ / 5
Comentário:

### 2. Perturbar > matar?

*O que observar:* os obstáculos geram improviso e recuperação, ou punição? Você morreu e culpou o obstáculo (não a própria queda)? Algum contato pareceu injusto/ilegível?

Nota: ___ / 5
Comentário:

### 3. Rota com propósito?

*O que observar:* argolas, molas e moedas criam decisões reais de desvio, ou são decoração? Você mudou de trajetória por causa de uma recompensa? A recompensa valeu o risco?

Nota: ___ / 5
Comentário:

### 4. Streak puxa "mais uma run"?

*O que observar:* perfect e rótulos dão vontade de encadear? Você tentou de novo por causa do streak/best? A febre parece conquistada?

Nota: ___ / 5
Comentário:

### 5. Aimed Shot é poder, não freio?

*O que observar:* a pausa de 2 s é um momento de "carta na manga" ou quebra o flow? O arrasto é preciso no dedo? O timeout com força média é justo? Voltar ao ritmo depois do tiro é natural?

Nota: ___ / 5
Comentário:

### 6. Magnet dá suco?

*O que observar:* puxar moedas é satisfatório? O raio/duração incentivam uma rota por moedas? Re-pegar e reiniciar o timer é claro?

Nota: ___ / 5
Comentário:

## Como reportar

Classifique cada item:

| Tipo | Exemplo |
|---|---|
| **Bloqueio** | não abre, trava, perde save, input morto |
| **Bug** | "toca na bola e nada acontece", "a bola atravessa a barra", texto cortado |
| **Feel** | "o chute parece fraco", "a câmera assusta", "a mira é escorregadia" |
| **Tuning** | "muitos obstáculos", "o ímã puxa longe demais", "a febre dura pouco" |
| **Design** | "queria que a mola…", "esse obstáculo não deveria…" |

Inclua: **build no rodapé** (`F7 · …`), aparelho/navegador, passos, o que esperava e o que aconteceu. Se der, um print ou vídeo de 5 s. Para problemas de número, abra `?debug=1` e mande o valor de `KICK arc/power` e `BALL`.

## Formulário (copiar e preencher)

```text
Build:
Aparelho / navegador:
Runs jogadas:

1. Kick:            __/5  ______________________________________
2. Perturbar>matar: __/5  ______________________________________
3. Rota:            __/5  ______________________________________
4. Streak:          __/5  ______________________________________
5. Aimed Shot:      __/5  ______________________________________
6. Magnet:          __/5  ______________________________________

Melhor momento:
Pior momento:
O que você tiraria:
O que você adicionaria:
Bug bloqueante? ( ) não ( ) sim — descrição:
```

## O que este teste NÃO cobre

- Retenção de longo prazo, monetização e performance em hardware fraco.
- Publicação nos portais (Bridge/Playgama/CrazyGames), que entra depois do playtest.
- Tema/arte/áudio finais — a direção visual e sonora ainda está em aberto no GDD.
