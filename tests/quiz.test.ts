import { describe, expect, it, vi } from "vitest";
import {
  CHORD_QUALITIES,
  isPlayableShape,
  qualitiesFor,
  type VoicingType,
} from "../src/core/chords";
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

describe("[S-CHORD-04] ルート弦の選択", () => {
  it("どのボイシングでも1〜6弦をルートに選べる", () => {
    for (const voicing of ["triad", "seventh", "guide"] as VoicingType[]) {
      expect(ChordQuiz.availableRootStrings(voicing)).toEqual([6, 5, 4, 3, 2, 1]);
    }
  });

  it("選んだルート弦の数だけ小問が作られる（低音弦から順）", () => {
    const quiz = new ChordQuiz(tuning, {
      voicing: "triad",
      qualityIds: ["major", "minor"],
      rootStrings: [4, 6, 2],
    });
    const s = quiz.state;
    expect(s.stepCount).toBe(3);
    expect(s.step.rootString).toBe(6);
    quiz.next();
    expect(quiz.state.step.rootString).toBe(4);
    quiz.next();
    expect(quiz.state.step.rootString).toBe(2);
  });

  it("1弦・2弦・3弦ルートでも出題できる", () => {
    for (const voicing of ["triad", "seventh", "guide"] as VoicingType[]) {
      for (const s of [3, 2, 1]) {
        const quiz = new ChordQuiz(tuning, {
          voicing,
          qualityIds: qualitiesFor(voicing).map((q) => q.id),
          rootStrings: [s],
        });
        expect(quiz.state.step.rootString, `${voicing}/${s}弦`).toBe(s);
        expect(quiz.state.shapes.length).toBeGreaterThan(0);
      }
    }
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

  /** 表示済みルートを除いた、答えるべき位置 */
  const answerPositions = (quiz: ChordQuiz): Position[] => {
    const { shape } = quiz.state;
    return shape.positions.filter((p) => !quiz.isGivenRoot(p));
  };

  it("ルート表示ONなら必要クリック数は音数-1、OFFなら音数と同じ", () => {
    expect(makeQuiz(true).requiredCount()).toBe(2);
    expect(makeQuiz(false).requiredCount()).toBe(3);
  });

  it("同じ位置をもう一度押すと選択が解除される", () => {
    const quiz = makeQuiz(true);
    const pos = answerPositions(quiz)[0];
    expect(quiz.toggle(pos).selected).toBe(true);
    expect(quiz.state.selected).toHaveLength(1);
    expect(quiz.toggle(pos).selected).toBe(false);
    expect(quiz.state.selected).toHaveLength(0);
  });

  it("必要数に達したときだけ ready になる", () => {
    const quiz = makeQuiz(true);
    const [a, b] = answerPositions(quiz);
    expect(quiz.toggle(a).ready).toBe(false);
    expect(quiz.toggle(b).ready).toBe(true);
  });

  it("表示済みのルートはクリックしても選択に含まれない", () => {
    const quiz = makeQuiz(true);
    const root = quiz.state.step.root;
    expect(quiz.isGivenRoot(root)).toBe(true);
    quiz.toggle(root);
    expect(quiz.state.selected).toHaveLength(0);
  });

  it("選択をクリアできる", () => {
    const quiz = makeQuiz(true);
    quiz.toggle(answerPositions(quiz)[0]);
    quiz.clearSelection();
    expect(quiz.state.selected).toHaveLength(0);
  });
});

describe("[S-CHORD-07] コードシェイプクイズの判定", () => {
  const makeQuiz = (showRoot = true, rootStrings = [6, 5]) =>
    new ChordQuiz(tuning, {
      voicing: "triad",
      qualityIds: ["major"],
      rootStrings,
      showRoot,
    });

  const answerCurrent = (quiz: ChordQuiz, shape = quiz.state.shape): void => {
    for (const p of shape.positions) {
      if (quiz.isGivenRoot(p)) continue;
      quiz.toggle(p);
    }
  };

  it("完全一致なら正解", () => {
    const quiz = makeQuiz();
    answerCurrent(quiz);
    const result = quiz.judge();
    expect(result.correct).toBe(true);
    expect(result.wrong).toHaveLength(0);
    expect(quiz.state.correct).toBe(1);
    expect(quiz.state.combo).toBe(1);
  });

  it("展開形（別の正解シェイプ）でも正解になる", () => {
    // Math.random を固定して同じ問題を再現できるようにする
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.3);
    try {
      const make = () =>
        new ChordQuiz(tuning, {
          voicing: "triad",
          qualityIds: ["major"],
          rootStrings: [5],
          showRoot: true,
        });
      const shapes = make().state.shapes;
      expect(shapes.length).toBeGreaterThan(1);
      expect(shapes.some((s) => s.rootIndex > 0)).toBe(true);

      for (const shape of shapes) {
        const quiz = make();
        answerCurrent(quiz, shape);
        const label = shape.positions.map((p) => `${p.string}-${p.fret}`).join();
        expect(quiz.judge().correct, label).toBe(true);
      }
    } finally {
      spy.mockRestore();
    }
  });

  it("弦を飛ばしたシェイプでも正解になる", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.3);
    try {
      const make = () =>
        new ChordQuiz(tuning, {
          voicing: "triad",
          qualityIds: ["major"],
          rootStrings: [5],
          showRoot: true,
        });
      const skipped = make().state.shapes.filter((shape) =>
        shape.positions.some((p, i) => i > 0 && shape.positions[i - 1].string - p.string > 1),
      );
      expect(skipped.length).toBeGreaterThan(0);

      for (const shape of skipped) {
        const quiz = make();
        answerCurrent(quiz, shape);
        const label = shape.positions.map((p) => `${p.string}-${p.fret}`).join();
        expect(quiz.judge().correct, label).toBe(true);
      }
    } finally {
      spy.mockRestore();
    }
  });

  it("押弦できないシェイプは正解候補に含まれない", () => {
    const quiz = new ChordQuiz(tuning, {
      voicing: "seventh",
      qualityIds: ["maj7", "dom7", "min7"],
      rootStrings: [6, 5, 4, 3, 2, 1],
      showRoot: true,
    });
    for (const shape of quiz.state.shapes) {
      expect(isPlayableShape(shape.positions)).toBe(true);
    }
  });

  it("どの正解シェイプにも含まれない位置を選ぶと不正解", () => {
    const quiz = makeQuiz();
    const valid = new Set(
      quiz.state.shapes.flatMap((s) => s.positions.map((p) => `${p.string}-${p.fret}`)),
    );
    const correctPos = quiz.state.shape.positions.find((p) => !quiz.isGivenRoot(p))!;
    let wrongPos: Position | null = null;
    for (let f = 0; f <= 24 && !wrongPos; f++) {
      const cand = { string: quiz.state.step.rootString, fret: f };
      if (!valid.has(`${cand.string}-${cand.fret}`)) wrongPos = cand;
    }
    quiz.toggle(correctPos);
    quiz.toggle(wrongPos!);
    const result = quiz.judge();
    expect(result.correct).toBe(false);
    expect(result.wrong).toContainEqual(wrongPos);
    expect(quiz.state.combo).toBe(0);
  });

  it("ルート非表示ならルートも含めて答える必要がある", () => {
    const quiz = makeQuiz(false, [6]);
    answerCurrent(quiz);
    expect(quiz.state.selected).toHaveLength(3);
    expect(quiz.judge().correct).toBe(true);
  });

  it("判定は1回だけ集計される", () => {
    const quiz = makeQuiz(true, [6]);
    answerCurrent(quiz);
    quiz.judge();
    quiz.judge();
    expect(quiz.state.asked).toBe(1);
    expect(quiz.state.correct).toBe(1);
  });
});

