import type { PitchClass } from "./notes";
import { openPitchClasses, type Tuning } from "./tuning";

export const MAX_FRET = 24;
export const STRING_COUNT = 6;

/** 指板上の1点。string は 1〜6 (1弦=高音側), fret は 0〜24 */
export interface Position {
  string: number;
  fret: number;
}

/** ポジションマークを付けるフレット (シングルドット) */
export const SINGLE_DOT_FRETS = [3, 5, 7, 9, 15, 17, 19, 21];
/** ポジションマークを付けるフレット (ダブルドット) */
export const DOUBLE_DOT_FRETS = [12, 24];

/** 指定ポジションのピッチクラスを返す */
export function pitchClassAt(tuning: Tuning, pos: Position): PitchClass {
  const opens = openPitchClasses(tuning);
  const open = opens[pos.string - 1];
  return (open + pos.fret) % 12;
}

/** 指定ポジションの MIDI ノート番号 (実音高) を返す */
export function midiAt(tuning: Tuning, pos: Position): number {
  return tuning.openMidi[pos.string - 1] + pos.fret;
}

/** 指定ピッチクラスに一致する全ポジションを返す */
export function findPositions(
  tuning: Tuning,
  pc: PitchClass,
  maxFret: number = MAX_FRET,
): Position[] {
  const result: Position[] = [];
  for (let s = 1; s <= STRING_COUNT; s++) {
    for (let f = 0; f <= maxFret; f++) {
      if (pitchClassAt(tuning, { string: s, fret: f }) === pc) {
        result.push({ string: s, fret: f });
      }
    }
  }
  return result;
}

export function samePosition(a: Position, b: Position): boolean {
  return a.string === b.string && a.fret === b.fret;
}
