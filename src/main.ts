import "./style.css";
import { getTonePreset, GuitarSynth, TONE_PRESETS } from "./core/audio";
import {
  DEGREE_GROUPS,
  degreeLabel,
  getDegree,
  type DegreeGroup,
  type DegreeStyle,
} from "./core/degrees";
import { midiAt, type Position } from "./core/fretboard";
import { noteName, type AccidentalStyle, type NotationMode } from "./core/notes";
import { getTuning, TUNINGS, type Tuning } from "./core/tuning";
import { DegreeQuiz, ROOT_MAX_FRET, type AnswerScope, type RootMode } from "./ui/DegreeQuiz";
import { Fretboard, type Marker } from "./ui/Fretboard";
import { Quiz, type QuestionRange } from "./ui/Quiz";

const STORAGE_KEY = "guitar-game-settings";

/** 出題タイプ */
type GameMode = "note" | "degree";

interface Settings {
  mode: GameMode;
  notation: NotationMode;
  accidental: AccidentalStyle;
  tuningId: string;
  range: QuestionRange;
  degreeGroup: DegreeGroup;
  degreeStyle: DegreeStyle;
  answerScope: AnswerScope;
  rootStrings: number[];
  rootMode: RootMode;
  rootPitchClass: number;
  rootPosition: { string: number; fret: number };
  showAllNames: boolean;
  autoNext: boolean;
  sound: boolean;
  volume: number;
  toneId: string;
}

function loadSettings(): Settings {
  const fallback: Settings = {
    mode: "note",
    notation: "en",
    accidental: "sharp",
    tuningId: "standard",
    range: "natural",
    degreeGroup: "chord-tone",
    degreeStyle: "roman",
    answerScope: "near-root",
    rootStrings: [6, 5],
    rootMode: "random",
    rootPitchClass: 0,
    rootPosition: { string: 6, fret: 5 },
    showAllNames: false,
    autoNext: true,
    sound: true,
    volume: 0.5,
    toneId: "acoustic",
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return fallback;
  }
}

function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

