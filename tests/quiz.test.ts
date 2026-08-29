import { describe, expect, it } from "vitest";
import { CHORD_QUALITIES, buildChordShape, type VoicingType } from "../src/core/chords";
import { pitchClassAt, type Position } from "../src/core/fretboard";
import { getTuning } from "../src/core/tuning";
import { ChordQuiz } from "../src/ui/ChordQuiz";
import { DegreeQuiz } from "../src/ui/DegreeQuiz";
import { Quiz } from "../src/ui/Quiz";

const tuning = getTuning("standard");

describe("[S-NOTE-01] 音名クイズの出題", () => {
  it("同じ音名が2問続けて出題されない", () => {
    const quiz = new Quiz(tuning, "all");
    let previous = quiz.state.question;
    for (let i = 0; i < 200; i++) {
      quiz.next();
      expect(quiz.state.question).not.toBe(previous);
      previous = quiz.state.question;
    }
  });

  it("ナチュラル範囲では♯/♭の音は出題されない", () => {
    const quiz = new Quiz(tuning, "natural");
    const naturals = [0, 2, 4, 5, 7, 9, 11];
    for (let i = 0; i < 100; i++) {
      expect(naturals).toContain(quiz.state.question);
      quiz.next();
    }
  });
});

describe("[S-NOTE-03] 音名クイズの判定", () => {
  it("ピッチクラスが一致すれば正解、スコアが増える", () => {
    const quiz = new Quiz(tuning, "all");
    const target = quiz.state.question;
    const answer = findPosition(target);

    const result = quiz.judge(answer);
    expect(result.correct).toBe(true);
    expect(result.answers.length).toBeGreaterThan(0);
    expect(quiz.state.correct).toBe(1);
    expect(quiz.state.asked).toBe(1);
    expect(quiz.state.combo).toBe(1);
  });

  it("不正解ならコンボが0に戻る", () => {
    const quiz = new Quiz(tuning, "all");
    quiz.judge(findPosition(quiz.state.question));
    quiz.next();
    const result = quiz.judge(findWrongPosition(quiz.state.question));
    expect(result.correct).toBe(false);
    expect(quiz.state.combo).toBe(0);
    expect(quiz.state.asked).toBe(2);
  });

  function findPosition(target: number): Position {
    for (let s = 1; s <= 6; s++) {
      for (let f = 0; f <= 24; f++) {
        if (pitchClassAt(tuning, { string: s, fret: f }) === target) {
          return { string: s, fret: f };
        }
      }
    }
    throw new Error("unreachable");
  }

  function findWrongPosition(target: number): Position {
    for (let s = 1; s <= 6; s++) {
      for (let f = 0; f <= 24; f++) {
        if (pitchClassAt(tuning, { string: s, fret: f }) !== target) {
          return { string: s, fret: f };
        }
      }
    }
    throw new Error("unreachable");
  }
});

describe("[S-DEG-01] 度数クイズの出題", () => {
  it("ルートは選択した弦・0〜12フレットに置かれる", () => {
    const quiz = new DegreeQuiz(tuning, "chord-tone", "whole", { strings: [6, 5] });
    for (let i = 0; i < 100; i++) {
      const root = quiz.state.root;
      expect([6, 5]).toContain(root.string);
      expect(root.fret).toBeGreaterThanOrEqual(0);
      expect(root.fret).toBeLessThanOrEqual(12);
      quiz.next();
    }
  });

  it("同じ度数が2問続けて出題されない", () => {
    const quiz = new DegreeQuiz(tuning, "all", "whole");
    let previous = quiz.state.interval;
    for (let i = 0; i < 100; i++) {
      quiz.next();
      expect(quiz.state.interval).not.toBe(previous);
      previous = quiz.state.interval;
    }
  });

  it("ルート音を固定するモードではピッチクラスが固定される", () => {
    const quiz = new DegreeQuiz(tuning, "chord-tone", "whole", {
      mode: "fixed-pitch",
      pitchClass: 3,
    });
    for (let i = 0; i < 50; i++) {
      expect(quiz.state.rootPitchClass).toBe(3);
      quiz.next();
    }
  });

  it("ルート位置を固定するモードでは弦もフレットも固定される", () => {
    const quiz = new DegreeQuiz(tuning, "chord-tone", "whole", {
      mode: "fixed-position",
      position: { string: 5, fret: 7 },
    });
    for (let i = 0; i < 50; i++) {
      expect(quiz.state.root).toEqual({ string: 5, fret: 7 });
      quiz.next();
    }
  });
});

