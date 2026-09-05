import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHORD_QUALITIES, type ChordShape, type VoicingType } from "../src/core/chords";
import { catalogChordShapes } from "../src/core/catalogShapes";
import { pitchClassAt, type Position } from "../src/core/fretboard";
import { noteName, type AccidentalStyle, type NotationMode } from "../src/core/notes";
import { getTuning } from "../src/core/tuning";

const tuning = getTuning("standard");

/** main.ts を新しい DOM に読み込み直す */
async function mountApp(settings?: Record<string, unknown>): Promise<void> {
  document.body.innerHTML = '<div id="app"></div>';
  localStorage.clear();
  if (settings) {
    localStorage.setItem("guitar-game-settings", JSON.stringify(settings));
  }
  vi.resetModules();
  await import("../src/main");
}

const $ = <T extends Element>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`要素が見つかりません: ${sel}`);
  return el;
};

const text = (sel: string): string => $(sel).textContent ?? "";

const clickCell = (pos: Position): void => {
  const rect = document.querySelector<SVGRectElement>(
    `.hit[data-string="${pos.string}"][data-fret="${pos.fret}"]`,
  );
  if (!rect) throw new Error(`セルが見つかりません: ${pos.string}弦 ${pos.fret}f`);
  rect.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
};

const switchMode = (mode: "note" | "degree" | "chord"): void => {
  $<HTMLButtonElement>(`.mode-tab[data-mode="${mode}"]`).click();
};

/** 表示中の音名から対応するピッチクラスを求める */
function pitchClassOfLabel(
  label: string,
  notation: NotationMode,
  accidental: AccidentalStyle,
): number {
  for (let pc = 0; pc < 12; pc++) {
    if (noteName(pc, notation, accidental) === label) return pc;
  }
  throw new Error(`音名を解釈できません: ${label}`);
}

function findPosition(pitchClass: number): Position {
  for (let s = 1; s <= 6; s++) {
    for (let f = 0; f <= 24; f++) {
      if (pitchClassAt(tuning, { string: s, fret: f }) === pitchClass) {
        return { string: s, fret: f };
      }
    }
  }
  throw new Error("位置が見つかりません");
}

/** 現在の問題を音名モードで正解する */
function answerNoteCorrectly(): void {
  const pc = pitchClassOfLabel(text("#question-note").trim(), "en", "sharp");
  clickCell(findPosition(pc));
}

/** 現在の問題を音名モードで間違える */
function answerNoteWrongly(): void {
  const pc = pitchClassOfLabel(text("#question-note").trim(), "en", "sharp");
  clickCell(findPosition((pc + 1) % 12));
}

describe("[S-APP-01] 画面の初期表示", () => {
  beforeEach(async () => {
    await mountApp();
  });

  it("3つのモードタブが並ぶ", () => {
    const labels = Array.from(document.querySelectorAll(".mode-tab")).map(
      (t) => t.textContent ?? "",
    );
    expect(labels).toHaveLength(3);
    expect(labels[0]).toContain("音名");
    expect(labels[1]).toContain("度数");
    expect(labels[2]).toContain("コードシェイプ");
  });

  it("指板は6弦×25フレット（0〜24）のセルを持つ", () => {
    expect(document.querySelectorAll(".hit")).toHaveLength(150);
    expect(document.querySelector('.hit[data-string="6"][data-fret="24"]')).not.toBeNull();
    expect(document.querySelector('.hit[data-string="1"][data-fret="0"]')).not.toBeNull();
  });

  it("1弦が上・6弦が下、0フレットが左に描かれる", () => {
    const y = (s: number) =>
      Number(document.querySelector(`.hit[data-string="${s}"][data-fret="0"]`)!.getAttribute("y"));
    expect(y(1)).toBeLessThan(y(6));
    const x = (f: number) =>
      Number(document.querySelector(`.hit[data-string="1"][data-fret="${f}"]`)!.getAttribute("x"));
    expect(x(0)).toBeLessThan(x(24));
  });
});

describe("[S-APP-02] モード切替", () => {
  beforeEach(async () => {
    await mountApp();
  });

  it("モードごとに #app のクラスが切り替わる", () => {
    switchMode("note");
    expect($("#app").className).toContain("is-note");
    switchMode("degree");
    expect($("#app").className).toContain("is-degree");
    expect($("#app").className).not.toContain("is-note");
    switchMode("chord");
    expect($("#app").className).toContain("is-chord");
    expect($("#app").className).not.toContain("is-degree");
  });

  it("スコアはモードごとに独立している", () => {
    switchMode("note");
    answerNoteCorrectly();
    expect(text("#score-asked")).toBe("1");
    switchMode("degree");
    expect(text("#score-asked")).toBe("0");
    switchMode("note");
    expect(text("#score-asked")).toBe("1");
  });
});