describe("[S-CHORD-08] 複数ルート弦の連続出題", () => {
  const makeQuiz = (rootStrings: number[]) =>
    new ChordQuiz(tuning, {
      voicing: "triad",
      qualityIds: ["major", "minor"],
      rootStrings,
      showRoot: true,
    });

  it("すべての小問を答え終えるまで、同じコードが出題され続ける", () => {
    const quiz = makeQuiz([6, 5, 4]);
    const first = quiz.state;
    expect(first.stepCount).toBe(3);

    for (let i = 0; i < first.stepCount; i++) {
      const s = quiz.state;
      expect(s.stepIndex).toBe(i);
      expect(s.quality.id).toBe(first.quality.id);
      expect(s.rootPitchClass).toBe(first.rootPitchClass);
      expect(s.step.rootString).toBe([6, 5, 4][i]);
      quiz.next();
    }

    // 最後の小問の次は新しいコード
    const next = quiz.state;
    expect(next.stepIndex).toBe(0);
    expect(
      next.quality.id !== first.quality.id || next.rootPitchClass !== first.rootPitchClass,
    ).toBe(true);
  });

  it("hasNextStep は最後の小問だけ false", () => {
    const quiz = makeQuiz([6, 5]);
    expect(quiz.hasNextStep).toBe(true);
    quiz.next();
    expect(quiz.hasNextStep).toBe(false);
  });

  it("判定結果の isLastStep は最後の小問だけ true", () => {
    const quiz = makeQuiz([6, 5]);
    const answer = () => {
      for (const p of quiz.state.shape.positions) {
        if (!quiz.isGivenRoot(p)) quiz.toggle(p);
      }
      return quiz.judge();
    };
    expect(answer().isLastStep).toBe(false);
    quiz.next();
    expect(answer().isLastStep).toBe(true);
  });

  it("途中で間違えても、残りの小問は出題される", () => {
    const quiz = makeQuiz([6, 5]);
    const wrong = { string: 1, fret: 24 };
    quiz.toggle(wrong);
    quiz.toggle({ string: 1, fret: 23 });
    expect(quiz.judge().correct).toBe(false);
    expect(quiz.hasNextStep).toBe(true);

    quiz.next();
    expect(quiz.state.stepIndex).toBe(1);
    expect(quiz.state.step.rootString).toBe(5);
    expect(quiz.state.selected).toHaveLength(0);
    expect(quiz.isAnswered).toBe(false);
  });

  it("スコアは小問ごとに加算される", () => {
    const quiz = makeQuiz([6, 5, 4]);
    for (let i = 0; i < 3; i++) {
      for (const p of quiz.state.shape.positions) {
        if (!quiz.isGivenRoot(p)) quiz.toggle(p);
      }
      quiz.judge();
      quiz.next();
    }
    expect(quiz.state.asked).toBe(3);
    expect(quiz.state.correct).toBe(3);
    expect(quiz.state.bestCombo).toBe(3);
  });
});

describe("[S-CHORD-05] クイズが出すシェイプは常に押弦可能", () => {
  it("200回送ってもすべて制約を満たす", () => {
    const quiz = new ChordQuiz(tuning, {
      voicing: "seventh",
      qualityIds: CHORD_QUALITIES.filter((q) => q.category === "seventh").map((q) => q.id),
      rootStrings: [6, 5, 4, 3, 2, 1],
    });
    for (let i = 0; i < 200; i++) {
      const { shape, shapes, step } = quiz.state;
      expect(shapes.length).toBeGreaterThan(0);
      expect(shape.root).toEqual(step.root);
      expect(shape.root.string).toBe(step.rootString);
      for (const s of shapes) {
        expect(s.positions).toHaveLength(4);
        const fretted = s.positions.map((p) => p.fret).filter((f) => f > 0);
        if (fretted.length > 0) {
          expect(Math.max(...fretted) - Math.min(...fretted)).toBeLessThanOrEqual(5);
        }
      }
      quiz.next();
    }
  });
});
