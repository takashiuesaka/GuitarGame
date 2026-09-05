import { getChordQuality, type ChordQuality } from "./chords";
import { midiAt, pitchClassAt, STRING_COUNT, type Position } from "./fretboard";
import type { PitchClass } from "./notes";
import { getTuning, type Tuning } from "./tuning";

/**
 * 実際にギタリストが使う「定番の押さえ方」のカタログ。
 *
 * タブ譜は **スタンダードチューニング（EADGBE）を前提とした記譜** である。
 * 構成音・ルート弦・転回形はタブ譜そのものの性質なので、
 * 常にスタンダードチューニングで解析する。
 * 別のチューニングでそのフォームが成立するかは `catalogShapes.ts` で判定する。
 *
 * 理屈の上で成立するシェイプは chords.ts が生成するが、こちらは
 * 教則本・レッスンサイトで実際に教えられている形だけを集めたもの。
 *
 * データとして持つのは **タブ譜の文字列だけ** にしてある。
 * ルート弦・転回形・度数といった情報は転記ミスの原因になるので持たせず、
 * すべて導出関数（{@link analyzeCatalogShape}）で計算する。
 */

/** 押さえ方の系統 */
export type ShapeFamily =
  /** 開放弦を含むローポジションの定番形 */
  | "open"
  /** CAGED システムの移動可能フォーム（バレーを含む） */
  | "caged"
  /** ジャズのドロップ2ボイシング（隣り合う4弦） */
  | "drop2"
  /** ジャズのドロップ3ボイシング（1本飛ばした4弦） */
  | "drop3"
  /** 5度を省いたシェル／ガイドトーン */
  | "shell"
  /** 3声のトライアドボイシング */
  | "triad";

export const SHAPE_FAMILY_LABELS: Record<ShapeFamily, string> = {
  open: "オープンコード",
  caged: "CAGED／バレーフォーム",
  drop2: "ドロップ2",
  drop3: "ドロップ3",
  shell: "シェル（ガイドトーン）",
  triad: "トライアド3声",
};

/** 出典 */
export interface CatalogSource {
  id: string;
  label: string;
  url: string;
}

export const CATALOG_SOURCES: CatalogSource[] = [
  {
    id: "chords-db",
    label: "tombatossals/chords-db（多数のギターアプリが採用する公開コードDB）",
    url: "https://github.com/tombatossals/chords-db",
  },
  {
    id: "jazzguitar-drop2",
    label: "Jazz Guitar Online「Drop 2 Chords」",
    url: "https://www.jazzguitar.be/blog/drop-2-chords/",
  },
  {
    id: "jazzguitar-drop3",
    label: "Jazz Guitar Online「Drop 3 Chords and Inversions」",
    url: "https://www.jazzguitar.be/blog/drop-3-chords-and-inversions/",
  },
  {
    id: "fretjam-triads",
    label: "fretjam「Economical Guitar Triads」",
    url: "https://www.fretjam.com/guitar-triads.html",
  },
  {
    id: "wikipedia-guitar-chord",
    label: "Wikipedia「Guitar chord」",
    url: "https://en.wikipedia.org/wiki/Guitar_chord",
  },
];

/** カタログの1エントリ */
export interface CatalogShape {
  id: string;
  /** CHORD_QUALITIES の id */
  qualityId: string;
  /** このタブ譜が表すコードのルート音（ピッチクラス） */
  root: PitchClass;
  /** 押さえ方の通称 */
  name: string;
  family: ShapeFamily;
  /**
   * 6弦→1弦の順に並べたフレット番号。`x` はミュート（弾かない弦）。
   * 例: `x-3-2-0-1-0` = Cメジャーのオープンコード
   */
  tab: string;
  /** CATALOG_SOURCES の id */
  sourceId: string;
  /**
   * 意図的に省略している構成音（ルートからの半音距離）。
   * シェルボイシングやオープンC7のように、5度を省くのが定番の形で使う。
   */
  omits?: number[];
  /** 補足（別形との違い、注意点など） */
  note?: string;
}

const C = 0 as PitchClass;
const D = 2 as PitchClass;
const E = 4 as PitchClass;
const F = 5 as PitchClass;
const G = 7 as PitchClass;
const A = 9 as PitchClass;
const B = 11 as PitchClass;

const DB = "chords-db";
const D2 = "jazzguitar-drop2";
const D3 = "jazzguitar-drop3";
const TR = "fretjam-triads";

/* ------------------------------------------------------------------ *
 * 1. オープンコード
 * ------------------------------------------------------------------ */

