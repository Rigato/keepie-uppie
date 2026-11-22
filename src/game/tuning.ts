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
    gravity: 1700, // u/s²
    wallRestitution: 1,
    /** Quantos unidades de mundo equivalem a 1 metro de altitude. */
    pxPerMeter: 20,
    maxFallSpeed: 2600,
  },

  kick: {
    /** Força básica somada à velocidade de encontro. */
    baseSpeed: 950,
    /** Quanto da velocidade de queda vira força de chute. */
    impactFactor: 0.5,
    /** Piso: toque hesitante nunca condena (~1/3 da tela de apex). [TESTE] */
    minSpeed: 1000,
    /** Teto da faixa: arco de ~2.5 s. [TESTE] */
    maxSpeed: 2100,
    /** Componente lateral máxima no toque na borda. */
    maxLateral: 0.75,
    /** Janela central para o Perfect Touch, em fração do raio. [TESTE] */
    perfectWindow: 0.22,
    /**
     * Raio generoso do alvo de toque e da mira (unidades de mundo). O jogador
     * toca dentro do anel; o ângulo usa essa mesma área, então centro = reto,
     * borda do anel = ângulo máximo.
     */
    touchRadius: 100,
    /** Tolera toque perto do ápice (vy levemente negativa) em vez de exigir queda pura. */
    apexTolerance: 120,
    /** Anel (de pontos) que comunica a área de chute enquanto a bola cai. */
    ringRadius: 100,
  },

  camera: {
    /** Altura do gatilho da catraca, em fração da tela. */
    ratchetAt: 0.4,
    /** Velocidade de acompanhamento (lerp por segundo). */
    followSpeed: 8,
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
    /** Força aplicada no perfect: topo da faixa. */
    speed: 2100,
  },

  obstacle: {
    hardWidth: 150,
    hardHeight: 18,
    softWidth: 190,
    softHeight: 22,
    breakableWidth: 132,
    breakableHeight: 26,
    /** Velocidade mínima para romper o breakable. [TESTE] */
    breakSpeed: 1400,
    /** Fração de velocidade perdida no soft. */
    softDamp: 0.45,
    birdWidth: 46,
    birdHeight: 26,
    birdRadius: 14,
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
    coinRadius: 16,
    coinValue: 1,
    ringRadius: 62,
    ringThickness: 10,
    /** Fração do raio da argola que conta como "passou por dentro". */
    ringPassRatio: 0.55,
    ringCoinBurst: 8,
    springWidth: 88,
    springHeight: 22,
    springLaunchSpeed: 2650,
    springCooldownMs: 350,
    pickupRadius: 26,
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
    /** Faixa de velocidade do tiro mirado, fora da faixa normal. */
    aimMinSpeed: 1300,
    aimMaxSpeed: 2650,
    /** Duração do Magnet. [TESTE] */
    magnetDurationMs: 15000,
    /** Raio de puxão: ~1/3 da largura. [TESTE] */
    magnetRadius: 180,
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