const settings = loadSettings();
let tuning: Tuning = getTuning(settings.tuningId);

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
  <header class="topbar">
    <h1>🎸 ギター指板トレーニング</h1>

    <div class="mode-tabs" role="tablist">
      <button class="mode-tab" data-mode="note" role="tab">🎵 音名クイズ</button>
      <button class="mode-tab" data-mode="degree" role="tab">🎯 度数クイズ</button>
    </div>

    <div class="controls">
      <label class="control mode-note">
        <span>音名表記</span>
        <select id="notation">
          <option value="en">C D E F G A B</option>
          <option value="ja">ド レ ミ ファ ソ ラ シ</option>
        </select>
      </label>
      <label class="control mode-note">
        <span>出題範囲</span>
        <select id="range">
          <option value="natural">ナチュラル音のみ (7音)</option>
          <option value="all">♯/♭を含む全12音</option>
        </select>
      </label>
      <label class="control mode-note">
        <span>♯/♭の表記</span>
        <select id="accidental">
          <option value="sharp">シャープ (C♯)</option>
          <option value="flat">フラット (D♭)</option>
          <option value="both">両方 (C♯/D♭)</option>
        </select>
      </label>

      <label class="control mode-degree">
        <span>出題する度数</span>
        <select id="degree-group"></select>
      </label>
      <label class="control mode-degree">
        <span>度数の表記</span>
        <select id="degree-style">
          <option value="roman">ローマ数字 (♭III)</option>
          <option value="quality">音程名 (m3)</option>
        </select>
      </label>
      <label class="control mode-degree">
        <span>回答できる範囲</span>
        <select id="answer-scope">
          <option value="near-root">ルート周辺 (±4フレット)</option>
          <option value="whole">指板全体</option>
        </select>
      </label>

      <label class="control mode-degree">
        <span>ルートの決め方</span>
        <select id="root-mode">
          <option value="random">毎問ランダム</option>
          <option value="fixed-pitch">ルート音を固定（位置は変わる）</option>
          <option value="fixed-position">ルート位置を固定</option>
        </select>
      </label>
      <label class="control mode-degree root-fixed-pitch">
        <span>ルート音</span>
        <select id="root-pitch"></select>
      </label>
      <label class="control mode-degree root-fixed-position">
        <span>ルートの弦</span>
        <select id="root-pos-string">
          <option value="1">1弦</option>
          <option value="2">2弦</option>
          <option value="3">3弦</option>
          <option value="4">4弦</option>
          <option value="5">5弦</option>
          <option value="6">6弦</option>
        </select>
      </label>
      <label class="control mode-degree root-fixed-position">
        <span>ルートのフレット</span>
        <select id="root-pos-fret"></select>
      </label>

      <div class="control mode-degree root-random-strings">
        <span>ルートの弦</span>
        <div class="string-picker" id="root-strings">
          <label><input type="checkbox" value="1" /><span>1弦</span></label>
          <label><input type="checkbox" value="2" /><span>2弦</span></label>
          <label><input type="checkbox" value="3" /><span>3弦</span></label>
          <label><input type="checkbox" value="4" /><span>4弦</span></label>
          <label><input type="checkbox" value="5" /><span>5弦</span></label>
          <label><input type="checkbox" value="6" /><span>6弦</span></label>
        </div>
      </div>

      <label class="control">
        <span>チューニング</span>
        <select id="tuning"></select>
      </label>
      <label class="control checkbox">
        <input type="checkbox" id="sound" />
        <span>クリックで音を鳴らす</span>
      </label>
      <label class="control">
        <span>音色</span>
        <select id="tone"></select>
      </label>
      <label class="control">
        <span>音量</span>
        <input type="range" id="volume" min="0" max="100" step="1" />
      </label>
      <label class="control checkbox">
        <input type="checkbox" id="auto-next" />
        <span>正解したら自動で次へ</span>
      </label>
      <label class="control checkbox">
        <input type="checkbox" id="show-names" />
        <span id="show-names-label">音名を表示（練習モード）</span>
      </label>
    </div>
  </header>

  <section class="question-panel">
    <div class="question-block">
      <p class="question-label" id="question-label">この音はどこ？</p>
      <p class="question-note" id="question-note">-</p>
      <p class="question-sub" id="question-sub"></p>
    </div>
    <div class="feedback" id="feedback"></div>
    <div class="actions">
      <button id="next" class="primary" disabled>次の問題 →</button>
      <button id="reset" class="ghost-btn">スコアをリセット</button>
    </div>
  </section>

  <section id="board-slot"></section>

  <section class="score-panel">
    <div class="score-item"><span class="score-label">正解</span><span id="score-correct">0</span></div>
    <div class="score-item"><span class="score-label">出題</span><span id="score-asked">0</span></div>
    <div class="score-item"><span class="score-label">正答率</span><span id="score-rate">-</span></div>
    <div class="score-item"><span class="score-label">連続正解</span><span id="score-combo">0</span></div>
    <div class="score-item"><span class="score-label">最高連続</span><span id="score-best">0</span></div>
  </section>

  <footer class="hint" id="hint"></footer>
