/** 度数（ルートからの半音距離 0〜11） */
export type Interval = number;

/** 度数表記のスタイル */
export type DegreeStyle = "roman" | "quality";

export interface Degree {
  interval: Interval;
  /** ローマ数字表記 (I, ♭III, V ...) */
  roman: string;
  /** 音程名表記 (P1, m3, P5 ...) */
  quality: string;
  /** 日本語の読み */
  reading: string;
}

export const DEGREES: Degree[] = [
  { interval: 0, roman: "I", quality: "P1", reading: "完全1度（ルート）" },
  { interval: 1, roman: "♭II", quality: "m2", reading: "短2度" },
  { interval: 2, roman: "II", quality: "M2", reading: "長2度" },
  { interval: 3, roman: "♭III", quality: "m3", reading: "短3度" },
  { interval: 4, roman: "III", quality: "M3", reading: "長3度" },
  { interval: 5, roman: "IV", quality: "P4", reading: "完全4度" },
  { interval: 6, roman: "♭V", quality: "TT", reading: "三全音（増4度/減5度）" },
  { interval: 7, roman: "V", quality: "P5", reading: "完全5度" },
  { interval: 8, roman: "♭VI", quality: "m6", reading: "短6度" },
  { interval: 9, roman: "VI", quality: "M6", reading: "長6度" },
  { interval: 10, roman: "♭VII", quality: "m7", reading: "短7度" },
  { interval: 11, roman: "VII", quality: "M7", reading: "長7度" },
];

export function getDegree(interval: Interval): Degree {
  return DEGREES[((interval % 12) + 12) % 12];
}

export function degreeLabel(interval: Interval, style: DegreeStyle): string {
  const d = getDegree(interval);
  return style === "quality" ? d.quality : d.roman;
}

/** 出題対象とする度数のグループ */
export type DegreeGroup =
  | "chord-tone"
  | "major"
  | "natural-minor"
  | "harmonic-minor"
  | "melodic-minor"
  | "major-penta"
  | "minor-penta"
  | "blues"
  | "all";

export const DEGREE_GROUPS: { id: DegreeGroup; label: string; intervals: Interval[] }[] = [
  {
    id: "chord-tone",
    label: "コードトーン (I ♭III III V ♭VII VII)",
    intervals: [0, 3, 4, 7, 10, 11],
  },
  {
    id: "major",
    label: "メジャースケール (I II III IV V VI VII)",
    intervals: [0, 2, 4, 5, 7, 9, 11],
  },
  {
    id: "natural-minor",
    label: "ナチュラルマイナー (I II ♭III IV V ♭VI ♭VII)",
    intervals: [0, 2, 3, 5, 7, 8, 10],
  },
  {
    id: "harmonic-minor",
    label: "ハーモニックマイナー (I II ♭III IV V ♭VI VII)",
    intervals: [0, 2, 3, 5, 7, 8, 11],
  },
  {
    id: "melodic-minor",
    label: "メロディックマイナー (I II ♭III IV V VI VII)",
    intervals: [0, 2, 3, 5, 7, 9, 11],
  },
  {
    id: "major-penta",
    label: "メジャーペンタトニック (I II III V VI)",
    intervals: [0, 2, 4, 7, 9],
  },
  {
    id: "minor-penta",
    label: "マイナーペンタトニック (I ♭III IV V ♭VII)",
    intervals: [0, 3, 5, 7, 10],
  },
  {
    id: "blues",
    label: "ブルーススケール (I ♭III IV ♭V V ♭VII)",
    intervals: [0, 3, 5, 6, 7, 10],
  },
  { id: "all", label: "全12音程", intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
];

export function getDegreeGroup(id: DegreeGroup): Interval[] {
  return (DEGREE_GROUPS.find((g) => g.id === id) ?? DEGREE_GROUPS[0]).intervals;
}