const OPEN_SHAPES: CatalogShape[] = [
  { id: "open-C", qualityId: "major", root: C, name: "C（オープン）", family: "open", tab: "x-3-2-0-1-0", sourceId: DB },
  { id: "open-A", qualityId: "major", root: A, name: "A（オープン）", family: "open", tab: "x-0-2-2-2-0", sourceId: DB },
  { id: "open-G", qualityId: "major", root: G, name: "G（オープン）", family: "open", tab: "3-2-0-0-0-3", sourceId: DB },
  { id: "open-G-alt", qualityId: "major", root: G, name: "G（オープン・2弦3f）", family: "open", tab: "3-2-0-0-3-3", sourceId: DB, note: "2弦も3フレットを押さえる、ロック系で多い形" },
  { id: "open-E", qualityId: "major", root: E, name: "E（オープン）", family: "open", tab: "0-2-2-1-0-0", sourceId: DB },
  { id: "open-D", qualityId: "major", root: D, name: "D（オープン）", family: "open", tab: "x-x-0-2-3-2", sourceId: DB },

  { id: "open-Am", qualityId: "minor", root: A, name: "Am（オープン）", family: "open", tab: "x-0-2-2-1-0", sourceId: DB },
  { id: "open-Em", qualityId: "minor", root: E, name: "Em（オープン）", family: "open", tab: "0-2-2-0-0-0", sourceId: DB },
  { id: "open-Dm", qualityId: "minor", root: D, name: "Dm（オープン）", family: "open", tab: "x-x-0-2-3-1", sourceId: DB },

  { id: "open-C7", qualityId: "dom7", root: C, name: "C7（オープン）", family: "open", tab: "x-3-2-3-1-0", sourceId: DB, omits: [7] },
  { id: "open-A7", qualityId: "dom7", root: A, name: "A7（オープン）", family: "open", tab: "x-0-2-0-2-0", sourceId: DB },
  { id: "open-A7-alt", qualityId: "dom7", root: A, name: "A7（オープン・1弦3f）", family: "open", tab: "x-0-2-2-2-3", sourceId: DB },
  { id: "open-G7", qualityId: "dom7", root: G, name: "G7（オープン）", family: "open", tab: "3-2-0-0-0-1", sourceId: DB },
  { id: "open-E7", qualityId: "dom7", root: E, name: "E7（オープン）", family: "open", tab: "0-2-0-1-0-0", sourceId: DB },
  { id: "open-E7-alt", qualityId: "dom7", root: E, name: "E7（オープン・4声）", family: "open", tab: "0-2-2-1-3-0", sourceId: DB },
  { id: "open-D7", qualityId: "dom7", root: D, name: "D7（オープン）", family: "open", tab: "x-x-0-2-1-2", sourceId: DB },
  { id: "open-B7", qualityId: "dom7", root: B, name: "B7（オープン）", family: "open", tab: "x-2-1-2-0-2", sourceId: DB },

  { id: "open-Am7", qualityId: "min7", root: A, name: "Am7（オープン）", family: "open", tab: "x-0-2-0-1-0", sourceId: DB },
  { id: "open-Am7-alt", qualityId: "min7", root: A, name: "Am7（オープン・1弦3f）", family: "open", tab: "x-0-2-2-1-3", sourceId: DB },
  { id: "open-Em7", qualityId: "min7", root: E, name: "Em7（オープン）", family: "open", tab: "0-2-2-0-3-0", sourceId: DB, note: "教則本の定番形" },
  { id: "open-Em7-alt", qualityId: "min7", root: E, name: "Em7（オープン・簡易）", family: "open", tab: "0-2-0-0-0-0", sourceId: DB },
  { id: "open-Dm7", qualityId: "min7", root: D, name: "Dm7（オープン）", family: "open", tab: "x-x-0-2-1-1", sourceId: DB },

  { id: "open-Cmaj7", qualityId: "maj7", root: C, name: "Cmaj7（オープン）", family: "open", tab: "x-3-2-0-0-0", sourceId: DB, note: "教則本の定番形（6弦はミュート）" },
  { id: "open-Cmaj7-bass5", qualityId: "maj7", root: C, name: "Cmaj7（オープン・6弦G）", family: "open", tab: "3-3-2-0-0-0", sourceId: DB, note: "最低音が5度になる形" },
  { id: "open-Amaj7", qualityId: "maj7", root: A, name: "Amaj7（オープン）", family: "open", tab: "x-0-2-1-2-0", sourceId: DB },
  { id: "open-Amaj7-alt", qualityId: "maj7", root: A, name: "Amaj7（オープン・1弦4f）", family: "open", tab: "x-0-2-2-2-4", sourceId: DB },
  { id: "open-Gmaj7", qualityId: "maj7", root: G, name: "Gmaj7（オープン）", family: "open", tab: "3-2-0-0-0-2", sourceId: DB },
  { id: "open-Fmaj7", qualityId: "maj7", root: F, name: "Fmaj7（オープン・4弦ルート）", family: "open", tab: "x-x-3-2-1-0", sourceId: DB },
  { id: "open-Dmaj7", qualityId: "maj7", root: D, name: "Dmaj7（オープン）", family: "open", tab: "x-x-0-2-2-2", sourceId: DB },

  { id: "open-Asus4", qualityId: "sus4", root: A, name: "Asus4（オープン）", family: "open", tab: "x-0-2-2-3-0", sourceId: DB },
  { id: "open-Dsus4", qualityId: "sus4", root: D, name: "Dsus4（オープン）", family: "open", tab: "x-x-0-2-3-3", sourceId: DB },
  { id: "open-Esus4", qualityId: "sus4", root: E, name: "Esus4（オープン）", family: "open", tab: "0-2-2-2-0-0", sourceId: DB },
  { id: "open-Csus4", qualityId: "sus4", root: C, name: "Csus4（オープン）", family: "open", tab: "x-3-3-0-1-1", sourceId: DB },
  { id: "open-Gsus4", qualityId: "sus4", root: G, name: "Gsus4（オープン）", family: "open", tab: "3-x-0-0-1-3", sourceId: DB },

  { id: "open-Eaug", qualityId: "aug", root: E, name: "Eaug（オープン）", family: "open", tab: "0-3-2-1-1-0", sourceId: DB },
  { id: "open-Aaug", qualityId: "aug", root: A, name: "Aaug（オープン）", family: "open", tab: "x-0-3-2-2-1", sourceId: DB },
  { id: "open-Edim", qualityId: "dim", root: E, name: "Edim（4弦ルート）", family: "open", tab: "x-x-2-3-x-3", sourceId: DB },

  { id: "open-Bm7b5", qualityId: "m7b5", root: B, name: "Bm7♭5（オープンポジション）", family: "open", tab: "x-2-3-2-3-x", sourceId: DB },
  { id: "open-Cdim7", qualityId: "dim7", root: C, name: "Cdim7（ローポジション）", family: "open", tab: "x-x-1-2-1-2", sourceId: DB },
  { id: "open-AmMaj7", qualityId: "mMaj7", root: A, name: "AmMaj7（オープン）", family: "open", tab: "x-0-2-1-1-0", sourceId: DB },
];

