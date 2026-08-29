import { describe, expect, it } from "vitest";
import {
  buildChordShape,
  CHORD_QUALITIES,
  chordName,
  getVoicing,
  isVoicingAvailable,
  qualitiesFor,
  samePositionSet,
  stringPlan,
  VOICINGS,
  type VoicingType,
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

  it("使う弦はルート弦から下記の並び", () => {
    expect(stringPlan("triad", 6)).toEqual([6, 5, 4]);
    expect(stringPlan("seventh", 6)).toEqual([6, 5, 4, 3]);
    expect(stringPlan("guide", 6)).toEqual([6, 4, 3]);
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
  it("triad は6〜3弦すべて使える", () => {
    for (const s of [6, 5, 4, 3]) expect(isVoicingAvailable("triad", s)).toBe(true);
  });

  it("seventh と guide は3弦ルートを使えない", () => {
    for (const v of ["seventh", "guide"] as VoicingType[]) {
      expect(isVoicingAvailable(v, 6)).toBe(true);
      expect(isVoicingAvailable(v, 5)).toBe(true);
      expect(isVoicingAvailable(v, 4)).toBe(true);
      expect(isVoicingAvailable(v, 3)).toBe(false);
    }
  });
});

describe("[S-CHORD-05] シェイプ生成", () => {
  const allShapes = () => {
    const shapes = [];
    for (const v of VOICINGS) {
      for (const q of qualitiesFor(v.id)) {
        for (const s of [6, 5, 4, 3]) {
          if (!isVoicingAvailable(v.id, s)) continue;
          for (let f = 0; f <= 12; f++) {
            const shape = buildChordShape(tuning, v.id, q, { string: s, fret: f });
            if (shape) shapes.push(shape);
          }
        }
      }
    }
    return shapes;
  };

  it("生成されたシェイプは音数・弦の並び・度数がボイシング定義と一致する", () => {
    for (const shape of allShapes()) {
      const plan = stringPlan(shape.voicing, shape.root.string)!;
      expect(shape.positions).toHaveLength(getVoicing(shape.voicing).noteCount);
      expect(shape.positions.map((p) => p.string)).toEqual(plan);
      const pcs = shape.intervals.map((i) => ((i % 12) + 12) % 12).sort((a, b) => a - b);
      const expected = [...shape.quality.intervals].sort((a, b) => a - b);
      const wanted =
        shape.voicing === "guide"
          ? expected.filter((i) => i !== shape.quality.intervals[2])
          : expected;
      expect(pcs).toEqual([...wanted].sort((a, b) => a - b));
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

  it("定番シェイプを正しく生成する", () => {
    const dom7 = CHORD_QUALITIES.find((q) => q.id === "dom7")!;
    const guide = buildChordShape(tuning, "guide", dom7, { string: 6, fret: 5 })!;
    expect(guide.positions).toEqual([
      { string: 6, fret: 5 },
      { string: 4, fret: 5 },
      { string: 3, fret: 6 },
    ]);

    const major = CHORD_QUALITIES.find((q) => q.id === "major")!;
    const triad = buildChordShape(tuning, "triad", major, { string: 5, fret: 5 })!;
    expect(triad.positions).toEqual([
      { string: 5, fret: 5 },
      { string: 4, fret: 4 },
      { string: 3, fret: 2 },
    ]);
  });

  it("各ボイシング×コード×ルート弦で、0〜12フレットのどこかに必ずシェイプがある", () => {
    for (const v of VOICINGS) {
      for (const q of qualitiesFor(v.id)) {
        for (const s of [6, 5, 4, 3]) {
          if (!isVoicingAvailable(v.id, s)) continue;
          const found = Array.from({ length: 13 }, (_, f) =>
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
