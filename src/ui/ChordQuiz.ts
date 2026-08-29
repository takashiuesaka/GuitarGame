import {
  buildChordShape,
  getChordQuality,
  isVoicingAvailable,
  qualitiesFor,
  samePositionSet,
  type ChordQuality,
  type ChordShape,
  type VoicingType,
} from "../core/chords";
import { getVoicing } from "../core/chords";
import type { Position } from "../core/fretboard";
import type { Tuning } from "../core/tuning";

/** ルートを配置するフレットの上限 */
export const CHORD_ROOT_MAX_FRET = 12;
/** ルート弦として選べる弦 */
export const CHORD_ROOT_STRINGS = [6, 5, 4, 3];

export interface ChordQuizConfig {
  voicing: VoicingType;
  qualityIds: string[];
  rootStrings: number[];
  /** ルートをあらかじめ指板に表示するか */
  showRoot: boolean;
}

export interface ChordJudgement {
  correct: boolean;
  /** ユーザーが選んだ位置のうち間違っていたもの */
  wrong: Position[];
  /** 正解のシェイプ */
  shape: ChordShape;
}

export interface ChordQuizState {
  shape: ChordShape;
  selected: Position[];
  /** あと何音クリックする必要があるか */
  remaining: number;
  asked: number;
  correct: number;
  combo: number;
  bestCombo: number;
}

export class ChordQuiz {
  private tuning: Tuning;
  private config: ChordQuizConfig;
  private shape: ChordShape;
  private selected: Position[] = [];
  private asked = 0;
  private correct = 0;
  private combo = 0;
  private bestCombo = 0;
  private answered = false;

  constructor(tuning: Tuning, config: Partial<ChordQuizConfig> = {}) {
    this.tuning = tuning;
    this.config = this.normalize(config);
    this.shape = this.pickShape();
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
          : CHORD_ROOT_STRINGS.filter((s) => isVoicingAvailable(voicing, s)),
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

  private pickShape(previous?: ChordShape): ChordShape {
    const qualities = this.qualities();
    const strings = this.config.rootStrings;

    for (let attempt = 0; attempt < 120; attempt++) {
      const quality = qualities[Math.floor(Math.random() * qualities.length)];
      const root: Position = {
        string: strings[Math.floor(Math.random() * strings.length)],
        fret: Math.floor(Math.random() * (CHORD_ROOT_MAX_FRET + 1)),
      };
      const shape = buildChordShape(this.tuning, this.config.voicing, quality, root);
      if (!shape) continue;
      if (
        previous &&
        previous.quality.id === shape.quality.id &&
        previous.root.string === shape.root.string &&
        previous.root.fret === shape.root.fret
      ) {
        continue;
      }
      return shape;
    }

    // 生成に失敗した場合はフレットを走査して確実に見つける
    for (const quality of qualities) {
      for (const string of strings) {
        for (let fret = 0; fret <= CHORD_ROOT_MAX_FRET; fret++) {
          const shape = buildChordShape(this.tuning, this.config.voicing, quality, {
            string,
            fret,
          });
          if (shape) return shape;
        }
      }
    }

    throw new Error("有効なコードシェイプを生成できませんでした");
  }

  get state(): ChordQuizState {
    return {
      shape: this.shape,
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
    this.shape = this.pickShape();
  }

  /** ルートとして固定表示している位置か */
  isGivenRoot(pos: Position): boolean {
    if (!this.config.showRoot) return false;
    return pos.string === this.shape.root.string && pos.fret === this.shape.root.fret;
  }

  /** 選択のトグル。回答可能な数に達したら true を返す */
  toggle(pos: Position): { selected: boolean; ready: boolean } {
    if (this.answered) return { selected: false, ready: false };
    if (this.isGivenRoot(pos)) return { selected: true, ready: false };

    const index = this.selected.findIndex(
      (p) => p.string === pos.string && p.fret === pos.fret,
    );
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

  /** 現在の選択で判定する */
  judge(): ChordJudgement {
    const answer = this.config.showRoot
      ? [this.shape.root, ...this.selected]
      : [...this.selected];
    const correct = samePositionSet(answer, this.shape.positions);

    const key = (p: Position) => `${p.string}-${p.fret}`;
    const expected = new Set(this.shape.positions.map(key));
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

    return { correct, wrong, shape: this.shape };
  }

  /** 選択をすべて解除する */
  clearSelection(): void {
    if (this.answered) return;
    this.selected = [];
  }

  next(): void {
    const previous = this.shape;
    this.selected = [];
    this.answered = false;
    this.shape = this.pickShape(previous);
  }

  reset(): void {
    this.asked = 0;
    this.correct = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.restart();
  }
}
