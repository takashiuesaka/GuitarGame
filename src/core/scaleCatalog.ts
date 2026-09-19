import { getDegreeGroup } from "./degrees";
import { MAX_FRET, findPositions, midiAt, pitchClassAt, type Position } from "./fretboard";
import { noteRegionError, type ScaleNoteBlock } from "./noteBlock";
import type { PitchClass } from "./notes";
import { getTuning, type Tuning } from "./tuning";

export type ScaleType = "major" | "natural-minor";
export type ScaleDirection = "higher" | "lower" | "mixed";

export const SCALE_TYPE_LABELS: Record<ScaleType, string> = {
  major: "メジャー",
  "natural-minor": "ナチュラルマイナー",
};

export const SCALE_DIRECTION_LABELS: Record<ScaleDirection, string> = {
  higher: "高音側（ルート以上）",
  lower: "低音側（ルート以下）",
  mixed: "両側（フォーム全体）",
};

export interface ScaleCatalogSource {
  id: string;
  title: string;
  url: string;
  locator: string;
}

export interface CatalogScalePattern {
  id: string;
  name: string;
  scaleType: ScaleType;
  tonic: PitchClass;
  /** 原典のフレット番号。6弦→1弦の順。 */
  frets: readonly (readonly number[])[];
  sourceIds: readonly string[];
  note: string;
}

export interface ScaleSelection {
  scaleType: ScaleType;
  tonic: PitchClass;
  rootString: number;
  rootFret: number;
  direction: ScaleDirection;
  patternId: string;
}

export interface CatalogScaleBlock extends ScaleNoteBlock {
  pattern: CatalogScalePattern;
  selection: ScaleSelection;
}

export const SCALE_CATALOG_SOURCES: readonly ScaleCatalogSource[] = [
  { id: "fretjam-major", title: "Fretjam — The Major Scale on Guitar", url: "https://www.fretjam.com/major-scale.html", locator: "Basic major scale guitar patterns（6弦・5弦ルート図）" },
  { id: "guitareo-major", title: "Guitareo — The Major Guitar Scale", url: "https://www.guitarlessons.com/guitar-lessons/guitar-scales/major-guitar-scale", locator: "各弦のフレット説明と最初の1オクターブの段階練習" },
  { id: "guitarscale-c", title: "GuitarScale.org — C Major", url: "https://www.guitarscale.org/c-major.html", locator: "Shapes: 7th position（c_major_box1.png）" },
  { id: "fachords-major", title: "FaChords — C Major Scale", url: "https://www.fachords.com/major-scale/", locator: "インタラクティブ教材 c_major_scale" },
  { id: "fachords-data", title: "FaChords — C major lesson data", url: "https://www.fachords.com/tools/get-json-lessons/?lesson=c_major_scale", locator: "lessons.c_major_scale.steps[1], [4], [7], [10], [13].frets" },
  { id: "fender-minor", title: "Fender — A Minor Guitar Scale", url: "https://www.fender.com/articles/scales/a-minor-guitar-scale", locator: "5th Position の図（本文の誤記ではなく実音で自然短音階と確認）" },
  { id: "fretjam-minor", title: "Fretjam — Natural Minor Scale on Guitar", url: "https://www.fretjam.com/natural-minor-scale.html", locator: "Natural minor scale guitar basics（6弦・5弦ルート図）" },
  { id: "agt-minor", title: "Applied Guitar Theory — Natural Minor Scale", url: "https://appliedguitartheory.com/lessons/natural-minor-scale/", locator: "Position 1 / Position 3 の図（GマイナーをAへ移調）" },
  { id: "guitarcommand-minor", title: "Guitar Command — A Minor Scale Guitar TAB", url: "https://www.guitarcommand.com/a-minor-scale-guitar/", locator: "2 Octave A Natural Minor Scale のTAB" },
  { id: "guitarscale-a", title: "GuitarScale.org — A Minor", url: "https://www.guitarscale.org/a-minor.html", locator: "A Minor 2 octaves（a_minor.png）" },
];

