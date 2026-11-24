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
    breakSpeed: 1800,
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
    /** Recalibrada para continuar acima do chute máximo com o boost profundo. */
    springLaunchSpeed: 2850,
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
    aimMaxSpeed: 3000,
    /** Duração do Magnet. [TESTE] */
    magnetDurationMs: 15000,
    /** Raio de puxão (−20% da calibração anterior); a aura acompanha. [TESTE] */
    magnetRadius: 144,
    magnetPullSpeed: 620,
  },

  consumable: {
    /**
     * Impulso vertical da rede de proteção ao salvar a bola na linha de morte.
     * Modesto de propósito: é uma segunda chance, não um atalho de altitude. [TESTE]
     */
    netLaunchSpeed: 1500,
    /** Quanto acima da linha de morte a bola reaparece depois da rede. [TESTE] */
    netRescueY: 180,
    /**
     * Velocidade do primeiro chute quando o Chutão está equipado. Fica acima do
     * chute de fundo (2600) e abaixo da mola (2850); o Perfect soma +60. [TESTE]
     */
    chutaoSpeed: 2750,
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