/* ------------------------------------------------------------------ *
 * 2. CAGED / バレーフォーム（移動可能）
 * ------------------------------------------------------------------ */

const CAGED_SHAPES: CatalogShape[] = [
  // メジャー
  { id: "caged-major-E", qualityId: "major", root: F, name: "Eフォーム（6弦ルート・バレー）", family: "caged", tab: "1-3-3-2-1-1", sourceId: DB, note: "オープンEを1フレット上へ移動した形＝F" },
  { id: "caged-major-A", qualityId: "major", root: C, name: "Aフォーム（5弦ルート・バレー）", family: "caged", tab: "x-3-5-5-5-3", sourceId: DB },
  { id: "caged-major-D", qualityId: "major", root: F, name: "Dフォーム（4弦ルート）", family: "caged", tab: "x-x-3-5-6-5", sourceId: DB },
  { id: "caged-major-C", qualityId: "major", root: D, name: "Cフォーム（5弦ルート）", family: "caged", tab: "x-5-4-2-3-2", sourceId: DB },
  { id: "caged-major-G", qualityId: "major", root: C, name: "Gフォーム（6弦ルート）", family: "caged", tab: "8-7-5-5-5-8", sourceId: DB },
  { id: "caged-major-A-small", qualityId: "major", root: F, name: "小さいFフォーム（4弦ルート・3声＋R）", family: "caged", tab: "x-x-3-2-1-1", sourceId: DB },

  // マイナー
  { id: "caged-minor-E", qualityId: "minor", root: F, name: "Emフォーム（6弦ルート・バレー）", family: "caged", tab: "1-3-3-1-1-1", sourceId: DB },
  { id: "caged-minor-A", qualityId: "minor", root: C, name: "Amフォーム（5弦ルート・バレー）", family: "caged", tab: "x-3-5-5-4-3", sourceId: DB },
  { id: "caged-minor-D", qualityId: "minor", root: F, name: "Dmフォーム（4弦ルート）", family: "caged", tab: "x-x-3-5-6-4", sourceId: DB },

  // sus4
  { id: "caged-sus4-E", qualityId: "sus4", root: C, name: "Esus4フォーム（6弦ルート・バレー）", family: "caged", tab: "8-10-10-10-8-8", sourceId: DB },
  { id: "caged-sus4-A", qualityId: "sus4", root: C, name: "Asus4フォーム（5弦ルート・バレー）", family: "caged", tab: "x-3-5-5-6-3", sourceId: DB },
  { id: "caged-sus4-D", qualityId: "sus4", root: F, name: "Dsus4フォーム（4弦ルート）", family: "caged", tab: "x-x-3-5-6-6", sourceId: DB },

  // セブンス系バレー
  { id: "caged-dom7-E", qualityId: "dom7", root: C, name: "E7フォーム（6弦ルート・バレー）", family: "caged", tab: "8-10-8-9-8-8", sourceId: DB },
  { id: "caged-dom7-A", qualityId: "dom7", root: C, name: "A7フォーム（5弦ルート・バレー）", family: "caged", tab: "x-3-5-3-5-3", sourceId: DB },
  { id: "caged-min7-E", qualityId: "min7", root: C, name: "Em7フォーム（6弦ルート・バレー）", family: "caged", tab: "8-10-8-8-8-8", sourceId: DB },
  { id: "caged-min7-A", qualityId: "min7", root: C, name: "Am7フォーム（5弦ルート・バレー）", family: "caged", tab: "x-3-5-3-4-3", sourceId: DB },
  { id: "caged-maj7-A", qualityId: "maj7", root: C, name: "Amaj7フォーム（5弦ルート・バレー）", family: "caged", tab: "x-3-5-4-5-3", sourceId: DB },
  { id: "caged-maj7-E", qualityId: "maj7", root: F, name: "Fmaj7フォーム（6弦ルート・バレー）", family: "caged", tab: "1-3-2-2-1-1", sourceId: DB },
  { id: "caged-mMaj7-E", qualityId: "mMaj7", root: C, name: "EmMaj7フォーム（6弦ルート・バレー）", family: "caged", tab: "8-10-9-8-8-8", sourceId: DB },
  { id: "caged-mMaj7-A", qualityId: "mMaj7", root: C, name: "AmMaj7フォーム（5弦ルート・バレー）", family: "caged", tab: "x-3-5-4-4-3", sourceId: DB },
  { id: "caged-m7b5-A", qualityId: "m7b5", root: C, name: "5弦ルートm7♭5（4弦セット）", family: "caged", tab: "x-3-4-3-4-x", sourceId: DB },
  { id: "caged-dim7-A", qualityId: "dim7", root: C, name: "5弦ルートdim7", family: "caged", tab: "x-3-4-2-4-2", sourceId: DB },
  { id: "caged-dim7-E", qualityId: "dim7", root: C, name: "6弦ルートdim7（弦飛ばし）", family: "caged", tab: "8-x-7-8-7-x", sourceId: DB },

  // aug / dim トライアド
  { id: "caged-aug-E", qualityId: "aug", root: C, name: "6弦ルートaug", family: "caged", tab: "8-7-6-5-5-x", sourceId: DB },
  { id: "caged-aug-A", qualityId: "aug", root: C, name: "5弦ルートaug", family: "caged", tab: "x-3-2-1-1-x", sourceId: DB },
  { id: "caged-aug-D", qualityId: "aug", root: C, name: "4弦ルートaug", family: "caged", tab: "x-x-10-9-9-8", sourceId: DB },
  { id: "caged-dim-E", qualityId: "dim", root: C, name: "6弦ルートdimトライアド（弦飛ばし）", family: "caged", tab: "8-6-x-8-7-x", sourceId: DB },
  { id: "caged-dim-A", qualityId: "dim", root: C, name: "5弦ルートdimトライアド（弦飛ばし）", family: "caged", tab: "x-3-1-x-1-2", sourceId: DB },
];

