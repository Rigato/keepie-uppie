/**
 * Motor de SFX do Keepie-Uppie: 100% sintetizado com WebAudio.
 *
 * Regras:
 * - O AudioContext só nasce no primeiro unlock(), dentro de um gesto do usuário.
 * - play() nunca lança; uma falha de áudio não pode interromper o gameplay.
 * - Todos os sons são curtos (< 400 ms), com envelope próprio e sem loop.
 * - O módulo não importa Phaser: é independente do engine.
 */

export type SfxId =
  | 'kick'
  | 'perfect'
  | 'whiff'
  | 'wall'
  | 'death'
  | 'coin'
  | 'ui'
  | 'shatter'
  | 'damp'
  | 'ring'
  | 'spring'
  | 'pickup'
  | 'fever'
  | 'streakUp'

export interface SfxOptions {
  volume?: number
  pitch?: number
  pan?: number
}

/** Ganho fixo do barramento principal. */
const MASTER_GAIN = 0.5

/** Repetição do mesmo id dentro desta janela é ignorada. */
const THROTTLE_MS = 25

/** Duração do buffer de ruído compartilhado (cobre o maior burst). */
const NOISE_SECONDS = 0.35

/** Limites de segurança para valores vindos do gameplay. */
const MIN_PITCH = 0.25
const MAX_PITCH = 4

/** Tempo até desconectar o barramento de uma voz já terminada. */
const RELEASE_MS = 700

/** Volume individual de cada som, antes do volume opcional do chamador. */
const SFX_LEVEL: Record<SfxId, number> = {
  kick: 0.9,
  perfect: 0.8,
  whiff: 0.5,
  wall: 0.7,
  death: 0.8,
  coin: 0.6,
  ui: 0.45,
  shatter: 0.75,
  damp: 0.65,
  ring: 0.55,
  spring: 0.65,
  pickup: 0.55,
  fever: 0.6,
  streakUp: 0.5,
}

interface ToneSpec {
  freq: number
  endFreq?: number
  type: OscillatorType
  /** Atraso em segundos a partir do início da voz. */
  delay?: number
  duration: number
  gain: number
  attack?: number
}

interface NoiseSpec {
  delay?: number
  duration: number
  gain: number
  attack?: number
  filter: BiquadFilterType
  freq: number
  endFreq?: number
  q?: number
}

/** Barramento de uma voz: entrada com volume e a cadeia criada para o pan. */
interface OutputBus {
  input: GainNode
  chain: AudioNode[]
}

type AudioContextFactory = new () => AudioContext

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

/** Aceita apenas números finitos; qualquer outra coisa cai no padrão. */
function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function resolveAudioContextFactory(): AudioContextFactory | null {
  if (typeof window === 'undefined') return null
  // Safari antigo expõe apenas webkitAudioContext.
  const legacy = (window as unknown as { webkitAudioContext?: AudioContextFactory })
    .webkitAudioContext
  return window.AudioContext ?? legacy ?? null
}

class AudioBus {
  private context: AudioContext | null = null
  private master: GainNode | null = null
  private noiseBuffer: AudioBuffer | null = null
  private muted = false
  private visibilityBound = false
  private readonly lastPlayed = new Map<SfxId, number>()

  /** Cria (uma única vez) e retoma o contexto. Nunca lança. */
  async unlock(): Promise<void> {
    try {
      const ctx = this.ensureContext()
      if (!ctx) return
      if (ctx.state === 'suspended') await ctx.resume()
    } catch {
      // Autoplay bloqueado ou política de iframe: o jogo segue em silêncio.
    }
  }

  /** Toca um SFX. Nunca lança; é no-op sem contexto liberado ou quando mutado. */
  play(id: SfxId, opts: SfxOptions = {}): void {
    try {
      const ctx = this.context
      const master = this.master
      if (!ctx || !master || this.muted || ctx.state === 'closed') return

      // Já liberado antes, mas o navegador pode ter suspendido (troca de aba).
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => undefined)
      }