describe("[S-APP-04][S-APP-05] 自動送りの既定値", () => {
  it("設定が空のとき、自動送りは既定でONになっている", async () => {
    await mountApp();
    expect($<HTMLInputElement>("#auto-next").checked).toBe(true);
  });

  it("保存済み設定にキーが無くても既定のONが使われる", async () => {
    await mountApp({ mode: "note", notation: "en" });
    expect($<HTMLInputElement>("#auto-next").checked).toBe(true);
  });
});

describe("[S-APP-05] 自動送り", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("音名クイズ: 正解すると900ms後に次の問題へ進む", async () => {
    await mountApp();
    switchMode("note");
    answerNoteCorrectly();
    expect(text("#feedback")).toContain("正解");

    vi.advanceTimersByTime(899);
    expect(text("#feedback")).toContain("正解");

    vi.advanceTimersByTime(2);
    expect(text("#feedback")).toBe("");
    expect(document.querySelectorAll(".marker")).toHaveLength(0);
    expect($<HTMLButtonElement>("#next").disabled).toBe(true);
  });

  it("度数クイズ: 正解すると900ms後に次の問題へ進む", async () => {
    await mountApp();
    switchMode("degree");
    const before = text("#question-note");
    // ルートと同じ位置＝I度を答えるため、出題がI度になるまで送る
    let guard = 0;
    while (!/^I$/.test(text("#question-note").trim()) && guard++ < 50) {
      $<HTMLButtonElement>("#next").disabled = false;
      $<HTMLButtonElement>("#next").click();
    }
    expect(guard).toBeLessThan(50);
    void before;

    const root = $<SVGCircleElement>(".marker-root");
    const cx = Number(root.getAttribute("cx"));
    const cy = Number(root.getAttribute("cy"));
    const cell = Array.from(document.querySelectorAll<SVGRectElement>(".hit")).find((c) => {
      const x = Number(c.getAttribute("x"));
      const y = Number(c.getAttribute("y"));
      return (
        cx >= x &&
        cx <= x + Number(c.getAttribute("width")) &&
        cy >= y &&
        cy <= y + Number(c.getAttribute("height"))
      );
    })!;
    cell.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    expect(text("#feedback")).toContain("正解");

    vi.advanceTimersByTime(901);
    expect(text("#feedback")).toBe("");
  });

  it("不正解のときは自動で進まない", async () => {
    await mountApp();
    switchMode("note");
    answerNoteWrongly();
    expect(text("#feedback")).toContain("残念");

    vi.advanceTimersByTime(5000);
    expect(text("#feedback")).toContain("残念");
    expect($<HTMLButtonElement>("#next").disabled).toBe(false);
  });

  it("自動送りをOFFにすると正解しても進まない", async () => {
    await mountApp();
    switchMode("note");
    const cb = $<HTMLInputElement>("#auto-next");
    cb.checked = false;
    cb.dispatchEvent(new window.Event("change"));

    answerNoteCorrectly();
    vi.advanceTimersByTime(5000);
    expect(text("#feedback")).toContain("正解");
  });

  it("モードを切り替えると予約済みの自動送りは破棄される", async () => {
    await mountApp();
    switchMode("note");
    answerNoteCorrectly();
    switchMode("degree");
    const question = text("#question-note");
    vi.advanceTimersByTime(2000);
    expect(text("#question-note")).toBe(question);
  });
});

describe("[S-APP-03] 設定の永続化", () => {
  it("変更した設定が localStorage に保存される", async () => {
    await mountApp();
    const notation = $<HTMLSelectElement>("#notation");
    notation.value = "ja";
    notation.dispatchEvent(new window.Event("change"));

    const saved = JSON.parse(localStorage.getItem("guitar-game-settings") ?? "{}");
    expect(saved.notation).toBe("ja");
  });

  it("存在しない選択肢が保存されていても既定値に戻る", async () => {
    await mountApp({ mode: "chord", degreeGroup: "diatonic", chordVoicing: "bogus" });
    expect($<HTMLSelectElement>("#chord-voicing").value).toBe("triad");
    expect($<HTMLSelectElement>("#degree-group").value).toBe("chord-tone");
  });
});

