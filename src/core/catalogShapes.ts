import {
  CATALOG_TUNING,
  CHORD_CATALOG,
  analyzeCatalogShape,
  tabToPositions,
  transposeTab,
  type CatalogShape,
  type ShapeFamily,
} from "./chordCatalog";
import {
  CHORD_QUALITIES,
  fingerCount,
  getChordQuality,
  type ChordQuality,
  type ChordShape,
  type VoicingType,
} from "./chords";
import { MAX_FRET, midiAt, pitchClassAt, type Position } from "./fretboard";
import type { PitchClass } from "./notes";
import type { Tuning } from "./tuning";

/**
 * 定番コードフォームのカタログを、コードシェイプクイズの正解シェイプに変換する。
 *
 * カタログは移動可能なフォームを1つずつしか持たないが、
 * 開放弦を含まないフォームは任意のフレットへ平行移動できるため、
 * ここで出題されたルート音の位置に合わせて移調する。
 *
 * カタログのタブ譜はスタンダードチューニング前提なので、
 * 別のチューニングでは和音として成立しないフォームがある
 * （例: ドロップDでは6弦を使うフォームが崩れる）。
 * 成立するかどうかは {@link isShapeValidIn} で判定して除外する。
 */

/** 代表シェイプを選ぶときの系統の優先順位 */
const FAMILY_PRIORITY: Record<ShapeFamily, number> = {
  open: 0,
  caged: 1,
  drop2: 2,
  drop3: 3,
  shell: 4,
  triad: 5,
};

/**
 * そのチューニングでフォームが和音として成立するか。
 *
 * 平行移動しても弦ごとの音程差は変わらないので、
 * 判定はタブ譜そのものの位置で1回行えばよい。
 */
export function isShapeValidIn(entry: CatalogShape, tuning: Tuning): boolean {
  if (tuning.id === CATALOG_TUNING.id) return true;

  const analysis = analyzeCatalogShape(entry);
  if (analysis.rootString === null) return false;

  const positions = tabToPositions(entry.tab);
  const rootPos = positions.find((p) => p.string === analysis.rootString);
  if (!rootPos) return false;

  const rootPc = pitchClassAt(tuning, rootPos);
  const actual = new Set(positions.map((p) => (pitchClassAt(tuning, p) - rootPc + 12) % 12));
  const omits = new Set(entry.omits ?? []);
  const expected = analysis.quality.intervals.map((i) => i % 12).filter((i) => !omits.has(i));

  if (actual.size !== expected.length) return false;
  return expected.every((i) => actual.has(i));
}

/** カタログのエントリがどのボイシングに当たるか */
export function catalogVoicing(shape: CatalogShape): VoicingType {
  const quality = getChordQuality(shape.qualityId);
  if (quality.category === "triad") return "triad";
  return shape.omits && shape.omits.length > 0 ? "guide" : "seventh";
}

/** そのボイシングで出題できるコードの種類（カタログにあるものだけ） */
export function catalogQualities(voicing: VoicingType): ChordQuality[] {
  const ids = new Set(
    CHORD_CATALOG.filter((s) => catalogVoicing(s) === voicing).map((s) => s.qualityId),
  );
  return CHORD_QUALITIES.filter((q) => ids.has(q.id));
}

/** そのボイシングで使えるルート弦（カタログにあるものだけ）。低音弦から順 */
export function catalogRootStrings(voicing: VoicingType, tuning: Tuning): number[] {
  const strings = new Set<number>();
  for (const shape of CHORD_CATALOG) {
    if (catalogVoicing(shape) !== voicing) continue;
    if (!isShapeValidIn(shape, tuning)) continue;
    const rootString = analyzeCatalogShape(shape).rootString;
    if (rootString !== null) strings.add(rootString);
  }
  return [...strings].sort((a, b) => b - a);
}

/** そのボイシング・ルート弦の組み合わせがカタログに存在するか */
export function catalogHasRootString(
  voicing: VoicingType,
  rootString: number,
  tuning: Tuning,
): boolean {
  return catalogRootStrings(voicing, tuning).includes(rootString);
}

