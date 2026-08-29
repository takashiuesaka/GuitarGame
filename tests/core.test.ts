import { describe, expect, it } from "vitest";
import {
  buildChordShape,
  buildChordShapes,
  CHORD_QUALITIES,
  chordName,
  getVoicing,
  isPlayableShape,
  isVoicingAvailable,
  MAX_FINGERS,
  MAX_STRING_SKIP,
  qualitiesFor,
  requiredFingers,
  samePositionSet,
  stringSets,
  voicingStringGroups,
  VOICINGS,
} from "../src/core/chords";
import { DEGREE_GROUPS, degreeLabel, getDegree } from "../src/core/degrees";
import { midiAt, pitchClassAt, MAX_FRET } from "../src/core/fretboard";
import { noteName } from "../src/core/notes";
import { getTuning, TUNINGS } from "../src/core/tuning";

const tuning = getTuning("standard");

describe("[S-APP-01] 指板の座標系", () => {
  it("6弦開放は E2 (MIDI 40)、1弦開放は E4 (MIDI 64)", () => {
    expect(midiAt(tuning, { string: 6, fret: 0 })).toBe(40);
    expect(midiAt(tuning, { string: 1, fret: 0 })).toBe(64);
  });

  it("24フレットまで扱える", () => {
    expect(MAX_FRET).toBe(24);
    expect(midiAt(tuning, { string: 1, fret: 24 })).toBe(88);
  });
});

describe("[S-APP-04] チューニング", () => {
  it("スタンダード・ドロップD・半音下げの3種類がある", () => {
    expect(TUNINGS.map((t) => t.id)).toEqual(["standard", "drop-d", "half-down"]);
  });

  it("ドロップDは6弦だけ2半音低い", () => {
    const drop = getTuning("drop-d");
    expect(midiAt(drop, { string: 6, fret: 0 })).toBe(38);
    expect(midiAt(drop, { string: 5, fret: 0 })).toBe(midiAt(tuning, { string: 5, fret: 0 }));
  });
});

describe("[S-NOTE-02] 音名の表記", () => {
  it("英語表記とドレミ表記を切り替えられる", () => {
    expect(noteName(0, "en", "sharp")).toBe("C");
    expect(noteName(0, "ja", "sharp")).toBe("ド");
  });

  it("♯/♭/両方の表記を切り替えられる", () => {
    expect(noteName(1, "en", "sharp")).toBe("C♯");
    expect(noteName(1, "en", "flat")).toBe("D♭");
    expect(noteName(1, "en", "both")).toBe("C♯/D♭");
  });
});

describe("[S-DEG-02] 度数グループ", () => {
  it("9種類のグループがあり、すべて空でない", () => {
    expect(DEGREE_GROUPS).toHaveLength(9);
    for (const g of DEGREE_GROUPS) {
      expect(g.intervals.length).toBeGreaterThan(0);
      for (const i of g.intervals) expect(i).toBeGreaterThanOrEqual(0);
    }
  });

  it("ローマ数字と音程名の2表記がある", () => {
    expect(degreeLabel(3, "roman")).toBe(getDegree(3).roman);
    expect(degreeLabel(3, "quality")).toBe(getDegree(3).quality);
  });
});