describe("[S-CHORD-04][S-CHORD-06] コードモードのUI", () => {
  beforeEach(async () => {
    await mountApp();
    switchMode("chord");
  });

  it("ルート弦の選択肢はカタログに定番フォームがある弦だけ並ぶ", () => {
    const rootChips = () =>
      Array.from(document.querySelectorAll("#chord-root-strings .chip")).map((c) => c.textContent);
    const sel = $<HTMLSelectElement>("#chord-voicing");

    // 既定は基本形のみ。基本形はどの弦セットでも最低音弦がルートになる
    sel.value = "triad";
    sel.dispatchEvent(new window.Event("change"));
    expect(rootChips()).toEqual(["6弦", "5弦", "4弦", "3弦"]);

    sel.value = "seventh";
    sel.dispatchEvent(new window.Event("change"));
    expect(rootChips()).toEqual(["6弦", "5弦", "4弦"]);

    // ガイドトーンは6弦・5弦ルートの定番フォームしかない
    sel.value = "guide";
    sel.dispatchEvent(new window.Event("change"));
    expect(rootChips()).toEqual(["6弦", "5弦"]);

    // 開放・バレーコードは6〜4弦ルート
    sel.value = "form";
    sel.dispatchEvent(new window.Event("change"));
    expect(rootChips()).toEqual(["6弦", "5弦", "4弦"]);
  });

  it("ボイシングは4種類から選べる", () => {
    const options = Array.from($<HTMLSelectElement>("#chord-voicing").options).map((o) => o.value);
    expect(options).toEqual(["triad", "seventh", "guide", "form"]);
  });

  it("コードの種類はボイシングに応じて切り替わり、最低1つは選択されたまま", () => {
    const sel = $<HTMLSelectElement>("#chord-voicing");
    sel.value = "guide";
    sel.dispatchEvent(new window.Event("change"));
    // ガイドトーンは5度を省くので、5度が identity の m7♭5 / dim7 は出題できない
    const chips = Array.from(document.querySelectorAll<HTMLButtonElement>("#chord-qualities .chip"));
    expect(chips.map((c) => c.textContent)).toEqual([
      "メジャーセブンス",
      "ドミナントセブンス",
      "マイナーセブンス",
      "マイナーメジャーセブンス",
    ]);

    for (const chip of chips) chip.click();
    const active = Array.from(
      document.querySelectorAll("#chord-qualities .chip.active"),
    );
    expect(active.length).toBeGreaterThanOrEqual(1);
  });

  it("クリックで選択中マーカーが付き、もう一度押すと外れる", () => {
    const cell = { string: 1, fret: 7 };
    clickCell(cell);
    expect(document.querySelectorAll(".marker-pending")).toHaveLength(1);
    clickCell(cell);
    expect(document.querySelectorAll(".marker-pending")).toHaveLength(0);
  });

  it("「選択をクリア」で選択が全て外れる", () => {
    clickCell({ string: 1, fret: 7 });
    $<HTMLButtonElement>("#clear-selection").click();
    expect(document.querySelectorAll(".marker-pending")).toHaveLength(0);
    expect(text("#question-sub")).toContain("0 音選択中");
  });

  it("補足行にボイシング名・ルート位置・残り音数が出る", () => {
    const sub = text("#question-sub");
    expect(sub).toContain("トライアド");
    expect(sub).toMatch(/ルート \d弦 \d+フレット/);
    expect(sub).toContain("選択中");
  });
});

describe("[S-APP-07] キーボード操作", () => {
  it("不正解後に Enter で次の問題へ進む", async () => {
    await mountApp();
    switchMode("note");
    answerNoteWrongly();
    expect($<HTMLButtonElement>("#next").disabled).toBe(false);

    document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter" }));
    expect(text("#feedback")).toBe("");
    expect($<HTMLButtonElement>("#next").disabled).toBe(true);
  });
});

