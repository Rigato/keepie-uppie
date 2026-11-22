/**
 * STUB temporário (F0). O lote de áudio substitui este arquivo por completo.
 * O contrato abaixo é o que o gameplay pode usar.
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

class AudioBus {
  private muted = false

  async unlock(): Promise<void> {}
  play(_id: SfxId, _opts?: SfxOptions): void {}
  setMuted(muted: boolean): void {
    this.muted = muted
  }
  isMuted(): boolean {
    return this.muted
  }
  isUnlocked(): boolean {
    return false
  }
}

export const audio = new AudioBus()
