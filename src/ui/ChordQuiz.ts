import {
  buildChordShapes,
  getChordQuality,
  getVoicing,
  isVoicingAvailable,
  qualitiesFor,
  samePositionSet,
  type ChordQuality,
  type ChordShape,
  type VoicingType,
} from "../core/chords";
import { pitchClassAt, type Position } from "../core/fretboard";
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
  /** ルートをあらかじめ指板に表示するか */
  showRoot: boolean;
}

/** 1つのコードに対する、ルート弦ごとの小問 */
export interface ChordStep {
  rootString: number;
  root: Position;
  /** 正解として受理するシェイプ（展開形を含む） */
  shapes: ChordShape[];
  /** 表示用の代表シェイプ */
  shape: ChordShape;
}

export interface ChordQuestion {
  quality: ChordQuality;
  rootPitchClass: PitchClass;
  /** 選択されたルート弦ごとの小問。低音弦から順に並ぶ */
  steps: ChordStep[];
}

export interface ChordJudgement {
  correct: boolean;
  /** ユーザーが選んだ位置のうち間違っていたもの */
  wrong: Position[];
  /** 判定に用いたシェイプ（正解ならユーザーが押さえたもの、不正解なら最も近いもの） */
  shape: ChordShape;
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
  /** 現在の小問で正解となるシェイプ一覧 */
  shapes: ChordShape[];
  selected: Position[];
  /** あと何音クリックする必要があるか */
  remaining: number;
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

  constructor(tuning: Tuning, config: Partial<ChordQuizConfig> = {}) {
    this.tuning = tuning;
    this.config = this.normalize(config);
    this.question = this.pickQuestion();
  }

  private normalize(config: Partial<ChordQuizConfig>): ChordQuizConfig {
    const voicing = config.voicing ?? "triad";
    const available = qualitiesFor(voicing).map((q) => q.id);
    const qualityIds = (config.qualityIds ?? []).filter((id) => available.includes(id));
    const rootStrings = (config.rootStrings ?? CHORD_ROOT_STRINGS).filter(
      (s) => CHORD_ROOT_STRINGS.includes(s) && isVoicingAvailable(voicing, s),
    );

    return {
      voicing,
      qualityIds: qualityIds.length > 0 ? qualityIds : available.slice(0, 2),
      rootStrings:
        rootStrings.length > 0
          ? [...new Set(rootStrings)].sort((a, b) => b - a)
          : ChordQuiz.availableRootStrings(voicing),
      showRoot: config.showRoot ?? true,
    };
  }

  /** そのボイシングで使えるルート弦 */
  static availableRootStrings(voicing: VoicingType): number[] {
    return CHORD_ROOT_STRINGS.filter((s) => isVoicingAvailable(voicing, s));
  }

  private qualities(): ChordQuality[] {
    const list = this.config.qualityIds.map(getChordQuality);
    return list.length > 0 ? list : qualitiesFor(this.config.voicing).slice(0, 1);
  }

  /** ルート弦1本ぶんの小問を作る。作れなければ null */
  private buildStep(
    quality: ChordQuality,
    rootPitchClass: PitchClass,
    rootString: number,
  ): ChordStep | null {
    for (let fret = 0; fret <= CHORD_ROOT_FALLBACK_FRET; fret++) {
      const root: Position = { string: rootString, fret };
      if (pitchClassAt(this.tuning, root) !== rootPitchClass) continue;
      const shapes = buildChordShapes(this.tuning, this.config.voicing, quality, root);
      if (shapes.length > 0) return { rootString, root, shapes, shape: shapes[0] };
    }
    return null;
  }

  private buildSteps(quality: ChordQuality, rootPitchClass: PitchClass): ChordStep[] {
    const steps: ChordStep[] = [];
    for (const s of this.config.rootStrings) {
      const step = this.buildStep(quality, rootPitchClass, s);
      if (step) steps.push(step);
    }
    return steps;
  }

  /**
   * 出題するコードを1つ選ぶ。
   * 選択されたルート弦すべてでシェイプが作れる組み合わせを優先する。
   */
  private pickQuestion(previous?: ChordQuestion): ChordQuestion {
    const qualities = this.qualities();
    const wanted = this.config.rootStrings.length;
    let fallback: ChordQuestion | null = null;

    for (let attempt = 0; attempt < 200; attempt++) {
      const quality = qualities[Math.floor(Math.random() * qualities.length)];
      const rootPitchClass = Math.floor(Math.random() * 12) as PitchClass;
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
      if (steps.length === wanted) return question;
      if (!fallback || steps.length > fallback.steps.length) fallback = question;
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

  get state(): ChordQuizState {
    const step = this.step;
    return {
      quality: this.question.quality,
      rootPitchClass: this.question.rootPitchClass,
      step,
      stepIndex: this.stepIndex,
      stepCount: this.question.steps.length,
      shape: step.shape,
      shapes: step.shapes,
      selected: [...this.selected],
      remaining: this.requiredCount() - this.selected.length,
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

  /** まだ回答していないルート弦が残っているか */
  get hasNextStep(): boolean {
    return this.stepIndex < this.question.steps.length - 1;
  }

  /** ユーザーがクリックすべき音数 */
  requiredCount(): number {
    const total = getVoicing(this.config.voicing).noteCount;
    return this.config.showRoot ? total - 1 : total;
  }

  setTuning(tuning: Tuning): void {
    this.tuning = tuning;
    this.restart();
  }

  setConfig(config: Partial<ChordQuizConfig>): void {
    this.config = this.normalize({ ...this.config, ...config });
    this.restart();
  }

  private restart(): void {
    this.selected = [];
    this.answered = false;
    this.stepIndex = 0;
    this.question = this.pickQuestion();
  }

  /** ルートとして固定表示している位置か */
  isGivenRoot(pos: Position): boolean {
    if (!this.config.showRoot) return false;
    const root = this.step.root;
    return pos.string === root.string && pos.fret === root.fret;
  }

  /** 選択のトグル。回答可能な数に達したら true を返す */
  toggle(pos: Position): { selected: boolean; ready: boolean } {
    if (this.answered) return { selected: false, ready: false };
    if (this.isGivenRoot(pos)) return { selected: true, ready: false };

    const index = this.selected.findIndex((p) => p.string === pos.string && p.fret === pos.fret);
    if (index >= 0) {
      this.selected.splice(index, 1);
      return { selected: false, ready: false };
    }

    if (this.selected.length >= this.requiredCount()) {
      return { selected: false, ready: false };
    }

    this.selected.push(pos);
    return { selected: true, ready: this.selected.length === this.requiredCount() };
  }

  /** ユーザーの選択に最も近いシェイプ（不正解時の答え合わせ用） */
  private closestShape(): ChordShape {
    const chosen = new Set(this.selected.map(key));
    let best = this.step.shape;
    let bestScore = -1;
    for (const shape of this.step.shapes) {
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
    const answer = this.config.showRoot ? [this.step.root, ...this.selected] : [...this.selected];
    const matched = this.step.shapes.find((s) => samePositionSet(answer, s.positions)) ?? null;
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
      } else {
        this.combo = 0;
      }
    }

    return { correct, wrong, shape, isLastStep: !this.hasNextStep };
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
      this.stepIndex += 1;
      return;
    }
    const previous = this.question;
    this.question = this.pickQuestion(previous);
    this.stepIndex = 0;
  }

  reset(): void {
    this.asked = 0;
    this.correct = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.restart();
  }
}