describe("[S-DEG-03] 度数クイズの判定", () => {
  it("正解位置を押すと正解になる", () => {
    const quiz = new DegreeQuiz(tuning, "chord-tone", "whole");
    const target = quiz.state.interval;
    const pos = findDegreePosition(quiz, target);
    const result = quiz.judge(pos);
    expect(result.correct).toBe(true);
    expect(quiz.state.correct).toBe(1);
  });

  it("ルート周辺モードでは正解位置がすべて±4フレット以内", () => {
    const quiz = new DegreeQuiz(tuning, "all", "near-root");
    for (let i = 0; i < 100; i++) {
      const { root, interval } = quiz.state;
      const result = quiz.judge(findDegreePosition(quiz, interval, root.fret));
      for (const a of result.answers) {
        expect(Math.abs(a.fret - root.fret)).toBeLessThanOrEqual(4);
      }
      quiz.next();
    }
  });

  function findDegreePosition(
    quiz: DegreeQuiz,
    interval: number,
    nearFret?: number,
  ): Position {
    for (let s = 1; s <= 6; s++) {
      for (let f = 0; f <= 24; f++) {
        const pos = { string: s, fret: f };
        if (quiz.intervalOf(pos) !== interval) continue;
        if (nearFret !== undefined && Math.abs(f - nearFret) > 4) continue;
        return pos;
      }
    }
    throw new Error("該当する度数の位置が見つかりません");
  }
});

describe("[S-CHORD-01] コードシェイプクイズの出題", () => {
  it("同じコード×ルート位置が2問続けて出題されない", () => {
    const quiz = new ChordQuiz(tuning, {
      voicing: "triad",
      qualityIds: ["major", "minor"],
      rootStrings: [6, 5],
    });
    const key = () => {
      const s = quiz.state.shape;
      return `${s.quality.id}-${s.root.string}-${s.root.fret}`;
    };
    let previous = key();
    for (let i = 0; i < 100; i++) {
      quiz.next();
      expect(key()).not.toBe(previous);
      previous = key();
    }
  });

  it("出題されるコードとルート弦は設定どおり", () => {
    const quiz = new ChordQuiz(tuning, {
      voicing: "guide",
      qualityIds: ["min7"],
      rootStrings: [5],
    });
    for (let i = 0; i < 50; i++) {
      expect(quiz.state.shape.quality.id).toBe("min7");
      expect(quiz.state.shape.root.string).toBe(5);
      expect(quiz.state.shape.voicing).toBe("guide");
      quiz.next();
    }
  });
});

describe("[S-CHORD-04] ルート弦の正規化", () => {
  it("seventh / guide では3弦ルートが除外される", () => {
    for (const voicing of ["seventh", "guide"] as VoicingType[]) {
      expect(ChordQuiz.availableRootStrings(voicing)).toEqual([6, 5, 4]);
      const quiz = new ChordQuiz(tuning, {
        voicing,
        qualityIds: ["maj7"],
        rootStrings: [3],
      });
      expect(quiz.state.shape.root.string).not.toBe(3);
    }
  });

  it("triad では6〜3弦すべて使える", () => {
    expect(ChordQuiz.availableRootStrings("triad")).toEqual([6, 5, 4, 3]);
  });
});

