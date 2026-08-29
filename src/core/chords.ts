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

/** 隣り合って鳴らす弦のあいだに飛ばせる弦の本数の上限 */
export const MAX_STRING_SKIP = 1;

/**
 * ボイシングで使える弦の組み合わせ（低音弦→高音弦の順）をすべて返す。
 * 隣同士の弦だけでなく、弦を飛ばした組み合わせも含む
 * （飛ばせるのは連続 MAX_STRING_SKIP 本まで）。
 */
export function voicingStringGroups(voicing: VoicingType): number[][] {
  const count = getVoicing(voicing).noteCount;
  const groups: number[][] = [];
  const current: number[] = [];

  const walk = (next: number): void => {
    if (current.length === count) {
      groups.push(current.slice());
      return;
    }
    for (let s = next; s >= count - current.length; s--) {
      const prev = current[current.length - 1];
      if (prev !== undefined && prev - s > MAX_STRING_SKIP + 1) break;
      current.push(s);
      walk(s - 1);
      current.pop();
    }
  };

  walk(STRING_COUNT);
  return groups;
}

/**
 * そのルート弦を含む弦の組み合わせ。ルートが最低音になるものを先頭に、
 * 弦の広がりが狭いものを優先して並べる。
 */
export function stringSets(voicing: VoicingType, rootString: number): number[][] {
  const spread = (g: number[]): number => g[0] - g[g.length - 1];
  return voicingStringGroups(voicing)
    .filter((g) => g.includes(rootString))
    .sort(
      (a, b) => a.indexOf(rootString) - b.indexOf(rootString) || spread(a) - spread(b),
    );
}

/** そのルート弦でボイシングが成立するか（弦が足りるか） */
export function isVoicingAvailable(voicing: VoicingType, rootString: number): boolean {
  return stringSets(voicing, rootString).length > 0;
}

