import {
  catalogChordShapes,
  catalogInversions,
  catalogQualities,
  catalogRootStrings,
} from "../core/catalogShapes";
import {
  getChordQuality,
  getVoicing,
  samePositionSet,
  type ChordQuality,
  type ChordShape,
  type VoicingType,
} from "../core/chords";
import { pitchClassAt, STRING_COUNT, type Position } from "../core/fretboard";
import type { PitchClass } from "../core/notes";
import type { Tuning } from "../core/tuning";

/** ルートを配置するフレットの上限 */
export const CHORD_ROOT_MAX_FRET = 12;
/** 低いフレットでシェイプが作れない場合に、ここまでは上を探す */
const CHORD_ROOT_FALLBACK_FRET = 17;
/** ルート弦として選べる弦（低音弦から） */
export const CHORD_ROOT_STRINGS = [6, 5, 4, 3, 2, 1];

export interface ChordQuizConfig {
  voicing: VoicingType;
  qualityIds: string[];
  rootStrings: number[];
  /** 出題する転回形（0=基本形）。既定は基本形のみ */
  inversions: number[];
  /**
   * 転回形を複数選んだときの出題のしかた。
   * true なら選んだ転回形をすべて連続で出題し、false なら1問ごとに1つだけ選ぶ。
   */
  askAllInversions: boolean;
  /** ルートをあらかじめ指板に表示するか */
  showRoot: boolean;
}

/** 1つのコードに対する、ルート弦ごと（連続出題時は転回形の数だけ繰り返す）の小問 */
export interface ChordStep {
  rootString: number;
  /** この小問で答えられる転回形の候補。回答済みのものを除く前の全候補 */
  inversions: number[];
  root: Position;
  /** 正解として受理するシェイプ（候補の全転回形を含む） */
  shapes: ChordShape[];
  /** 表示用の代表シェイプ */
  shape: ChordShape;
}

export interface ChordQuestion {
  quality: ChordQuality;
  rootPitchClass: PitchClass;
  /** 小問。ルート弦は低音弦から順。連続出題時は同じ弦が転回形の数だけ続く */
  steps: ChordStep[];
}

export interface ChordJudgement {
  correct: boolean;
  /** ユーザーが選んだ位置のうち間違っていたもの */
  wrong: Position[];
  /** 判定に用いたシェイプ（正解ならユーザーが押さえたもの、不正解なら最も近いもの） */
  shape: ChordShape;
  /** 正解したときに、まだ答えていない転回形 */
  remainingInversions: number[];
  /** この小問が最後かどうか */
  isLastStep: boolean;
}

export interface ChordQuizState {
  quality: ChordQuality;
  rootPitchClass: PitchClass;
  step: ChordStep;
  stepIndex: number;
  stepCount: number;
  /** 現在の小問の代表シェイプ */
  shape: ChordShape;
  /** 現在の小問で正解となるシェイプ一覧（回答済みの転回形は除く） */
  shapes: ChordShape[];
  /** 現在の小問で答えられる転回形（回答済みを除く）。小さい順 */
  inversions: number[];
  /** この小問より前に、同じルート弦で答え終えた転回形 */
  answeredInversions: number[];
  selected: Position[];
  /** 最低音数まであと何音クリックする必要があるか */
  remaining: number;
  /** 「回答する」で判定できる状態か（最低音数に達しているか） */
  canAnswer: boolean;
  asked: number;
  correct: number;
  combo: number;
  bestCombo: number;
}

const key = (p: Position): string => `${p.string}-${p.fret}`;

export class ChordQuiz {
  private tuning: Tuning;
  private config: ChordQuizConfig;
  private question: ChordQuestion;
  private stepIndex = 0;
  private selected: Position[] = [];
  private asked = 0;
  private correct = 0;
  private combo = 0;
  private bestCombo = 0;
  private answered = false;
  /** 同じルート弦の中で、すでに答え終えた転回形 */
  private answeredInversions: number[] = [];

  constructor(tuning: Tuning, config: Partial<ChordQuizConfig> = {}) {
    this.tuning = tuning;
    this.config = this.normalize(config);
    this.question = this.pickQuestion();
  }

