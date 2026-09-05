import { describe, expect, it } from "vitest";
import {
  catalogChordShapes,
  catalogQualities,
  catalogRootStrings,
} from "../src/core/catalogShapes";
import {
  CHORD_QUALITIES,
  chordName,
  fingerCount,
  getChordQuality,
  getVoicing,
  isPlayableShape,
  isSpanReachable,
  MAX_FINGERS,
  samePositionSet,
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

  it("音数はボイシング定義と一致する", () => {
    expect(getVoicing("triad").noteCount).toBe(3);
    expect(getVoicing("seventh").noteCount).toBe(4);
    expect(getVoicing("guide").noteCount).toBe(3);
  });
});

describe("[S-CHORD-03] コードの種類", () => {
  it("出題できるのはカタログに定番フォームがあるコードだけ", () => {
    expect(catalogQualities("triad").map((q) => q.id)).toEqual([
      "major",
      "minor",
      "dim",
      "aug",
      "sus4",
    ]);
    expect(catalogQualities("seventh").map((q) => q.id)).toEqual([
      "maj7",
      "dom7",
      "min7",
      "m7b5",
      "dim7",
      "mMaj7",
    ]);
    // ガイドトーンは5度を省くため、5度が identity である m7♭5 / dim7 は対象外
    expect(catalogQualities("guide").map((q) => q.id)).toEqual([
      "maj7",
      "dom7",
      "min7",
      "mMaj7",
    ]);
  });

  it("コードネームはルート名 + サフィックス", () => {
    expect(chordName("C", CHORD_QUALITIES.find((q) => q.id === "major")!)).toBe("C");
    expect(chordName("A", CHORD_QUALITIES.find((q) => q.id === "min7")!)).toBe("Am7");
  });
});

describe("[S-CHORD-04] ルート弦の可否", () => {
  it("トライアド・セブンスは1〜6弦すべてをルートにできる", () => {
    for (const voicing of ["triad", "seventh"] as const) {
      expect(catalogRootStrings(voicing, tuning)).toEqual([6, 5, 4, 3, 2, 1]);
    }
  });

  it("ガイドトーンは6弦・5弦ルートだけ", () => {
    expect(catalogRootStrings("guide", tuning)).toEqual([6, 5]);
  });

  it("ドロップDでは6弦を使う定番フォームが成立しないので6弦ルートは選べない", () => {
    const dropD = getTuning("drop-d");
    expect(catalogRootStrings("triad", dropD)).toEqual([5, 4, 3, 2, 1]);
    expect(catalogRootStrings("seventh", dropD)).toEqual([5, 4, 3, 2, 1]);
    expect(catalogRootStrings("guide", dropD)).toEqual([5]);
  });

  it("半音下げは弦の間隔が同じなのでスタンダードと同じ", () => {
    const halfDown = getTuning("half-down");
    for (const voicing of ["triad", "seventh", "guide"] as const) {
      expect(catalogRootStrings(voicing, halfDown)).toEqual(catalogRootStrings(voicing, tuning));
    }
  });
});

