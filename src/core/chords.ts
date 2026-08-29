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
 * ボイシングごとに使える弦グループ（低音弦→高音弦の順）をすべて返す。
 * ガイドトーンは 1 本飛ばしたシェルボイシングの配置にする。
 */
export function voicingStringGroups(voicing: VoicingType): number[][] {
  const groups: number[][] = [];

  if (voicing === "guide") {
    for (let s = STRING_COUNT; s >= 1; s--) {
      const group = [s, s - 2, s - 3];
      if (group.every((x) => x >= 1 && x <= STRING_COUNT)) groups.push(group);
    }
    return groups;
  }

  const count = getVoicing(voicing).noteCount;
  for (let s = STRING_COUNT; s >= count; s--) {
    groups.push(Array.from({ length: count }, (_, i) => s - i));
  }
  return groups;
}

/**
 * そのルート弦を含む弦グループ。ルートが最低音になるものを先頭に並べる
 * （後ろに来るものはルートより低い音を含む展開形）。
 */
export function stringSets(voicing: VoicingType, rootString: number): number[][] {
  return voicingStringGroups(voicing)
    .filter((g) => g.includes(rootString))
    .sort((a, b) => a.indexOf(rootString) - b.indexOf(rootString));
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
}

/** 押弦幅の上限（フレット数） */
const MAX_SPAN = 5;
/** 隣り合う構成音の音程の上限（半音）。クローズボイシングを保つ */
const MAX_GAP = 12;

const mod12 = (n: number): number => ((n % 12) + 12) % 12;
const posKey = (p: Position): string => `${p.string}-${p.fret}`;

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

  return shapes.sort(
    (a, b) =>
      a.rootIndex - b.rootIndex ||
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
