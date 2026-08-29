import { MAX_FRET, STRING_COUNT, pitchClassAt, type Position } from "../core/fretboard";
import { getDegreeGroup, type DegreeGroup, type Interval } from "../core/degrees";
import type { PitchClass } from "../core/notes";
import type { Tuning } from "../core/tuning";

/** 回答として受け付ける範囲 */
export type AnswerScope = "near-root" | "whole";

/** ルートの決め方 */
export type RootMode = "random" | "fixed-pitch" | "fixed-position";

/** ルート周辺モードで許容するフレット幅 */
const NEAR_ROOT_SPAN = 4;
/** ルートを配置するフレット上限 */
export const ROOT_MAX_FRET = 12;

export interface RootConfig {
  mode: RootMode;
  /** mode = "fixed-pitch" のときのルート音 */
  pitchClass: PitchClass;
  /** mode = "fixed-position" のときのルート位置 */
  position: Position;
  /** ルートを配置する弦 (mode = "random" / "fixed-pitch" で使用) */
  strings: number[];
}

export interface DegreeJudgement {
  correct: boolean;
  picked: Position;
  pickedInterval: Interval;
  answers: Position[];
}

export interface DegreeQuizState {
  root: Position;
  rootPitchClass: PitchClass;
  interval: Interval;
  asked: number;
  correct: number;
  combo: number;
  bestCombo: number;
}

export class DegreeQuiz {
  private tuning: Tuning;
  private group: DegreeGroup;
  private scope: AnswerScope;
  private rootConfig: RootConfig;
  private root: Position;
  private interval: Interval;
  private asked = 0;
  private correct = 0;
  private combo = 0;
  private bestCombo = 0;
  private answered = false;

  constructor(
    tuning: Tuning,
    group: DegreeGroup = "chord-tone",
    scope: AnswerScope = "near-root",
    rootConfig: Partial<RootConfig> = {},
  ) {
    this.tuning = tuning;
    this.group = group;
    this.scope = scope;
    this.rootConfig = this.normalizeConfig(rootConfig);
    this.root = this.pickRoot();
    this.interval = this.pickInterval();
  }

  private normalizeConfig(config: Partial<RootConfig>): RootConfig {
    const strings = (config.strings ?? [6, 5]).filter((s) => s >= 1 && s <= STRING_COUNT);
    return {
      mode: config.mode ?? "random",
      pitchClass: ((config.pitchClass ?? 0) % 12 + 12) % 12,
      position: config.position ?? { string: 6, fret: 5 },
      strings: strings.length > 0 ? [...new Set(strings)].sort((a, b) => a - b) : [6, 5],
    };
  }

  private pool(): Interval[] {
    return getDegreeGroup(this.group);
  }

  /** 選択中の弦の中で、指定ピッチクラスになる位置を列挙 */
  private fixedPitchCandidates(): Position[] {
    const collect = (strings: number[]): Position[] => {
      const result: Position[] = [];
      for (const s of strings) {
        for (let f = 0; f <= ROOT_MAX_FRET; f++) {
          const pos = { string: s, fret: f };
          if (pitchClassAt(this.tuning, pos) === this.rootConfig.pitchClass) result.push(pos);
        }
      }
      return result;
    };

    const preferred = collect(this.rootConfig.strings);
    if (preferred.length > 0) return preferred;
    // 選択した弦に該当位置がなければ全弦から探す
    return collect(Array.from({ length: STRING_COUNT }, (_, i) => i + 1));
  }