describe("[S-CHORD-09] 押弦できるシェイプかの判定", () => {
  const pos = (list: number[][]) => list.map(([string, fret]) => ({ string, fret }));

  it("開放弦だけなら指は 0 本", () => {
    expect(fingerCount(pos([[6, 0], [5, 0], [4, 0]]))).toBe(0);
  });

  it("同じフレットの複数音は最低フレットならセーハで 1 本", () => {
    // F メジャーの一部: 1フレットのセーハ
    expect(fingerCount(pos([[6, 1], [2, 1], [1, 1]]))).toBe(1);
    // セーハ + 別の指
    expect(fingerCount(pos([[6, 1], [5, 3], [1, 1]]))).toBe(2);
  });

  it("セーハの内側に低いフレットや開放弦があるとセーハできない", () => {
    // 5弦3f と 1弦3f のあいだの 3弦が開放 → セーハ不可なので 2 本
    expect(fingerCount(pos([[5, 3], [3, 0], [1, 3]]))).toBe(2);
    // あいだが 3f 以上ならセーハできる
    expect(fingerCount(pos([[5, 3], [3, 4], [1, 3]]))).toBe(2);
  });

  it("最低フレット以外の同フレットは指を別々に数える", () => {
    expect(fingerCount(pos([[6, 5], [5, 8], [4, 8]]))).toBe(3);
  });

  it("押弦幅が広すぎるシェイプは押さえられない", () => {
    expect(isSpanReachable(pos([[6, 3], [5, 8]]))).toBe(false);
    // ローポジションは 3 フレット差まで
    expect(isSpanReachable(pos([[6, 1], [5, 4]]))).toBe(true);
    expect(isSpanReachable(pos([[6, 1], [5, 5]]))).toBe(false);
    // 5フレット以降は 4 フレット差まで
    expect(isSpanReachable(pos([[6, 5], [5, 9]]))).toBe(true);
    expect(isSpanReachable(pos([[6, 5], [5, 10]]))).toBe(false);
  });

  it("指が5本必要なシェイプは押さえられない", () => {
    expect(fingerCount(pos([[6, 5], [5, 6], [4, 7], [3, 8], [2, 6]]))).toBe(5);
    expect(isPlayableShape(pos([[6, 5], [5, 6], [4, 7], [3, 8], [2, 6]]))).toBe(false);
    expect(isPlayableShape(pos([[6, 5], [5, 6], [4, 7], [3, 8]]))).toBe(true);
  });

  it("カタログ由来のシェイプは指4本以内で押さえられる", () => {
    for (const voicing of VOICINGS) {
      for (const quality of catalogQualities(voicing.id)) {
        for (const string of catalogRootStrings(voicing.id, tuning)) {
          for (let fret = 0; fret <= 12; fret++) {
            for (const shape of catalogChordShapes(tuning, voicing.id, quality, { string, fret })) {
              const label = `${quality.id}/${voicing.id}/${string}弦${fret}f`;
              expect(shape.fingers, label).toBeLessThanOrEqual(MAX_FINGERS);
              expect(shape.fingers, label).toBe(fingerCount(shape.positions));
            }
          }
        }
      }
    }
  });
});