  private normalize(config: Partial<ChordQuizConfig>): ChordQuizConfig {
    const voicing = config.voicing ?? "triad";
    const available = catalogQualities(voicing).map((q) => q.id);
    const picked = (config.qualityIds ?? []).filter((id) => available.includes(id));
    const qualityIds = picked.length > 0 ? picked : available.slice(0, 2);

    // 選んだコードの種類で作れる転回形だけを残す
    const usableInversions = ChordQuiz.availableInversions(voicing, this.tuning, qualityIds);
    const pickedInversions = (config.inversions ?? [0]).filter((i) => usableInversions.includes(i));
    const inversions =
      pickedInversions.length > 0
        ? [...new Set(pickedInversions)].sort((a, b) => a - b)
        : usableInversions.slice(0, 1);

    // ルート弦は転回形に依存する（基本形は最低音弦ルートだけ）
    const usable = ChordQuiz.availableRootStrings(voicing, this.tuning, inversions);
    const rootStrings = (config.rootStrings ?? usable).filter((s) => usable.includes(s));

    return {
      voicing,
      qualityIds,
      rootStrings: rootStrings.length > 0 ? [...new Set(rootStrings)].sort((a, b) => b - a) : usable,
      inversions,
      askAllInversions: config.askAllInversions ?? false,
      showRoot: config.showRoot ?? true,
    };
  }

  /** そのボイシングで出題できる転回形（カタログに定番フォームがあるものだけ） */
  static availableInversions(
    voicing: VoicingType,
    tuning: Tuning,
    qualityIds?: string[],
  ): number[] {
    return catalogInversions(voicing, tuning, qualityIds);
  }

  /** そのボイシングで使えるルート弦（カタログに定番フォームがあるものだけ） */
  static availableRootStrings(
    voicing: VoicingType,
    tuning: Tuning,
    inversions?: number[],
  ): number[] {
    const usable = catalogRootStrings(voicing, tuning, inversions);
    return CHORD_ROOT_STRINGS.filter((s) => usable.includes(s));
  }

  private qualities(): ChordQuality[] {
    const list = this.config.qualityIds.map(getChordQuality);
    return list.length > 0 ? list : catalogQualities(this.config.voicing).slice(0, 1);
  }


  /**
   * ルート弦1本ぶんの小問を作る。作れなければ null。
   * 選んだ転回形のうち、そのルート弦で作れるものすべてを正解候補にする。
   */
  private buildStep(
    quality: ChordQuality,
    rootPitchClass: PitchClass,
    rootString: number,
  ): ChordStep | null {
    for (let fret = 0; fret <= CHORD_ROOT_FALLBACK_FRET; fret++) {
      const root: Position = { string: rootString, fret };
      if (pitchClassAt(this.tuning, root) !== rootPitchClass) continue;

      const shapes: ChordShape[] = [];
      for (const inv of this.config.inversions) {
        shapes.push(...catalogChordShapes(this.tuning, this.config.voicing, quality, root, inv));
      }
      if (shapes.length === 0) continue;

      const inversions = [...new Set(shapes.map((s) => s.inversion))].sort((a, b) => a - b);
      return { rootString, inversions, root, shapes, shape: shapes[0] };
    }
    return null;
  }

  /**
   * 小問を並べる。ルート弦は低音弦から順。
   * 連続出題が ON のときは、同じルート弦をその弦で作れる転回形の数だけ繰り返す
   * （2問目以降はまだ答えていない転回形が正解になる）。
   */
  private buildSteps(quality: ChordQuality, rootPitchClass: PitchClass): ChordStep[] {
    const steps: ChordStep[] = [];
    for (const s of this.config.rootStrings) {
      const step = this.buildStep(quality, rootPitchClass, s);
      if (!step) continue;
      const repeat = this.config.askAllInversions ? step.inversions.length : 1;
      for (let i = 0; i < repeat; i++) steps.push(step);
    }
    return steps;
  }