/** 図・本文・教材データから確認した位置集合。外接長方形から音を補充しない。 */
export const SCALE_PATTERNS: readonly CatalogScalePattern[] = [
  {
    id: "major-basic-box", name: "基本ボックス（6弦系）", scaleType: "major", tonic: 0,
    frets: [[8, 10], [7, 8, 10], [7, 9, 10], [7, 9, 10], [8, 10], [7, 8, 10]],
    sourceIds: ["fretjam-major", "guitareo-major"],
    note: "FretjamのC配置とGuitareoのG配置を+5した形が一致。16位置、C3〜D5。",
  },
  {
    id: "major-first-octave", name: "基本の1オクターブ（6〜4弦）", scaleType: "major", tonic: 0,
    frets: [[8, 10], [7, 8, 10], [7, 9, 10], [], [], []],
    sourceIds: ["guitareo-major", "fretjam-major", "fachords-data"],
    note: "Guitareoが明示する最初の1オクターブ。FaChords steps[1]とも一致するC3〜C4の8位置。",
  },
  {
    id: "major-seventh-box", name: "第7ポジションの全形", scaleType: "major", tonic: 0,
    frets: [[7, 8, 10], [7, 8, 10], [7, 9, 10], [7, 9, 10], [8, 10], [7, 8, 10]],
    sourceIds: ["guitarscale-c"],
    note: "原典の全形はB2〜D5。6弦8fのCより低いBも含む。基本ボックスとは別の収録音。",
  },
  {
    id: "major-fifth-octave", name: "5弦からの1オクターブ", scaleType: "major", tonic: 0,
    frets: [[], [3, 5], [2, 3, 5], [2, 4, 5], [], []],
    sourceIds: ["fretjam-major", "fachords-data"],
    note: "Fretjamの5弦ルートボックスからC3〜C4を抽出した8位置。FaChords steps[4]の1オクターブ教材とも完全一致する。Fretjamの全形とは区別する。",
  },
  {
    id: "major-3nps", name: "3NPS（6弦からの全形）", scaleType: "major", tonic: 0,
    frets: [[8, 10, 12], [8, 10, 12], [9, 10, 12], [9, 10, 12], [10, 12, 13], [10, 12, 13]],
    sourceIds: ["fachords-major", "fachords-data"],
    note: "教材steps[13]の18位置をそのまま採録。原典の「2 octaves」という題名と異なり、実音域はC3〜F5。",
  },
  {
    id: "major-fourth-3nps", name: "4弦からの1オクターブ（3NPS系）", scaleType: "major", tonic: 0,
    frets: [[], [], [10, 12, 14], [10, 12, 14], [12, 13], []],
    sourceIds: ["fachords-major", "fachords-data"],
    note: "教材steps[7]の8位置。上のルートで止まるため弦ごとの音数は3・3・2。",
  },
  {
    id: "major-third-3nps", name: "3弦からの1オクターブ（3NPS系）", scaleType: "major", tonic: 0,
    frets: [[], [], [], [5, 7, 9], [6, 8, 10], [7, 8]],
    sourceIds: ["fachords-major", "fachords-data"],
    note: "教材steps[10]の8位置。3・3・2音で、G弦とB弦の間隔の違いを含む。",
  },
  {
    id: "minor-basic-box", name: "基本ボックス（6弦系）", scaleType: "natural-minor", tonic: 9,
    frets: [[5, 7, 8], [5, 7, 8], [5, 7], [4, 5, 7], [5, 6, 8], [5, 7, 8]],
    sourceIds: ["fender-minor", "fretjam-minor", "agt-minor"],
    note: "17位置、A2〜C5。3弦4fへの移動も原典どおり保持する。",
  },
  {
    id: "minor-fifth-box", name: "基本ボックス（5弦系）", scaleType: "natural-minor", tonic: 9,
    frets: [[], [12, 14, 15], [12, 14, 15], [12, 14], [12, 13, 15], [12, 13, 15]],
    sourceIds: ["fretjam-minor"],
    note: "掲載図とAマイナーの5弦12f指定に基づく14位置。6弦は使わない。",
  },
  {
    id: "minor-position-three", name: "AGT 第3ポジションの全形", scaleType: "natural-minor", tonic: 9,
    frets: [[10, 12, 13], [10, 12], [9, 10, 12], [9, 10, 12], [10, 12, 13], [10, 12, 13]],
    sourceIds: ["agt-minor"],
    note: "Gマイナーの原図を+2移調した17位置。5弦12fと2弦10fがA。ルートより低い音も含む。",
  },
  {
    id: "minor-two-octaves", name: "2オクターブの練習形", scaleType: "natural-minor", tonic: 9,
    frets: [[5, 7, 8], [5, 7, 8], [5, 7], [4, 5, 7], [5, 6, 8], [5]],
    sourceIds: ["guitarcommand-minor", "guitarscale-a"],
    note: "TABの上行部分15位置、A2〜A4。基本ボックスの上端2音を含まない独立した教材例。",
  },
];

export const DEFAULT_SCALE_SELECTION: Readonly<ScaleSelection> = {
  scaleType: "major", tonic: 0, rootString: 6, rootFret: 8, direction: "higher", patternId: "major-basic-box",
};