describe("[S-CHORD-05] カタログからの正解シェイプ導出", () => {
  const allShapes = () => {
    const shapes = [];
    for (const v of VOICINGS) {
      for (const q of catalogQualities(v.id)) {
        for (const s of catalogRootStrings(v.id, tuning)) {
          for (let f = 0; f <= 17; f++) {
            shapes.push(...catalogChordShapes(tuning, v.id, q, { string: s, fret: f }));
          }
        }
      }
    }
    return shapes;
  };

  it("シェイプの構成音はコードの構成音と一致する（ガイドトーンは5度を省く）", () => {
    for (const shape of allShapes()) {
      const pcs = [...new Set(shape.intervals.map((i) => ((i % 12) + 12) % 12))].sort(
        (a, b) => a - b,
      );
      const expected = [...shape.quality.intervals].sort((a, b) => a - b);
      const wanted =
        shape.voicing === "guide"
          ? expected.filter((i) => i !== shape.quality.intervals[2])
          : expected;
      expect(pcs, shape.catalogId).toEqual([...wanted].sort((a, b) => a - b));
    }
  });

  it("ルートは positions のうち rootIndex 番目にあり、ルート弦の指定と一致する", () => {
    for (const shape of allShapes()) {
      expect(shape.positions[shape.rootIndex]).toEqual(shape.root);
      expect(shape.rootPitchClass).toBe(pitchClassAt(tuning, shape.root));
    }
  });

  it("音高は低音弦から高音弦へ昇順", () => {
    for (const shape of allShapes()) {
      const midis = shape.positions.map((p) => midiAt(tuning, p));
      for (let i = 1; i < midis.length; i++) {
        expect(midis[i], shape.catalogId).toBeGreaterThan(midis[i - 1]);
      }
    }
  });

  it("フレットは 1〜24 に収まる（移調で 0 フレットや 24 超えにならない）", () => {
    for (const shape of allShapes()) {
      for (const pos of shape.positions) {
        expect(pos.fret, shape.catalogId).toBeGreaterThanOrEqual(0);
        expect(pos.fret, shape.catalogId).toBeLessThanOrEqual(MAX_FRET);
      }
    }
  });

  it("同じ位置集合のシェイプは重複しない", () => {
    for (const v of VOICINGS) {
      for (const q of catalogQualities(v.id)) {
        for (const s of catalogRootStrings(v.id, tuning)) {
          for (let f = 0; f <= 12; f++) {
            const shapes = catalogChordShapes(tuning, v.id, q, { string: s, fret: f });
            const keys = shapes.map((sh) =>
              sh.positions.map((p) => `${p.string}-${p.fret}`).join("|"),
            );
            expect(new Set(keys).size).toBe(keys.length);
          }
        }
      }
    }
  });

  it("オクターブ重複を含む定番フォームも正解候補になる", () => {
    const key = (list: { string: number; fret: number }[]) =>
      list.map((p) => `${p.string}-${p.fret}`).join("|");

    // 開放 E メジャー（022100）は 5th と root が重複する 6 音シェイプ
    const openE = catalogChordShapes(tuning, "triad", getChordQuality("major")!, {
      string: 6,
      fret: 0,
    });
    expect(openE.map((s) => key(s.positions))).toContain(
      key([
        { string: 6, fret: 0 },
        { string: 5, fret: 2 },
        { string: 4, fret: 2 },
        { string: 3, fret: 1 },
        { string: 2, fret: 0 },
        { string: 1, fret: 0 },
      ]),
    );

    // C#maj7 の A フォーム: 5th が 4弦と1弦に重複する
    const cs = catalogChordShapes(tuning, "seventh", getChordQuality("maj7")!, {
      string: 5,
      fret: 4,
    });
    expect(cs.map((s) => key(s.positions))).toContain(
      key([
        { string: 5, fret: 4 },
        { string: 4, fret: 6 },
        { string: 3, fret: 5 },
        { string: 2, fret: 6 },
        { string: 1, fret: 4 },
      ]),
    );
  });

  it("展開形（ルートが最低音でないシェイプ）も正解候補になる", () => {
    const major = getChordQuality("major")!;
    // 1弦ルートは必ず展開形になる（1弦より高い弦がない）
    const shapes = catalogChordShapes(tuning, "triad", major, { string: 1, fret: 8 });
    expect(shapes.length).toBeGreaterThan(0);
    for (const s of shapes) expect(s.rootIndex).toBe(s.positions.length - 1);

    // 5弦ルートはルートが最低音のものと、6弦を含む展開形の両方がある
    const fifth = catalogChordShapes(tuning, "triad", major, { string: 5, fret: 3 });
    expect(fifth.some((s) => s.rootIndex === 0)).toBe(true);
    expect(fifth.some((s) => s.rootIndex > 0)).toBe(true);
  });

  it("定番シェイプが正解候補に含まれる", () => {
    const has = (shapes: { positions: { string: number; fret: number }[] }[], want: number[][]) =>
      shapes.some((s) =>
        samePositionSet(
          s.positions,
          want.map(([string, fret]) => ({ string, fret })),
        ),
      );

    // A7 のシェルボイシング
    const guide = catalogChordShapes(tuning, "guide", getChordQuality("dom7")!, {
      string: 6,
      fret: 5,
    });
    expect(has(guide, [[6, 5], [5, 4], [4, 5]])).toBe(true);

    // D メジャーのクローズドトライアド
    const triad = catalogChordShapes(tuning, "triad", getChordQuality("major")!, {
      string: 5,
      fret: 5,
    });
    expect(has(triad, [[5, 5], [4, 4], [3, 2]])).toBe(true);

    // 定番の Cmaj7（5弦ルート・ドロップ2）
    const cmaj7 = catalogChordShapes(tuning, "seventh", getChordQuality("maj7")!, {
      string: 5,
      fret: 3,
    });
    expect(has(cmaj7, [[5, 3], [4, 5], [3, 4], [2, 5]])).toBe(true);
  });

  it("各ボイシング×コード×ルート弦で、0〜17フレットのどこかに必ずシェイプがある", () => {
    for (const v of VOICINGS) {
      for (const q of catalogQualities(v.id)) {
        for (const s of catalogRootStrings(v.id, tuning)) {
          const found = Array.from({ length: 18 }, (_, f) =>
            catalogChordShapes(tuning, v.id, q, { string: s, fret: f }),
          ).filter((list) => list.length > 0);
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
