/** 12半音のピッチクラス (0 = C) */
export type PitchClass = number;

/** 音名表記モード */
export type NotationMode = "en" | "ja";

/** 臨時記号の表記スタイル */
export type AccidentalStyle = "sharp" | "flat" | "both";

const EN_SHARP = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const EN_FLAT = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];
const JA_SHARP = [
  "ド",
  "ド♯",
  "レ",
  "レ♯",
  "ミ",
  "ファ",
  "ファ♯",
  "ソ",
  "ソ♯",
  "ラ",
  "ラ♯",
  "シ",
];
const JA_FLAT = [
  "ド",
  "レ♭",
  "レ",
  "ミ♭",
  "ミ",
  "ファ",
  "ソ♭",
  "ソ",
  "ラ♭",
  "ラ",
  "シ♭",
  "シ",
];

/** parseNote 用の内部キー (記号なし ASCII) */
const KEYS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function normalize(pc: PitchClass): number {
  return ((pc % 12) + 12) % 12;
}

/** シャープ/フラットを含む音かどうか */
export function isAccidental(pc: PitchClass): boolean {
  return !NATURAL_PITCH_CLASSES.includes(normalize(pc));
}

/** ピッチクラスを指定表記の音名文字列に変換 */
export function noteName(
  pc: PitchClass,
  mode: NotationMode,
  accidental: AccidentalStyle = "sharp",
): string {
  const i = normalize(pc);
  const sharp = (mode === "ja" ? JA_SHARP : EN_SHARP)[i];
  if (!isAccidental(i)) return sharp;

  const flat = (mode === "ja" ? JA_FLAT : EN_FLAT)[i];
  if (accidental === "flat") return flat;
  if (accidental === "both") return `${sharp}/${flat}`;
  return sharp;
}

/** 音名文字列 (ASCII の ♯ 表記) をピッチクラスに変換 */
export function parseNote(name: string): PitchClass {
  const index = KEYS.indexOf(name);
  if (index < 0) throw new Error(`unknown note: ${name}`);
  return index;
}

/** ナチュラル音のみ (C D E F G A B) */
export const NATURAL_PITCH_CLASSES: PitchClass[] = [0, 2, 4, 5, 7, 9, 11];

/** 全12音 */
export const ALL_PITCH_CLASSES: PitchClass[] = Array.from({ length: 12 }, (_, i) => i);
