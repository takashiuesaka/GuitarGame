import { findPositions, MAX_FRET, pitchClassAt, samePosition, type Position } from "../core/fretboard";
import { isInNoteBlock, isScaleNoteBlock, noteRegionError, type NoteRegion } from "../core/noteBlock";
import { ALL_PITCH_CLASSES, NATURAL_PITCH_CLASSES, type PitchClass } from "../core/notes";
import type { Tuning } from "../core/tuning";

export type QuestionRange = "natural" | "all";

export interface Judgement {
  correct: boolean;
  complete: boolean;
  ignored: boolean;
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
  selected: Position[];
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
  private block: NoteRegion | null = null;
  private selected: Position[] = [];

  constructor(tuning: Tuning, range: QuestionRange = "natural", block: NoteRegion | null = null) {
    this.tuning = tuning;
    this.range = range;
    this.setBlock(block);
    this.question = this.pickQuestion();
  }

  private candidates(): PitchClass[] {
    const candidates = this.range === "all" ? ALL_PITCH_CLASSES : NATURAL_PITCH_CLASSES;
    if (!this.block || !isScaleNoteBlock(this.block)) return candidates;
    const pitches = new Set(this.block.positions.map((pos) => pitchClassAt(this.tuning, pos)));
    return candidates.filter((pc) => pitches.has(pc));
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
      selected: this.selected.map((pos) => ({ ...pos })),
    };
  }

  get isAnswered(): boolean {
    return this.answered;
  }

  setTuning(tuning: Tuning): void {
    if (this.block) {
      const error = noteRegionError(tuning, this.block);
      if (error) throw new Error(error);
      this.selected = [];
      this.answered = false;
    }
    this.tuning = tuning;
    if (!this.candidates().includes(this.question)) this.question = this.pickQuestion();
  }

  setBlock(block: NoteRegion | null): void {
    if (block) {
      const error = noteRegionError(this.tuning, block);
      if (error) throw new Error(error);
    }
    this.block = block
      ? isScaleNoteBlock(block)
        ? { kind: "scale", root: { ...block.root }, positions: block.positions.map((pos) => ({ ...pos })) }
        : { ...block }
      : null;
    this.selected = [];
    this.answered = false;
    if (this.question !== undefined && !this.candidates().includes(this.question)) {
      this.question = this.pickQuestion();
    }
  }

  isInScope(pos: Position): boolean {
    return this.block === null || isInNoteBlock(pos, this.block);
  }

  setRange(range: QuestionRange): void {
    this.range = range;
    if (!this.candidates().includes(this.question)) {
      this.question = this.pickQuestion();
      this.answered = false;
      this.selected = [];
    }
  }

  /** 現在の問題の正解ポジション一覧 */
  answers(): Position[] {
    return findPositions(this.tuning, this.question, MAX_FRET).filter((pos) => this.isInScope(pos));
  }

  judge(picked: Position): Judgement {
    const pickedPitchClass = pitchClassAt(this.tuning, picked);
    const correct = pickedPitchClass === this.question;
    const answers = this.answers();
    const ignored = !this.isInScope(picked)
      || this.selected.some((pos) => samePosition(pos, picked));
    if (this.answered || ignored) {
      return {
        correct: correct && this.isInScope(picked),
        complete: this.answered,
        ignored: true,
        picked,
        pickedPitchClass,
        answers,
      };
    }
    if (this.block && correct) {
      this.selected.push({ ...picked });
      if (this.selected.length < answers.length) {
        return { correct, complete: false, ignored: false, picked, pickedPitchClass, answers };
      }
    }

    this.answered = true;
    this.asked += 1;
    if (correct) {
      this.correct += 1;
      this.combo += 1;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
    } else {
      this.combo = 0;
    }

    return { correct, complete: true, ignored: false, picked, pickedPitchClass, answers };
  }

  next(): void {
    this.question = this.pickQuestion(this.question);
    this.answered = false;
    this.selected = [];
  }

  reset(): void {
    this.asked = 0;
    this.correct = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.answered = false;
    this.selected = [];
    this.question = this.pickQuestion();
  }
}