/* ------------------------------------------------------------------ *
 * 3. ドロップ2ボイシング（すべて C ルート）
 *
 * 弦セット 6-5-4-3 / 5-4-3-2 / 4-3-2-1 の各4転回。
 * ------------------------------------------------------------------ */

/** [弦セット名, 型1, 型2, 型3, 型4]（転回形は analyzeCatalogShape で導出する） */
type DropRow = [string, string, string, string, string];

const DROP2_SETS: Record<string, DropRow[]> = {
  maj7: [
    ["6-5-4-3", "3-3-2-4-x-x", "7-7-5-5-x-x", "8-10-9-9-x-x", "12-14-10-12-x-x"],
    ["5-4-3-2", "x-10-10-9-12-x", "x-14-14-12-13-x", "x-3-5-4-5-x", "x-7-9-5-8-x"],
    ["4-3-2-1", "x-x-5-5-5-7", "x-x-9-9-8-8", "x-x-10-12-12-12", "x-x-2-4-1-3"],
  ],
  dom7: [
    ["6-5-4-3", "3-3-2-3-x-x", "6-7-5-5-x-x", "8-10-8-9-x-x", "12-13-10-12-x-x"],
    ["5-4-3-2", "x-10-10-9-11-x", "x-13-14-12-13-x", "x-3-5-3-5-x", "x-7-8-5-8-x"],
    ["4-3-2-1", "x-x-5-5-5-6", "x-x-8-9-8-8", "x-x-10-12-11-12", "x-x-2-3-1-3"],
  ],
  min7: [
    ["6-5-4-3", "3-3-1-3-x-x", "6-6-5-5-x-x", "8-10-8-8-x-x", "11-13-10-12-x-x"],
    ["5-4-3-2", "x-10-10-8-11-x", "x-13-13-12-13-x", "x-3-5-3-4-x", "x-6-8-5-8-x"],
    ["4-3-2-1", "x-x-5-5-4-6", "x-x-8-8-8-8", "x-x-10-12-11-11", "x-x-1-3-1-3"],
  ],
  m7b5: [
    ["6-5-4-3", "2-3-1-3-x-x", "6-6-4-5-x-x", "8-9-8-8-x-x", "11-13-10-11-x-x"],
    ["5-4-3-2", "x-9-10-8-11-x", "x-13-13-11-13-x", "x-3-4-3-4-x", "x-6-8-5-7-x"],
    ["4-3-2-1", "x-x-4-5-4-6", "x-x-8-8-7-8", "x-x-10-11-11-11", "x-x-1-3-1-2"],
  ],
  dim7: [
    ["6-5-4-3", "2-3-1-2-x-x", "5-6-4-5-x-x", "8-9-7-8-x-x", "11-12-10-11-x-x"],
    ["5-4-3-2", "x-9-10-8-10-x", "x-12-13-11-13-x", "x-3-4-2-4-x", "x-6-7-5-7-x"],
    ["4-3-2-1", "x-x-4-5-4-5", "x-x-7-8-7-8", "x-x-10-11-10-11", "x-x-1-2-1-2"],
  ],
  mMaj7: [
    ["6-5-4-3", "3-3-1-4-x-x", "7-6-5-5-x-x", "8-10-9-8-x-x", "11-14-10-12-x-x"],
    ["5-4-3-2", "x-10-10-8-12-x", "x-14-13-12-13-x", "x-3-5-4-4-x", "x-6-9-5-8-x"],
    ["4-3-2-1", "x-x-5-5-4-7", "x-x-9-8-8-8", "x-x-10-12-12-11", "x-x-1-4-1-3"],
  ],
};

