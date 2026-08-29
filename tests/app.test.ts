import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  it("ボイシングを seventh にすると3弦ルートが選べなくなる", () => {
    const sel = $<HTMLSelectElement>("#chord-voicing");
    sel.value = "seventh";
    sel.dispatchEvent(new window.Event("change"));
    const chips = Array.from(document.querySelectorAll("#chord-root-strings .chip")).map(
      (c) => c.textContent,
    );
    expect(chips).toEqual(["6弦", "5弦", "4弦"]);
  });

  it("コードの種類はボイシングに応じて切り替わり、最低1つは選択されたまま", () => {
    const sel = $<HTMLSelectElement>("#chord-voicing");
    sel.value = "guide";
    sel.dispatchEvent(new window.Event("change"));
    const chips = Array.from(document.querySelectorAll<HTMLButtonElement>("#chord-qualities .chip"));
    expect(chips).toHaveLength(6);

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
    expect(text("#question-sub")).toContain("0/2 選択中");
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
