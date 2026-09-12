import { describe, expect, it } from "vitest";
import { getDegreeGroup } from "../src/core/degrees";
import { midiAt, pitchClassAt } from "../src/core/fretboard";
import { noteRegionError } from "../src/core/noteBlock";
import { SCALE_CATALOG_SOURCES, SCALE_PATTERNS, catalogScaleBlocks, chooseScaleBlock, isScaleSelection, matchesScaleSelection, scalePatternPositions, type CatalogScalePattern } from "../src/core/scaleCatalog";
import { buildScaleCatalogMarkdown } from "../src/core/scaleCatalogDoc";
import { getTuning, TUNINGS } from "../src/core/tuning";
import savedScaleCatalog from "../docs/SCALE_CATALOG.md?raw";

const fixture: CatalogScalePattern = {
  id: "test-major",
  name: "移調検証用",
  scaleType: "major",
  tonic: 0,
  frets: [[7, 8, 10], [7, 8, 10], [7, 9, 10], [7, 9, 10], [8, 10], [7, 8, 10]],
  sourceIds: [],
  note: "カタログ採録ではなく、展開ロジック用の固定データ。",
};

describe("[S-NOTE-08] 出典付き運指カタログ", () => {
  it("出典のある11形を収録し、ID・弦・フレット・構成音が正しい", () => {
    expect(SCALE_PATTERNS).toHaveLength(11);
    expect(new Set(SCALE_PATTERNS.map((pattern) => pattern.id)).size).toBe(SCALE_PATTERNS.length);
    const tuning = getTuning("standard");
    for (const pattern of SCALE_PATTERNS) {
      expect(pattern.frets, pattern.id).toHaveLength(6);
      expect(pattern.sourceIds.length, pattern.id).toBeGreaterThan(0);
      expect(pattern.note.length, pattern.id).toBeGreaterThan(0);
      for (const id of pattern.sourceIds) {
        const source = SCALE_CATALOG_SOURCES.find((entry) => entry.id === id);
        expect(source?.url, id).toMatch(/^https:\/\//);
        expect(source?.locator.length, id).toBeGreaterThan(0);
      }
      const positions = scalePatternPositions(pattern);
      expect(new Set(positions.map((pos) => `${pos.string}:${pos.fret}`)).size, pattern.id).toBe(positions.length);
      expect(positions.every((pos) => pos.fret >= 0 && pos.fret <= 24 && Number.isInteger(pos.fret))).toBe(true);
      expect(new Set(positions.map((pos) => (pitchClassAt(tuning, pos) - pattern.tonic + 12) % 12)), pattern.id)
        .toEqual(new Set(getDegreeGroup(pattern.scaleType)));
    }
  });

  it("原典の端点を勝手に補充・削除せず、音数の違う形を区別する", () => {
    const count = (id: string) => scalePatternPositions(SCALE_PATTERNS.find((pattern) => pattern.id === id)!).length;
    expect(count("major-basic-box")).toBe(16);
    expect(count("major-seventh-box")).toBe(17);
    expect(count("major-first-octave")).toBe(8);
    expect(count("major-3nps")).toBe(18);
    expect(count("minor-basic-box")).toBe(17);
    expect(count("minor-fifth-box")).toBe(14);
    expect(count("minor-position-three")).toBe(17);
    expect(count("minor-two-octaves")).toBe(15);
  });

  it.each(TUNINGS)("全カタログを $label・24スケールで展開し、完全な1オクターブと元の運指を保つ", (tuning) => {
    const standard = getTuning("standard");
    for (const scaleType of ["major", "natural-minor"] as const) {
      for (let tonic = 0; tonic < 12; tonic++) {
        const blocks = catalogScaleBlocks(tuning, scaleType, tonic);
        expect(blocks.length).toBeGreaterThan(0);
        const ids = blocks.map((block) => JSON.stringify(block.selection));
        expect(new Set(ids).size).toBe(ids.length);
        for (const block of blocks) {
          expect(noteRegionError(tuning, block)).toBeNull();
          const rootMidi = midiAt(tuning, block.root);
          const pitches = new Set(block.positions.map((pos) => midiAt(tuning, pos)));
          const intervals = [...getDegreeGroup(scaleType), 12];
          const octaveAbove = intervals.every((interval) => pitches.has(rootMidi + interval));
          const octaveBelow = intervals.every((interval) => pitches.has(rootMidi - 12 + interval));
          expect(octaveAbove || octaveBelow, JSON.stringify(block.selection)).toBe(true);
          if (block.selection.direction === "higher") expect(octaveAbove).toBe(true);
          if (block.selection.direction === "lower") expect(octaveBelow).toBe(true);
          const reference = scalePatternPositions(block.pattern);
          const referenceRoot = reference.find((pos) => pos.string === block.root.string
            && pitchClassAt(standard, pos) === block.pattern.tonic)!;
          const shift = block.root.fret - referenceRoot.fret;
          const expected = reference.filter((pos) => {
            const delta = midiAt(standard, pos) - midiAt(standard, referenceRoot);
            return block.selection.direction === "higher" ? delta >= 0 : block.selection.direction === "lower" ? delta <= 0 : true;
          }).map((pos) => ({ string: pos.string, fret: pos.fret + shift }));
          expect(block.positions).toEqual(expected);
        }
      }
    }
  });

  it("両スケールとも標準調弦では6本のルート弦をカバーする", () => {
    for (const scaleType of ["major", "natural-minor"] as const) {
      const roots = new Set(catalogScaleBlocks(getTuning("standard"), scaleType, 0).map((block) => block.root.string));
      expect(roots).toEqual(new Set([1, 2, 3, 4, 5, 6]));
    }
  });

  it("ドキュメントは収録データと一致する", () => {
    expect(savedScaleCatalog).toBe(buildScaleCatalogMarkdown());
  });
});

describe("[S-NOTE-08] カタログ運指の移調・音域展開", () => {
  it.each(TUNINGS)("全12キーを $label で検証し、運指・構成音・指板範囲を保つ", (tuning) => {
    for (let tonic = 0; tonic < 12; tonic++) {
      const blocks = catalogScaleBlocks(tuning, "major", tonic, [fixture]);
      expect(blocks.length).toBeGreaterThan(0);
      for (const block of blocks) {
        expect(noteRegionError(tuning, block)).toBeNull();
        expect(pitchClassAt(tuning, block.root)).toBe(tonic);
        expect(new Set(block.positions.map((pos) => (pitchClassAt(tuning, pos) - tonic + 12) % 12)))
          .toEqual(new Set(getDegreeGroup("major")));
        expect(block.positions.every((pos) => pos.fret >= 0 && pos.fret <= 24)).toBe(true);
        expect(matchesScaleSelection(block, block.selection)).toBe(true);
      }
    }
  });

  it("高音・低音はフレット番号でなくルートとの実音高で分ける", () => {
    const tuning = getTuning("standard");
    const blocks = catalogScaleBlocks(tuning, "major", 0, [fixture]);
    expect(new Set(blocks.map((block) => block.selection.direction))).toEqual(new Set(["higher", "lower", "mixed"]));
    for (const block of blocks) {
      const root = midiAt(tuning, block.root);
      const pitches = block.positions.map((pos) => midiAt(tuning, pos));
      if (block.selection.direction === "higher") {
        expect(Math.min(...pitches)).toBe(root);
        expect(pitches).toContain(root + 12);
      } else if (block.selection.direction === "lower") {
        expect(Math.max(...pitches)).toBe(root);
        expect(pitches).toContain(root - 12);
      } else {
        expect(Math.min(...pitches)).toBeLessThan(root);
        expect(Math.max(...pitches)).toBeGreaterThan(root);
      }
    }
  });

  it("Cメジャー6弦8fは高音・両側があり、低音だけの1オクターブは成立しない", () => {
    const blocks = catalogScaleBlocks(getTuning("standard"), "major", 0, [fixture])
      .filter((block) => block.root.string === 6 && block.root.fret === 8);
    expect(blocks.map((block) => block.selection.direction)).toEqual(["higher", "mixed"]);
  });

  it("ドロップDでは6弦を含む標準運指を改造せず、6弦を使わない音域だけを残す", () => {
    const blocks = catalogScaleBlocks(getTuning("drop-d"), "major", 0, [fixture]);
    expect(blocks.length).toBeGreaterThan(0);
    expect(blocks.every((block) => block.positions.every((pos) => pos.string !== 6))).toBe(true);
  });

  it("候補の絞り込みはルート弦・位置・音域・フォームの順に保持する", () => {
    const blocks = catalogScaleBlocks(getTuning("standard"), "major", 0, [fixture]);
    const preferred = { scaleType: "major", tonic: 0, rootString: 6, rootFret: 8, direction: "higher", patternId: fixture.id } as const;
    expect(chooseScaleBlock(blocks, preferred).selection).toEqual(preferred);
    expect(() => chooseScaleBlock([], preferred)).toThrow("使えるカタログ運指");
  });

  it("保存されたスケール条件の形式を検証する", () => {
    const valid = { scaleType: "major", tonic: 0, rootString: 6, rootFret: 8, direction: "higher", patternId: fixture.id };
    expect(isScaleSelection(valid)).toBe(true);
    for (const value of [null, {}, { ...valid, tonic: 12 }, { ...valid, scaleType: "pentatonic" },
      { ...valid, rootString: 0 }, { ...valid, rootFret: 25 }, { ...valid, direction: "sideways" }]) {
      expect(isScaleSelection(value)).toBe(false);
    }
  });
});