      const now = performance.now()
      const last = this.lastPlayed.get(id)
      if (last !== undefined && now - last < THROTTLE_MS) return
      this.lastPlayed.set(id, now)

      const pitch = clamp(finiteOr(opts.pitch, 1), MIN_PITCH, MAX_PITCH)
      const volume = clamp(finiteOr(opts.volume, 1), 0, 1)
      if (volume <= 0) return
      const pan = clamp(finiteOr(opts.pan, 0), -1, 1)

      const level = SFX_LEVEL[id]
      if (level === undefined) return

      const output = this.createOutput(ctx, master, pan, level * volume)
      this.render(ctx, id, output.input, ctx.currentTime + 0.001, pitch)
      this.scheduleRelease(output.chain)
    } catch {
      // Nunca deixar uma exceção de áudio vazar para o gameplay.
    }
  }

  setMuted(muted: boolean): void {
    this.muted = muted
  }

  isMuted(): boolean {
    return this.muted
  }

  /** Contexto criado e ainda utilizável (mesmo que suspenso por visibilidade). */
  isUnlocked(): boolean {
    return this.context !== null && this.context.state !== 'closed'
  }

  /** Cria o contexto no primeiro uso e o reutiliza nas chamadas seguintes. */
  private ensureContext(): AudioContext | null {
    if (this.context !== null && this.context.state !== 'closed') return this.context

    const Factory = resolveAudioContextFactory()
    if (!Factory) return null

    try {
      const ctx = new Factory()
      const master = ctx.createGain()
      master.gain.value = MASTER_GAIN
      master.connect(ctx.destination)

      this.context = ctx
      this.master = master
      this.noiseBuffer = null
      this.bindVisibility()
      return ctx
    } catch {
      return null
    }
  }

  /** Suspende com a aba oculta e retoma ao voltar, apenas se já liberado. */
  private bindVisibility(): void {
    if (this.visibilityBound || typeof document === 'undefined') return
    this.visibilityBound = true
    document.addEventListener('visibilitychange', this.handleVisibility)
  }

  private readonly handleVisibility = (): void => {
    const ctx = this.context
    if (!ctx || ctx.state === 'closed') return

    if (document.visibilityState === 'hidden') {
      if (ctx.state === 'running') void ctx.suspend().catch(() => undefined)
    } else if (ctx.state === 'suspended') {
      void ctx.resume().catch(() => undefined)
    }
  }

  /** Cria o ganho da voz e o pan (quando o navegador suporta). */
  private createOutput(
    ctx: AudioContext,
    master: GainNode,
    pan: number,
    volume: number,
  ): OutputBus {
    const input = ctx.createGain()
    input.gain.value = Math.max(0, volume)
    const chain: AudioNode[] = [input]

    try {
      if (typeof ctx.createStereoPanner === 'function') {
        const panner = ctx.createStereoPanner()
        panner.pan.value = pan
        input.connect(panner)
        panner.connect(master)
        chain.push(panner)
        return { input, chain }
      }
    } catch {
      // Sem StereoPanner: cai para o caminho mono abaixo.
    }

    input.connect(master)
    return { input, chain }
  }

  /** Desconecta a voz depois que todos os seus sons terminaram. */
  private scheduleRelease(chain: readonly AudioNode[]): void {
    setTimeout(() => {
      for (const node of chain) {
        try {
          node.disconnect()
        } catch {
          // Nó já desconectado ou contexto fechado.
        }
      }
    }, RELEASE_MS)
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer

    const frames = Math.max(1, Math.floor(ctx.sampleRate * NOISE_SECONDS))
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1
    }

    this.noiseBuffer = buffer
    return buffer
  }

  private envelope(
    gain: GainNode,
    start: number,
    duration: number,
    peak: number,
    attack = 0.003,
  ): void {
    const safePeak = Math.max(0.0001, peak)
    const attackTime = Math.max(0.001, Math.min(attack, duration * 0.5))
    const end = start + duration

    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(safePeak, start + attackTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, end)
  }

  /** Um oscilador com envelope de ganho e glide opcional de frequência. */
  private tone(
    ctx: AudioContext,
    out: AudioNode,
    time: number,
    spec: ToneSpec,
    pitch: number,
  ): void {
    if (spec.duration <= 0 || spec.gain <= 0) return

    const start = time + (spec.delay ?? 0)
    const end = start + spec.duration
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()

    osc.type = spec.type
    osc.frequency.setValueAtTime(Math.max(20, spec.freq * pitch), start)
    if (spec.endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(20, spec.endFreq * pitch),
        end,
      )
    }

    this.envelope(gain, start, spec.duration, spec.gain, spec.attack)
    osc.connect(gain)
    gain.connect(out)
    osc.start(start)
    osc.stop(end + 0.02)
  }

  /** Ruído curto filtrado, sempre a partir do buffer gerado em runtime. */
  private noise(
    ctx: AudioContext,
    out: AudioNode,
    time: number,
    spec: NoiseSpec,
    pitch: number,
  ): void {
    if (spec.duration <= 0 || spec.gain <= 0) return

    const start = time + (spec.delay ?? 0)
    const end = start + spec.duration
    const source = ctx.createBufferSource()
    const filter = ctx.createBiquadFilter()
    const gain = ctx.createGain()

    source.buffer = this.getNoiseBuffer(ctx)
    source.loop = false

    filter.type = spec.filter
    filter.frequency.setValueAtTime(Math.max(20, spec.freq * pitch), start)
    if (spec.endFreq !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(20, spec.endFreq * pitch),
        end,
      )
    }
    filter.Q.value = spec.q ?? 0.7

    this.envelope(gain, start, spec.duration, spec.gain, spec.attack)
    source.connect(filter)
    filter.connect(gain)
    gain.connect(out)
    source.start(start)
    source.stop(end + 0.02)
  }

  /**
   * Receitas dos sons. Cada uma foi pensada para ser reconhecível isoladamente,
   * mesmo com vários efeitos tocando ao mesmo tempo.
   */
  private render(
    ctx: AudioContext,
    id: SfxId,
    out: AudioNode,
    time: number,
    pitch: number,
  ): void {
    switch (id) {
      case 'kick': {
        // Thump grave + click curto de impacto.
        this.tone(
          ctx,
          out,
          time,
          { freq: 140, endFreq: 48, type: 'sine', duration: 0.16, gain: 0.95, attack: 0.002 },
          pitch,
        )
        this.tone(
          ctx,
          out,
          time,
          { freq: 1100, endFreq: 420, type: 'triangle', duration: 0.03, gain: 0.22, attack: 0.001 },
          pitch,
        )
        return
      }

      case 'perfect': {
        // Duas notas brilhantes em quinta, a segunda com leve atraso.
        this.tone(
          ctx,
          out,
          time,
          { freq: 1318.51, type: 'triangle', duration: 0.13, gain: 0.5, attack: 0.002 },
          pitch,
        )
        this.tone(
          ctx,
          out,
          time,
          { freq: 1975.53, type: 'triangle', delay: 0.07, duration: 0.18, gain: 0.45, attack: 0.002 },
          pitch,
        )
        return
      }

      case 'whiff': {
        // Ar curto: banda que fecha rápido + sopro agudo.
        this.noise(
          ctx,
          out,
          time,
          { duration: 0.17, gain: 0.55, attack: 0.012, filter: 'bandpass', freq: 1800, endFreq: 550, q: 0.8 },
          pitch,
        )
        this.noise(
          ctx,
          out,
          time,
          { delay: 0.01, duration: 0.09, gain: 0.15, attack: 0.008, filter: 'highpass', freq: 3200, endFreq: 1800 },
          pitch,
        )
        return
      }

      case 'wall': {
        // Woodblock: corpo curto e ressonante + tick de madeira.
        this.tone(
          ctx,
          out,
          time,
          { freq: 780, endFreq: 470, type: 'triangle', duration: 0.07, gain: 0.75, attack: 0.001 },
          pitch,
        )
        this.tone(
          ctx,
          out,
          time,
          { freq: 1320, endFreq: 980, type: 'sine', duration: 0.03, gain: 0.2, attack: 0.001 },
          pitch,
        )
        this.noise(
          ctx,
          out,
          time,
          { duration: 0.018, gain: 0.12, attack: 0.001, filter: 'bandpass', freq: 2600, q: 1.2 },
          pitch,
        )
        return
      }

      case 'death': {
        // Descida longa e grave, com um sopro que acompanha a queda.
        this.tone(
          ctx,
          out,
          time,
          { freq: 420, endFreq: 70, type: 'triangle', duration: 0.37, gain: 0.7, attack: 0.005 },
          pitch,
        )
        this.tone(
          ctx,
          out,
          time,
          { freq: 210, endFreq: 38, type: 'sine', duration: 0.38, gain: 0.45, attack: 0.005 },
          pitch,
        )
        this.noise(
          ctx,
          out,
          time,
          { duration: 0.28, gain: 0.12, attack: 0.01, filter: 'lowpass', freq: 900, endFreq: 120 },
          pitch,
        )
        return
      }

      case 'coin': {
        // Blip clássico de moeda: duas ondas quadradas curtas.
        this.tone(
          ctx,
          out,
          time,
          { freq: 987.77, type: 'square', duration: 0.055, gain: 0.22, attack: 0.001 },
          pitch,
        )
        this.tone(
          ctx,
          out,
          time,
          { freq: 1318.51, type: 'square', delay: 0.055, duration: 0.13, gain: 0.2, attack: 0.001 },
          pitch,
        )
        return
      }

      case 'ui': {
        // Click neutro e seco, para botões e transições.
        this.tone(
          ctx,
          out,
          time,
          { freq: 1050, endFreq: 780, type: 'triangle', duration: 0.045, gain: 0.4, attack: 0.001 },
          pitch,
        )
        this.noise(
          ctx,
          out,
          time,
          { duration: 0.012, gain: 0.08, attack: 0.001, filter: 'highpass', freq: 3500 },
          pitch,
        )
        return
      }

      case 'shatter': {
        // Ruído highpass + estilhaços senoidais espalhados no tempo.
        this.noise(
          ctx,
          out,
          time,
          { duration: 0.26, gain: 0.55, attack: 0.001, filter: 'highpass', freq: 1800, endFreq: 4200 },
          pitch,
        )
        this.noise(
          ctx,
          out,
          time,
          { delay: 0.035, duration: 0.13, gain: 0.2, attack: 0.001, filter: 'bandpass', freq: 5200, endFreq: 2400, q: 1.1 },
          pitch,
        )
        this.tone(
          ctx,
          out,
          time,
          { freq: 2350, type: 'sine', delay: 0.02, duration: 0.05, gain: 0.12, attack: 0.001 },
          pitch,
        )
        this.tone(
          ctx,
          out,
          time,
          { freq: 3150, type: 'sine', delay: 0.07, duration: 0.05, gain: 0.1, attack: 0.001 },
          pitch,
        )
        this.tone(
          ctx,
          out,
          time,
          { freq: 3900, type: 'sine', delay: 0.12, duration: 0.045, gain: 0.08, attack: 0.001 },
          pitch,
        )
        return
      }

      case 'damp': {
        // Thud abafado, sem brilho: grave curto + ruído lowpass.
        this.tone(
          ctx,
          out,
          time,
          { freq: 120, endFreq: 48, type: 'sine', duration: 0.16, gain: 0.8, attack: 0.003 },
          pitch,
        )
        this.noise(
          ctx,
          out,
          time,
          { duration: 0.09, gain: 0.3, attack: 0.002, filter: 'lowpass', freq: 420, endFreq: 160, q: 0.6 },
          pitch,
        )
        return
      }

      case 'ring': {
        // Arpejo shimmer de quatro notas, com a última bem brilhante.
        this.tone(
          ctx,
          out,
          time,
          { freq: 880, type: 'triangle', duration: 0.14, gain: 0.3, attack: 0.002 },
          pitch,
        )
        this.tone(
          ctx,
          out,
          time,
          { freq: 1108.73, type: 'triangle', delay: 0.045, duration: 0.14, gain: 0.28, attack: 0.002 },
          pitch,
        )
        this.tone(
          ctx,
          out,
          time,
          { freq: 1318.51, type: 'triangle', delay: 0.09, duration: 0.15, gain: 0.26, attack: 0.002 },
          pitch,
        )
        this.tone(
          ctx,
          out,
          time,
          { freq: 1760, type: 'sine', delay: 0.135, duration: 0.18, gain: 0.22, attack: 0.002 },
          pitch,
        )
        return
      }

      case 'spring': {
        // Glide ascendente rápido, como uma mola esticando.
        this.tone(
          ctx,
          out,
          time,
          { freq: 170, endFreq: 900, type: 'triangle', duration: 0.3, gain: 0.5, attack: 0.004 },
          pitch,
        )
        this.tone(
          ctx,
          out,
          time,
          { freq: 340, endFreq: 1800, type: 'sine', duration: 0.27, gain: 0.18, attack: 0.004 },
          pitch,
        )
        return
      }

      case 'pickup': {
        // Dois tons curtos e limpos.
        this.tone(
          ctx,
          out,
          time,
          { freq: 660, type: 'triangle', duration: 0.06, gain: 0.32, attack: 0.001 },
          pitch,
        )
        this.tone(
          ctx,
          out,
          time,
          { freq: 990, type: 'triangle', delay: 0.06, duration: 0.1, gain: 0.32, attack: 0.001 },
          pitch,
        )
        return
      }

      case 'fever': {
        // Arpejo maior subindo: anuncia a febre sem competir com os SFX.
        this.tone(
          ctx,
          out,
          time,
          { freq: 523.25, type: 'triangle', duration: 0.1, gain: 0.28, attack: 0.002 },
          pitch,
        )
        this.tone(
          ctx,
          out,
          time,
          { freq: 659.25, type: 'triangle', delay: 0.045, duration: 0.1, gain: 0.3, attack: 0.002 },
          pitch,
        )
        this.tone(
          ctx,
          out,
          time,
          { freq: 783.99, type: 'triangle', delay: 0.09, duration: 0.11, gain: 0.32, attack: 0.002 },
          pitch,
        )
        this.tone(
          ctx,
          out,
          time,
          { freq: 1046.5, type: 'triangle', delay: 0.135, duration: 0.11, gain: 0.34, attack: 0.002 },
          pitch,
        )
        this.tone(
          ctx,
          out,
          time,
          { freq: 1318.51, type: 'triangle', delay: 0.18, duration: 0.12, gain: 0.36, attack: 0.002 },
          pitch,
        )
        this.tone(
          ctx,
          out,
          time,
          { freq: 1567.98, type: 'triangle', delay: 0.225, duration: 0.15, gain: 0.38, attack: 0.002 },
          pitch,
        )
        return
      }

      case 'streakUp': {
        // Blip ascendente curto para subida de streak.
        this.tone(
          ctx,
          out,
          time,
          { freq: 620, endFreq: 1240, type: 'sine', duration: 0.14, gain: 0.5, attack: 0.002 },
          pitch,
        )
        this.tone(
          ctx,
          out,
          time,
          { freq: 930, endFreq: 1860, type: 'triangle', delay: 0.01, duration: 0.1, gain: 0.18, attack: 0.002 },
          pitch,
        )
        return
      }
    }
  }
}

export const audio = new AudioBus()
