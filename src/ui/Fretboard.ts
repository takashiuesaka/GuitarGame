import {
  DOUBLE_DOT_FRETS,
  MAX_FRET,
  SINGLE_DOT_FRETS,
  STRING_COUNT,
  pitchClassAt,
  samePosition,
  type Position,
} from "../core/fretboard";
import { noteName, type AccidentalStyle, type NotationMode } from "../core/notes";
import type { Tuning } from "../core/tuning";

const SVG_NS = "http://www.w3.org/2000/svg";

const PAD_LEFT = 56;
const PAD_RIGHT = 24;
const PAD_TOP = 34;
const PAD_BOTTOM = 26;
const OPEN_WIDTH = 46;
const FRET_WIDTH = 46;
const STRING_GAP = 34;

const BOARD_X = PAD_LEFT + OPEN_WIDTH;
const BOARD_WIDTH = FRET_WIDTH * MAX_FRET;
const BOARD_HEIGHT = STRING_GAP * (STRING_COUNT - 1);
const TOTAL_WIDTH = PAD_LEFT + OPEN_WIDTH + BOARD_WIDTH + PAD_RIGHT;
const TOTAL_HEIGHT = PAD_TOP + BOARD_HEIGHT + PAD_BOTTOM;

export type MarkerKind = "correct" | "wrong" | "answer" | "root" | "pending";

export interface FretboardOptions {
  tuning: Tuning;
  notation: NotationMode;
  accidental: AccidentalStyle;
  onSelect: (pos: Position) => void;
}

interface Marker {
  pos: Position;
  kind: MarkerKind;
  /** 表示テキストの上書き (省略時は音名) */
  text?: string;
}

function el<K extends keyof SVGElementTagNameMap>(
  name: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, name);
  for (const [k, v] of Object.entries(attrs)) {
    node.setAttribute(k, String(v));
  }
  return node;
}

/** フレット番号 -> そのフレット押弦位置の中心X座標 */
function fretCenterX(fret: number): number {
  if (fret === 0) return PAD_LEFT + OPEN_WIDTH / 2;
  return BOARD_X + FRET_WIDTH * (fret - 1) + FRET_WIDTH / 2;
}

/** 弦番号 (1弦=上) -> Y座標 */
function stringY(stringNo: number): number {
  return PAD_TOP + STRING_GAP * (stringNo - 1);
}

export class Fretboard {
  readonly element: HTMLDivElement;
  private svg: SVGSVGElement;
  private markerLayer: SVGGElement;
  private labelLayer: SVGGElement;
  private opts: FretboardOptions;
  private markers: Marker[] = [];
  private showAllNames = false;
  private interactive = true;
  /** 練習モードのラベル生成を差し替える (度数モード用) */
  private ghostLabel: ((pos: Position) => string | null) | null = null;

  constructor(opts: FretboardOptions) {
    this.opts = opts;
    this.element = document.createElement("div");
    this.element.className = "fretboard-wrap";

    this.svg = el("svg", {
      viewBox: `0 0 ${TOTAL_WIDTH} ${TOTAL_HEIGHT}`,
      width: TOTAL_WIDTH,
      height: TOTAL_HEIGHT,
      class: "fretboard",
      role: "application",
      "aria-label": "ギター指板",
    });
    this.element.appendChild(this.svg);

    this.markerLayer = el("g", { class: "marker-layer" });
    this.labelLayer = el("g", { class: "label-layer" });

    this.drawStatic();
    this.svg.appendChild(this.markerLayer);
    this.svg.appendChild(this.labelLayer);
    this.drawHitAreas();
  }

  private drawStatic(): void {
    // 指板の板
    this.svg.appendChild(
      el("rect", {
        x: BOARD_X,
        y: PAD_TOP - STRING_GAP / 2,
        width: BOARD_WIDTH,
        height: BOARD_HEIGHT + STRING_GAP,
        rx: 4,
        class: "board",
      }),
    );

    // ポジションマーク
    const dotY = PAD_TOP + BOARD_HEIGHT / 2;
    for (const f of SINGLE_DOT_FRETS) {
      this.svg.appendChild(el("circle", { cx: fretCenterX(f), cy: dotY, r: 7, class: "dot" }));
    }
    for (const f of DOUBLE_DOT_FRETS) {
      const cx = fretCenterX(f);
      this.svg.appendChild(
        el("circle", { cx, cy: dotY - STRING_GAP, r: 7, class: "dot" }),
      );
      this.svg.appendChild(
        el("circle", { cx, cy: dotY + STRING_GAP, r: 7, class: "dot" }),
      );
    }

    // フレットワイヤー (1〜24フレットの右端)
    for (let f = 1; f <= MAX_FRET; f++) {
      const x = BOARD_X + FRET_WIDTH * f;
      this.svg.appendChild(
        el("line", {
          x1: x,
          y1: PAD_TOP - STRING_GAP / 2,
          x2: x,
          y2: PAD_TOP + BOARD_HEIGHT + STRING_GAP / 2,
          class: "fret-wire",
        }),
      );
    }

    // ナット
    this.svg.appendChild(
      el("rect", {
        x: BOARD_X - 6,
        y: PAD_TOP - STRING_GAP / 2,
        width: 6,
        height: BOARD_HEIGHT + STRING_GAP,
        class: "nut",
      }),
    );

    // 弦 (1弦=上=細い)
    for (let s = 1; s <= STRING_COUNT; s++) {
      const y = stringY(s);
      this.svg.appendChild(
        el("line", {
          x1: PAD_LEFT,
          y1: y,
          x2: BOARD_X + BOARD_WIDTH,
          y2: y,
          class: "string",
          "stroke-width": 1 + (s - 1) * 0.55,
        }),
      );
    }

    // 弦ラベル (開放弦名) は refreshLabels で更新
    for (let s = 1; s <= STRING_COUNT; s++) {
      const t = el("text", {
        x: PAD_LEFT - 14,
        y: stringY(s) + 4,
        class: "string-label",
        "text-anchor": "end",
        "data-string": s,
      });
      this.svg.appendChild(t);
    }

    // フレット番号
    const numY = PAD_TOP + BOARD_HEIGHT + STRING_GAP / 2 + 18;
    for (let f = 0; f <= MAX_FRET; f++) {
      const t = el("text", {
        x: fretCenterX(f),
        y: numY,
        class: SINGLE_DOT_FRETS.includes(f) || DOUBLE_DOT_FRETS.includes(f)
          ? "fret-number marked"
          : "fret-number",
        "text-anchor": "middle",
      });
      t.textContent = String(f);
      this.svg.appendChild(t);
    }

    this.refreshStringLabels();
  }