/** ボイシングで押さえる構成音（ルートからの半音距離） */
export function voicingTones(voicing: VoicingType, quality: ChordQuality): number[] {
  if (voicing === "guide") {
    // 5度を省いた R・3rd・7th
    return [0, quality.intervals[1], quality.intervals[3]];
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
  /** positions と同じ並びの、ルートからの音程（展開形では負になる） */
  intervals: number[];
  /** positions の中でルートが何番目か。0 ならルートが最低音 */
  rootIndex: number;
  /** 押さえるのに必要な指の本数（開放弦は 0 本、セーハは 1 本） */
  fingers: number;
}

/** 押弦幅（最低フレットとの差）の上限 */
const MAX_SPAN = 4;
/** ローポジション（このフレット未満から始まる）はフレット間隔が広いので幅を狭める */
const LOW_POSITION_FRET = 5;
const MAX_SPAN_LOW = 3;
/** 隣り合う構成音の音程の上限（半音）。クローズボイシングを保つ */
const MAX_GAP = 12;
/** 押弦に使える指の本数（親指は数えない） */
export const MAX_FINGERS = 4;

const mod12 = (n: number): number => ((n % 12) + 12) % 12;
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
 * 物理的に押さえられない（押弦幅が広すぎる）場合は null を返す。
 * 開放弦は指を使わず、最低フレットの同フレット複数音はセーハで 1 本と数える。
 */
export function requiredFingers(positions: Position[]): number | null {
  const fretted = positions.filter((p) => p.fret > 0);
  if (fretted.length === 0) return 0;

  const frets = fretted.map((p) => p.fret);
  const minFret = Math.min(...frets);
  const limit = minFret < LOW_POSITION_FRET ? MAX_SPAN_LOW : MAX_SPAN;
  if (Math.max(...frets) - minFret > limit) return null;

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

/** 人間が押さえられるシェイプか */
export function isPlayableShape(positions: Position[]): boolean {
  const fingers = requiredFingers(positions);
  return fingers !== null && fingers <= MAX_FINGERS;
}

/**
 * ルート位置を含むコードシェイプをすべて生成する。
 * 各弦に構成音を1音ずつ、音高が低音弦から高音弦へ昇順になるよう配置する。
 * ルートが最低音でないもの（展開形）も含まれる。
 */
export function buildChordShapes(
  tuning: Tuning,
  voicing: VoicingType,
  quality: ChordQuality,
  root: Position,
): ChordShape[] {
  const tones = voicingTones(voicing, quality);
  if (tones.some((t) => !Number.isFinite(t))) return [];

  const rootMidi = midiAt(tuning, root);
  const shapes: ChordShape[] = [];
  const seen = new Set<string>();

  // 押弦幅の制約から、探索するフレットはルート周辺に限定できる。
  // 開放弦ルートは押弦幅の計算に含まれないため、音程差の上限まで広げる。
  const lowFret = Math.max(0, root.fret - MAX_SPAN);
  const highFret =
    root.fret === 0 ? Math.min(MAX_FRET, MAX_GAP) : Math.min(MAX_FRET, root.fret + MAX_SPAN);

  for (const strings of stringSets(voicing, root.string)) {
    const rootIndex = strings.indexOf(root.string);
    if (tones.length !== strings.length) continue;

    const used = new Array<boolean>(tones.length).fill(false);
    const chosen: Position[] = [];

    const spanOk = (): boolean => {
      const f = chosen.filter((p) => p.fret > 0).map((p) => p.fret);
      return f.length === 0 || Math.max(...f) - Math.min(...f) <= MAX_SPAN;
    };

    const place = (index: number, pos: Position, toneIndex: number, prevMidi: number | null) => {
      const midi = midiAt(tuning, pos);
      if (prevMidi !== null && (midi <= prevMidi || midi - prevMidi > MAX_GAP)) return;
      used[toneIndex] = true;
      chosen.push(pos);
      if (spanOk()) dfs(index + 1, midi);
      chosen.pop();
      used[toneIndex] = false;
    };

    const dfs = (index: number, prevMidi: number | null): void => {
      if (index === strings.length) {
        const positions = chosen.slice();
        const fingers = requiredFingers(positions);
        if (fingers === null || fingers > MAX_FINGERS) return;
        const key = positions.map(posKey).join("|");
        if (seen.has(key)) return;
        seen.add(key);
        shapes.push({
          quality,
          voicing,
          root,
          rootPitchClass: mod12(rootMidi) as PitchClass,
          positions,
          intervals: positions.map((p) => midiAt(tuning, p) - rootMidi),
          rootIndex,
          fingers,
        });
        return;
      }

      if (index === rootIndex) {
        const toneIndex = tones.indexOf(0);
        if (toneIndex < 0 || used[toneIndex]) return;
        place(index, root, toneIndex, prevMidi);
        return;
      }

      for (let t = 0; t < tones.length; t++) {
        if (used[t]) continue;
        const target = mod12(tones[t]);
        for (let fret = lowFret; fret <= highFret; fret++) {
          const pos = { string: strings[index], fret };
          if (mod12(midiAt(tuning, pos) - rootMidi) !== target) continue;
          place(index, pos, t, prevMidi);
        }
        // 開放弦も候補に含める
        if (lowFret > 0) {
          const open = { string: strings[index], fret: 0 };
          if (mod12(midiAt(tuning, open) - rootMidi) === target) place(index, open, t, prevMidi);
        }
      }
    };

    dfs(0, null);
  }

  const span = (s: ChordShape): number => {
    const f = s.positions.filter((p) => p.fret > 0).map((p) => p.fret);
    return f.length === 0 ? 0 : Math.max(...f) - Math.min(...f);
  };
  const stringSpread = (s: ChordShape): number =>
    s.positions[0].string - s.positions[s.positions.length - 1].string;

  return shapes.sort(
    (a, b) =>
      a.rootIndex - b.rootIndex ||
      a.fingers - b.fingers ||
      stringSpread(a) - stringSpread(b) ||
      span(a) - span(b) ||
      Math.max(...a.positions.map((p) => p.fret)) - Math.max(...b.positions.map((p) => p.fret)),
  );
}

/**
 * ルート位置から代表的なコードシェイプを 1 つ生成する。
 * ルートが最低音になるもの、押弦幅の狭いものを優先する。
 */
export function buildChordShape(
  tuning: Tuning,
  voicing: VoicingType,
  quality: ChordQuality,
  root: Position,
): ChordShape | null {
  return buildChordShapes(tuning, voicing, quality, root)[0] ?? null;
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