const DROP3_SETS: Record<string, DropRow[]> = {
  maj7: [
    ["6-4-3-2", "8-x-9-9-8-x", "12-x-10-12-12-x", "3-x-2-4-1-x", "7-x-5-5-5-x"],
    ["5-3-2-1", "x-3-x-4-5-3", "x-7-x-5-8-7", "x-10-x-9-12-8", "x-14-x-12-13-12"],
  ],
  dom7: [
    ["6-4-3-2", "8-x-8-9-8-x", "12-x-10-12-11-x", "3-x-2-3-1-x", "6-x-5-5-5-x"],
    ["5-3-2-1", "x-3-x-3-5-3", "x-7-x-5-8-6", "x-10-x-9-11-8", "x-13-x-12-13-12"],
  ],
  min7: [
    ["6-4-3-2", "8-x-8-8-8-x", "11-x-10-12-11-x", "3-x-1-3-1-x", "6-x-5-5-4-x"],
    ["5-3-2-1", "x-3-x-3-4-3", "x-6-x-5-8-6", "x-10-x-8-11-8", "x-13-x-12-13-11"],
  ],
  m7b5: [
    ["6-4-3-2", "8-x-8-8-7-x", "11-x-10-11-11-x", "2-x-1-3-1-x", "6-x-4-5-4-x"],
    ["5-3-2-1", "x-3-x-3-4-2", "x-6-x-5-7-6", "x-9-x-8-11-8", "x-13-x-11-13-11"],
  ],
  dim7: [
    ["6-4-3-2", "8-x-7-8-7-x", "11-x-10-11-10-x", "2-x-1-2-1-x", "5-x-4-5-4-x"],
    ["5-3-2-1", "x-3-x-2-4-2", "x-6-x-5-7-5", "x-9-x-8-10-8", "x-12-x-11-13-11"],
  ],
  mMaj7: [
    ["6-4-3-2", "8-x-9-8-8-x", "11-x-10-12-12-x", "3-x-1-4-1-x", "7-x-5-5-4-x"],
    ["5-3-2-1", "x-3-x-4-4-3", "x-6-x-5-8-7", "x-10-x-8-12-8", "x-14-x-12-13-11"],
  ],
};

