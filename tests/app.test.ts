import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CHORD_QUALITIES, type ChordShape, type VoicingType } from "../src/core/chords";
import { catalogChordShapes } from "../src/core/catalogShapes";
import { pitchClassAt, type Position } from "../src/core/fretboard";
import { noteName, type AccidentalStyle, type NotationMode } from "../src/core/notes";
import { getTuning } from "../src/core/tuning";
import { DEFAULT_NOTE_BLOCK, isInNoteBlock, type NoteBlock, type ScaleNoteBlock } from "../src/core/noteBlock";
import { Fretboard } from "../src/ui/Fretboard";
import { DEFAULT_SCALE_SELECTION, catalogScaleBlocks, matchesScaleSelection, type ScaleSelection } from "../src/core/scaleCatalog";
import appStyles from "../src/style.css?inline";

const tuning = getTuning("standard");

describe("[S-NOTE-09] スケール運指の描画", () => {
  it("実際の運指だけを示し、段状の外周とルートを描き、解除時には残さない", () => {
    const block: ScaleNoteBlock = {
      kind: "scale",
      root: { string: 6, fret: 8 },
      positions: [
        { string: 6, fret: 8 }, { string: 6, fret: 10 },
        { string: 5, fret: 7 }, { string: 5, fret: 8 }, { string: 5, fret: 10 },
        { string: 4, fret: 7 }, { string: 4, fret: 9 }, { string: 4, fret: 10 },
      ],
    };
    const board = new Fretboard({ tuning, notation: "en", accidental: "sharp", onSelect: vi.fn() });
    board.setNoteBlock(block);
    expect(board.element.querySelectorAll("path.block-outline")).toHaveLength(1);
    expect(board.element.querySelectorAll(".inside-block")).toHaveLength(8);
    expect(board.element.querySelectorAll(".scale-position")).toHaveLength(7);
    expect(board.element.querySelectorAll(".scale-anchor")).toHaveLength(1);
    expect(board.element.querySelector('.hit[data-string="5"][data-fret="9"]')?.getAttribute("aria-disabled")).toBe("true");
    board.setShowAllNames(true);
    expect(board.element.querySelectorAll(".note-name.ghost")).toHaveLength(7);
    board.setNoteBlock(DEFAULT_NOTE_BLOCK);
    expect(board.element.querySelectorAll("rect.block-outline")).toHaveLength(1);
    expect(board.element.querySelector(".scale-position-layer")).toBeNull();
    board.setNoteBlock(null);
    expect(board.element.querySelector(".block-outline")).toBeNull();
    expect(board.element.querySelectorAll(".note-name.ghost")).toHaveLength(150);
  });
});

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

function changeSelect(id: string, value: string): void {
  const select = $<HTMLSelectElement>(id);
  select.value = value;
  select.dispatchEvent(new window.Event("change"));
}

function setBlockEnabled(enabled: boolean): void {
  const checkbox = $<HTMLInputElement>("#note-block-enabled");
  checkbox.checked = enabled;
  checkbox.dispatchEvent(new window.Event("change"));
}

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