/**
 * カタログのエントリを、指定したルート位置に合わせて移調したシェイプにする。
 * 移調できない（開放弦を含む・フレットからはみ出す）場合は null。
 */
function toChordShape(
  entry: CatalogShape,
  tuning: Tuning,
  quality: ChordQuality,
  root: Position,
): ChordShape | null {
  if (!isShapeValidIn(entry, tuning)) return null;

  const analysis = analyzeCatalogShape(entry);
  if (analysis.rootString !== root.string) return null;

  const basePositions = tabToPositions(entry.tab);
  const baseRoot = basePositions.find((p) => p.string === root.string);
  if (!baseRoot) return null;

  const delta = root.fret - baseRoot.fret;
  let positions = basePositions;
  if (delta !== 0) {
    // 開放弦を含むフォームは移調できない。移調後は 1〜24フレットに収まる必要がある
    if (!analysis.movable) return null;
    if (basePositions.some((p) => p.fret + delta < 1 || p.fret + delta > MAX_FRET)) return null;
    positions = tabToPositions(transposeTab(entry.tab, delta));
  }

  const rootMidi = midiAt(tuning, root);
  const rootIndex = positions.findIndex((p) => p.string === root.string && p.fret === root.fret);
  if (rootIndex < 0) return null;

  return {
    quality,
    voicing: catalogVoicing(entry),
    root,
    rootPitchClass: pitchClassAt(tuning, root),
    positions,
    intervals: positions.map((p) => midiAt(tuning, p) - rootMidi),
    rootIndex,
    fingers: fingerCount(positions),
    catalogId: entry.id,
    catalogName: entry.name,
  };
}

/**
 * 指定したルート位置で成立する、カタログ由来の正解シェイプをすべて返す。
 * 代表的なものが先頭に来るよう、ルートが最低音のもの・定番の系統から順に並べる。
 */
export function catalogChordShapes(
  tuning: Tuning,
  voicing: VoicingType,
  quality: ChordQuality,
  root: Position,
): ChordShape[] {
  const shapes: { shape: ChordShape; entry: CatalogShape }[] = [];

  for (const entry of CHORD_CATALOG) {
    if (entry.qualityId !== quality.id) continue;
    if (catalogVoicing(entry) !== voicing) continue;
    const shape = toChordShape(entry, tuning, quality, root);
    if (shape) shapes.push({ shape, entry });
  }

  const spread = (s: ChordShape): number =>
    s.positions[0].string - s.positions[s.positions.length - 1].string;

  shapes.sort(
    (a, b) =>
      a.shape.rootIndex - b.shape.rootIndex ||
      FAMILY_PRIORITY[a.entry.family] - FAMILY_PRIORITY[b.entry.family] ||
      b.shape.positions.length - a.shape.positions.length ||
      spread(a.shape) - spread(b.shape),
  );

  // 同じ押さえ方が複数のファミリーに登場することがあるので、優先度の高いものだけ残す
  const seen = new Set<string>();
  return shapes
    .filter(({ shape }) => {
      const key = shape.positions.map((p) => `${p.string}-${p.fret}`).join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((s) => s.shape);
}

/** そのルート音・ルート弦でシェイプが作れる最も低いフレットのルート位置 */
export function findCatalogRoot(
  tuning: Tuning,
  voicing: VoicingType,
  quality: ChordQuality,
  rootPitchClass: PitchClass,
  rootString: number,
  maxFret: number,
): { root: Position; shapes: ChordShape[] } | null {
  for (let fret = 0; fret <= maxFret; fret++) {
    const root: Position = { string: rootString, fret };
    if (pitchClassAt(tuning, root) !== rootPitchClass) continue;
    const shapes = catalogChordShapes(tuning, voicing, quality, root);
    if (shapes.length > 0) return { root, shapes };
  }
  return null;
}