function expandDropShapes(
  table: Record<string, DropRow[]>,
  family: "drop2" | "drop3",
  sourceId: string,
): CatalogShape[] {
  const result: CatalogShape[] = [];
  for (const [qualityId, rows] of Object.entries(table)) {
    for (const [set, ...tabs] of rows) {
      tabs.forEach((tab, i) => {
        result.push({
          id: `${family}-${qualityId}-${set}-${i}`,
          qualityId,
          root: C,
          name: `${SHAPE_FAMILY_LABELS[family]} ${set}弦セット（型${i + 1}）`,
          family,
          tab,
          sourceId,
        });
      });
    }
  }
  return result;
}

/* ------------------------------------------------------------------ *
 * 4. シェル／ガイドトーン（5度を省いた3音）
 * ------------------------------------------------------------------ */

const SHELL_SHAPES: CatalogShape[] = [
  { id: "shell-maj7-6-R73", qualityId: "maj7", root: C, name: "シェル 6弦ルート R-7-3（弦6-4-3）", family: "shell", tab: "8-x-9-9-x-x", sourceId: D2, omits: [7] },
  { id: "shell-dom7-6-R73", qualityId: "dom7", root: C, name: "シェル 6弦ルート R-♭7-3（弦6-4-3）", family: "shell", tab: "8-x-8-9-x-x", sourceId: D2, omits: [7] },
  { id: "shell-min7-6-R73", qualityId: "min7", root: C, name: "シェル 6弦ルート R-♭7-♭3（弦6-4-3）", family: "shell", tab: "8-x-8-8-x-x", sourceId: D2, omits: [7] },
  { id: "shell-mMaj7-6-R73", qualityId: "mMaj7", root: C, name: "シェル 6弦ルート R-7-♭3（弦6-4-3）", family: "shell", tab: "8-x-9-8-x-x", sourceId: D2, omits: [7] },

  { id: "shell-maj7-5-R73", qualityId: "maj7", root: C, name: "シェル 5弦ルート R-7-3（弦5-3-2）", family: "shell", tab: "x-3-x-4-5-x", sourceId: D2, omits: [7] },
  { id: "shell-dom7-5-R73", qualityId: "dom7", root: C, name: "シェル 5弦ルート R-♭7-3（弦5-3-2）", family: "shell", tab: "x-3-x-3-5-x", sourceId: D2, omits: [7] },
  { id: "shell-min7-5-R73", qualityId: "min7", root: C, name: "シェル 5弦ルート R-♭7-♭3（弦5-3-2）", family: "shell", tab: "x-3-x-3-4-x", sourceId: D2, omits: [7] },
  { id: "shell-mMaj7-5-R73", qualityId: "mMaj7", root: C, name: "シェル 5弦ルート R-7-♭3（弦5-3-2）", family: "shell", tab: "x-3-x-4-4-x", sourceId: D2, omits: [7] },

  { id: "shell-maj7-6-R37", qualityId: "maj7", root: C, name: "シェル 6弦ルート R-3-7（弦6-5-4）", family: "shell", tab: "8-7-9-x-x-x", sourceId: D2, omits: [7] },
  { id: "shell-dom7-6-R37", qualityId: "dom7", root: C, name: "シェル 6弦ルート R-3-♭7（弦6-5-4）", family: "shell", tab: "8-7-8-x-x-x", sourceId: D2, omits: [7] },
  { id: "shell-min7-6-R37", qualityId: "min7", root: C, name: "シェル 6弦ルート R-♭3-♭7（弦6-5-4）", family: "shell", tab: "8-6-8-x-x-x", sourceId: D2, omits: [7] },
  { id: "shell-mMaj7-6-R37", qualityId: "mMaj7", root: C, name: "シェル 6弦ルート R-♭3-7（弦6-5-4）", family: "shell", tab: "8-6-9-x-x-x", sourceId: D2, omits: [7] },

  { id: "shell-maj7-5-R37", qualityId: "maj7", root: C, name: "シェル 5弦ルート R-3-7（弦5-4-3）", family: "shell", tab: "x-3-2-4-x-x", sourceId: D2, omits: [7] },
  { id: "shell-dom7-5-R37", qualityId: "dom7", root: C, name: "シェル 5弦ルート R-3-♭7（弦5-4-3）", family: "shell", tab: "x-3-2-3-x-x", sourceId: D2, omits: [7] },
  { id: "shell-min7-5-R37", qualityId: "min7", root: C, name: "シェル 5弦ルート R-♭3-♭7（弦5-4-3）", family: "shell", tab: "x-3-1-3-x-x", sourceId: D2, omits: [7] },
  { id: "shell-mMaj7-5-R37", qualityId: "mMaj7", root: C, name: "シェル 5弦ルート R-♭3-7（弦5-4-3）", family: "shell", tab: "x-3-1-4-x-x", sourceId: D2, omits: [7] },
];