  /**
   * 出題するコードを1つ選ぶ。
   * 選択されたルート弦すべてでシェイプが作れる組み合わせを優先する。
   */
  private pickQuestion(previous?: ChordQuestion): ChordQuestion {
    const qualities = this.qualities();
    let fallback: ChordQuestion | null = null;

    for (let attempt = 0; attempt < 200; attempt++) {
      const quality = qualities[Math.floor(Math.random() * qualities.length)];
      const rootPitchClass = Math.floor(Math.random() * 12) as PitchClass;
      const wanted = this.config.rootStrings.length;
      if (
        previous &&
        previous.quality.id === quality.id &&
        previous.rootPitchClass === rootPitchClass
      ) {
        continue;
      }
      const steps = this.buildSteps(quality, rootPitchClass);
      if (steps.length === 0) continue;
      const question = { quality, rootPitchClass, steps };
      // 連続出題ではステップが増えるので、カバーできたルート弦の本数で比べる
      const covered = new Set(steps.map((s) => s.rootString)).size;
      if (covered === wanted) return question;
      if (!fallback || covered > new Set(fallback.steps.map((s) => s.rootString)).size) {
        fallback = question;
      }
    }

    if (fallback) return fallback;

    // ランダムで見つからない場合は総当たりで探す
    for (const quality of qualities) {
      for (let pc = 0; pc < 12; pc++) {
        const steps = this.buildSteps(quality, pc as PitchClass);
        if (steps.length > 0) {
          return { quality, rootPitchClass: pc as PitchClass, steps };
        }
      }
    }

    throw new Error("有効なコードシェイプを生成できませんでした");
  }

  private get step(): ChordStep {
    return this.question.steps[this.stepIndex];
  }

  /** 現在の小問で正解になるシェイプ。同じルート弦で答え済みの転回形は除く */
  private get activeShapes(): ChordShape[] {
    const rest = this.step.shapes.filter(
      (s) => !this.answeredInversions.includes(s.inversion),
    );
    return rest.length > 0 ? rest : this.step.shapes;
  }

  /** 現在の小問で答えられる転回形 */
  private get activeInversions(): number[] {
    return [...new Set(this.activeShapes.map((s) => s.inversion))].sort((a, b) => a - b);
  }

  get state(): ChordQuizState {
    const step = this.step;
    return {
      quality: this.question.quality,
      rootPitchClass: this.question.rootPitchClass,
      step,
      stepIndex: this.stepIndex,
      stepCount: this.question.steps.length,
      shape: this.activeShapes[0],
      shapes: this.activeShapes,
      inversions: this.activeInversions,
      answeredInversions: [...this.answeredInversions],
      selected: [...this.selected],
      remaining: Math.max(0, this.minCount() - this.selected.length),
      canAnswer: this.canAnswer,
      asked: this.asked,
      correct: this.correct,
      combo: this.combo,
      bestCombo: this.bestCombo,
    };
  }

  get isAnswered(): boolean {
    return this.answered;
  }

  get showRoot(): boolean {
    return this.config.showRoot;
  }

  get voicing(): VoicingType {
    return this.config.voicing;
  }

  /** 出題対象として選ばれている転回形 */
  get inversions(): number[] {
    return [...this.config.inversions];
  }

  /** 選んだ転回形を連続で出題する設定か */
  get askAllInversions(): boolean {
    return this.config.askAllInversions;
  }

  /** まだ回答していない小問が残っているか */
  get hasNextStep(): boolean {
    return this.stepIndex < this.question.steps.length - 1;
  }

  /** 次の小問が同じルート弦か（＝別の転回形を続けて答えるか） */
  get nextStepIsSameRootString(): boolean {
    if (!this.hasNextStep) return false;
    return this.question.steps[this.stepIndex + 1].rootString === this.step.rootString;
  }

  /** ユーザーがクリックすべき最低音数（正解シェイプのうち最も音数の少ないもの） */
  minCount(): number {
    const shapes = this.activeShapes;
    const total =
      shapes.length > 0
        ? Math.min(...shapes.map((s) => s.positions.length))
        : getVoicing(this.config.voicing).noteCount;
    return this.config.showRoot ? total - 1 : total;
  }

  /** ユーザーがクリックできる最大音数（弦の本数まで） */
  maxCount(): number {
    return this.config.showRoot ? STRING_COUNT - 1 : STRING_COUNT;
  }

  /** 最低音数に達していて「回答する」で判定できるか */
  get canAnswer(): boolean {
    return !this.answered && this.selected.length >= this.minCount();
  }