describe("[S-CHORD-08] 複数ルート弦の連続出題（画面）", () => {
  /** 表示中の小問の正解シェイプ（代表） */
  function currentShape(): ChordShape {
    const name = text("#question-note").trim();
    const quality = [...CHORD_QUALITIES]
      .sort((a, b) => b.symbol.length - a.symbol.length)
      .find((q) => q.symbol === "" || name.endsWith(q.symbol))!;
    const sub = text("#question-sub");
    const m = /ルート (\d)弦 (\d+)フレット/.exec(sub);
    if (!m) throw new Error(`ルート位置を読み取れません: ${sub}`);
    const root = { string: Number(m[1]), fret: Number(m[2]) };
    const voicing = $<HTMLSelectElement>("#chord-voicing").value as VoicingType;
    const shape = catalogChordShapes(tuning, voicing, quality, root)[0];
    if (!shape) throw new Error(`シェイプが見つかりません: ${name} ${sub}`);
    return shape;
  }

  /** 表示済みのルート以外をクリックして正解する */
  function answerChordCorrectly(): void {
    const shape = currentShape();
    const rootMarker = document.querySelector(".marker-root");
    for (const p of shape.positions) {
      if (rootMarker && p.string === shape.root.string && p.fret === shape.root.fret) continue;
      clickCell(p);
    }
  }

  /** 確実に不正解になる位置をクリックする */
  function answerChordWrongly(): void {
    const button = $<HTMLButtonElement>("#answer-chord");
    for (let i = 0; button.disabled && i < 6; i++) clickCell({ string: 1, fret: 24 - i });
    button.click();
  }

  beforeEach(async () => {
    await mountApp();
    switchMode("chord");
  });

  it("既定では6弦・5弦の2問構成で、進捗が表示される", () => {
    expect(text("#question-sub")).toContain("6弦ルート（1/2）");
    expect($("#next").textContent).toContain("次のシェイプ");
  });

  it("間違えても次のルート弦へ進み、コード名は変わらない", () => {
    const chord = text("#question-note");
    answerChordWrongly();
    expect(text("#feedback")).toContain("残念");
    expect($<HTMLButtonElement>("#next").disabled).toBe(false);
    expect($("#next").textContent).toContain("次のシェイプ");

    $<HTMLButtonElement>("#next").click();
    expect(text("#question-note")).toBe(chord);
    expect(text("#question-sub")).toContain("5弦ルート（2/2）");
    expect($("#next").textContent).toContain("次の問題");
  });

  it("すべての小問を答え終えると新しいコードが出題される", () => {
    const chord = text("#question-note");
    answerChordWrongly();
    $<HTMLButtonElement>("#next").click();
    answerChordWrongly();
    $<HTMLButtonElement>("#next").click();
    expect(text("#question-sub")).toContain("6弦ルート（1/2）");
    expect(text("#question-note")).not.toBe(chord);
  });

  it("「回答する」は最低音数に達するまで押せない", () => {
    const button = $<HTMLButtonElement>("#answer-chord");
    expect(button.disabled).toBe(true);
    clickCell({ string: 1, fret: 24 });
    expect(button.disabled).toBe(true);
    clickCell({ string: 1, fret: 23 });
    expect(button.disabled).toBe(false);
    $<HTMLButtonElement>("#clear-selection").click();
    expect(button.disabled).toBe(true);
  });

  it("正解シェイプと一致したら「回答する」を押さなくても自動で判定される", () => {
    answerChordCorrectly();
    expect(text("#feedback")).toContain("正解");
    expect($<HTMLButtonElement>("#answer-chord").disabled).toBe(true);
  });

  it("正解すると自動で次のルート弦へ進む", () => {
    vi.useFakeTimers();
    try {
      const chord = text("#question-note");
      answerChordCorrectly();
      expect(text("#feedback")).toContain("正解");
      vi.advanceTimersByTime(1301);
      expect(text("#feedback")).toBe("");
      expect(text("#question-note")).toBe(chord);
      expect(text("#question-sub")).toContain("5弦ルート（2/2）");
    } finally {
      vi.useRealTimers();
    }
  });

  it("展開形（ルートが最低音でないシェイプ）でも正解になる", () => {
    // 5弦ルートの小問へ進めてから、6弦を含む展開形で答える
    answerChordWrongly();
    $<HTMLButtonElement>("#next").click();

    const name = text("#question-note").trim();
    const quality = [...CHORD_QUALITIES]
      .sort((a, b) => b.symbol.length - a.symbol.length)
      .find((q) => q.symbol === "" || name.endsWith(q.symbol))!;
    const m = /ルート (\d)弦 (\d+)フレット/.exec(text("#question-sub"))!;
    const root = { string: Number(m[1]), fret: Number(m[2]) };
    const shapes = catalogChordShapes(tuning, "triad", quality, root, 0);
    // 同じ転回形でも押さえ方が複数あることがあるので、代表以外でも正解になること
    const other = shapes.slice(1).find((s) => s.positions.length > 0);
    if (!other) return;

    for (const p of other.positions) {
      if (p.string === root.string && p.fret === root.fret) continue;
      clickCell(p);
    }
    expect(text("#feedback")).toContain("正解");
  });
});