`;

const $ = <T extends Element>(sel: string): T => document.querySelector<T>(sel)!;

const notationSelect = $<HTMLSelectElement>("#notation");
const rangeSelect = $<HTMLSelectElement>("#range");
const accidentalSelect = $<HTMLSelectElement>("#accidental");
const degreeGroupSelect = $<HTMLSelectElement>("#degree-group");
const degreeStyleSelect = $<HTMLSelectElement>("#degree-style");
const answerScopeSelect = $<HTMLSelectElement>("#answer-scope");
const rootStringInputs = Array.from(
  document.querySelectorAll<HTMLInputElement>("#root-strings input"),
);
const rootModeSelect = $<HTMLSelectElement>("#root-mode");
const rootPitchSelect = $<HTMLSelectElement>("#root-pitch");
const rootPosStringSelect = $<HTMLSelectElement>("#root-pos-string");
const rootPosFretSelect = $<HTMLSelectElement>("#root-pos-fret");
const tuningSelect = $<HTMLSelectElement>("#tuning");
const toneSelect = $<HTMLSelectElement>("#tone");
const soundCheckbox = $<HTMLInputElement>("#sound");
const volumeSlider = $<HTMLInputElement>("#volume");
const autoNextCheckbox = $<HTMLInputElement>("#auto-next");
const showNamesCheckbox = $<HTMLInputElement>("#show-names");
const showNamesLabel = $<HTMLSpanElement>("#show-names-label");
const questionLabel = $<HTMLParagraphElement>("#question-label");
const questionNote = $<HTMLParagraphElement>("#question-note");
const questionSub = $<HTMLParagraphElement>("#question-sub");
const feedback = $<HTMLDivElement>("#feedback");
const nextButton = $<HTMLButtonElement>("#next");
const resetButton = $<HTMLButtonElement>("#reset");
const boardSlot = $<HTMLElement>("#board-slot");
const hint = $<HTMLElement>("#hint");
const modeTabs = Array.from(document.querySelectorAll<HTMLButtonElement>(".mode-tab"));

for (const t of TUNINGS) {
  tuningSelect.appendChild(new Option(t.label, t.id));
}
for (const t of TONE_PRESETS) {
  toneSelect.appendChild(new Option(t.label, t.id));
}
for (const g of DEGREE_GROUPS) {
  degreeGroupSelect.appendChild(new Option(g.label, g.id));
}

for (let f = 0; f <= ROOT_MAX_FRET; f++) {
  rootPosFretSelect.appendChild(new Option(`${f}フレット`, String(f)));
}

// 旧バージョンの保存値が残っていた場合に補正する
if (!DEGREE_GROUPS.some((g) => g.id === settings.degreeGroup)) {
  settings.degreeGroup = "chord-tone";
  saveSettings(settings);
}

notationSelect.value = settings.notation;
rangeSelect.value = settings.range;
accidentalSelect.value = settings.accidental;
degreeGroupSelect.value = settings.degreeGroup;
degreeStyleSelect.value = settings.degreeStyle;
answerScopeSelect.value = settings.answerScope;
rootModeSelect.value = settings.rootMode;
refreshRootPitchOptions();
rootPosStringSelect.value = String(settings.rootPosition.string);
rootPosFretSelect.value = String(settings.rootPosition.fret);
for (const input of rootStringInputs) {
  input.checked = settings.rootStrings.includes(Number(input.value));
}
tuningSelect.value = tuning.id;
toneSelect.value = getTonePreset(settings.toneId).id;
soundCheckbox.checked = settings.sound;
volumeSlider.value = String(Math.round(settings.volume * 100));
autoNextCheckbox.checked = settings.autoNext;
showNamesCheckbox.checked = settings.showAllNames;

const synth = new GuitarSynth();
synth.setEnabled(settings.sound);
synth.setVolume(settings.volume);
synth.setPreset(getTonePreset(settings.toneId));

const noteQuiz = new Quiz(tuning, settings.range);
const degreeQuiz = new DegreeQuiz(tuning, settings.degreeGroup, settings.answerScope, {
  mode: settings.rootMode,
  pitchClass: settings.rootPitchClass,
  position: settings.rootPosition,
  strings: settings.rootStrings,
});

const fretboard = new Fretboard({
  tuning,
  notation: settings.notation,
  accidental: settings.accidental,
  onSelect: handleSelect,
});
boardSlot.appendChild(fretboard.element);

const AUTO_NEXT_DELAY = 900;
let autoNextTimer: number | null = null;
let answerSoundTimer: number | null = null;

function cancelTimers(): void {
  if (autoNextTimer !== null) {
    clearTimeout(autoNextTimer);
    autoNextTimer = null;
  }
  if (answerSoundTimer !== null) {
    clearTimeout(answerSoundTimer);
    answerSoundTimer = null;
  }
}

function noteLabel(pc: number): string {
  return noteName(pc, settings.notation, settings.accidental);
}

function degLabel(interval: number): string {
  return degreeLabel(interval, settings.degreeStyle);
}

/** ルート音セレクトを現在の音名表記で作り直す */
function refreshRootPitchOptions(): void {
  const current = rootPitchSelect.value || String(settings.rootPitchClass);
  rootPitchSelect.replaceChildren();
  for (let pc = 0; pc < 12; pc++) {
    rootPitchSelect.appendChild(new Option(noteLabel(pc), String(pc)));
  }
  rootPitchSelect.value = current;
}

/** ルートの決め方に応じて関連コントロールの表示を切り替える */
function refreshRootControls(): void {
  app.classList.toggle("root-random", settings.rootMode === "random");
  app.classList.toggle("root-pitch", settings.rootMode === "fixed-pitch");
  app.classList.toggle("root-position", settings.rootMode === "fixed-position");
}

const isDegreeMode = (): boolean => settings.mode === "degree";
const isAnswered = (): boolean =>
  isDegreeMode() ? degreeQuiz.isAnswered : noteQuiz.isAnswered;

/** クリック位置に最も近い正解ポジション */
function nearestAnswer(answers: Position[], from: Position): Position {
  const dist = (p: Position) =>
    Math.abs(p.fret - from.fret) + Math.abs(p.string - from.string) * 2;
  return answers.reduce((best, cur) => (dist(cur) < dist(best) ? cur : best));
}

function handleSelect(pos: Position): void {
  synth.play(midiAt(tuning, pos));
  if (isAnswered()) return;

  const markers: Marker[] = [];
  let correct: boolean;
  let answers: Position[];

  if (isDegreeMode()) {
    const root = degreeQuiz.state.root;
    const result = degreeQuiz.judge(pos);
    correct = result.correct;
    answers = result.answers;

    markers.push({ pos: root, kind: "root", text: "R" });
    if (correct) {
      markers.push({ pos, kind: "correct", text: degLabel(result.pickedInterval) });
      feedback.textContent = "正解！ 🎉";
      feedback.className = "feedback correct";
    } else {
      const target = degreeQuiz.state.interval;
      const isSameDegree = result.pickedInterval === target;
      markers.push({ pos, kind: "wrong", text: degLabel(result.pickedInterval) });
      for (const a of answers) {
        if (a.string === root.string && a.fret === root.fret) continue;
        markers.push({ pos: a, kind: "answer", text: degLabel(target) });
      }
      feedback.textContent = isSameDegree
        ? `度数は合っています！ ただし今は「ルート周辺（±4フレット）」が回答範囲です。`
        : `残念… そこは ${degLabel(result.pickedInterval)} です。${degLabel(
            target,
          )} は緑の位置。`;
      feedback.className = "feedback wrong";
    }
  } else {
    const result = noteQuiz.judge(pos);
    correct = result.correct;
    answers = result.answers;

    if (correct) {
      markers.push({ pos, kind: "correct" });
      feedback.textContent = "正解！ 🎉";
      feedback.className = "feedback correct";
    } else {
      markers.push({ pos, kind: "wrong" });
      for (const a of answers) markers.push({ pos: a, kind: "answer" });
      feedback.textContent = `残念… そこは ${noteLabel(result.pickedPitchClass)} です。${noteLabel(
        noteQuiz.state.question,
      )} は緑の位置。`;
      feedback.className = "feedback wrong";
    }
  }

  fretboard.setMarkers(markers);
  nextButton.disabled = false;
  updateScore();

  if (!correct && answers.length > 0) {
    // 正解の音を聴かせる
    const target = nearestAnswer(answers, pos);
    answerSoundTimer = window.setTimeout(() => {
      answerSoundTimer = null;
      synth.play(midiAt(tuning, target));
    }, 550);
  }

  if (correct && settings.autoNext) {
    cancelTimers();
    autoNextTimer = window.setTimeout(() => {
      autoNextTimer = null;
      nextQuestion();
    }, AUTO_NEXT_DELAY);
  } else {
    nextButton.focus();
  }
}

function nextQuestion(): void {
  cancelTimers();
  if (isDegreeMode()) degreeQuiz.next();
  else noteQuiz.next();
  feedback.textContent = "";
  feedback.className = "feedback";
  nextButton.disabled = true;
  refreshBoard();
  updateQuestion();
}

/** 現在の問題に応じた常設マーカー(ルート)とゴーストラベルを更新 */
function refreshBoard(): void {
  if (isDegreeMode()) {
    const root = degreeQuiz.state.root;
    fretboard.setMarkers([{ pos: root, kind: "root", text: "R" }]);
    fretboard.setGhostLabel((pos) => {
      if (pos.string === root.string && pos.fret === root.fret) return null;
      return degLabel(degreeQuiz.intervalOf(pos));
    });
  } else {
    fretboard.clearMarkers();
    fretboard.setGhostLabel(null);
  }
  fretboard.setShowAllNames(settings.showAllNames);
}

function updateQuestion(): void {
  if (isDegreeMode()) {
    const s = degreeQuiz.state;
    const d = getDegree(s.interval);
    questionLabel.textContent = "R（青）から見て、この度数はどこ？";
    questionNote.textContent = degLabel(s.interval);
    questionSub.textContent = `${d.reading} ／ ルート = ${noteLabel(s.rootPitchClass)}（${
      s.root.string
    }弦 ${s.root.fret}フレット）`;
  } else {
    questionLabel.textContent = "この音はどこ？";
    questionNote.textContent = noteLabel(noteQuiz.state.question);
    questionSub.textContent = "";
  }
}

function updateScore(): void {
  const s = isDegreeMode() ? degreeQuiz.state : noteQuiz.state;
  $("#score-correct").textContent = String(s.correct);
  $("#score-asked").textContent = String(s.asked);
  $("#score-rate").textContent =
    s.asked === 0 ? "-" : `${Math.round((s.correct / s.asked) * 100)}%`;
  $("#score-combo").textContent = String(s.combo);
  $("#score-best").textContent = String(s.bestCombo);
}

function applyMode(): void {
  const degree = isDegreeMode();
  app.classList.toggle("is-degree", degree);
  app.classList.toggle("is-note", !degree);
  for (const tab of modeTabs) {
    tab.classList.toggle("active", tab.dataset.mode === settings.mode);
    tab.setAttribute("aria-selected", String(tab.dataset.mode === settings.mode));
  }
  showNamesLabel.textContent = degree
    ? "度数を表示（練習モード）"
    : "音名を表示（練習モード）";
  hint.textContent = degree
    ? "青い R がルートです。指板をクリックして指定された度数の位置を答えてください。"
    : "1弦が上・6弦が下、左が0フレット（開放弦）、右が24フレットです。回答後も指板をクリックすると音を確認できます。";

  cancelTimers();
  feedback.textContent = "";
  feedback.className = "feedback";
  nextButton.disabled = true;
  refreshRootControls();
  refreshBoard();
  updateQuestion();
  updateScore();
}

/* ---------- イベント ---------- */

for (const tab of modeTabs) {
  tab.addEventListener("click", () => {
    const mode = tab.dataset.mode as GameMode;
    if (mode === settings.mode) return;
    settings.mode = mode;
    saveSettings(settings);
    applyMode();
  });
}

notationSelect.addEventListener("change", () => {
  settings.notation = notationSelect.value as NotationMode;
  saveSettings(settings);
  fretboard.setNotation(settings.notation);
  refreshRootPitchOptions();
  updateQuestion();
});

rangeSelect.addEventListener("change", () => {
  settings.range = rangeSelect.value as QuestionRange;
  saveSettings(settings);
  noteQuiz.setRange(settings.range);
  nextQuestion();
});

accidentalSelect.addEventListener("change", () => {
  settings.accidental = accidentalSelect.value as AccidentalStyle;
  saveSettings(settings);
  fretboard.setAccidental(settings.accidental);
  refreshRootPitchOptions();
  updateQuestion();
});

degreeGroupSelect.addEventListener("change", () => {
  settings.degreeGroup = degreeGroupSelect.value as DegreeGroup;
  saveSettings(settings);
  degreeQuiz.setGroup(settings.degreeGroup);
  nextQuestion();
});

degreeStyleSelect.addEventListener("change", () => {
  settings.degreeStyle = degreeStyleSelect.value as DegreeStyle;
  saveSettings(settings);
  refreshBoard();
  updateQuestion();
});

answerScopeSelect.addEventListener("change", () => {
  settings.answerScope = answerScopeSelect.value as AnswerScope;
  saveSettings(settings);
  degreeQuiz.setScope(settings.answerScope);
  nextQuestion();
});

rootModeSelect.addEventListener("change", () => {
  settings.rootMode = rootModeSelect.value as RootMode;
  saveSettings(settings);
  refreshRootControls();
  degreeQuiz.setRootConfig({ mode: settings.rootMode });
  nextQuestion();
});

rootPitchSelect.addEventListener("change", () => {
  settings.rootPitchClass = Number(rootPitchSelect.value);
  saveSettings(settings);
  degreeQuiz.setRootConfig({ pitchClass: settings.rootPitchClass });
  nextQuestion();
});

function applyFixedPosition(): void {
  settings.rootPosition = {
    string: Number(rootPosStringSelect.value),
    fret: Number(rootPosFretSelect.value),
  };
  saveSettings(settings);
  degreeQuiz.setRootConfig({ position: settings.rootPosition });
  nextQuestion();
}

rootPosStringSelect.addEventListener("change", applyFixedPosition);
rootPosFretSelect.addEventListener("change", applyFixedPosition);

for (const input of rootStringInputs) {
  input.addEventListener("change", () => {
    const selected = rootStringInputs.filter((i) => i.checked).map((i) => Number(i.value));
    if (selected.length === 0) {
      // 最低1本は必要なので取り消す
      input.checked = true;
      return;
    }
    settings.rootStrings = selected;
    saveSettings(settings);
    degreeQuiz.setRootStrings(selected);
    nextQuestion();
  });
}

tuningSelect.addEventListener("change", () => {
  tuning = getTuning(tuningSelect.value);
  settings.tuningId = tuning.id;
  saveSettings(settings);
  noteQuiz.setTuning(tuning);
  degreeQuiz.setTuning(tuning);
  fretboard.setTuning(tuning);
  nextQuestion();
});

soundCheckbox.addEventListener("change", () => {
  settings.sound = soundCheckbox.checked;
  saveSettings(settings);
  synth.setEnabled(settings.sound);
});

toneSelect.addEventListener("change", () => {
  settings.toneId = toneSelect.value;
  saveSettings(settings);
  synth.setPreset(getTonePreset(settings.toneId));
  synth.play(midiAt(tuning, { string: 3, fret: 0 }));
});

volumeSlider.addEventListener("input", () => {
  settings.volume = Number(volumeSlider.value) / 100;
  synth.setVolume(settings.volume);
});
volumeSlider.addEventListener("change", () => saveSettings(settings));

autoNextCheckbox.addEventListener("change", () => {
  settings.autoNext = autoNextCheckbox.checked;
  saveSettings(settings);
  if (!settings.autoNext) cancelTimers();
});

showNamesCheckbox.addEventListener("change", () => {
  settings.showAllNames = showNamesCheckbox.checked;
  saveSettings(settings);
  fretboard.setShowAllNames(settings.showAllNames);
});

nextButton.addEventListener("click", nextQuestion);

resetButton.addEventListener("click", () => {
  cancelTimers();
  if (isDegreeMode()) degreeQuiz.reset();
  else noteQuiz.reset();
  feedback.textContent = "";
  feedback.className = "feedback";
  nextButton.disabled = true;
  refreshBoard();
  updateQuestion();
  updateScore();
});

document.addEventListener("keydown", (e) => {
  if ((e.key === "Enter" || e.key === " ") && !nextButton.disabled) {
    e.preventDefault();
    nextQuestion();
  }
});

applyMode();