export function isScaleSelection(value: unknown): value is ScaleSelection {
  if (typeof value !== "object" || value === null) return false;
  if (!("scaleType" in value) || (value.scaleType !== "major" && value.scaleType !== "natural-minor")
    || !("direction" in value) || (value.direction !== "higher" && value.direction !== "lower" && value.direction !== "mixed")
    || !("patternId" in value) || typeof value.patternId !== "string" || value.patternId.length === 0) return false;
  return "tonic" in value && typeof value.tonic === "number" && Number.isInteger(value.tonic) && value.tonic >= 0 && value.tonic < 12
    && "rootString" in value && typeof value.rootString === "number" && Number.isInteger(value.rootString) && value.rootString >= 1 && value.rootString <= 6
    && "rootFret" in value && typeof value.rootFret === "number" && Number.isInteger(value.rootFret) && value.rootFret >= 0 && value.rootFret <= MAX_FRET;
}

export function chooseScaleBlock(blocks: readonly CatalogScaleBlock[], preferred: ScaleSelection): CatalogScaleBlock {
  if (blocks.length === 0) throw new Error("このスケールとチューニングで使えるカタログ運指がありません。");
  const priority = (block: CatalogScaleBlock): number[] => [
    Number(block.root.string !== preferred.rootString),
    Math.abs(block.root.fret - preferred.rootFret),
    Number(block.selection.direction !== preferred.direction),
    Number(block.pattern.id !== preferred.patternId),
  ];
  return [...blocks].sort((a, b) => {
    const left = priority(a);
    const right = priority(b);
    for (let i = 0; i < left.length; i++) {
      if (left[i] !== right[i]) return left[i] - right[i];
    }
    return 0;
  })[0];
}

export function scalePatternPositions(pattern: CatalogScalePattern): Position[] {
  return pattern.frets.flatMap((frets, index) => frets.map((fret) => ({ string: 6 - index, fret })));
}

/** 原典の運指を移動・音域抽出するだけで、新たな運指は生成しない。 */
export function catalogScaleBlocks(
  tuning: Tuning,
  scaleType: ScaleType,
  tonic: PitchClass,
  patterns: readonly CatalogScalePattern[] = SCALE_PATTERNS,
): CatalogScaleBlock[] {
  const standard = getTuning("standard");
  const targetRoots = findPositions(tuning, tonic);
  const result: CatalogScaleBlock[] = [];
  const expectedIntervals = getDegreeGroup(scaleType);
  for (const pattern of patterns.filter((entry) => entry.scaleType === scaleType)) {
    const reference = scalePatternPositions(pattern);
    const roots = reference.filter((pos) => pitchClassAt(standard, pos) === pattern.tonic);
    for (const referenceRoot of roots) {
      const rootMidi = midiAt(standard, referenceRoot);
      for (const direction of ["higher", "lower", "mixed"] as const) {
        const positions = reference.filter((pos) => {
          const midi = midiAt(standard, pos);
          return direction === "higher" ? midi >= rootMidi : direction === "lower" ? midi <= rootMidi : true;
        });
        if (direction === "mixed" && (!positions.some((pos) => midiAt(standard, pos) < rootMidi)
          || !positions.some((pos) => midiAt(standard, pos) > rootMidi))) continue;
        if (noteRegionError(standard, { kind: "scale", root: referenceRoot, positions })) continue;
        for (const root of targetRoots.filter((pos) => pos.string === referenceRoot.string)) {
          const shift = root.fret - referenceRoot.fret;
          const moved = positions.map((pos) => ({ string: pos.string, fret: pos.fret + shift }));
          if (moved.some((pos) => pos.fret < 0 || pos.fret > MAX_FRET)) continue;
          const tuningShift = tuning.openMidi[root.string - 1] - standard.openMidi[root.string - 1];
          if (moved.some((pos) => tuning.openMidi[pos.string - 1] - standard.openMidi[pos.string - 1] !== tuningShift)) continue;
          if (moved.some((pos) => !expectedIntervals.includes((pitchClassAt(tuning, pos) - tonic + 12) % 12))) continue;
          const block: CatalogScaleBlock = {
            kind: "scale",
            root: { ...root },
            positions: moved,
            pattern,
            selection: { scaleType, tonic, rootString: root.string, rootFret: root.fret, direction, patternId: pattern.id },
          };
          if (!noteRegionError(tuning, block)) result.push(block);
        }
      }
    }
  }
  return result;
}

export function matchesScaleSelection(block: CatalogScaleBlock, selection: ScaleSelection): boolean {
  return block.selection.scaleType === selection.scaleType && block.selection.tonic === selection.tonic
    && block.root.string === selection.rootString && block.root.fret === selection.rootFret
    && block.selection.direction === selection.direction && block.pattern.id === selection.patternId;
}