describe("[S-NOTE-04][S-NOTE-05][S-NOTE-06] ブロック音名クイズの画面", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function currentAnswers(block: NoteBlock = DEFAULT_NOTE_BLOCK, tuningId = "standard"): Position[] {
    const pc = pitchClassOfLabel(text("#question-note"), "en", "sharp");
    const positions: Position[] = [];
    for (let string = block.firstString; string <= block.lastString; string++) {
      for (let fret = block.minFret; fret <= block.maxFret; fret++) {
        if (pitchClassAt(getTuning(tuningId), { string, fret }) === pc) positions.push({ string, fret });
      }
    }
    return positions;
  }

  async function mountG(settings: Record<string, unknown> = {}): Promise<void> {
    const random = vi.spyOn(Math, "random").mockReturnValue(7 / 12);
    try {
      await mountApp({ noteScope: "block", range: "all", sound: false, ...settings });
    } finally {
      random.mockRestore();
    }
    expect(text("#question-note")).toBe("G");
  }

  it("[S-APP-03] 既定はOFFで指板全体、ONにすると1〜3弦・0〜4fを保存する", async () => {
    await mountApp();
    expect($<HTMLInputElement>("#note-block-enabled").checked).toBe(false);
    expect($<HTMLButtonElement>("#apply-note-block").disabled).toBe(true);
    setBlockEnabled(true);
    expect($<HTMLInputElement>("#note-block-enabled").checked).toBe(true);
    expect($<HTMLButtonElement>("#apply-note-block").disabled).toBe(false);
    expect(text("#question-sub")).toContain("1〜3弦 ／ 0〜4フレット");
    expect(JSON.parse(localStorage.getItem("guitar-game-settings")!)).toMatchObject({
      noteScope: "block", noteBlock: DEFAULT_NOTE_BLOCK,
    });
    expect(document.querySelectorAll(".inside-block")).toHaveLength(15);
    expect(document.querySelectorAll(".outside-block")).toHaveLength(135);
  });

  describe("[S-NOTE-07][S-NOTE-09][S-NOTE-10] スケール運指ブロックの画面", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => {
      vi.clearAllTimers();
      vi.useRealTimers();
      vi.restoreAllMocks();
    });

    async function mountScale(extra: Record<string, unknown> = {}): Promise<void> {
      await mountApp({
        noteScope: "block", noteBlockSource: "scale", noteScale: { ...DEFAULT_SCALE_SELECTION },
        range: "all", sound: false, autoNext: false, ...extra,
      });
    }

    function scaleAnswers(): Position[] {
      const saved = JSON.parse(localStorage.getItem("guitar-game-settings")!);
      const selection = saved.noteScale as ScaleSelection;
      const currentTuning = getTuning(saved.tuningId ?? "standard");
      const block = catalogScaleBlocks(currentTuning, selection.scaleType, selection.tonic)
        .find((entry) => matchesScaleSelection(entry, selection))!;
      const pitch = pitchClassOfLabel(text("#question-note"), "en", "sharp");
      return block.positions.filter((pos) => pitchClassAt(currentTuning, pos) === pitch);
    }

    it("Cメジャー6弦8fを起点に、教則の16位置だけを表示する", async () => {
      await mountScale();
      expect($<HTMLSelectElement>("#note-scale").value).toBe("major:0");
      expect($<HTMLSelectElement>("#note-scale").options).toHaveLength(24);
      expect($<HTMLSelectElement>("#note-scale-root-string").value).toBe("6");
      expect($<HTMLSelectElement>("#note-scale-root-fret").value).toBe("8");
      expect(document.querySelectorAll(".inside-block")).toHaveLength(16);
      expect(document.querySelectorAll(".scale-anchor")).toHaveLength(1);
      expect(text("#question-sub")).toContain("C メジャー");
      expect(text("#question-sub")).toContain("6弦 8フレット起点");
      expect($("#note-scale-info a").getAttribute("href")).toBe("https://www.fretjam.com/major-scale.html");
      clickCell({ string: 6, fret: 9 });
      expect(text("#feedback")).toContain("○のない位置は回答対象外");
      expect(text("#score-asked")).toBe("0");
    });

    it("[S-APP-05] 同名音の全位置が必要で、最後の回答から900ms後に進む", async () => {
      const random = vi.spyOn(Math, "random").mockReturnValue(0);
      await mountScale({ autoNext: true });
      random.mockRestore();
      expect(text("#question-note")).toBe("C");
      const answers = scaleAnswers();
      expect(answers).toEqual([{ string: 6, fret: 8 }, { string: 4, fret: 10 }, { string: 1, fret: 8 }]);
      clickCell(answers[0]);
      clickCell(answers[1]);
      vi.advanceTimersByTime(1500);
      expect(text("#question-note")).toBe("C");
      expect(text("#score-asked")).toBe("0");
      clickCell(answers[2]);
      expect(text("#score-correct")).toBe("1");
      vi.advanceTimersByTime(900);
      expect(text("#question-note")).not.toBe("C");
      expect(document.querySelectorAll(".marker")).toHaveLength(0);
      expect(document.querySelectorAll(".inside-block")).toHaveLength(16);
    });

    it("音域・ルート弦に応じて使える運指だけを選択肢にする", async () => {
      await mountScale();
      const options = (id: string) => Array.from($<HTMLSelectElement>(id).options).map((option) => option.value);
      expect(options("#note-scale-direction")).not.toContain("lower");
      changeSelect("#note-scale-direction", "mixed");
      expect($<HTMLSelectElement>("#note-scale-pattern").value).toBe("major-seventh-box");
      expect(document.querySelectorAll(".inside-block")).toHaveLength(17);
      changeSelect("#note-scale-root-string", "1");
      expect(options("#note-scale-direction")).toContain("lower");
      expect(options("#note-scale-direction")).not.toContain("higher");
      changeSelect("#note-scale-direction", "lower");
      expect(text("#question-sub")).toContain("低音側");
      scaleAnswers().forEach(clickCell);
      expect(text("#score-correct")).toBe("1");
    });

    it("Aナチュラルマイナーとルート弦を選び、半音下げでも同じキーで答えられる", async () => {
      await mountScale();
      changeSelect("#note-scale", "natural-minor:9");
      expect(text("#question-sub")).toContain("A ナチュラルマイナー");
      changeSelect("#note-scale-root-string", "5");
      expect($<HTMLSelectElement>("#note-scale-root-string").value).toBe("5");
      changeSelect("#tuning", "half-down");
      expect(text("#question-sub")).toContain("A ナチュラルマイナー");
      expect(text("#question-sub")).toContain("5弦");
      scaleAnswers().forEach(clickCell);
      expect(text("#score-correct")).toBe("1");
    });

    it("ルートフレットとパターンを直接変更し、1オクターブの8位置だけに絞る", async () => {
      await mountScale();
      changeSelect("#note-scale-root-fret", "20");
      expect(text("#question-sub")).toContain("6弦 20フレット起点");
      changeSelect("#note-scale-pattern", "major-first-octave");
      expect(document.querySelectorAll(".inside-block")).toHaveLength(8);
      expect(text("#question-sub")).toContain("基本の1オクターブ");
      changeSelect("#note-scale-root-fret", "8");
      expect(text("#question-sub")).toContain("6弦 8フレット起点");
      expect($<HTMLSelectElement>("#note-scale-pattern").value).toBe("major-first-octave");
      expect(document.querySelectorAll(".inside-block")).toHaveLength(8);
      scaleAnswers().forEach(clickCell);
      expect(text("#score-correct")).toBe("1");
    });

    it("スケールとナチュラル音の共通部分だけから出題し、正解のない問題を作らない", async () => {
      await mountScale({ range: "natural" });
      changeSelect("#note-scale", "major:1");
      const questions = new Set<string>();
      for (let i = 0; i < 12; i++) {
        questions.add(text("#question-note"));
        const answers = scaleAnswers();
        expect(answers.length).toBeGreaterThan(0);
        answers.forEach(clickCell);
        $<HTMLButtonElement>("#next").click();
      }
      expect(questions).toEqual(new Set(["C", "F"]));
    });

    it("[S-APP-03] スケール設定を復元し、カスタムの範囲は上書きしない", async () => {
      const custom = { firstString: 1, lastString: 4, minFret: 0, maxFret: 5 };
      await mountScale({ noteBlock: custom });
      changeSelect("#note-scale", "natural-minor:9");
      changeSelect("#note-scale-root-string", "5");
      const saved = JSON.parse(localStorage.getItem("guitar-game-settings")!);
      expect(saved.noteBlock).toEqual(custom);
      await mountApp(saved);
      expect($<HTMLSelectElement>("#note-scale").value).toBe("natural-minor:9");
      expect($<HTMLSelectElement>("#note-scale-root-string").value).toBe("5");
      changeSelect("#note-block-source", "custom");
      expect(text("#question-sub")).toContain("1〜4弦 ／ 0〜5フレット");
      expect(document.querySelector(".scale-position-layer")).toBeNull();
      changeSelect("#note-block-source", "scale");
      expect(text("#question-sub")).toContain("A ナチュラルマイナー");
      setBlockEnabled(false);
      expect(document.querySelector(".block-outline")).toBeNull();
      setBlockEnabled(true);
      expect(text("#question-sub")).toContain("A ナチュラルマイナー");
    });

    it("ドロップDで成立しない6弦運指は拒否し、OFFなら使える候補に更新する", async () => {
      await mountScale();
      changeSelect("#tuning", "drop-d");
      expect($<HTMLSelectElement>("#tuning").value).toBe("standard");
      expect(text("#note-block-error")).toContain("ルート弦");
      setBlockEnabled(false);
      changeSelect("#tuning", "drop-d");
      expect($<HTMLSelectElement>("#tuning").value).toBe("drop-d");
      expect(Array.from($<HTMLSelectElement>("#note-scale-root-string").options).map((option) => option.value)).not.toContain("6");
      setBlockEnabled(true);
      scaleAnswers().forEach(clickCell);
      expect(text("#score-correct")).toBe("1");
    });

    it("[S-APP-05] スケール条件変更で自動送りを取り消し、別モードに運指を残さない", async () => {
      await mountScale({ autoNext: true });
      scaleAnswers().forEach(clickCell);
      changeSelect("#note-scale-root-string", "5");
      const question = text("#question-note");
      vi.advanceTimersByTime(2000);
      expect(text("#question-note")).toBe(question);
      switchMode("degree");
      expect(document.querySelector(".scale-position-layer")).toBeNull();
      expect(document.querySelector(".block-outline")).toBeNull();
      switchMode("note");
      expect(document.querySelector(".scale-position-layer")).not.toBeNull();
      expect(text("#question-sub")).toMatch(/0\/\d+か所発見/);
    });

    it("[S-APP-03] 無効な保存値を理由付きで補正する", async () => {
      const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
      await mountScale({ noteScale: { ...DEFAULT_SCALE_SELECTION, patternId: "deleted" } });
      expect(warning).toHaveBeenCalled();
      expect(text("#note-block-error")).toContain("成立するカタログ運指");
      expect($<HTMLSelectElement>("#note-scale-pattern").value).toBe("major-basic-box");
      await mountScale({ noteScale: null });
      expect(text("#note-block-error")).toContain("既定の条件");
      expect(document.querySelectorAll(".inside-block")).toHaveLength(16);
    });

    it.each([
      { tuningId: "standard", patternId: "deleted" },
      { tuningId: "drop-d", patternId: "major-basic-box" },
    ])("[S-APP-03][S-NOTE-10] カスタム使用中も無効な運指を保存・通知する: $tuningId / $patternId", async ({ tuningId, patternId }) => {
      const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
      const noteScale = { ...DEFAULT_SCALE_SELECTION, patternId };
      const custom = { firstString: 1, lastString: 4, minFret: 0, maxFret: 5 };
      await mountScale({ noteBlockSource: "custom", noteBlock: custom, tuningId, noteScale });

      expect(warning).toHaveBeenCalledWith(expect.stringContaining("成立するカタログ運指"));
      expect(text("#note-block-error")).toContain("成立するカタログ運指");
      const saved = JSON.parse(localStorage.getItem("guitar-game-settings")!);
      expect(saved).toMatchObject({ noteBlockSource: "custom", noteBlock: custom, noteScope: "block" });
      expect(saved.noteScale).not.toEqual(noteScale);
      const block = catalogScaleBlocks(getTuning(tuningId), "major", 0)
        .find((entry) => matchesScaleSelection(entry, saved.noteScale));
      expect(block).toBeDefined();

      warning.mockClear();
      await mountApp(saved);
      expect(warning).not.toHaveBeenCalled();
      expect(text("#note-block-error")).toBe("");
      expect(JSON.parse(localStorage.getItem("guitar-game-settings")!).noteScale).toEqual(saved.noteScale);
      changeSelect("#note-block-source", "scale");
      expect($<HTMLSelectElement>("#note-scale-pattern").value).toBe(saved.noteScale.patternId);
      expect($<HTMLSelectElement>("#note-scale-root-string").value).toBe(String(saved.noteScale.rootString));
      expect($<HTMLSelectElement>("#note-scale-root-fret").value).toBe(String(saved.noteScale.rootFret));
      const positions = Array.from(document.querySelectorAll<SVGElement>(".inside-block"))
        .map((cell) => `${cell.dataset.string}:${cell.dataset.fret}`);
      expect(new Set(positions)).toEqual(new Set(block!.positions.map((pos) => `${pos.string}:${pos.fret}`)));
    });

    it("音名表記変更をスケール選択にも反映する", async () => {
      await mountScale();
      changeSelect("#notation", "ja");
      expect($<HTMLSelectElement>("#note-scale").selectedOptions[0].textContent).toBe("ド メジャー");
      changeSelect("#notation", "en");
      changeSelect("#accidental", "flat");
      changeSelect("#note-scale", "major:1");
      expect(text("#question-sub")).toContain("D♭ メジャー");
    });
  });

  it("[S-APP-03] OFFでも指定した範囲を保持し、再起動後に同じ範囲でONに戻せる", async () => {
    const block = { firstString: 2, lastString: 4, minFret: 5, maxFret: 9 };
    await mountApp({ noteScope: "block", noteBlock: block, sound: false });
    expect($<HTMLInputElement>("#note-block-enabled").checked).toBe(true);
    setBlockEnabled(false);
    expect(document.querySelector(".block-outline")).toBeNull();
    expect($<HTMLSelectElement>("#note-first-string").value).toBe("2");
    expect($<HTMLSelectElement>("#note-min-fret").value).toBe("5");
    const saved = JSON.parse(localStorage.getItem("guitar-game-settings")!);
    expect(saved).toMatchObject({ noteScope: "whole", noteBlock: block });
    await mountApp(saved);
    expect($<HTMLInputElement>("#note-block-enabled").checked).toBe(false);
    expect($<HTMLButtonElement>("#apply-note-block").disabled).toBe(true);
    setBlockEnabled(true);
    expect(text("#question-sub")).toContain("2〜4弦 ／ 5〜9フレット");
    expect(document.querySelectorAll(".block-outline")).toHaveLength(1);
    expect(JSON.parse(localStorage.getItem("guitar-game-settings")!)).toMatchObject({
      noteScope: "block", noteBlock: block,
    });
  });

  it("[S-APP-05] ON/OFFで進捗と自動送りを消し、音名クイズのスコアを維持する", async () => {
    await mountG();
    clickCell(currentAnswers()[0]);
    setBlockEnabled(false);
    expect(document.querySelectorAll(".marker")).toHaveLength(0);
    expect(text("#score-asked")).toBe("0");
    answerNoteCorrectly();
    expect(text("#score-correct")).toBe("1");
    setBlockEnabled(true);
    const question = text("#question-note");
    vi.advanceTimersByTime(2000);
    expect(text("#question-note")).toBe(question);
    expect(text("#question-sub")).toMatch(/0\/\d+か所発見/);
    expect(text("#score-correct")).toBe("1");
    currentAnswers().forEach(clickCell);
    setBlockEnabled(false);
    const wholeQuestion = text("#question-note");
    vi.advanceTimersByTime(2000);
    expect(text("#question-note")).toBe(wholeQuestion);
    expect(document.querySelector(".block-outline")).toBeNull();
    expect(text("#score-correct")).toBe("2");
  });

  it("編集中の範囲が無効でもOFFにでき、最後の有効範囲を保存する", async () => {
    await mountG();
    changeSelect("#note-max-fret", "2");
    $<HTMLButtonElement>("#apply-note-block").click();
    expect(text("#note-block-error")).toContain("全12音");
    expect($<HTMLInputElement>("#note-block-enabled").checked).toBe(true);
    setBlockEnabled(false);
    expect($<HTMLInputElement>("#note-block-enabled").checked).toBe(false);
    expect(text("#note-block-error")).toBe("");
    expect(JSON.parse(localStorage.getItem("guitar-game-settings")!)).toMatchObject({
      noteScope: "whole", noteBlock: DEFAULT_NOTE_BLOCK,
    });
    $<HTMLButtonElement>("#apply-note-block").click();
    expect(document.querySelector(".block-outline")).toBeNull();
  });

  it.each([
    DEFAULT_NOTE_BLOCK,
    { firstString: 2, lastString: 4, minFret: 5, maxFret: 9 },
    { firstString: 1, lastString: 1, minFret: 0, maxFret: 11 },
    { firstString: 6, lastString: 6, minFret: 13, maxFret: 24 },
  ])("[S-NOTE-06] ブロック %j の外周だけを1つの枠で囲む", async (block) => {
    await mountApp({ noteScope: "block", noteBlock: block });
    expect(document.querySelectorAll(".block-outline")).toHaveLength(1);
    const outline = $(".block-outline");
    const first = $(`.hit[data-string="${block.firstString}"][data-fret="${block.minFret}"]`);
    const last = $(`.hit[data-string="${block.lastString}"][data-fret="${block.maxFret}"]`);
    const attr = (el: Element, name: string): number => Number(el.getAttribute(name));
    expect(attr(outline, "x")).toBe(attr(first, "x"));
    expect(attr(outline, "y")).toBe(attr(first, "y"));
    expect(attr(outline, "width")).toBe(attr(last, "x") + attr(last, "width") - attr(first, "x"));
    expect(attr(outline, "height")).toBe(attr(last, "y") + attr(last, "height") - attr(first, "y"));
    expect(document.querySelectorAll(".string")).toHaveLength(6);
    expect(document.querySelectorAll(".fret-wire")).toHaveLength(24);

    const style = document.createElement("style");
    style.textContent = appStyles;
    document.head.appendChild(style);
    try {
      const outlineStyle = window.getComputedStyle(outline);
      expect(outlineStyle.fill).toBe("rgba(0, 0, 0, 0)");
      expect(outlineStyle.strokeWidth).toBe("2");
      expect(outlineStyle.pointerEvents).toBe("none");
      for (const cell of document.querySelectorAll(".inside-block")) {
        const cellStyle = window.getComputedStyle(cell);
        expect(cellStyle.stroke).toBe("rgba(0, 0, 0, 0)");
        expect(cellStyle.fill).toBe("rgba(0, 0, 0, 0)");
      }
    } finally {
      style.remove();
    }
  });

  it("[S-NOTE-06] 範囲変更では外枠を置き換え、別モードや指板全体では外す", async () => {
    await mountG();
    const before = $(".block-outline");
    changeSelect("#note-max-fret", "5");
    $<HTMLButtonElement>("#apply-note-block").click();
    expect(document.querySelectorAll(".block-outline")).toHaveLength(1);
    expect($(".block-outline")).not.toBe(before);
    expect(Number($(".block-outline").getAttribute("width"))).toBeGreaterThan(Number(before.getAttribute("width")));
    switchMode("degree");
    expect(document.querySelector(".block-outline")).toBeNull();
    switchMode("chord");
    expect(document.querySelector(".block-outline")).toBeNull();
    switchMode("note");
    expect(document.querySelectorAll(".block-outline")).toHaveLength(1);
    setBlockEnabled(false);
    expect(document.querySelector(".block-outline")).toBeNull();
  });

  it("[S-APP-05] すべて選び終えるまでスコアも自動送りも進まず、完了後900msで進む", async () => {
    await mountG();
    const answers = currentAnswers();
    expect(answers).toHaveLength(2);
    clickCell(answers[0]);
    expect(text("#question-sub")).toContain("1/2か所発見");
    expect(text("#score-asked")).toBe("0");
    expect($<HTMLButtonElement>("#next").disabled).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(text("#question-note")).toBe("G");
    clickCell(answers[0]);
    expect(text("#question-sub")).toContain("1/2か所発見");
    clickCell({ string: 6, fret: 3 });
    expect(text("#feedback")).toContain("ブロック内");
    expect(text("#score-asked")).toBe("0");
    clickCell(answers[1]);
    expect(text("#feedback")).toContain("正解");
    expect(document.querySelectorAll(".marker-correct")).toHaveLength(2);
    expect(text("#score-correct")).toBe("1");
    expect(text("#score-asked")).toBe("1");
    vi.advanceTimersByTime(899);
    expect(text("#feedback")).toContain("正解");
    vi.advanceTimersByTime(1);
    expect(text("#question-note")).not.toBe("G");
    expect(text("#feedback")).toBe("");
    expect(document.querySelectorAll(".marker")).toHaveLength(0);
    expect(text("#question-sub")).toMatch(/0\/\d+か所発見/);
  });

  it("[S-APP-05] 途中で間違えるとブロック内だけに正解を示して停止する", async () => {
    await mountG();
    clickCell(currentAnswers()[0]);
    clickCell({ string: 2, fret: 0 });
    expect(text("#feedback")).toContain("残念");
    expect(text("#score-asked")).toBe("1");
    expect(text("#score-correct")).toBe("0");
    expect(document.querySelectorAll(".marker-correct")).toHaveLength(1);
    expect(document.querySelectorAll(".marker-answer")).toHaveLength(1);
    expect(document.querySelectorAll(".marker-wrong")).toHaveLength(1);
    vi.advanceTimersByTime(5000);
    expect(text("#question-note")).toBe("G");
    clickCell(currentAnswers()[1]);
    expect(text("#score-asked")).toBe("1");
  });

  it("[S-APP-05] 自動送りOFFなら完了後も待ち、次の問題ボタンで進める", async () => {
    await mountG({ autoNext: false });
    currentAnswers().forEach(clickCell);
    vi.advanceTimersByTime(5000);
    expect(text("#question-note")).toBe("G");
    expect(document.activeElement).toBe($("#next"));
    $<HTMLButtonElement>("#next").click();
    expect(text("#question-note")).not.toBe("G");
  });

  it("編集途中は適用せず、不足・逆順の範囲は理由を出して問題と保存値を保つ", async () => {
    await mountG();
    clickCell(currentAnswers()[0]);
    changeSelect("#note-max-fret", "2");
    expect(text("#question-sub")).toContain("1/2か所発見");
    const saved = localStorage.getItem("guitar-game-settings");
    $<HTMLButtonElement>("#apply-note-block").click();
    expect(text("#note-block-error")).toContain("全12音");
    expect(text("#question-sub")).toContain("1/2か所発見");
    expect(localStorage.getItem("guitar-game-settings")).toBe(saved);
    changeSelect("#note-min-fret", "3");
    $<HTMLButtonElement>("#apply-note-block").click();
    expect(text("#note-block-error")).toContain("フレット");
    expect(document.querySelectorAll(".inside-block")).toHaveLength(15);
  });

  it("[S-APP-03] 有効なブロックを適用すると進捗を消し、再起動後も復元する", async () => {
    await mountG();
    clickCell(currentAnswers()[0]);
    changeSelect("#note-last-string", "4");
    changeSelect("#note-max-fret", "5");
    $<HTMLButtonElement>("#apply-note-block").click();
    expect(text("#note-block-error")).toBe("");
    expect(document.querySelectorAll(".inside-block")).toHaveLength(24);
    expect(document.querySelectorAll(".marker")).toHaveLength(0);
    const saved = JSON.parse(localStorage.getItem("guitar-game-settings")!);
    expect(saved.noteBlock).toEqual({ firstString: 1, lastString: 4, minFret: 0, maxFret: 5 });
    await mountApp(saved);
    expect(text("#question-sub")).toContain("1〜4弦 ／ 0〜5フレット");
    expect($<HTMLSelectElement>("#note-last-string").value).toBe("4");
    expect($<HTMLSelectElement>("#note-max-fret").value).toBe("5");
  });

  it("練習ラベルもブロック内だけに表示し、別モードや指板全体では制限を外す", async () => {
    await mountG({ showAllNames: true });
    expect(document.querySelectorAll(".note-name.ghost")).toHaveLength(15);
    clickCell(currentAnswers()[0]);
    expect(document.querySelectorAll(".note-name.ghost")).toHaveLength(14);
    switchMode("degree");
    expect(document.querySelectorAll(".outside-block")).toHaveLength(0);
    switchMode("note");
    expect(document.querySelectorAll(".marker")).toHaveLength(0);
    expect(document.querySelectorAll(".inside-block")).toHaveLength(15);
    setBlockEnabled(false);
    expect(document.querySelectorAll(".outside-block")).toHaveLength(0);
    expect(document.querySelectorAll(".note-name.ghost")).toHaveLength(150);
    answerNoteCorrectly();
    expect(text("#score-correct")).toBe("1");
  });

  it("[S-APP-05] ブロック変更で予約済みの自動送りを取り消す", async () => {
    await mountG();
    currentAnswers().forEach(clickCell);
    vi.advanceTimersByTime(400);
    changeSelect("#note-max-fret", "5");
    $<HTMLButtonElement>("#apply-note-block").click();
    const next = text("#question-note");
    vi.advanceTimersByTime(2000);
    expect(text("#question-note")).toBe(next);
    expect(text("#question-sub")).toMatch(/0\/\d+か所発見/);
  });

  it("チューニング変更で正解位置と進捗を更新する", async () => {
    await mountG();
    clickCell(currentAnswers()[0]);
    changeSelect("#tuning", "half-down");
    expect(document.querySelectorAll(".marker")).toHaveLength(0);
    const answers = currentAnswers(DEFAULT_NOTE_BLOCK, "half-down");
    expect(answers.length).toBeGreaterThan(0);
    expect(answers.every((pos) => isInNoteBlock(pos, DEFAULT_NOTE_BLOCK))).toBe(true);
    answers.forEach(clickCell);
    expect(text("#score-correct")).toBe("1");
  });

  it("使用中のブロックで全12音がそろわなくなるチューニング変更は拒否する", async () => {
    const block = { firstString: 4, lastString: 6, minFret: 0, maxFret: 4 };
    await mountApp({ noteScope: "block", noteBlock: block, sound: false });
    const question = text("#question-note");
    const saved = localStorage.getItem("guitar-game-settings");
    changeSelect("#tuning", "drop-d");
    expect($<HTMLSelectElement>("#tuning").value).toBe("standard");
    expect(text("#note-block-error")).toContain("全12音");
    expect(text("#question-note")).toBe(question);
    expect(localStorage.getItem("guitar-game-settings")).toBe(saved);
    currentAnswers(block).forEach(clickCell);
    expect(text("#score-correct")).toBe("1");
  });

  it("無効なブロックで方式を切り替えても、編集して再適用できる", async () => {
    await mountApp({ sound: false });
    changeSelect("#note-max-fret", "2");
    setBlockEnabled(true);
    expect($<HTMLInputElement>("#note-block-enabled").checked).toBe(false);
    expect($<HTMLButtonElement>("#apply-note-block").disabled).toBe(true);
    expect(text("#note-block-error")).toContain("全12音");
    expect(document.querySelectorAll(".inside-block")).toHaveLength(0);
    changeSelect("#note-max-fret", "4");
    setBlockEnabled(true);
    expect($<HTMLInputElement>("#note-block-enabled").checked).toBe(true);
    expect(text("#note-block-error")).toBe("");
    expect(document.querySelectorAll(".inside-block")).toHaveLength(15);
  });

  it("スコアリセットと出題範囲の変更で途中の選択を消す", async () => {
    await mountG();
    clickCell(currentAnswers()[0]);
    $<HTMLButtonElement>("#reset").click();
    expect(document.querySelectorAll(".marker")).toHaveLength(0);
    expect(text("#score-asked")).toBe("0");
    clickCell(currentAnswers()[0]);
    changeSelect("#range", "natural");
    expect(document.querySelectorAll(".marker")).toHaveLength(0);
    expect(["C", "D", "E", "F", "G", "A", "B"]).toContain(text("#question-note"));
    vi.advanceTimersByTime(1000);
    expect(text("#question-sub")).toMatch(/0\/\d+か所発見/);
  });

  it("[S-APP-05] 別モードへ移るとブロックの自動送りも破棄する", async () => {
    await mountG();
    currentAnswers().forEach(clickCell);
    switchMode("degree");
    const question = text("#question-note");
    vi.advanceTimersByTime(2000);
    expect(text("#question-note")).toBe(question);
    expect(document.querySelectorAll(".marker-root")).toHaveLength(1);
    switchMode("note");
    expect(document.querySelectorAll(".marker")).toHaveLength(0);
    expect(text("#score-correct")).toBe("1");
  });

  it("[S-APP-03] 保存済み回答範囲が無効なら指板全体へ補正する", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    await mountApp({ noteScope: "invalid" });
    expect(warning).toHaveBeenCalled();
    expect($<HTMLInputElement>("#note-block-enabled").checked).toBe(false);
    expect(text("#note-block-error")).toContain("指板全体に戻しました");
    expect(JSON.parse(localStorage.getItem("guitar-game-settings")!).noteScope).toBe("whole");
  });

  it("[S-APP-03] 無効な保存済みブロックを理由付きで既定に補正する", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    await mountApp({ noteScope: "block", noteBlock: null });
    expect(warning).toHaveBeenCalled();
    expect(text("#note-block-error")).toContain("戻しました");
    expect(document.querySelectorAll(".inside-block")).toHaveLength(15);
    expect(JSON.parse(localStorage.getItem("guitar-game-settings")!).noteBlock).toEqual(DEFAULT_NOTE_BLOCK);
  });
});