  /** 現在の選択が正解シェイプのいずれかと一致しているか */
  private matchedShape(): ChordShape | null {
    const answer = this.config.showRoot ? [this.step.root, ...this.selected] : [...this.selected];
    return this.activeShapes.find((s) => samePositionSet(answer, s.positions)) ?? null;
  }

  setTuning(tuning: Tuning): void {
    this.tuning = tuning;
    // チューニングによって使えるルート弦・コードの種類が変わるので設定を正規化し直す
    this.config = this.normalize(this.config);
    this.restart();
  }

  setConfig(config: Partial<ChordQuizConfig>): void {
    this.config = this.normalize({ ...this.config, ...config });
    this.restart();
  }

  private restart(): void {
    this.selected = [];
    this.answered = false;
    this.answeredInversions = [];
    this.stepIndex = 0;
    this.question = this.pickQuestion();
  }

  /** ルートとして固定表示している位置か */
  isGivenRoot(pos: Position): boolean {
    if (!this.config.showRoot) return false;
    const root = this.step.root;
    return pos.string === root.string && pos.fret === root.fret;
  }

  /**
   * 選択のトグル。
   * 音数は可変なので、選択が正解シェイプのいずれかと一致したときに ready を返す。
   */
  toggle(pos: Position): { selected: boolean; ready: boolean } {
    if (this.answered) return { selected: false, ready: false };
    if (this.isGivenRoot(pos)) return { selected: true, ready: false };

    const index = this.selected.findIndex((p) => p.string === pos.string && p.fret === pos.fret);
    if (index >= 0) {
      this.selected.splice(index, 1);
      return { selected: false, ready: false };
    }

    if (this.selected.length >= this.maxCount()) {
      return { selected: false, ready: false };
    }

    this.selected.push(pos);
    return { selected: true, ready: this.matchedShape() !== null };
  }

  /** ユーザーの選択に最も近いシェイプ（不正解時の答え合わせ用） */
  private closestShape(): ChordShape {
    const chosen = new Set(this.selected.map(key));
    const shapes = this.activeShapes;
    let best = shapes[0];
    let bestScore = -1;
    for (const shape of shapes) {
      const score = shape.positions.filter((p) => chosen.has(key(p))).length;
      if (score > bestScore) {
        bestScore = score;
        best = shape;
      }
    }
    return best;
  }

  /** 現在の選択で判定する */
  judge(): ChordJudgement {
    const matched = this.matchedShape();
    const correct = matched !== null;
    const shape = matched ?? this.closestShape();

    const expected = new Set(shape.positions.map(key));
    const wrong = this.selected.filter((p) => !expected.has(key(p)));

    if (!this.answered) {
      this.answered = true;
      this.asked += 1;
      if (correct) {
        this.correct += 1;
        this.combo += 1;
        this.bestCombo = Math.max(this.bestCombo, this.combo);
        // 連続出題では、次の小問で同じ転回形を答えられないようにする
        if (!this.answeredInversions.includes(shape.inversion)) {
          this.answeredInversions.push(shape.inversion);
        }
      } else {
        this.combo = 0;
      }
    }

    const remainingInversions = this.step.inversions.filter(
      (i) => !this.answeredInversions.includes(i),
    );
    return { correct, wrong, shape, isLastStep: !this.hasNextStep, remainingInversions };
  }

  /** 選択をすべて解除する */
  clearSelection(): void {
    if (this.answered) return;
    this.selected = [];
  }

  /**
   * 次へ進む。
   * 未回答のルート弦が残っていれば同じコードの次のシェイプへ、
   * すべて答え終えていたら新しいコードを出題する。
   */
  next(): void {
    this.selected = [];
    this.answered = false;
    if (this.hasNextStep) {
      const previousString = this.step.rootString;
      this.stepIndex += 1;
      // ルート弦が変わったら、答え済みの転回形はリセットする
      if (this.step.rootString !== previousString) this.answeredInversions = [];
      return;
    }
    const previous = this.question;
    this.question = this.pickQuestion(previous);
    this.stepIndex = 0;
    this.answeredInversions = [];
  }

  reset(): void {
    this.asked = 0;
    this.correct = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.restart();
  }
}