describe("[S-CHORD-02] ボイシング定義", () => {
  it("triad / seventh / guide の3種類", () => {
    expect(VOICINGS.map((v) => v.id)).toEqual(["triad", "seventh", "guide"]);
  });

  it("弦は最大1本まで飛ばせる（隣り合う弦だけに限定しない）", () => {
    for (const v of ["triad", "seventh", "guide"] as const) {
      const groups = voicingStringGroups(v);
      const count = getVoicing(v).noteCount;
      for (const g of groups) {
        expect(g.length, JSON.stringify(g)).toBe(count);
        // 低音弦→高音弦の順で、飛ばせるのは1本まで
        for (let i = 1; i < g.length; i++) {
          expect(g[i - 1] - g[i], JSON.stringify(g)).toBeGreaterThanOrEqual(1);
          expect(g[i - 1] - g[i], JSON.stringify(g)).toBeLessThanOrEqual(1 + MAX_STRING_SKIP);
        }
      }
      // 重複がない
      expect(new Set(groups.map((g) => g.join())).size).toBe(groups.length);
    }
  });

  it("隣り合う弦グループも弦を飛ばしたグループも含む", () => {
    const triad = voicingStringGroups("triad").map((g) => g.join());
    expect(triad).toContain("6,5,4");
    expect(triad).toContain("3,2,1");
    expect(triad).toContain("6,4,3");
    expect(triad).toContain("6,5,3");
    expect(triad).not.toContain("6,3,2"); // 弦を2本飛ばすので不可

    const seventh = voicingStringGroups("seventh").map((g) => g.join());
    expect(seventh).toContain("6,5,4,3");
    expect(seventh).toContain("6,5,3,1");

    // ガイドトーンも隣り合う弦で押さえられる
    expect(voicingStringGroups("guide").map((g) => g.join())).toContain("6,5,4");
  });

  it("ルート弦を含む弦グループは、ルートが最低音になるものが先頭", () => {
    for (const v of ["triad", "seventh", "guide"] as const) {
      for (let root = 1; root <= 6; root++) {
        const sets = stringSets(v, root);
        expect(sets.length, `${v}/${root}弦`).toBeGreaterThan(0);
        expect(sets.every((g) => g.includes(root))).toBe(true);
        const indexes = sets.map((g) => g.indexOf(root));
        expect(indexes).toEqual([...indexes].sort((x, y) => x - y));
      }
    }
    expect(stringSets("triad", 6)[0]).toEqual([6, 5, 4]);
    expect(stringSets("triad", 1)[0]).toEqual([3, 2, 1]);
  });

  it("音数はボイシング定義と一致する", () => {
    expect(getVoicing("triad").noteCount).toBe(3);
    expect(getVoicing("seventh").noteCount).toBe(4);
    expect(getVoicing("guide").noteCount).toBe(3);
  });
});

describe("[S-CHORD-03] コードの種類", () => {
  it("triad ではトライアド系、seventh/guide ではセブンス系のみ", () => {
    expect(qualitiesFor("triad").map((q) => q.id)).toEqual([
      "major",
      "minor",
      "dim",
      "aug",
      "sus4",
    ]);
    const sevenths = ["maj7", "dom7", "min7", "m7b5", "dim7", "mMaj7"];
    expect(qualitiesFor("seventh").map((q) => q.id)).toEqual(sevenths);
    expect(qualitiesFor("guide").map((q) => q.id)).toEqual(sevenths);
  });

  it("コードネームはルート名 + サフィックス", () => {
    expect(chordName("C", CHORD_QUALITIES.find((q) => q.id === "major")!)).toBe("C");
    expect(chordName("A", CHORD_QUALITIES.find((q) => q.id === "min7")!)).toBe("Am7");
  });
});

describe("[S-CHORD-04] ルート弦の可否", () => {
  it("すべてのボイシングで1〜6弦すべてをルートにできる", () => {
    for (const v of VOICINGS) {
      for (let s = 1; s <= 6; s++) {
        expect(isVoicingAvailable(v.id, s), `${v.id}/${s}弦`).toBe(true);
      }
    }
  });
});