describe("[S-APP-01] 画面の初期表示", () => {
  beforeEach(async () => {
    await mountApp();
  });

  it("音名クイズの設定を指定順の4行に分け、行間だけを控えめな横線で区切る", () => {
    const style = document.createElement("style");
    style.textContent = appStyles;
    document.head.appendChild(style);
    try {
      const rows = Array.from(document.querySelectorAll<HTMLElement>(".controls > .control-row"));
      expect(rows.map((row) => row.getAttribute("aria-label"))).toEqual([
        "出題条件", "ブロック範囲", "サウンド", "練習設定",
      ]);
      const visible = (element: Element): boolean => {
        for (let current: Element | null = element; current; current = current.parentElement) {
          if (window.getComputedStyle(current).display === "none") return false;
        }
        return true;
      };
      expect(rows.map((row) => Array.from(row.querySelectorAll("input, select, button"))
        .filter(visible).map((control) => control.id))).toEqual([
        ["notation", "range", "accidental", "tuning"],
        ["note-block-enabled", "note-block-source", "note-first-string", "note-last-string", "note-min-fret", "note-max-fret", "apply-note-block"],
        ["sound", "tone", "volume"],
        ["auto-next", "show-names"],
      ]);
      expect($("#note-block-error").closest(".control-row")).toBe(rows[1]);
      expect(window.getComputedStyle($(".controls")).flexDirection).toBe("column");
      for (const [index, row] of rows.entries()) {
        const rowStyle = window.getComputedStyle(row);
        expect(rowStyle.display).toBe("flex");
        expect(rowStyle.flexWrap).toBe("wrap");
        if (index > 0) {
          expect(rowStyle.borderTopWidth).toBe("1px");
          expect(rowStyle.borderTopStyle).toBe("solid");
          expect(rowStyle.borderTopColor).toBe("rgba(148, 160, 180, 0.2)");
        } else {
          expect(rowStyle.borderTopStyle).not.toBe("solid");
        }
      }
      for (const mode of ["degree", "chord"] as const) {
        switchMode(mode);
        expect(rows.filter(visible).map((row) => row.getAttribute("aria-label"))).toEqual([
          "出題条件", "サウンド", "練習設定",
        ]);
        expect(document.querySelectorAll("#tuning")).toHaveLength(1);
        expect(visible($("#tuning"))).toBe(true);
        expect(visible($("#note-block-enabled"))).toBe(false);
        expect(visible($("#sound"))).toBe(true);
        expect(visible($("#auto-next"))).toBe(true);
      }
      switchMode("note");
      expect(rows.filter(visible)).toHaveLength(4);
    } finally {
      style.remove();
    }
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