  private drawHitAreas(): void {
    const layer = el("g", { class: "hit-layer" });
    for (let s = 1; s <= STRING_COUNT; s++) {
      for (let f = 0; f <= MAX_FRET; f++) {
        const w = f === 0 ? OPEN_WIDTH : FRET_WIDTH;
        const x = fretCenterX(f) - w / 2;
        const rect = el("rect", {
          x,
          y: stringY(s) - STRING_GAP / 2,
          width: w,
          height: STRING_GAP,
          class: "hit",
          "data-string": s,
          "data-fret": f,
        });
        rect.addEventListener("click", () => {
          if (!this.interactive) return;
          this.opts.onSelect({ string: s, fret: f });
        });
        layer.appendChild(rect);
      }
    }
    this.svg.appendChild(layer);
  }

  private label(pc: number): string {
    return noteName(pc, this.opts.notation, this.opts.accidental);
  }

  private refreshStringLabels(): void {
    const labels = this.svg.querySelectorAll<SVGTextElement>(".string-label");
    labels.forEach((node) => {
      const s = Number(node.dataset.string);
      const pc = pitchClassAt(this.opts.tuning, { string: s, fret: 0 });
      node.textContent = `${s}弦 ${this.label(pc)}`;
    });
  }

  setAccidental(accidental: AccidentalStyle): void {
    this.opts.accidental = accidental;
    this.refreshStringLabels();
    this.render();
  }

  setTuning(tuning: Tuning): void {
    this.opts.tuning = tuning;
    this.refreshStringLabels();
    this.render();
  }

  setNotation(notation: NotationMode): void {
    this.opts.notation = notation;
    this.refreshStringLabels();
    this.render();
  }

  setShowAllNames(show: boolean): void {
    this.showAllNames = show;
    this.render();
  }

  /** 練習モードで表示するラベルを差し替える。null を返すと非表示 */
  setGhostLabel(fn: ((pos: Position) => string | null) | null): void {
    this.ghostLabel = fn;
    this.render();
  }

  setInteractive(interactive: boolean): void {
    this.interactive = interactive;
    this.element.classList.toggle("locked", !interactive);
  }

  setMarkers(markers: Marker[]): void {
    this.markers = markers;
    this.render();
  }

  clearMarkers(): void {
    this.setMarkers([]);
  }

  private render(): void {
    this.markerLayer.replaceChildren();
    this.labelLayer.replaceChildren();

    if (this.showAllNames) {
      for (let s = 1; s <= STRING_COUNT; s++) {
        for (let f = 0; f <= MAX_FRET; f++) {
          const pos = { string: s, fret: f };
          if (this.markers.some((m) => samePosition(m.pos, pos))) continue;
          const text = this.ghostLabel
            ? this.ghostLabel(pos)
            : this.label(pitchClassAt(this.opts.tuning, pos));
          if (text === null) continue;
          const t = el("text", {
            x: fretCenterX(f),
            y: stringY(s) + 4,
            class: `note-name ghost${text.length > 3 ? " small" : ""}`,
            "text-anchor": "middle",
          });
          t.textContent = text;
          this.labelLayer.appendChild(t);
        }
      }
    }

    for (const marker of this.markers) {
      const cx = fretCenterX(marker.pos.fret);
      const cy = stringY(marker.pos.string);
      const pc = pitchClassAt(this.opts.tuning, marker.pos);
      const text = marker.text ?? this.label(pc);
      const wide = text.length > 3;
      if (wide) {
        const w = 8 + text.length * 8;
        this.markerLayer.appendChild(
          el("rect", {
            x: cx - w / 2,
            y: cy - 13,
            width: w,
            height: 26,
            rx: 13,
            class: `marker marker-${marker.kind}`,
          }),
        );
      } else {
        this.markerLayer.appendChild(
          el("circle", { cx, cy, r: 14, class: `marker marker-${marker.kind}` }),
        );
      }
      const t = el("text", {
        x: cx,
        y: cy + 4,
        class: `note-name${wide ? " small" : ""}`,
        "text-anchor": "middle",
      });
      t.textContent = text;
      this.markerLayer.appendChild(t);
    }
  }
}

export type { Marker, Position };
