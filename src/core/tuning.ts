import { parseNote, type PitchClass } from "./notes";

export interface Tuning {
  id: string;
  label: string;
  /** 1弦から6弦の順に並べた開放弦の音名 (ASCII の ♯ 表記) */
  openNotes: string[];
  /** 1弦から6弦の順に並べた開放弦の MIDI ノート番号 */
  openMidi: number[];
}

export const TUNINGS: Tuning[] = [
  {
    id: "standard",
    label: "スタンダード (EADGBE)",
    openNotes: ["E", "B", "G", "D", "A", "E"],
    openMidi: [64, 59, 55, 50, 45, 40],
  },
  {
    id: "drop-d",
    label: "ドロップD (DADGBE)",
    openNotes: ["E", "B", "G", "D", "A", "D"],
    openMidi: [64, 59, 55, 50, 45, 38],
  },
  {
    id: "half-down",
    label: "半音下げ (E♭)",
    openNotes: ["D#", "A#", "F#", "C#", "G#", "D#"],
    openMidi: [63, 58, 54, 49, 44, 39],
  },
];

export function getTuning(id: string): Tuning {
  return TUNINGS.find((t) => t.id === id) ?? TUNINGS[0];
}

/** 1弦から6弦の順に並べた開放弦のピッチクラス配列 */
export function openPitchClasses(tuning: Tuning): PitchClass[] {
  return tuning.openNotes.map(parseNote);
}