describe("[S-CHORD-10] 転回形の選択（画面）", () => {
  const invChips = () =>
    Array.from(document.querySelectorAll("#chord-inversions .chip")) as HTMLButtonElement[];
  const activeInvChips = () => invChips().filter((c) => c.classList.contains("active"));

  /** ルート弦を1本だけに絞る。チップはクリックのたびに作り直されるので毎回取り直す */
  const onlyRootString = (label: string): void => {
    const chip = (l: string) =>
      (
        Array.from(document.querySelectorAll("#chord-root-strings .chip")) as HTMLButtonElement[]
      ).find((c) => c.textContent === l);
    if (!chip(label)!.classList.contains("active")) chip(label)!.click();
    for (const l of ["6弦", "5弦", "4弦", "3弦", "2弦", "1弦"]) {
      if (l === label) continue;
      const c = chip(l);
      if (c?.classList.contains("active")) c.click();
    }
  };

  beforeEach(async () => {
    await mountApp();
    switchMode("chord");
  });

  it("ボイシングごとに選べる転回形が並び、既定は基本形だけ", () => {
    expect(invChips().map((c) => c.textContent)).toEqual(["基本形", "第1転回", "第2転回"]);
    expect(activeInvChips().map((c) => c.textContent)).toEqual(["基本形"]);

    const sel = $<HTMLSelectElement>("#chord-voicing");
    sel.value = "seventh";
    sel.dispatchEvent(new window.Event("change"));
    expect(invChips().map((c) => c.textContent)).toEqual([
      "基本形",
      "第1転回",
      "第2転回",
      "第3転回",
    ]);

    // ガイドトーンは基本形しかないので、連続出題の設定も無効になる
    sel.value = "guide";
    sel.dispatchEvent(new window.Event("change"));
    expect(invChips().map((c) => c.textContent)).toEqual(["基本形"]);
    expect($<HTMLInputElement>("#chord-ask-all-inversions").disabled).toBe(true);
  });

  it("転回形を切り替えると出題と補足行に反映される", () => {
    invChips()[1].click(); // 第1転回を追加
    invChips()[0].click(); // 基本形を外す
    expect(activeInvChips().map((c) => c.textContent)).toEqual(["第1転回"]);
    expect(text("#question-sub")).toContain("第1転回");
  });

  it("転回形を変えるとルート弦の選択肢も変わる", () => {
    const rootChips = () =>
      Array.from(document.querySelectorAll("#chord-root-strings .chip")).map((c) => c.textContent);
    expect(rootChips()).toEqual(["6弦", "5弦", "4弦", "3弦"]);

    invChips()[1].click();
    invChips()[0].click();
    // 第1転回はルートが弦セットの最高音弦になる
    expect(rootChips()).toEqual(["4弦", "3弦", "2弦", "1弦"]);
  });

  it("転回形と連続出題の設定が保存される", () => {
    invChips()[1].click();
    setAskAll(true);

    const saved = JSON.parse(localStorage.getItem("guitar-game-settings") ?? "{}");
    expect(saved.chordInversions).toEqual([0, 1]);
    expect(saved.chordAskAllInversions).toBe(true);
  });

  it("連続出題を ON にすると転回形ごとに小問が並ぶ", () => {
    invChips()[1].click();
    invChips()[2].click();
    setAskAll(true);

    // ルート弦を4弦だけに絞ると、その弦で作れる転回形の数だけ小問が並ぶ
    onlyRootString("4弦");
    // 小問の総数は問題によって変わる（小問の中身は quiz.test.ts で検証）
    const sub = text("#question-sub");
    expect(sub).toContain("4弦ルート");
    // 転回形が1つしか作れない問題もあるので、複数のときだけ (i/n) 表記になる
    const m = /4弦ルート（(\d)\/(\d)）/.exec(sub);
    if (m) expect(Number(m[1])).toBeLessThanOrEqual(Number(m[2]));
  });

  /** 連続出題を OFF にする（既定は ON） */
  const setAskAll = (on: boolean): void => {
    const box = $<HTMLInputElement>("#chord-ask-all-inversions");
    box.checked = on;
    box.dispatchEvent(new window.Event("change"));
  };

  it("「選んだ転回形を連続で出題する」は既定で ON", () => {
    expect($<HTMLInputElement>("#chord-ask-all-inversions").checked).toBe(true);
  });

  it("複数選ぶと、いくつの転回形から選べるかが出題時に分かる", () => {
    // 実際に作れる転回形の数は問題によって変わるので、表記の形だけを検証する
    setAskAll(false);
    invChips()[1].click();
    invChips()[2].click();
    onlyRootString("4弦");
    const sub = text("#question-sub");
    // 候補が複数なら「転回形 N種（…）のどれでも」、1つなら転回形名だけを表示する
    expect(sub).toMatch(/転回形 \d種（[^）]+）のどれでも|基本形|第1転回|第2転回/);
    const m = /転回形 (\d)種（([^）]+)）のどれでも/.exec(sub);
    if (m) expect(m[2].split("・").length).toBe(Number(m[1]));
  });

  it("正解すると、答えたのが何転回だったかと残りの転回形が表示される", () => {
    setAskAll(false);
    invChips()[1].click();
    invChips()[2].click();
    onlyRootString("4弦");

    // 補足行から現在の問題を復元し、候補のシェイプで答える
    const name = text("#question-note").trim();
    const quality = [...CHORD_QUALITIES]
      .sort((a, b) => b.symbol.length - a.symbol.length)
      .find((q) => q.symbol === "" || name.endsWith(q.symbol))!;
    const m = /ルート (\d)弦 (\d+)フレット/.exec(text("#question-sub"))!;
    const root = { string: Number(m[1]), fret: Number(m[2]) };

    const shapes: ChordShape[] = [];
    for (const inv of [0, 1, 2]) {
      shapes.push(...catalogChordShapes(tuning, "triad", quality, root, inv));
    }
    const picked = shapes[0];
    for (const p of picked.positions) {
      if (p.string === root.string && p.fret === root.fret) continue;
      clickCell(p);
    }

    const fb = text("#feedback");
    expect(fb).toContain("正解");
    expect(fb).toContain(`${["基本形", "第1転回", "第2転回"][picked.inversion]}でした`);

    // 連続出題が OFF なら、続きの小問が無いので残りの転回形は出さない
    expect(fb).not.toContain("残りは");
    expect(text("#question-sub")).not.toContain("残りの転回形");
  });

  it("連続出題では、回答後も残りの転回形が専用のバッジに表示され続ける", () => {
    invChips()[1].click();
    invChips()[2].click();
    setAskAll(true);
    onlyRootString("4弦");

    // 補足行から現在の問題を復元し、候補のシェイプで答える
    const name = text("#question-note").trim();
    const quality = [...CHORD_QUALITIES]
      .sort((a, b) => b.symbol.length - a.symbol.length)
      .find((q) => q.symbol === "" || name.endsWith(q.symbol))!;
    const m = /ルート (\d)弦 (\d+)フレット/.exec(text("#question-sub"))!;
    const root = { string: Number(m[1]), fret: Number(m[2]) };

    const shapes: ChordShape[] = [];
    for (const inv of [0, 1, 2]) {
      shapes.push(...catalogChordShapes(tuning, "triad", quality, root, inv));
    }
    const picked = shapes[0];
    for (const p of picked.positions) {
      if (p.string === root.string && p.fret === root.fret) continue;
      clickCell(p);
    }
    expect(text("#feedback")).toContain("正解");

    const rest = [...new Set(shapes.map((s) => s.inversion))]
      .filter((i) => i !== picked.inversion)
      .sort((a, b) => a - b);
    const hint = text("#inversion-hint");
    if (rest.length > 0) {
      expect(text("#feedback")).toContain("残りは");
      expect(hint).toContain("次に押さえるのは");
      for (const i of rest) expect(hint).toContain(["基本形", "第1転回", "第2転回"][i]);
    } else {
      expect(hint).toContain("すべて回答済み");
    }
  });

  it("連続出題では、出題時から押さえる転回形がバッジに出る", () => {
    invChips()[1].click();
    invChips()[2].click();
    setAskAll(true);
    onlyRootString("4弦");

    expect(text("#inversion-hint")).toContain("押さえるのは");

    // 連続出題を OFF に戻すとバッジは消える
    setAskAll(false);
    expect(text("#inversion-hint")).toBe("");
  });
});
