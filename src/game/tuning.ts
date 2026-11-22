/**
 * TODOS os números de calibração vivem aqui. Nenhum outro arquivo pode hardcodar
 * valor de gameplay. Os valores marcados `[TESTE]` são pontos de partida do GDD.
 */
export const TUNING = {
  world: {
    width: 540,
    height: 1080,
  },

  ball: {
    radius: 26,
  },

  physics: {
    gravity: 2000, // u/s²
    wallRestitution: 1,
    /** Quantos unidades de mundo equivalem a 1 metro de altitude. */
    pxPerMeter: 20,
    maxFallSpeed: 3200,
  },

  kick: {
    /** Força básica somada à velocidade de encontro. */
    baseSpeed: 1100,
    /** Quanto da velocidade de queda vira força de chute. */
    impactFactor: 0.55,
    /** Piso: toque hesitante nunca condena (~1/3 da tela de apex). [TESTE] */
    minSpeed: 1130,
    /** Teto da faixa: arco de ~2.3 s. [TESTE] */
    maxSpeed: 2300,
    /** Componente lateral máxima no toque na borda. */
    maxLateral: 0.75,
    /** Janela central para o Perfect Touch, em fração do raio. [TESTE] */
    perfectWindow: 0.25,
  },

  camera: {
    /** Altura do gatilho da catraca, em fração da tela. */
    ratchetAt: 0.58,
    /** Velocidade de acompanhamento (lerp por segundo). */
    followSpeed: 8,
  },

  run: {
    /** Tempo entre a morte e a tela de fim. */
    deathDelayMs: 900,
    /** Altura de spawn inicial da bola (a partir do topo). */
    spawnY: 220,
  },

  perfect: {
    /** Força aplicada no perfect: topo da faixa. */
    speed: 2300,
  },

  obstacle: {
    /** 1 evento relevante a cada ~10 s de subida no início. [TESTE] */
    eventSpacingSeconds: 10,
    /** Crescimento da densidade por faixa de altitude. [TESTE] */
    densityGrowthPerKm: 0.25,
    /** Altura mínima livre acima da bola ao spawnar. */
    safeGap: 260,
    hardWidth: 150,
    hardHeight: 18,
    softWidth: 190,
    softHeight: 22,
    /** Velocidade mínima para romper o breakable. [TESTE] */
    breakSpeed: 1400,
    /** Velocidade perdida no soft. */
    softDamp: 0.45,
    birdSpeed: 220,
    flockSize: 4,
    flockDurationMs: 3600,
    birdDeflect: 260,
  },

  collect: {
    coinRadius: 16,
    coinValue: 1,
    ringRadius: 62,
    ringThickness: 10,
    ringCoinBurst: 8,
    springWidth: 88,
    springLaunchSpeed: 2650,
    pickupRadius: 26,
  },

  powerup: {
    /** Janela do Aimed Shot. [TESTE] */
    aimWindowMs: 2000,
    /** Força mínima aceitável no timeout; abaixo disso aplica média default. */
    aimMinForceRatio: 0.15,
    aimDefaultForceRatio: 0.5,
    aimMaxForceRatio: 1.15,
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