/* ------------------------------------------------------------------ *
 * 5. トライアド3声ボイシング（すべて C ルート）
 * ------------------------------------------------------------------ */

/** [弦セット名, 型1, 型2, 型3]（転回形は analyzeCatalogShape で導出する） */
type TriadRow = [string, string, string, string];

const TRIAD_SETS: Record<string, TriadRow[]> = {
  major: [
    ["6-5-4", "8-7-5-x-x-x", "12-10-10-x-x-x", "3-3-2-x-x-x"],
    ["5-4-3", "x-15-14-12-x-x", "x-7-5-5-x-x", "x-10-10-9-x-x"],
    ["4-3-2", "x-x-10-9-8-x", "x-x-14-12-13-x", "x-x-5-5-5-x"],
    ["3-2-1", "x-x-x-5-5-3", "x-x-x-9-8-8", "x-x-x-12-13-12"],
  ],
  minor: [
    ["6-5-4", "8-6-5-x-x-x", "11-10-10-x-x-x", "3-3-1-x-x-x"],
    ["5-4-3", "x-15-13-12-x-x", "x-6-5-5-x-x", "x-10-10-8-x-x"],
    ["4-3-2", "x-x-10-8-8-x", "x-x-13-12-13-x", "x-x-5-5-4-x"],
    ["3-2-1", "x-x-x-5-4-3", "x-x-x-8-8-8", "x-x-x-12-13-11"],
  ],
  dim: [
    ["6-5-4", "8-6-4-x-x-x", "11-9-10-x-x-x", "2-3-1-x-x-x"],
    ["5-4-3", "x-15-13-11-x-x", "x-6-4-5-x-x", "x-9-10-8-x-x"],
    ["4-3-2", "x-x-10-8-7-x", "x-x-13-11-13-x", "x-x-4-5-4-x"],
    ["3-2-1", "x-x-x-5-4-2", "x-x-x-8-7-8", "x-x-x-11-13-11"],
  ],
  aug: [
    ["6-5-4", "8-7-6-x-x-x", "12-11-10-x-x-x", "4-3-2-x-x-x"],
    ["5-4-3", "x-3-2-1-x-x", "x-7-6-5-x-x", "x-11-10-9-x-x"],
    ["4-3-2", "x-x-10-9-9-x", "x-x-2-1-1-x", "x-x-6-5-5-x"],
    ["3-2-1", "x-x-x-5-5-4", "x-x-x-9-9-8", "x-x-x-13-13-12"],
  ],
  sus4: [
    ["6-5-4", "8-8-5-x-x-x", "13-10-10-x-x-x", "3-3-3-x-x-x"],
    ["5-4-3", "x-15-15-12-x-x", "x-8-5-5-x-x", "x-10-10-10-x-x"],
    ["4-3-2", "x-x-10-10-8-x", "x-x-15-12-13-x", "x-x-5-5-6-x"],
    ["3-2-1", "x-x-x-5-6-3", "x-x-x-10-8-8", "x-x-x-12-13-13"],
  ],
};

function expandTriadShapes(): CatalogShape[] {
  const result: CatalogShape[] = [];
  for (const [qualityId, rows] of Object.entries(TRIAD_SETS)) {
    for (const [set, ...tabs] of rows) {
      tabs.forEach((tab, i) => {
        result.push({
          id: `triad-${qualityId}-${set}-${i}`,
          qualityId,
          root: C,
          name: `トライアド ${set}弦セット（型${i + 1}）`,
          family: "triad",
          tab,
          sourceId: TR,
        });
      });
    }
  }
  return result;
}

/** 定番の押さえ方カタログ（全エントリ） */
export const CHORD_CATALOG: CatalogShape[] = [
  ...OPEN_SHAPES,
  ...CAGED_SHAPES,
  ...expandDropShapes(DROP2_SETS, "drop2", D2),
  ...expandDropShapes(DROP3_SETS, "drop3", D3),
  ...SHELL_SHAPES,
  ...expandTriadShapes(),
];

/* ------------------------------------------------------------------ *
 * 導出関数
 * ------------------------------------------------------------------ */

/** タブ譜文字列を 6弦→1弦 のフレット配列に変換する。ミュートは null */
export function parseTab(tab: string): (number | null)[] {
  const parts = tab.split("-");
  if (parts.length !== STRING_COUNT) {
    throw new Error(`タブ譜は6弦ぶん必要です: "${tab}"`);
  }
  return parts.map((p) => {
    if (p === "x" || p === "X") return null;
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0) throw new Error(`不正なフレット: "${p}" (${tab})`);
    return n;
  });
}

