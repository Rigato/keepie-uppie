/**
 * TODOS os números de calibração vivem aqui. Nenhum outro arquivo pode hardcodar
 * valor de gameplay. Os valores marcados `[TESTE]` são pontos de partida do GDD.
 */
export const TUNING = {
  world: {
    width: 540,
    height: 1080,
    wallWidth: 14,
  },

  ball: {
    radius: 30,
    /**
     * Rotação visual (não muda a física): a rolagem é `vx / raio × fator`,
     * com teto em `spinMax`. 0.42 dá ~1,5 volta/s num chute lateral médio e
     * evita que o padrão vire um borrão nos chutes fortes. [TESTE]
     */
    spinRollFactor: 0.42,
    /** Teto da rolagem visual em rad/s (~2,9 voltas/s). [TESTE] */
    spinMax: 18,
    /**
     * Giro residual do chute a força cheia (rad/s). É somado à rolagem e
     * decai durante o voo; o toque central sai em backspin. [TESTE]
     */
    spinKick: 5.5,
    /** Peso do backspin no toque central, em fração do giro lateral máximo. [TESTE] */
    spinBackspin: 0.65,
    /** Decaimento exponencial do giro residual do chute (1/s). [TESTE] */
    spinDamping: 0.8,
    /** Giro decorativo da bola do título (rad/s): ~16 s por volta. [TESTE] */
    titleSpin: 0.4,
  },

  physics: {
    /** Queda mais flutuante: o arco normal cabe em 1.5–2.5 s sem virar projétil. */
    gravity: 1300, // u/s²
    /**
     * Quique nas paredes laterais. Abaixo de 1, cada quique devolve a bola
     * mais devagar: evita o efeito pinball de uma bola quase horizontal
     * quicando sem parar entre as bordas. [TESTE]
     */
    wallRestitution: 0.8,
    /** Quantos unidades de mundo equivalem a 1 metro de altitude. */
    pxPerMeter: 20,
    /**
     * Teto inicial de queda: a bola acelera só até aqui e depois cai em
     * velocidade constante. É o que mantém a janela de toque humana mesmo sem
     * mirar. A partir de `difficulty.stageMeters` este teto sobe em degraus.
     */
    maxFallSpeed: 900,
  },

  difficulty: {
    /**
     * Dificuldade por ritmo: a cada 500 m de altitude de pico, o teto de queda
     * sobe um degrau de 75 u/s. A 0.2.0 começa nos 900 aprovados e chega a
     * 1200 no topo da curva. [TESTE]
     */
    stageMeters: 500,
    fallSpeedStep: 75,
    /**
     * Limite do teto de queda. Com 1200 u/s a janela de toque ainda fica em
     * ~0,125 s (7 frames a 60 fps), contra 0,167 s na base — o mínimo que
     * mantém o chute de reflexo jogável no celular. [TESTE]
     */
    fallSpeedLimit: 1200,
  },

  kick: {
    /**
     * Piso: toque no ápice é um pulinho curto (~0.8 s de arco, ~5 m de
     * ganho). O risco de esperar a queda é o que paga a altura; tocar cedo
     * não pode render o mesmo que tocar no fundo. [TESTE]
     */
    minSpeed: 500,
    /**
     * Teto da curva-base: queda cheia, arco de ~3.4 s. A partir de 80% da tela
     * o boost profundo soma por cima deste teto (até `deepBonus`). [TESTE]
     */
    maxSpeed: 2200,
    /**
     * Queda (u) desde o ápice em que a curva-base satura. A velocidade de
     * queda tem teto em `physics.maxFallSpeed`, então é a distância caída que
     * continua recompensando quem espera. Com a catraca em 22%, a queda útil
     * até a linha de morte é ~872 u: 850 é quase o fundo. [TESTE]
     */
    fullPowerDrop: 850,
    /**
     * Expoente da curva-base (<1). Entrega boa parte da força cedo e ainda
     * cresce até 80%; é o trecho aprovado na 0.1.8 e não muda aqui. [TESTE]
     */
    powerCurve: 0.7,
    /**
     * Segundo estágio do fundo: de 80% da tela (626 u com o ápice em 22%) até
     * a linha de morte (872 u), a força ganha um boost com ganho marginal
     * crescente. Sem isso, cada trecho abaixo de 60–70% rendia menos que o
     * anterior e o fundo parecia "normalizado". A faixa até 80% não muda. [TESTE]
     */
    deepStartDrop: 626,
    deepFullDrop: 872,
    /**
     * Velocidade somada no fundo útil, acima do teto da curva-base. O chute no
     * fundo chega a 2600 u/s (2660 no perfect) e vira o grande golpe da run. [TESTE]
     */
    deepBonus: 400,
    /** Expoente do boost profundo (>1): o ganho cresce a cada trecho do fundo. [TESTE] */
    deepPowerCurve: 1.3,
    /** Componente lateral máxima no toque na borda. */
    maxLateral: 0.75,
    /** Janela central para o Perfect Touch, em fração do raio de ângulo. [TESTE] */
    perfectWindow: 0.22,
    /**
     * Área de toque generosa: acertar a bola é fácil mesmo com o dedo em
     * movimento. O ângulo usa `angleRadius`, não esta área.
     */
    touchRadius: 75,
    /** Área que define o ângulo: preserva a calibração de mira de 60 u. */
    angleRadius: 60,
    /** Tolera toque perto do ápice (vy levemente negativa) em vez de exigir queda pura. */
    apexTolerance: 120,
    /** Guarda um toque que chega pouco antes do ápice e dispara quando a bola fica chutável. */
    apexBufferMs: 160,
    /** Anel (de pontos) que comunica a área de toque; ferramenta de tuning, oculta por padrão. */
    ringRadius: 75,
  },

  camera: {
    /**
     * Linha de espera da catraca: a bola pode subir visivelmente até esta
     * fração da tela antes de a câmera começar a segui-la. Subiu de 34% para
     * 22% junto com `maxTop`: o ápice inteiro fica ~130 u mais alto na tela.
     */
    ratchetAt: 0.22,
    /** Velocidade de acompanhamento (lerp por segundo); menor = mais atraso. */
    followSpeed: 6,
    /**
     * A bola nunca sai acima desta fração do topo. 14% deixa o ápice logo
     * abaixo do HUD (a bola ainda cabe inteira) e é bem mais alto que os 26%
     * da 0.1.7 — é o teto visual da recompensa da queda.
     */
    maxTop: 0.14,
    /**
     * Força mínima para o chute puxar a câmera para trás. Abaixo disso o toque
     * é uma embaixadinha comum e a câmera não pisca. [TESTE]
     */
    kickZoomThreshold: 0.5,
    /**
     * Recuo máximo de zoom no chute cheio (12%). Em 390 px de largura tira
     * ~23 px de cada lateral e encolhe a bola de 36 para ~31,7 px — visível
     * no miolo da tela, não só nas laterais. [TESTE]
     */
    kickZoomMax: 0.12,
    /** [TESTE] Velocidade exponencial de abertura no chute (1/s): abre rápido. */
    zoomOpenSpeed: 8,
    /** [TESTE] Velocidade de fechamento no ápice (1/s): fecha em ~0,6–0,9 s. */
    zoomCloseSpeed: 4.5,
  },

  run: {
    /** Tempo entre a morte e a tela de fim. */
    deathDelayMs: 900,
    /** Altura de spawn inicial da bola (a partir do topo). */
    spawnY: 220,
    /** Gravidade reduzida antes do primeiro chute: janela justa de entrada. */
    serveGravityScale: 0.6,
  },

  perfect: {
    /**
     * Bônus de velocidade do Perfect Touch (u/s), somado depois da curva de
     * queda. É pequeno e pode passar um pouco do teto normal: o perfect
     * premia a mira sem substituir o timing. [TESTE]
     */
    speedBonus: 60,
  },

  obstacle: {
    /**
     * Barreira de jogadores de falta: hitbox honesta com os quatro corpos
     * lado a lado. A largura é a mesma da antiga folhagem; a altura cresce
     * para caber cabeça, camisa, short e chuteira. [TESTE]
     */
    barrierWidth: 152,
    barrierHeight: 32,
    /**
     * Quique da barreira: a bola sempre sai para cima e para um dos lados.
     * `restitution` escala a velocidade de entrada (com piso em `minLift`);
     * `sideKick` + `sideCarry` definem a saída lateral, limitada por `maxSide`.
     * [TESTE]
     */
    barrierRestitution: 0.72,
    barrierMinLift: 620,
    barrierSideKick: 300,
    barrierSideCarry: 0.12,
    barrierMaxSide: 520,
    breakableWidth: 106,
    breakableHeight: 21,
    /** Velocidade mínima para romper o breakable (recalibrada com a nova faixa de chute). [TESTE] */
    breakSpeed: 1800,
    birdWidth: 37,
    birdHeight: 21,
    birdRadius: 11,
    birdSpeed: 240,
    flockSize: 4,
    flockDurationMs: 3600,
    birdDeflect: 260,
    /** Bumper: almofada circular que reflete a bola na direção radial. [TESTE] */
    bumperRadius: 34,
    bumperRestitution: 0.9,
    bumperCooldownMs: 350,
    /** Ramp: barra diagonal; ângulo em graus e espessura. [TESTE] */
    rampWidth: 120,
    rampHeight: 14,
    rampAngleDeg: 35,
    rampRestitution: 0.95,
    /** Evita múltiplos contatos do mesmo obstáculo no mesmo toque. */
    contactCooldownMs: 120,
    /** Obstáculos abaixo desta margem da câmera são descartados. */
    despawnMargin: 260,
  },

  spawn: {
    /** Primeiro evento só depois de o jogador começar a subir. */
    firstAtMeters: 28,
    /**
     * Passo entre obstáculos suavizado por smoothstep de 0 a `stepAtMeters`.
     * 200 m no início → 176.7 em 500 → 133.3 em 1000 → 110 m em 2000.
     * A curva contínua substitui o antigo degrau em 1200 m e evita "paredes"
     * de densidade no meio da run. [TESTE]
     */
    startStepMeters: 200,
    minStepMeters: 110,
    stepAtMeters: 1500,
    /** Obstáculo nasce acima do topo da câmera. */
    aboveTop: 150,
    jitterY: 120,
    /** Corredor livre em torno do x da bola ao escolher a posição. */
    safeXGap: 110,
    edgeMargin: 26,
    maxPerUpdate: 3,
    /** Faixa (dentro da tela) onde o bando entra. */
    birdBandTop: 140,
    birdBandHeight: 180,
    /**
     * Folga da caixa de layout do bando: a formação em V espalha companheiros
     * ~18 u em x (atrás do líder) e em y (asas/fileiras). [TESTE]
     */
    birdFlockSpread: 18,
    /**
     * Folga mínima entre retângulos de spawn (borda a borda) e limites de
     * tentativas do layout. 16 laterais + 4 recuos verticais dão espaço
     * suficiente sem custo perceptível por frame. [TESTE]
     */
    overlapGap: 12,
    placementAttempts: 16,
    placementLevels: 4,
    /**
     * Âncoras do mix de obstáculos, interpoladas com smoothstep entre as
     * vizinhas (sem faixas com degrau). Ordem dos pesos:
     * [barrier, breakable, bird, bumper, ramp]. Cada âncora soma 100.
     * Bumper/ramp entram com peso 0 em 0 e 300 m e crescem suavemente depois
     * disso; o hard foi removido e os demais pesos foram renormalizados. [TESTE]
     */
    mix: [
      { meters: 0, weights: [67, 33, 0, 0, 0] },
      { meters: 300, weights: [42, 33, 25, 0, 0] },
      { meters: 600, weights: [25, 28, 24, 14, 9] },
      { meters: 1200, weights: [17, 23, 25, 19, 16] },
    ],
  },

  collect: {
    coinRadius: 13,
    coinValue: 1,
    /**
     * Moeda especial: maior, vale 5 (10 na febre) e só nasce a partir de
     * `coinSpecialMinMeters`. [TESTE]
     */
    coinSpecialRadius: 18,
    coinSpecialValue: 5,
    /** [CONFIRMAR] com o usuário: default proposto 400 m. [TESTE] */
    coinSpecialMinMeters: 400,
    ringRadius: 50,
    ringThickness: 8,
    /** Fração do raio da argola que conta como "passou por dentro". */
    ringPassRatio: 0.55,
    ringCoinBurst: 8,
    springWidth: 70,
    springHeight: 18,
    /** Recalibrada para continuar acima do chute máximo com o boost profundo. */
    springLaunchSpeed: 2850,
    springCooldownMs: 350,
    pickupRadius: 21,
  },

  interactive: {
    firstAtMeters: 18,
    /**
     * Passo dos interativos também é suave: 70 m em 0 → 57.2 em 500 →
     * 38.5 em 1000 → 36 m em 2000 (smoothstep até 1200 m). [TESTE]
     */
    startStepMeters: 70,
    minStepMeters: 36,
    stepAtMeters: 1200,
    /** Interativos nascem acima do topo da câmera. */
    aboveTop: 130,
    jitterY: 170,
    /** Passo base e arco usados por TODOS os padrões de `coin-patterns.ts`. [TESTE] */
    coinSpacing: 44,
    coinArc: 28,
    edgeMargin: 44,
    maxPerUpdate: 2,
    /**
     * Pesos dos padrões de spawn de moedas, na ordem do sorteio.
     * Âncoras fixas: sem gating por altitude; a estrela é a mais rara. [TESTE]
     */
    coinPatterns: [
      { id: 'trail', weight: 34 },
      { id: 'row', weight: 18 },
      { id: 'square', weight: 16 },
      { id: 'zigzag', weight: 16 },
      { id: 'diamond', weight: 9 },
      { id: 'star', weight: 7 },
    ],
    /**
     * Pesos FIXOS dos não-moedas: argola, mola, magnet, aimed, shield, sweet.
     * A fatia da moeda vem de `coinWeightAnchors` e cresce com a altitude;
     * `pickKind` junta os dois vetores e normaliza no sorteio. [TESTE]
     */
    weights: [18, 10, 9, 5, 4, 4],
    /** Peso da moeda: 50 em 0 m → 55 em 600 → 60 em 1500, com smoothstep. [TESTE] */
    coinWeightAnchors: [
      { meters: 0, weight: 50 },
      { meters: 600, weight: 55 },
      { meters: 1500, weight: 60 },
    ],
  },

  powerup: {
    /** Janela do Aimed Shot. [TESTE] */
    aimWindowMs: 2000,
    /** Força mínima aceitável no timeout; abaixo disso aplica média default. */
    aimMinForceRatio: 0.15,
    aimDefaultForceRatio: 0.5,
    /** Arrasto (em unidades de mundo) que satura a força. */
    aimMaxDrag: 220,
    /** Arrasto mínimo para a mira contar; abaixo disso é "tap" e usa a força default. */
    aimDeadZone: 24,
    /** Faixa de velocidade do tiro mirado, fora da faixa normal (recalibrada com g=1300). */
    aimMinSpeed: 1200,
    aimMaxSpeed: 3000,
    /**
     * Duração do Magnet do MUNDO (pickup). O consumível ativável da barra usa
     * `TUNING.consumable.magnetDurationMs` — são durações distintas. [TESTE]
     */
    magnetDurationMs: 15000,
    /** Raio de puxão (−20% da calibração anterior); a aura acompanha. [TESTE] */
    magnetRadius: 144,
    magnetPullSpeed: 620,
    /**
     * Escudo: janela com uma carga. O próximo contato com obstáculo vira um
     * quique amigável para cima, ignorando dreno/estilhaço/desvio. [TESTE]
     */
    shieldDurationMs: 12000,
    shieldRescueVy: -750,
    /**
     * Ponto Doce: janela do Perfect ×1.8 e bônus de velocidade ×1.5 (60→90).
     * É um buff de precisão, não uma linha de trajetória. [TESTE]
     */
    sweetDurationMs: 10000,
    sweetWindowScale: 1.8,
    sweetBonusScale: 1.5,
  },

  consumable: {
    /**
     * Duração do Magnet da BARRA (consumível ativável). Diferente do pickup do
     * mundo (`powerup.magnetDurationMs`, 15 s): o HUD mostra a duração ativa.
     * [TESTE]
     */
    magnetDurationMs: 45000,
    /**
     * Impulso vertical da rede de proteção ao salvar a bola na linha de morte.
     * Modesto de propósito: é uma segunda chance, não um atalho de altitude. [TESTE]
     */
    netLaunchSpeed: 1500,
    /** Quanto acima da linha de morte a bola reaparece depois da rede. [TESTE] */
    netRescueY: 180,
    /**
     * Velocidade do chute quando o Chutão é ativado. Fica acima do chute de
     * fundo (2600) e abaixo da mola (2850); o Perfect soma +60. [TESTE]
     */
    chutaoSpeed: 2750,
  },

  goal: {
    /** Primeiro gol depois de o jogador já ter pegado o ritmo. [TESTE] */
    firstAtMeters: 200,
    minGapMeters: 400,
    maxGapMeters: 600,
    /** Vão do gol (entre postes) e espessura dos postes. [TESTE] */
    gapWidth: 180,
    gapHeight: 120,
    postThickness: 14,
    /** Bônus em moedas ao atravessar o vão. [TESTE] */
    coinBonus: 15,
    /** Gol nasce acima do topo da câmera. */
    aboveTop: 170,
  },

  streak: {
    /** Chutes limpos para o primeiro rótulo. [TESTE] */
    niceAt: 3,
    greatAt: 6,
    onFireAt: 10,
    /** Duração da febre. [TESTE] */
    feverMs: 8000,
    coinMultiplier: 2,
    /** Raio visual da aura de febre (acompanha a redução dos elementos). */
    feverAuraRadius: 56,
    /**
     * Bônus sutil de força do streak, aplicado à curva normal do chute (não ao
     * Chutão) e calculado com o streak ANTES do chute atual. Os bônus de moedas
     * e febre não mudam. [TESTE]
     */
    kickBoostPerKick: 0.005,
    /** Teto do bônus de força: 5% em 10 chutes limpos (ON FIRE). [TESTE] */
    kickBoostMax: 0.05,
  },

  stamina: {
    max: 100,
    /** Custo de um chute válido. 100/30 = 3 chutes cheios antes de esgotar. */
    kickCost: 30,
    /** Recarga por segundo fora da exaustão; 24/s torna 1 chute a cada ~1,25 s sustentável. */
    regenPerSecond: 24,
    /** Bloqueio após esgotar; a barra recarrega rápido de 0 a max nesse intervalo. */
    recoverMs: 1200,
  },

  fx: {
    hitStopMs: 40,
    shakeKick: 0.0035,
    shakeHard: 0.008,
    shakeShatter: 0.006,
  },

  ui: {
    hudMargin: 28,
  },
} as const

export type Tuning = typeof TUNING
