import { MAX_FRET, STRING_COUNT, midiAt, pitchClassAt, samePosition, type Position } from "./fretboard";
import type { Tuning } from "./tuning";

export interface NoteBlock {
  firstString: number;
  lastString: number;
  minFret: number;
  maxFret: number;
}

export interface ScaleNoteBlock {
  kind: "scale";
  root: Position;
  positions: readonly Position[];
}

export type NoteRegion = NoteBlock | ScaleNoteBlock;

export function isScaleNoteBlock(block: NoteRegion): block is ScaleNoteBlock {
  return "kind" in block && block.kind === "scale";
}

export const DEFAULT_NOTE_BLOCK: Readonly<NoteBlock> = {
  firstString: 1,
  lastString: 3,
  minFret: 0,
  maxFret: 4,
};

export function isInNoteBlock(pos: Position, block: NoteRegion): boolean {
  if (isScaleNoteBlock(block)) return block.positions.some((p) => samePosition(p, pos));
  return Number.isInteger(pos.string) && Number.isInteger(pos.fret)
    && pos.string >= block.firstString && pos.string <= block.lastString
    && pos.fret >= block.minFret && pos.fret <= block.maxFret;
}

export function noteRegionError(tuning: Tuning, block: NoteRegion): string | null {
  if (!isScaleNoteBlock(block)) return noteBlockError(tuning, block);
  if (block.positions.some((pos) => !Number.isInteger(pos.string) || !Number.isInteger(pos.fret)
    || pos.string < 1 || pos.string > STRING_COUNT || pos.fret < 0 || pos.fret > MAX_FRET)) {
    return "スケールの運指が指板の範囲外です。";
  }
  if (!block.positions.some((pos) => samePosition(pos, block.root))) {
    return "スケールの運指に指定したルートがありません。";
  }
  const pitches = new Set(block.positions.map((pos) => pitchClassAt(tuning, pos)));
  const rootMidi = midiAt(tuning, block.root);
  const midis = new Set(block.positions.map((pos) => midiAt(tuning, pos)));
  const hasCompleteOctave = (start: number): boolean => midis.has(start) && midis.has(start + 12)
    && new Set([...midis].filter((midi) => midi >= start && midi <= start + 12).map((midi) => midi % 12)).size === 7;
  if (pitches.size !== 7 || (!hasCompleteOctave(rootMidi) && !hasCompleteOctave(rootMidi - 12))) {
    return "スケールの運指には7種類の音が必要です。ルートから上か下の1オクターブ内に7音をそろえてください。";
  }
  const keys = new Set(block.positions.map((pos) => `${pos.string}:${pos.fret}`));
  if (keys.size !== block.positions.length) return "スケールの運指に同じ位置が重複しています。";
  return null;
}

/** 弦ごとの運指の幅をつなぎ、内側のセル境界を除いた外周を返す。座標はセル単位。 */
export function scaleBlockOutline(block: ScaleNoteBlock): [number, number, number, number][] {
  const cells: Position[] = [];
  for (let string = 1; string <= STRING_COUNT; string++) {
    const frets = block.positions.filter((pos) => pos.string === string).map((pos) => pos.fret);
    if (frets.length === 0) continue;
    for (let fret = Math.min(...frets); fret <= Math.max(...frets); fret++) cells.push({ string, fret });
  }
  const occupied = new Set(cells.map((pos) => `${pos.string}:${pos.fret}`));
  const edges: [number, number, number, number][] = [];
  for (const { string, fret } of cells) {
    if (!occupied.has(`${string - 1}:${fret}`)) edges.push([fret, string - 1, fret + 1, string - 1]);
    if (!occupied.has(`${string + 1}:${fret}`)) edges.push([fret, string, fret + 1, string]);
    if (!occupied.has(`${string}:${fret - 1}`)) edges.push([fret, string - 1, fret, string]);
    if (!occupied.has(`${string}:${fret + 1}`)) edges.push([fret + 1, string - 1, fret + 1, string]);
  }
  return edges;
}

/** 保存データも検証し、使えないブロックは理由を返す。 */
export function noteBlockError(tuning: Tuning, value: unknown): string | null {
  if (typeof value !== "object" || value === null
    || !("firstString" in value) || !("lastString" in value)
    || !("minFret" in value) || !("maxFret" in value)) {
    return "ブロックの弦とフレット範囲を指定してください。";
  }
  const { firstString, lastString, minFret, maxFret } = value;
  if (typeof firstString !== "number" || typeof lastString !== "number"
    || !Number.isInteger(firstString) || !Number.isInteger(lastString)
    || firstString < 1 || lastString > STRING_COUNT || firstString > lastString) {
    return "弦は1〜6弦の範囲で、開始弦以下にならない終了弦を指定してください。";
  }
  if (typeof minFret !== "number" || typeof maxFret !== "number"
    || !Number.isInteger(minFret) || !Number.isInteger(maxFret)
    || minFret < 0 || maxFret > MAX_FRET || minFret > maxFret) {
    return "フレットは0〜24の範囲で、開始以下にならない終了フレットを指定してください。";
  }
  const pitches = new Set<number>();
  for (let string = firstString; string <= lastString; string++) {
    for (let fret = minFret; fret <= maxFret; fret++) {
      pitches.add(pitchClassAt(tuning, { string, fret }));
    }
  }
  return pitches.size === 12
    ? null
    : `ブロックには1オクターブ分の全12音が必要です（現在${pitches.size}音）。弦かフレットの範囲を広げてください。`;
}
