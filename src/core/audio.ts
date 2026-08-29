/**
 * Karplus-Strong 方式による撥弦音シンセ。
 * 音源ファイル不要で、はじいた弦っぽい減衰音を生成する。
 */

const A4_MIDI = 69;
const A4_FREQ = 440;

export function midiToFreq(midi: number): number {
  return A4_FREQ * Math.pow(2, (midi - A4_MIDI) / 12);
}

export interface TonePreset {
  id: string;
  label: string;
  /** 弦の減衰の基準値 (1に近いほど長く伸びる) */
  decay: number;
  /** 弦の明るさ。1に近いほど高域が残る */
  brightness: number;
  /** 最大サステイン秒数 */
  maxDuration: number;
  /** 励振ノイズのローパス量 (0=柔らかい / 1=硬い) */
  pickHardness: number;
  /** 歪みの量 (0 = 歪みなし) */
  drive: number;
  /** 出力段のローパス周波数 */
  toneHz: number;
  /** 音量補正 */
  gain: number;
}

export const TONE_PRESETS: TonePreset[] = [
  {
    id: "acoustic",
    label: "アコースティック",
    decay: 0.9965,
    brightness: 0.62,
    maxDuration: 3.6,
    pickHardness: 0.75,
    drive: 0,
    toneHz: 7000,
    gain: 1,
  },
  {
    id: "nylon",
    label: "ガットギター（ナイロン弦）",
    decay: 0.9945,
    brightness: 0.4,
    maxDuration: 2.6,
    pickHardness: 0.25,
    drive: 0,
    toneHz: 2600,
    gain: 1.05,
  },
  {
    id: "clean",
    label: "エレキ・クリーン",
    decay: 0.996,
    brightness: 0.52,
    maxDuration: 3.2,
    pickHardness: 0.55,
    drive: 0,
    toneHz: 4200,
    gain: 1,
  },
  {
    id: "crunch",
    label: "エレキ・クランチ",
    decay: 0.9975,
    brightness: 0.55,
    maxDuration: 3.4,
    pickHardness: 0.65,
    drive: 12,
    toneHz: 3200,
    gain: 0.55,
  },
  {
    id: "lead",
    label: "エレキ・ディストーション",
    decay: 0.9985,
    brightness: 0.6,
    maxDuration: 4,
    pickHardness: 0.7,
    drive: 45,
    toneHz: 2800,
    gain: 0.4,
  },
  {
    id: "mute",
    label: "ブリッジミュート",
    decay: 0.972,
    brightness: 0.35,
    maxDuration: 0.9,
    pickHardness: 0.8,
    drive: 6,
    toneHz: 2200,
    gain: 1.1,
  },
];

export function getTonePreset(id: string): TonePreset {
  return TONE_PRESETS.find((t) => t.id === id) ?? TONE_PRESETS[0];
}

/** 歪み用のトランスファーカーブ */
function makeDistortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const samples = 2048;
  const curve = new Float32Array(new ArrayBuffer(samples * 4));
  const k = amount;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

/** 1音分のプラック波形を生成する */
function renderPluck(ctx: AudioContext, midi: number, preset: TonePreset): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const freq = midiToFreq(midi);
  const delayLength = Math.max(2, Math.floor(sampleRate / freq));

  // 高音ほど短く減衰させる
  const duration = Math.min(
    preset.maxDuration,
    Math.max(preset.maxDuration * 0.4, preset.maxDuration - (midi - 40) * 0.045),
  );
  const length = Math.floor(sampleRate * duration);

  const buffer = ctx.createBuffer(1, length, sampleRate);
  const out = buffer.getChannelData(0);

  // 励振信号: ノイズをローパスして「ピック感」を作る
  const line = new Float32Array(delayLength);
  const smooth = 1 - preset.pickHardness;
  let last = 0;
  for (let i = 0; i < delayLength; i++) {
    const noise = Math.random() * 2 - 1;
    last = last * smooth + noise * (1 - smooth);
    line[i] = last;
  }

  // 低音弦ほど長く伸びる
  const decay = Math.min(0.9995, preset.decay + (60 - Math.min(midi, 60)) * 0.0002);
  const blend = preset.brightness;
  let idx = 0;
  let prev = 0;

  for (let i = 0; i < length; i++) {
    const current = line[idx];
    const next = line[(idx + 1) % delayLength];
    // ローパス(加重平均)で高域から減衰させる
    const filtered = (current * blend + next * (1 - blend)) * decay;
    const value = filtered - prev * 0.002; // わずかなDC除去
    line[idx] = value;
    prev = value;
    out[i] = current;
    idx = (idx + 1) % delayLength;
  }

  // 終端のクリック防止フェードアウト
  const fade = Math.min(2000, Math.floor(length * 0.15));
  for (let i = 0; i < fade; i++) {
    out[length - fade + i] *= 1 - i / fade;
  }

  return buffer;
}

export class GuitarSynth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private cache = new Map<string, AudioBuffer>();
  private active: AudioBufferSourceNode[] = [];
  private volume = 0.5;
  private enabled = true;
  private preset: TonePreset = TONE_PRESETS[0];

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) this.stopAll();
  }

  setVolume(volume: number): void {
    this.volume = volume;
    if (this.master) this.master.gain.value = volume;
  }

  setPreset(preset: TonePreset): void {
    this.preset = preset;
    this.stopAll();
  }

  get presetId(): string {
    return this.preset.id;
  }

  /** 直前の音を止める (単音演奏用) */
  stopAll(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    for (const node of this.active) {
      try {
        node.stop(ctx.currentTime + 0.06);
      } catch {
        /* already stopped */
      }
    }
    this.active = [];
  }

  /** MIDIノート番号の音を鳴らす */
  play(midi: number, options: { fadePrevious?: boolean } = {}): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;

    if (options.fadePrevious !== false) this.stopAll();

    const key = `${this.preset.id}:${midi}`;
    let buffer = this.cache.get(key);
    if (!buffer) {
      buffer = renderPluck(ctx, midi, this.preset);
      this.cache.set(key, buffer);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(this.preset.gain, ctx.currentTime + 0.005);

    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = this.preset.toneHz;

    const nodes: AudioNode[] = [source, gain];
    if (this.preset.drive > 0) {
      const shaper = ctx.createWaveShaper();
      shaper.curve = makeDistortionCurve(this.preset.drive);
      shaper.oversample = "4x";
      nodes.push(shaper);
    }
    nodes.push(tone);

    for (let i = 0; i < nodes.length - 1; i++) {
      nodes[i].connect(nodes[i + 1]);
    }
    tone.connect(this.master);
    source.start();

    this.active.push(source);
    source.onended = () => {
      this.active = this.active.filter((n) => n !== source);
      for (const node of nodes) node.disconnect();
    };
  }

  /** 複数音を軽いストローク風にずらして鳴らす */
  playSequence(midis: number[], intervalMs = 70): void {
    if (!this.enabled) return;
    this.stopAll();
    midis.forEach((midi, i) => {
      window.setTimeout(() => this.play(midi, { fadePrevious: false }), i * intervalMs);
    });
  }
}
