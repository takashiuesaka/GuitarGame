import { MAX_FRET, midiAt, STRING_COUNT, type Position } from "./fretboard";
import type { PitchClass } from "./notes";
import type { Tuning } from "./tuning";

/** コードの種別 */
export type ChordCategory = "triad" | "seventh";

export interface ChordQuality {
  id: string;
  /** 表示用の日本語名 */
  label: string;
  /** コードネームに付くサフィックス (メジャーは空文字) */
  symbol: string;
  category: ChordCategory;
  /** ルートからの半音距離。トライアドは3音、セブンスは4音 */
  intervals: number[];
}

export const CHORD_QUALITIES: ChordQuality[] = [
  { id: "major", label: "メジャー", symbol: "", category: "triad", intervals: [0, 4, 7] },
  { id: "minor", label: "マイナー", symbol: "m", category: "triad", intervals: [0, 3, 7] },
  { id: "dim", label: "ディミニッシュ", symbol: "dim", category: "triad", intervals: [0, 3, 6] },
  { id: "aug", label: "オーギュメント", symbol: "aug", category: "triad", intervals: [0, 4, 8] },
  { id: "sus4", label: "サスフォー", symbol: "sus4", category: "triad", intervals: [0, 5, 7] },

  { id: "maj7", label: "メジャーセブンス", symbol: "maj7", category: "seventh", intervals: [0, 4, 7, 11] },
  { id: "dom7", label: "ドミナントセブンス", symbol: "7", category: "seventh", intervals: [0, 4, 7, 10] },
  { id: "min7", label: "マイナーセブンス", symbol: "m7", category: "seventh", intervals: [0, 3, 7, 10] },
  { id: "m7b5", label: "マイナーセブンフラットファイブ", symbol: "m7♭5", category: "seventh", intervals: [0, 3, 6, 10] },
  { id: "dim7", label: "ディミニッシュセブンス", symbol: "dim7", category: "seventh", intervals: [0, 3, 6, 9] },
  { id: "mMaj7", label: "マイナーメジャーセブンス", symbol: "mMaj7", category: "seventh", intervals: [0, 3, 7, 11] },
];

export function getChordQuality(id: string): ChordQuality {
  return CHORD_QUALITIES.find((q) => q.id === id) ?? CHORD_QUALITIES[0];
}

/** ボイシングの種類 */
export type VoicingType = "triad" | "seventh" | "guide";

export interface VoicingDef {
  id: VoicingType;
  label: string;
  description: string;
  category: ChordCategory;
  /** 押さえる音数 */
  noteCount: number;
}

export const VOICINGS: VoicingDef[] = [
  {
    id: "triad",
    label: "トライアド（R・3rd・5th）",
    description: "ルート・3度・5度の3音",
    category: "triad",
    noteCount: 3,
  },
  {
    id: "seventh",
    label: "セブンス（R・3rd・5th・7th）",
    description: "ルート・3度・5度・7度の4音",
    category: "seventh",
    noteCount: 4,
  },
  {
    id: "guide",
    label: "ガイドトーン（R・3rd・7th／5th省略）",
    description: "5度を省いたシェルボイシング。ジャズで多用される3音",
    category: "seventh",
    noteCount: 3,
  },
];

export function getVoicing(id: VoicingType): VoicingDef {
  return VOICINGS.find((v) => v.id === id) ?? VOICINGS[0];
}

/** そのボイシングで出題できるコードの種類 */
export function qualitiesFor(voicing: VoicingType): ChordQuality[] {
  const category = getVoicing(voicing).category;
  return CHORD_QUALITIES.filter((q) => q.category === category);
}

/**
 * ボイシングごとに使用する弦の並び（ルート弦から高音弦へ）。
 * ガイドトーンは 1 本飛ばしたシェルボイシングの配置にする。
 */
export function stringPlan(voicing: VoicingType, rootString: number): number[] | null {
  const plan =
    voicing === "guide"
      ? [rootString, rootString - 2, rootString - 3]
      : voicing === "seventh"
        ? [rootString, rootString - 1, rootString - 2, rootString - 3]
        : [rootString, rootString - 1, rootString - 2];

  if (plan.some((s) => s < 1 || s > STRING_COUNT)) return null;
  return plan;
}

/** そのルート弦でボイシングが成立するか（弦が足りるか） */
export function isVoicingAvailable(voicing: VoicingType, rootString: number): boolean {
  return stringPlan(voicing, rootString) !== null;
}

/** 弦の並びに対応する、ルートからの度数の並び */
export function tonePlan(voicing: VoicingType, quality: ChordQuality): number[] {
  if (voicing === "guide") {
    // ルート → 7th → 3rd の順に低音側から積む
    return [0, quality.intervals[3], quality.intervals[1]];
  }
  return quality.intervals;
}

export interface ChordShape {
  quality: ChordQuality;
  voicing: VoicingType;
  root: Position;
  rootPitchClass: PitchClass;
  /** 低音弦から高音弦の順に並んだ押弦位置 */
  positions: Position[];
  /** positions と同じ並びの、ルートからの度数 */
  intervals: number[];
}

/** 押弦幅の上限（フレット数） */
const MAX_SPAN = 5;
/** 隣り合う構成音の音程の上限（半音）。クローズボイシングを保つ */
const MAX_GAP = 12;

/**
 * ルート位置からクローズボイシングのコードシェイプを生成する。
 * 各弦に1音ずつ、音高が低音弦から高音弦へ昇順になるよう配置する。
 */
export function buildChordShape(
  tuning: Tuning,
  voicing: VoicingType,
  quality: ChordQuality,
  root: Position,
): ChordShape | null {
  const strings = stringPlan(voicing, root.string);
  if (!strings) return null;

  const tones = tonePlan(voicing, quality);
  if (tones.length !== strings.length) return null;

  const rootMidi = midiAt(tuning, root);
  const positions: Position[] = [root];
  const intervals: number[] = [0];
  let previousMidi = rootMidi;

  for (let i = 1; i < strings.length; i++) {
    const stringNo = strings[i];
    const target = ((tones[i] % 12) + 12) % 12;
    let found: Position | null = null;

    for (let fret = 0; fret <= MAX_FRET; fret++) {
      const pos = { string: stringNo, fret };
      const midi = midiAt(tuning, pos);
      if (midi <= previousMidi) continue;
      if (((midi - rootMidi) % 12 + 12) % 12 !== target) continue;
      found = pos;
      break;
    }

    if (!found) return null;
    const foundMidi = midiAt(tuning, found);
    if (foundMidi - previousMidi > MAX_GAP) return null;
    positions.push(found);
    intervals.push(foundMidi - rootMidi);
    previousMidi = foundMidi;
  }

  // 押さえられる幅に収まっているか確認する
  const frets = positions.map((p) => p.fret);
  const fretted = frets.filter((f) => f > 0);
  if (fretted.length > 0) {
    const span = Math.max(...fretted) - Math.min(...fretted);
    if (span > MAX_SPAN) return null;
  }

  return {
    quality,
    voicing,
    root,
    rootPitchClass: ((rootMidi % 12) + 12) % 12,
    positions,
    intervals,
  };
}

/** コードネームを組み立てる (例: "C", "Am7", "G♭maj7") */
export function chordName(rootName: string, quality: ChordQuality): string {
  return `${rootName}${quality.symbol}`;
}

export function samePositionSet(a: Position[], b: Position[]): boolean {
  if (a.length !== b.length) return false;
  const key = (p: Position) => `${p.string}-${p.fret}`;
  const setB = new Set(b.map(key));
  return a.every((p) => setB.has(key(p)));
}
