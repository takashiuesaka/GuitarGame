import { describe, expect, it } from "vitest";
import savedCatalogDoc from "../docs/CHORD_CATALOG.md?raw";
import {
  CATALOG_SOURCES,
  CHORD_CATALOG,
  analyzeCatalogShape,
  catalogShapeMatchesQuality,
  findCatalogShapes,
  parseTab,
  tabToPositions,
  transposeTab,
  type ShapeFamily,
} from "../src/core/chordCatalog";
import { CHORD_QUALITIES, isPlayableShape } from "../src/core/chords";
import { MAX_FRET, pitchClassAt } from "../src/core/fretboard";
import { buildCatalogMarkdown } from "../src/core/chordCatalogDoc";
import { getTuning } from "../src/core/tuning";

const tuning = getTuning("standard");

/** 既存の isPlayableShape（押弦幅の制限が保守的）を通らない既知のエントリ */
const KNOWN_UNPLAYABLE = ["triad-dim-6-5-4-0"];

describe("[S-CATALOG-01] カタログのデータ形式", () => {
  it("id が重複しない", () => {
    const ids = CHORD_CATALOG.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("qualityId が CHORD_QUALITIES に存在する", () => {
    const known = new Set(CHORD_QUALITIES.map((q) => q.id));
    for (const shape of CHORD_CATALOG) {
      expect(known.has(shape.qualityId), shape.id).toBe(true);
    }
  });

  it("sourceId が CATALOG_SOURCES に存在する", () => {
    const known = new Set(CATALOG_SOURCES.map((s) => s.id));
    for (const shape of CHORD_CATALOG) {
      expect(known.has(shape.sourceId), shape.id).toBe(true);
    }
  });

  it("タブ譜は6弦ぶんで、フレットは 0〜24 に収まる", () => {
    for (const shape of CHORD_CATALOG) {
      const frets = parseTab(shape.tab);
      expect(frets.length, shape.id).toBe(6);
      for (const fret of frets) {
        if (fret === null) continue;
        expect(fret, shape.id).toBeGreaterThanOrEqual(0);
        expect(fret, shape.id).toBeLessThanOrEqual(MAX_FRET);
      }
    }
  });

  it("すべての系統が1つ以上のエントリを持つ", () => {
    const families: ShapeFamily[] = ["open", "caged", "drop2", "drop3", "shell", "triad"];
    for (const family of families) {
      expect(findCatalogShapes({ family }).length, family).toBeGreaterThan(0);
    }
  });
});

describe("[S-CATALOG-02] カタログの構成音が正しい", () => {
  it("すべてのエントリが、そのコードの構成音を過不足なく含む", () => {
    const ng = CHORD_CATALOG.filter((s) => !catalogShapeMatchesQuality(s)).map(
      (s) => `${s.id}[${s.tab}]`,
    );
    expect(ng).toEqual([]);
  });

  it("宣言した root のピッチクラスが実際に鳴っている", () => {
    for (const shape of CHORD_CATALOG) {
      const pcs = tabToPositions(shape.tab).map((p) => pitchClassAt(tuning, p));
      expect(pcs, shape.id).toContain(shape.root);
    }
  });

  it("omits を宣言したエントリだけが構成音を欠く", () => {
    for (const shape of CHORD_CATALOG) {
      const { quality, intervals } = analyzeCatalogShape(shape);
      const missing = quality.intervals.filter((i) => !intervals.includes(i % 12));
      expect(missing.sort(), shape.id).toEqual([...(shape.omits ?? [])].sort());
    }
  });

  it("省略できるのは5度だけ（3度・7度・ルートは省略しない）", () => {
    for (const shape of CHORD_CATALOG) {
      for (const omit of shape.omits ?? []) {
        expect(omit, shape.id).toBe(7);
      }
    }
  });
});

describe("[S-CATALOG-03] ルート弦・転回形の導出", () => {
  it("すべてのエントリでルート弦が特定できる", () => {
    for (const shape of CHORD_CATALOG) {
      expect(analyzeCatalogShape(shape).rootString, shape.id).not.toBeNull();
    }
  });

  it("名前に「N弦ルート」と書いてあれば導出結果と一致する", () => {
    for (const shape of CHORD_CATALOG) {
      const matched = shape.name.match(/([1-6])弦ルート/);
      if (!matched) continue;
      expect(analyzeCatalogShape(shape).rootString, shape.id).toBe(Number(matched[1]));
    }
  });

  it("転回形は最低音の度数から決まる", () => {
    const cmaj7Root = CHORD_CATALOG.find((s) => s.id === "drop2-maj7-6-5-4-3-2")!;
    expect(analyzeCatalogShape(cmaj7Root).inversion).toBe(0);

    const openC = CHORD_CATALOG.find((s) => s.id === "open-C")!;
    expect(analyzeCatalogShape(openC).inversion).toBe(0);

    // 6弦を鳴らす Cmaj7 は最低音が5度なので第2転回
    const cmaj7Bass5 = CHORD_CATALOG.find((s) => s.id === "open-Cmaj7-bass5")!;
    expect(analyzeCatalogShape(cmaj7Bass5).inversion).toBe(2);
  });

  it("open 系だけが開放弦を含み、それ以外は移動可能", () => {
    for (const shape of CHORD_CATALOG) {
      const { movable } = analyzeCatalogShape(shape);
      if (shape.family === "open") continue;
      expect(movable, shape.id).toBe(true);
    }
  });
});

describe("[S-CATALOG-04] カタログのシェイプは人間が押さえられる", () => {
  it("既存の押弦判定を通らないのは既知のエントリだけ", () => {
    const ng = CHORD_CATALOG.filter((s) => !isPlayableShape(tabToPositions(s.tab))).map((s) => s.id);
    expect(ng).toEqual(KNOWN_UNPLAYABLE);
  });

  it("押弦するフレットの幅が5フレット以内に収まる", () => {
    for (const shape of CHORD_CATALOG) {
      const { minFret, maxFret } = analyzeCatalogShape(shape);
      if (minFret === null || maxFret === null) continue;
      expect(maxFret - minFret, `${shape.id}[${shape.tab}]`).toBeLessThanOrEqual(4);
    }
  });
});

describe("[S-CATALOG-05] タブ譜の変換・移動", () => {
  it("parseTab は6弦→1弦の順に読み、x を null にする", () => {
    expect(parseTab("x-3-2-0-1-0")).toEqual([null, 3, 2, 0, 1, 0]);
  });

  it("tabToPositions は低音弦から高音弦の順に Position を返す", () => {
    expect(tabToPositions("x-3-2-0-1-0")).toEqual([
      { string: 5, fret: 3 },
      { string: 4, fret: 2 },
      { string: 3, fret: 0 },
      { string: 2, fret: 1 },
      { string: 1, fret: 0 },
    ]);
  });

  it("移動可能なシェイプは半音単位で動かせる", () => {
    expect(transposeTab("x-3-5-5-5-3", 2)).toBe("x-5-7-7-7-5");
  });

  it("開放弦を含むシェイプは移動できない", () => {
    expect(() => transposeTab("x-3-2-0-1-0", 2)).toThrow();
  });

  it("移動しても構成音の度数構成は変わらない", () => {
    const shape = CHORD_CATALOG.find((s) => s.id === "caged-maj7-A")!;
    const moved = { ...shape, tab: transposeTab(shape.tab, 3), root: ((shape.root + 3) % 12) as 3 };
    expect(catalogShapeMatchesQuality(moved)).toBe(true);
  });

  it("不正なタブ譜は例外になる", () => {
    expect(() => parseTab("3-2-0")).toThrow();
    expect(() => parseTab("x-x-x-x-x-y")).toThrow();
  });
});

describe("[S-CATALOG-06] カタログの検索", () => {
  it("qualityId で絞り込める", () => {
    const found = findCatalogShapes({ qualityId: "maj7" });
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((s) => s.qualityId === "maj7")).toBe(true);
  });

  it("family と movable を組み合わせて絞り込める", () => {
    const found = findCatalogShapes({ family: "open", movable: false });
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((s) => parseTab(s.tab).includes(0))).toBe(true);
  });

  it("11種のコードすべてにカタログが存在する", () => {
    for (const quality of CHORD_QUALITIES) {
      expect(findCatalogShapes({ qualityId: quality.id }).length, quality.id).toBeGreaterThan(0);
    }
  });
});

describe("[S-CATALOG-07] 生成ドキュメント", () => {
  it("docs/CHORD_CATALOG.md がカタログの内容と一致している", () => {
    expect(savedCatalogDoc, "`npm run catalog` を実行して再生成してください").toBe(
      buildCatalogMarkdown(),
    );
  });
});