describe("[S-CHORD-09] 押弦できるシェイプかの判定", () => {
  const pos = (list: number[][]) => list.map(([string, fret]) => ({ string, fret }));

  it("開放弦だけなら指は 0 本", () => {
    expect(requiredFingers(pos([[6, 0], [5, 0], [4, 0]]))).toBe(0);
  });

  it("同じフレットの複数音は最低フレットならセーハで 1 本", () => {
    // F メジャーの一部: 1フレットのセーハ
    expect(requiredFingers(pos([[6, 1], [2, 1], [1, 1]]))).toBe(1);
    // セーハ + 別の指
    expect(requiredFingers(pos([[6, 1], [5, 3], [1, 1]]))).toBe(2);
  });

  it("セーハの内側に低いフレットや開放弦があるとセーハできない", () => {
    // 5弦3f と 1弦3f のあいだの 3弦が開放 → セーハ不可なので 2 本
    expect(requiredFingers(pos([[5, 3], [3, 0], [1, 3]]))).toBe(2);
    // あいだが 3f 以上ならセーハできる
    expect(requiredFingers(pos([[5, 3], [3, 4], [1, 3]]))).toBe(2);
  });

  it("最低フレット以外の同フレットは指を別々に数える", () => {
    expect(requiredFingers(pos([[6, 5], [5, 8], [4, 8]]))).toBe(3);
  });

  it("押弦幅が広すぎるシェイプは押さえられない", () => {
    // ローポジションは 3 フレット差まで
    expect(requiredFingers(pos([[6, 1], [5, 4]]))).toBe(2);
    expect(requiredFingers(pos([[6, 1], [5, 5]]))).toBeNull();
    // 5フレット以降は 4 フレット差まで
    expect(requiredFingers(pos([[6, 5], [5, 9]]))).toBe(2);
    expect(requiredFingers(pos([[6, 5], [5, 10]]))).toBeNull();
  });

  it("指が5本必要なシェイプは押さえられない", () => {
    expect(requiredFingers(pos([[6, 5], [5, 6], [4, 7], [3, 8], [2, 6]]))).toBe(5);
    expect(isPlayableShape(pos([[6, 5], [5, 6], [4, 7], [3, 8], [2, 6]]))).toBe(false);
    expect(isPlayableShape(pos([[6, 5], [5, 6], [4, 7], [3, 8]]))).toBe(true);
  });

  it("生成されるシェイプはすべて押弦できる", () => {
    for (const v of VOICINGS) {
      for (const q of qualitiesFor(v.id)) {
        for (let string = 1; string <= 6; string++) {
          for (let fret = 0; fret <= 12; fret++) {
            for (const shape of buildChordShapes(tuning, v.id, q, { string, fret })) {
              const label = `${q.id}/${v.id}/${string}弦${fret}f`;
              expect(isPlayableShape(shape.positions), label).toBe(true);
              expect(shape.fingers, label).toBeLessThanOrEqual(MAX_FINGERS);
              expect(shape.fingers, label).toBe(requiredFingers(shape.positions));
            }
          }
        }
      }
    }
  });
});

