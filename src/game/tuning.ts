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
  },

  physics: {
    /** Queda mais flutuante: o arco normal cabe em 1.5–2.5 s sem virar projétil. */
    gravity: 1300, // u/s²
    wallRestitution: 1,
    /** Quantos unidades de mundo equivalem a 1 metro de altitude. */
    pxPerMeter: 20,
    /**
     * Teto de queda: a bola acelera só até aqui e depois cai em velocidade
     * constante. É o que mantém a janela de toque humana mesmo sem mirar.
     */
    maxFallSpeed: 900,
  },

  kick: {
    /**
     * Piso: toque no ápice é um pulinho curto (~0.8 s de arco, ~5 m de
     * ganho). O risco de esperar a queda é o que paga a altura; tocar cedo
     * não pode render o mesmo que tocar no fundo. [TESTE]
     */
    minSpeed: 500,
    /** Teto da faixa normal: queda cheia, arco de ~2.4 s. [TESTE] */
    maxSpeed: 1550,
    /**
     * Queda (u) desde o ápice que satura a força. A velocidade de queda tem
     * teto em `physics.maxFallSpeed`, então é a distância caída que continua
     * recompensando o jogador que espera a bola descer mais. [TESTE]
     */
    fullPowerDrop: 640,
    /**
     * Expoente da curva de queda (<1). Dá força já nos primeiros trechos e
     * evita um "vale" em que esperar um pouco renderia menos ganho líquido
     * do que tocar no ápice. [TESTE]
     */
    powerCurve: 0.85,
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
     * fração da tela antes de a câmera começar a segui-la.
     */
    ratchetAt: 0.34,
    /** Velocidade de acompanhamento (lerp por segundo); menor = mais atraso. */
    followSpeed: 6,
    /**
     * A bola nunca sai acima desta fração do topo. 26% deixa o ápice abaixo
     * do scrim do HUD e devolve espaço de leitura acima da bola.
     */
    maxTop: 0.26,
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
    /** Hard mais estreito que os demais: refletir para baixo é punitivo. */
    hardWidth: 100,
    hardHeight: 14,
    softWidth: 152,
    softHeight: 18,
    breakableWidth: 106,
    breakableHeight: 21,
    /** Velocidade mínima para romper o breakable (recalibrada com a nova faixa de chute). [TESTE] */
    breakSpeed: 1350,
    /** Fração de velocidade perdida no soft. */
    softDamp: 0.45,
    birdWidth: 37,
    birdHeight: 21,
    birdRadius: 11,
    birdSpeed: 240,
    flockSize: 4,
    flockDurationMs: 3600,
    birdDeflect: 260,
    /** Evita múltiplos contatos do mesmo obstáculo no mesmo toque. */
    contactCooldownMs: 120,
    /** Obstáculos abaixo desta margem da câmera são descartados. */
    despawnMargin: 260,
  },

  spawn: {
    /** Primeiro evento só depois de o jogador começar a subir. */
    firstAtMeters: 28,
    /** Distância entre eventos no início e no fim da curva (densidade cresce). */
    startStepMeters: 190,
    minStepMeters: 115,
    stepAtMeters: 1200,
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
    /** Pesos por faixa de altitude: [hard, soft, breakable, bird]. */
    mix: [
      { maxMeters: 120, weights: [55, 30, 15, 0] },
      { maxMeters: 300, weights: [40, 25, 20, 15] },
      { maxMeters: 1_000_000, weights: [30, 20, 25, 25] },
    ],
  },

  collect: {
    coinRadius: 13,
    coinValue: 1,
    ringRadius: 50,
    ringThickness: 8,
    /** Fração do raio da argola que conta como "passou por dentro". */
    ringPassRatio: 0.55,
    ringCoinBurst: 8,
    springWidth: 70,
    springHeight: 18,
    /** Recalibrada para manter o mesmo ápice com a gravidade nova (era 2650 com g=1700). */
    springLaunchSpeed: 2320,
    springCooldownMs: 350,
    pickupRadius: 21,
  },

  interactive: {
    firstAtMeters: 18,
    startStepMeters: 62,
    minStepMeters: 34,
    stepAtMeters: 900,
    /** Interativos nascem acima do topo da câmera. */
    aboveTop: 130,
    jitterY: 170,
    /** Trilha de moedas: quantidade, espaçamento vertical e arco lateral. */
    coinTrail: 6,
    coinSpacing: 44,
    coinArc: 28,
    edgeMargin: 44,
    maxPerUpdate: 2,
    /** Pesos: moeda, argola, mola, magnet, aimed. */
    weights: [55, 20, 10, 10, 5],
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
    aimMaxSpeed: 2200,
    /** Duração do Magnet. [TESTE] */
    magnetDurationMs: 15000,
    /** Raio de puxão (−20% da calibração anterior); a aura acompanha. [TESTE] */
    magnetRadius: 144,
    magnetPullSpeed: 620,
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
