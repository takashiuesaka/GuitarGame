import type { Position } from "./fretboard";
import type { PitchClass } from "./notes";

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
export type VoicingType = "triad" | "seventh" | "guide" | "form";

export interface VoicingDef {
  id: VoicingType;
  label: string;
  description: string;
  /** 押さえる最低音数。オクターブを重ねてこれより増えることがある */
  noteCount: number;
}

export const VOICINGS: VoicingDef[] = [
  {
    id: "triad",
    label: "トライアド（R・3rd・5th）",
    description: "ルート・3度・5度の3音。オクターブ重複なし",
    noteCount: 3,
  },
  {
    id: "seventh",
    label: "セブンス（R・3rd・5th・7th）",
    description: "ルート・3度・5度・7度の4音。オクターブ重複なし",
    noteCount: 4,
  },
  {
    id: "guide",
    label: "ガイドトーン（R・3rd・7th／5th省略）",
    description: "5度を省いたシェルボイシング。ジャズで多用される3音",
    noteCount: 3,
  },
  {
    id: "form",
    label: "コードフォーム（開放・バレー）",
    description: "構成音をオクターブで重ねた開放コード／バレーコードの形。4〜6音",
    noteCount: 4,
  },
];

export function getVoicing(id: VoicingType): VoicingDef {
  return VOICINGS.find((v) => v.id === id) ?? VOICINGS[0];
}

export interface ChordShape {
  quality: ChordQuality;
  voicing: VoicingType;
  root: Position;
  rootPitchClass: PitchClass;
  /** 低音弦から高音弦の順に並んだ押弦位置 */
  positions: Position[];
  /** positions と同じ並びの、ルートからの音程（展開形では負になる） */
  intervals: number[];
  /** positions の中でルートが何番目か。0 ならルートが最低音 */
  rootIndex: number;
  /** 押さえるのに必要な指の本数（開放弦は 0 本、セーハは 1 本） */
  fingers: number;
  /** 意図的に省略している構成音（ルートからの半音距離）。通常は5度 */
  omits: number[];
  /** 元になったカタログエントリの ID */
  catalogId: string;
  /** 元になったカタログエントリの表示名（例: "ドロップ2 型1"） */
  catalogName: string;
}

/** 押弦幅（最低フレットとの差）の上限 */
const MAX_SPAN = 4;
/** ローポジション（このフレット未満から始まる）はフレット間隔が広いので幅を狭める */
const LOW_POSITION_FRET = 5;
const MAX_SPAN_LOW = 3;
/** 押弦に使える指の本数（親指は数えない） */
export const MAX_FINGERS = 4;

const posKey = (p: Position): string => `${p.string}-${p.fret}`;

/**
 * 同じフレットの複数音を人差し指のセーハで押さえられるか。
 * セーハする弦の範囲の内側に、それより低いフレット（開放弦を含む）があると押さえられない。
 */
function canBarre(group: Position[], all: Position[]): boolean {
  const fret = group[0].fret;
  const lo = Math.min(...group.map((p) => p.string));
  const hi = Math.max(...group.map((p) => p.string));
  return !all.some((p) => p.string > lo && p.string < hi && p.fret < fret);
}

/**
 * そのシェイプを押さえるのに必要な指の本数。
 * 開放弦は指を使わず、最低フレットの同フレット複数音はセーハで 1 本と数える。
 */
export function fingerCount(positions: Position[]): number {
  const fretted = positions.filter((p) => p.fret > 0);
  if (fretted.length === 0) return 0;

  const minFret = Math.min(...fretted.map((p) => p.fret));

  const byFret = new Map<number, Position[]>();
  for (const p of fretted) {
    const list = byFret.get(p.fret);
    if (list) list.push(p);
    else byFret.set(p.fret, [p]);
  }

  let fingers = 0;
  for (const [fret, group] of byFret) {
    if (group.length === 1) fingers += 1;
    else if (fret === minFret && canBarre(group, positions)) fingers += 1;
    else fingers += group.length;
  }
  return fingers;
}

/** 押弦幅（最低フレットとの差）が手の届く範囲か */
export function isSpanReachable(positions: Position[]): boolean {
  const frets = positions.map((p) => p.fret).filter((f) => f > 0);
  if (frets.length === 0) return true;
  const minFret = Math.min(...frets);
  const limit = minFret < LOW_POSITION_FRET ? MAX_SPAN_LOW : MAX_SPAN;
  return Math.max(...frets) - minFret <= limit;
}

/** 人間が押さえられるシェイプか */
export function isPlayableShape(positions: Position[]): boolean {
  return isSpanReachable(positions) && fingerCount(positions) <= MAX_FINGERS;
}

/** コードネームを組み立てる (例: "C", "Am7", "G♭maj7") */
export function chordName(rootName: string, quality: ChordQuality): string {
  return `${rootName}${quality.symbol}`;
}

export function samePositionSet(a: Position[], b: Position[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b.map(posKey));
  return a.every((p) => setB.has(posKey(p)));
}