describe("[S-CHORD-05] シェイプ生成", () => {
  const ROOT_STRINGS = [6, 5, 4, 3, 2, 1];

  const allShapes = () => {
    const shapes = [];
    for (const v of VOICINGS) {
      for (const q of qualitiesFor(v.id)) {
        for (const s of ROOT_STRINGS) {
          for (let f = 0; f <= 17; f++) {
            shapes.push(...buildChordShapes(tuning, v.id, q, { string: s, fret: f }));
          }
        }
      }
    }
    return shapes;
  };

  it("生成されたシェイプは音数・弦の並び・度数がボイシング定義と一致する", () => {
    for (const shape of allShapes()) {
      const groups = stringSets(shape.voicing, shape.root.string);
      expect(shape.positions).toHaveLength(getVoicing(shape.voicing).noteCount);
      const strings = shape.positions.map((p) => p.string);
      expect(groups).toContainEqual(strings);
      const pcs = shape.intervals.map((i) => ((i % 12) + 12) % 12).sort((a, b) => a - b);
      const expected = [...shape.quality.intervals].sort((a, b) => a - b);
      const wanted =
        shape.voicing === "guide"
          ? expected.filter((i) => i !== shape.quality.intervals[2])
          : expected;
      expect(pcs).toEqual([...wanted].sort((a, b) => a - b));
    }
  });

  it("ルートは positions のうち rootIndex 番目にある", () => {
    for (const shape of allShapes()) {
      expect(shape.positions[shape.rootIndex]).toEqual(shape.root);
    }
  });

  it("音高は低音弦から高音弦へ昇順（クローズボイシング）", () => {
    for (const shape of allShapes()) {
      const midis = shape.positions.map((p) => midiAt(tuning, p));
      for (let i = 1; i < midis.length; i++) {
        expect(midis[i]).toBeGreaterThan(midis[i - 1]);
      }
    }
  });

  it("押弦幅は5フレット以内、隣り合う音程は12半音以内", () => {
    for (const shape of allShapes()) {
      const fretted = shape.positions.map((p) => p.fret).filter((f) => f > 0);
      if (fretted.length > 0) {
        expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(5);
      }
      const midis = shape.positions.map((p) => midiAt(tuning, p));
      for (let i = 1; i < midis.length; i++) {
        expect(midis[i] - midis[i - 1]).toBeLessThanOrEqual(12);
      }
    }
  });

  it("ルートのピッチクラスは指板上の実際の音と一致する", () => {
    for (const shape of allShapes()) {
      expect(shape.rootPitchClass).toBe(pitchClassAt(tuning, shape.root));
    }
  });

  it("同じ位置集合のシェイプは重複しない", () => {
    for (const v of VOICINGS) {
      for (const q of qualitiesFor(v.id)) {
        for (const s of ROOT_STRINGS) {
          for (let f = 0; f <= 12; f++) {
            const shapes = buildChordShapes(tuning, v.id, q, { string: s, fret: f });
            const keys = shapes.map((sh) =>
              sh.positions.map((p) => `${p.string}-${p.fret}`).join("|"),
            );
            expect(new Set(keys).size).toBe(keys.length);
          }
        }
      }
    }
  });

  it("展開形（ルートが最低音でないシェイプ）も生成される", () => {
    const major = CHORD_QUALITIES.find((q) => q.id === "major")!;
    // 1弦ルートは必ず展開形になる（1弦より高い弦がない）
    const shapes = buildChordShapes(tuning, "triad", major, { string: 1, fret: 8 });
    expect(shapes.length).toBeGreaterThan(0);
    for (const s of shapes) expect(s.rootIndex).toBe(2);

    // 5弦ルートはルートが最低音のものと、6弦を含む展開形の両方がある
    const fifth = buildChordShapes(tuning, "triad", major, { string: 5, fret: 3 });
    expect(fifth.some((s) => s.rootIndex === 0)).toBe(true);
    expect(fifth.some((s) => s.rootIndex > 0)).toBe(true);
  });

  it("buildChordShape はルートが最低音のシェイプを優先して返す", () => {
    const major = CHORD_QUALITIES.find((q) => q.id === "major")!;
    const shape = buildChordShape(tuning, "triad", major, { string: 5, fret: 3 })!;
    expect(shape.rootIndex).toBe(0);
  });

  it("定番シェイプが正解候補に含まれる", () => {
    const has = (shapes: { positions: { string: number; fret: number }[] }[], want: number[][]) =>
      shapes.some((s) =>
        samePositionSet(
          s.positions,
          want.map(([string, fret]) => ({ string, fret })),
        ),
      );

    const dom7 = CHORD_QUALITIES.find((q) => q.id === "dom7")!;
    const guide = buildChordShapes(tuning, "guide", dom7, { string: 6, fret: 5 });
    // A7 のシェルボイシング
    expect(has(guide, [[6, 5], [4, 5], [3, 6]])).toBe(true);

    const major = CHORD_QUALITIES.find((q) => q.id === "major")!;
    const triad = buildChordShapes(tuning, "triad", major, { string: 5, fret: 5 });
    // D メジャーのクローズドトライアド
    expect(has(triad, [[5, 5], [4, 4], [3, 2]])).toBe(true);

    const maj7 = CHORD_QUALITIES.find((q) => q.id === "maj7")!;
    const cmaj7 = buildChordShapes(tuning, "seventh", maj7, { string: 5, fret: 3 });
    // 定番の Cmaj7（5弦ルート・ドロップ2）
    expect(has(cmaj7, [[5, 3], [4, 5], [3, 4], [2, 5]])).toBe(true);
  });

  it("各ボイシング×コード×ルート弦で、0〜17フレットのどこかに必ずシェイプがある", () => {
    for (const v of VOICINGS) {
      for (const q of qualitiesFor(v.id)) {
        for (const s of ROOT_STRINGS) {
          const found = Array.from({ length: 18 }, (_, f) =>
            buildChordShape(tuning, v.id, q, { string: s, fret: f }),
          ).filter(Boolean);
          expect(found.length, `${v.id}/${q.id}/${s}弦`).toBeGreaterThan(0);
        }
      }
    }
  });
});

describe("[S-CHORD-07] 位置集合の一致判定", () => {
  it("順序が違っても同じ集合なら一致", () => {
    const a = [
      { string: 6, fret: 5 },
      { string: 4, fret: 5 },
    ];
    const b = [
      { string: 4, fret: 5 },
      { string: 6, fret: 5 },
    ];
    expect(samePositionSet(a, b)).toBe(true);
  });

  it("1つでも違えば不一致", () => {
    expect(
      samePositionSet([{ string: 6, fret: 5 }], [{ string: 6, fret: 6 }]),
    ).toBe(false);
  });
});