  private pickRoot(previous?: Position): Position {
    const cfg = this.rootConfig;

    if (cfg.mode === "fixed-position") {
      return { ...cfg.position };
    }

    if (cfg.mode === "fixed-pitch") {
      const candidates = this.fixedPitchCandidates();
      if (candidates.length === 0) return { ...cfg.position };
      const others = candidates.filter(
        (c) => !previous || c.string !== previous.string || c.fret !== previous.fret,
      );
      const source = others.length > 0 ? others : candidates;
      return source[Math.floor(Math.random() * source.length)];
    }

    const strings = cfg.strings;
    for (let i = 0; i < 30; i++) {
      const candidate: Position = {
        string: strings[Math.floor(Math.random() * strings.length)],
        fret: Math.floor(Math.random() * (ROOT_MAX_FRET + 1)),
      };
      if (!previous || candidate.string !== previous.string || candidate.fret !== previous.fret) {
        return candidate;
      }
    }
    return { string: strings[0], fret: 5 };
  }

  private pickInterval(previous?: Interval): Interval {
    const pool = this.pool().filter((i) => i !== previous);
    const source = pool.length > 0 ? pool : this.pool();
    return source[Math.floor(Math.random() * source.length)];
  }

  get state(): DegreeQuizState {
    return {
      root: this.root,
      rootPitchClass: pitchClassAt(this.tuning, this.root),
      interval: this.interval,
      asked: this.asked,
      correct: this.correct,
      combo: this.combo,
      bestCombo: this.bestCombo,
    };
  }

  get isAnswered(): boolean {
    return this.answered;
  }

  setTuning(tuning: Tuning): void {
    this.tuning = tuning;
  }

  setGroup(group: DegreeGroup): void {
    this.group = group;
    if (!this.pool().includes(this.interval)) {
      this.interval = this.pickInterval();
      this.answered = false;
    }
  }

  setScope(scope: AnswerScope): void {
    this.scope = scope;
  }

  /** ルートを配置する弦を設定する */
  setRootStrings(strings: number[]): void {
    this.rootConfig = this.normalizeConfig({ ...this.rootConfig, strings });
    if (
      this.rootConfig.mode !== "fixed-position" &&
      !this.rootConfig.strings.includes(this.root.string)
    ) {
      this.root = this.pickRoot();
      this.answered = false;
    }
  }

  /** ルートの決め方を設定する */
  setRootConfig(config: Partial<RootConfig>): void {
    this.rootConfig = this.normalizeConfig({ ...this.rootConfig, ...config });
    this.root = this.pickRoot();
    this.answered = false;
  }

  get rootMode(): RootMode {
    return this.rootConfig.mode;
  }

  /** クリック位置がルートから見て何度にあたるか */
  intervalOf(pos: Position): Interval {
    const rootPc = pitchClassAt(this.tuning, this.root);
    const pc = pitchClassAt(this.tuning, pos);
    return (pc - rootPc + 12) % 12;
  }

  private inScope(pos: Position): boolean {
    if (this.scope === "whole") return true;
    return Math.abs(pos.fret - this.root.fret) <= NEAR_ROOT_SPAN;
  }

  /** 現在の問題の正解ポジション一覧 */
  answers(): Position[] {
    const result: Position[] = [];
    for (let s = 1; s <= STRING_COUNT; s++) {
      for (let f = 0; f <= MAX_FRET; f++) {
        const pos = { string: s, fret: f };
        if (pos.string === this.root.string && pos.fret === this.root.fret && this.interval !== 0) {
          continue;
        }
        if (this.intervalOf(pos) === this.interval && this.inScope(pos)) {
          result.push(pos);
        }
      }
    }
    return result;
  }

  judge(picked: Position): DegreeJudgement {
    const pickedInterval = this.intervalOf(picked);
    const answers = this.answers();
    const correct =
      pickedInterval === this.interval &&
      answers.some((a) => a.string === picked.string && a.fret === picked.fret);

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

    return { correct, picked, pickedInterval, answers };
  }

  next(): void {
    this.root = this.pickRoot(this.root);
    this.interval = this.pickInterval(this.interval);
    this.answered = false;
  }

  reset(): void {
    this.asked = 0;
    this.correct = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.answered = false;
    this.root = this.pickRoot();
    this.interval = this.pickInterval();
  }
}