describe("[S-CHORD-06] 回答の選択操作", () => {
  const makeQuiz = (showRoot: boolean) =>
    new ChordQuiz(tuning, {
      voicing: "triad",
      qualityIds: ["major"],
      rootStrings: [6, 5],
      showRoot,
    });

  it("ルート表示ONなら必要クリック数は音数-1、OFFなら音数と同じ", () => {
    expect(makeQuiz(true).requiredCount()).toBe(2);
    expect(makeQuiz(false).requiredCount()).toBe(3);
  });

  it("同じ位置をもう一度押すと選択が解除される", () => {
    const quiz = makeQuiz(true);
    const pos = quiz.state.shape.positions[1];
    expect(quiz.toggle(pos).selected).toBe(true);
    expect(quiz.state.selected).toHaveLength(1);
    expect(quiz.toggle(pos).selected).toBe(false);
    expect(quiz.state.selected).toHaveLength(0);
  });

  it("必要数に達したときだけ ready になる", () => {
    const quiz = makeQuiz(true);
    const [, a, b] = quiz.state.shape.positions;
    expect(quiz.toggle(a).ready).toBe(false);
    expect(quiz.toggle(b).ready).toBe(true);
  });

  it("表示済みのルートはクリックしても選択に含まれない", () => {
    const quiz = makeQuiz(true);
    const root = quiz.state.shape.root;
    expect(quiz.isGivenRoot(root)).toBe(true);
    quiz.toggle(root);
    expect(quiz.state.selected).toHaveLength(0);
  });

  it("選択をクリアできる", () => {
    const quiz = makeQuiz(true);
    quiz.toggle(quiz.state.shape.positions[1]);
    quiz.clearSelection();
    expect(quiz.state.selected).toHaveLength(0);
  });
});

describe("[S-CHORD-07] コードシェイプクイズの判定", () => {
  it("完全一致なら正解", () => {
    const quiz = new ChordQuiz(tuning, {
      voicing: "triad",
      qualityIds: ["major", "minor"],
      rootStrings: [6, 5],
      showRoot: true,
    });
    const [, ...rest] = quiz.state.shape.positions;
    for (const p of rest) quiz.toggle(p);
    const result = quiz.judge();
    expect(result.correct).toBe(true);
    expect(result.wrong).toHaveLength(0);
    expect(quiz.state.correct).toBe(1);
    expect(quiz.state.combo).toBe(1);
  });

  it("1つでも違えば不正解で、間違えた位置が返る", () => {
    const quiz = new ChordQuiz(tuning, {
      voicing: "triad",
      qualityIds: ["major"],
      rootStrings: [6, 5],
      showRoot: true,
    });
    const shape = quiz.state.shape;
    const correctPos = shape.positions[1];
    const wrongPos = { string: shape.positions[2].string, fret: shape.positions[2].fret + 6 };
    quiz.toggle(correctPos);
    quiz.toggle(wrongPos);
    const result = quiz.judge();
    expect(result.correct).toBe(false);
    expect(result.wrong).toEqual([wrongPos]);
    expect(quiz.state.combo).toBe(0);
  });

  it("ルート非表示ならルートも含めて答える必要がある", () => {
    const quiz = new ChordQuiz(tuning, {
      voicing: "triad",
      qualityIds: ["major"],
      rootStrings: [6],
      showRoot: false,
    });
    for (const p of quiz.state.shape.positions) quiz.toggle(p);
    expect(quiz.judge().correct).toBe(true);
  });

  it("判定は1回だけ集計される", () => {
    const quiz = new ChordQuiz(tuning, {
      voicing: "triad",
      qualityIds: ["major"],
      rootStrings: [6],
      showRoot: true,
    });
    const [, ...rest] = quiz.state.shape.positions;
    for (const p of rest) quiz.toggle(p);
    quiz.judge();
    quiz.judge();
    expect(quiz.state.asked).toBe(1);
    expect(quiz.state.correct).toBe(1);
  });
});

describe("[S-CHORD-05] クイズが出すシェイプは常に押弦可能", () => {
  it("100問生成してもすべて制約を満たす", () => {
    const quiz = new ChordQuiz(tuning, {
      voicing: "seventh",
      qualityIds: CHORD_QUALITIES.filter((q) => q.category === "seventh").map((q) => q.id),
      rootStrings: [6, 5, 4],
    });
    for (let i = 0; i < 100; i++) {
      const shape = quiz.state.shape;
      const rebuilt = buildChordShape(tuning, shape.voicing, shape.quality, shape.root);
      expect(rebuilt).not.toBeNull();
      expect(rebuilt!.positions).toEqual(shape.positions);
      quiz.next();
    }
  });
});
