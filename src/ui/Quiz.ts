import { findPositions, MAX_FRET, pitchClassAt, type Position } from "../core/fretboard";
import { ALL_PITCH_CLASSES, NATURAL_PITCH_CLASSES, type PitchClass } from "../core/notes";
import type { Tuning } from "../core/tuning";

export type QuestionRange = "natural" | "all";

export interface Judgement {
  correct: boolean;
  picked: Position;
  pickedPitchClass: PitchClass;
  answers: Position[];
}

export interface QuizState {
  question: PitchClass;
  asked: number;
  correct: number;
  combo: number;
  bestCombo: number;
}

export class Quiz {
  private tuning: Tuning;
  private range: QuestionRange;
  private question: PitchClass;
  private asked = 0;
  private correct = 0;
  private combo = 0;
  private bestCombo = 0;
  private answered = false;

  constructor(tuning: Tuning, range: QuestionRange = "natural") {
    this.tuning = tuning;
    this.range = range;
    this.question = this.pickQuestion();
  }

  private candidates(): PitchClass[] {
    return this.range === "all" ? ALL_PITCH_CLASSES : NATURAL_PITCH_CLASSES;
  }

  private pickQuestion(previous?: PitchClass): PitchClass {
    const pool = this.candidates().filter((pc) => pc !== previous);
    const source = pool.length > 0 ? pool : this.candidates();
    return source[Math.floor(Math.random() * source.length)];
  }

  get state(): QuizState {
    return {
      question: this.question,
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

  setRange(range: QuestionRange): void {
    this.range = range;
    if (!this.candidates().includes(this.question)) {
      this.question = this.pickQuestion();
      this.answered = false;
    }
  }

  /** 現在の問題の正解ポジション一覧 */
  answers(): Position[] {
    return findPositions(this.tuning, this.question, MAX_FRET);
  }

  judge(picked: Position): Judgement {
    const pickedPitchClass = pitchClassAt(this.tuning, picked);
    const correct = pickedPitchClass === this.question;

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

    return { correct, picked, pickedPitchClass, answers: this.answers() };
  }

  next(): void {
    this.question = this.pickQuestion(this.question);
    this.answered = false;
  }

  reset(): void {
    this.asked = 0;
    this.correct = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.answered = false;
    this.question = this.pickQuestion();
  }
}