/** タブ譜を低音弦から高音弦の順の Position[] に変換する */
export function tabToPositions(tab: string): Position[] {
  const frets = parseTab(tab);
  const result: Position[] = [];
  frets.forEach((fret, i) => {
    if (fret === null) return;
    result.push({ string: STRING_COUNT - i, fret });
  });
  return result;
}

/** シェイプを半音単位で移動したタブ譜を返す。開放弦を含む形は移動できない */
export function transposeTab(tab: string, semitones: number): string {
  const frets = parseTab(tab);
  if (semitones !== 0 && frets.some((f) => f === 0)) {
    throw new Error(`開放弦を含むシェイプは移動できません: "${tab}"`);
  }
  return frets
    .map((f) => {
      if (f === null) return "x";
      const next = f + semitones;
      if (next < 0) throw new Error(`移動先が負のフレットになります: "${tab}" ${semitones}`);
      return String(next);
    })
    .join("-");
}

/** シェイプの分析結果 */
export interface CatalogAnalysis {
  quality: ChordQuality;
  /** 低音弦から高音弦の順 */
  positions: Position[];
  /** positions と同じ並びの、ルートからの度数（0〜11） */
  intervals: number[];
  /** ルート音が鳴っている弦のうち、最も低音側のもの。無ければ null */
  rootString: number | null;
  /** 最低音の度数を基準にした転回番号。0=基本形 */
  inversion: number;
  /** 開放弦を含まず、任意のフレットへ移動できるか */
  movable: boolean;
  /** 実際に鳴っている弦の本数 */
  noteCount: number;
  /** 押さえるフレットの最小値（開放弦のみなら null） */
  minFret: number | null;
  /** 押さえるフレットの最大値（開放弦のみなら null） */
  maxFret: number | null;
}

/** 転回形の表示名（0=基本形） */
export const INVERSION_LABELS = ["基本形", "第1転回", "第2転回", "第3転回"];

/** タブ譜の記譜が前提とするチューニング */
export const CATALOG_TUNING: Tuning = getTuning("standard");

/** カタログのシェイプを分析する（ルート弦・転回形・度数などを導出） */
export function analyzeCatalogShape(shape: CatalogShape): CatalogAnalysis {
  const tuning = CATALOG_TUNING;
  const quality = getChordQuality(shape.qualityId);
  const positions = tabToPositions(shape.tab);
  const intervals = positions.map((p) => (pitchClassAt(tuning, p) - shape.root + 12) % 12);

  const rootPositions = positions.filter((_, i) => intervals[i] === 0);
  const rootString = rootPositions.length > 0 ? Math.max(...rootPositions.map((p) => p.string)) : null;

  const midis = positions.map((p) => midiAt(tuning, p));
  const lowestInterval = intervals[midis.indexOf(Math.min(...midis))];
  const sorted = [...quality.intervals].sort((a, b) => a - b);
  const inversion = Math.max(0, sorted.indexOf(lowestInterval));

  const fretted = positions.map((p) => p.fret).filter((f) => f > 0);

  return {
    quality,
    positions,
    intervals,
    rootString,
    inversion,
    movable: positions.every((p) => p.fret > 0),
    noteCount: positions.length,
    minFret: fretted.length > 0 ? Math.min(...fretted) : null,
    maxFret: fretted.length > 0 ? Math.max(...fretted) : null,
  };
}

/**
 * カタログのシェイプが、そのコードの構成音を過不足なく含んでいるか。
 * `omits` に宣言された音は欠けていてもよいが、それ以外の欠落・余分な音は不一致とみなす。
 */
export function catalogShapeMatchesQuality(shape: CatalogShape): boolean {
  const { quality, intervals } = analyzeCatalogShape(shape);
  const actual = new Set(intervals);
  const omits = new Set((shape.omits ?? []).map((i) => ((i % 12) + 12) % 12));
  const expected = quality.intervals.map((i) => ((i % 12) + 12) % 12);

  for (const i of actual) {
    if (!expected.includes(i)) return false;
  }
  for (const i of expected) {
    if (!actual.has(i) && !omits.has(i)) return false;
  }
  for (const i of omits) {
    if (actual.has(i)) return false;
  }
  return true;
}

/** 条件でカタログを絞り込む */
export function findCatalogShapes(filter: {
  qualityId?: string;
  family?: ShapeFamily;
  movable?: boolean;
}): CatalogShape[] {
  return CHORD_CATALOG.filter((s) => {
    if (filter.qualityId && s.qualityId !== filter.qualityId) return false;
    if (filter.family && s.family !== filter.family) return false;
    if (filter.movable !== undefined) {
      const movable = parseTab(s.tab).every((f) => f === null || f > 0);
      if (movable !== filter.movable) return false;
    }
    return true;
  });
}
