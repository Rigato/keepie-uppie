# Fix 17 — Soft de folhagem e economia 2,5×

| | |
|---|---|
| **Data** | 25/11/2026 |
| **Build** | `0.7.0-mvp1` · F7 · `0f3b592` |
| **Pacote** | `release/keepie-uppie-v0.7.0-mvp1.zip` · 362,2 KiB · SHA-256 `82fe5aa569163148a4e653f9591264fbd4ef8af1a29ddfab71876066933893c6` |
| **URL** | https://rigato.github.io/keepie-uppie/ |

## O pedido

> "1- Repensar o obstaculo soft que deixa a bola passar desacelerando ela (toldo?). Digo repensar em termos visuais e formato.
> 2- É muito fácil acumular diversas moedas. O preço das coisas no shop precisa aumentar 2-3x."

## 1. Soft: de toldo para folhagem

O soft era um retângulo arredondado de tecido com linhas horizontais — lia como
um **toldo** ou uma barra macia. A 0.7.0 troca a silhueta por uma **folhagem**:
folhas pontudas sobrepostas, em duas camadas de verde, sem nenhuma aresta reta.

- **Formato:** onze folhas em leque (três atrás, cinco na frente e três
  penduradas), cada uma desenhada como uma lente pontuda com nervura central,
  brilho no topo e contorno escuro. As pontas caem para os lados e o conjunto
  tem uma base irregular; não existe mais um retângulo.
- **Leitura:** a silhueta orgânica diz "dá para atravessar" antes do contato, e
  a cor verde continua a mesma família do soft antigo — a mudança é de forma,
  não de código de cor.
- **Hitbox e regra intactas:** continua um retângulo de **152×18** que aplica
  `damp` com `softDamp` 0,45, sem desviar. O desenho pode passar alguns pixels
  da faixa (as folhas penduradas), mas a colisão não mudou.
- **Feedback mantido:** o contato achata a folhagem em Y por 70 ms + yoyo e
  solta a ondulação no ponto exato do toque. O galho fino atrás das folhas dá
  leitura de arbusto sem criar uma segunda superfície.

Capture em 390×844 @2×: `/tmp/opencode/keepie-soft-full.png` (jogo) e
`/tmp/opencode/keepie-soft-zoom.png` (aproximação).

## 2. Economia: preços 2,5×

A coleta estava fácil demais para o custo dos consumíveis. Os quatro preços
subiram **2,5×**, mantendo a ordem de valor relativo:

| Consumível | Antes | Agora | Multiplicador |
|---|---:|---:|---:|
| Safety Net | 50 | **125** | 2,5× |
| Magnet | 30 | **75** | 2,5× |
| Power Kick | 40 | **100** | 2,5× |
| Streak Saver | 25 | **60** | 2,4× |

- Nada de efeito, duração, carga ou inventário mudou: só o preço em
  `src/core/consumables.ts`, que é a fonte única da loja.
- A loja continua legível com três dígitos (`125 COINS`); o card foi conferido
  em 390×844.
- O teste `tests/shop.test.ts` deixou de usar um saldo fixo de 100 moedas
  (agora abaixo do preço da Safety Net) e compra com 200.

## Validação

- Typecheck limpo; **195/195 testes** (16 arquivos); build ok; `git diff --check`
  limpo.
- Smoke E2E **12/12** (390×844 @2×), zero `pageerror`/`console.error`.
- Capturas da loja: `/tmp/opencode/keepie-shop-prices.png` (125/75/100/60).

## Ajuste fino

- Os preços são `[TESTE]`. Se ainda acumular moeda demais, o próximo passo é
  subir de novo (3× seria 150/90/120/75) ou reduzir o valor dos conjuntos; se
  ficar caro demais para a primeira compra, volte um degrau.
- A direção visual da folhagem é `[CONFIRMAR]`. Se ela ainda não ler como
  "atravessa e desacelera" no celular, as alternativas já desenhadas são a rede
  frouxa (hammock) e uma nuvem densa; a hitbox e o dreno continuam iguais em
  qualquer uma.
