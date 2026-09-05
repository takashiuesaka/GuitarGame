import {
  CATALOG_SOURCES,
  CATALOG_TUNING,
  CHORD_CATALOG,
  INVERSION_LABELS,
  SHAPE_FAMILY_LABELS,
  analyzeCatalogShape,
  type ShapeFamily,
} from "./chordCatalog";
import { getChordQuality } from "./chords";
import { pitchClassAt } from "./fretboard";
import { noteName } from "./notes";

/** docs/CHORD_CATALOG.md に出力する系統の順序 */
const FAMILY_ORDER: ShapeFamily[] = ["open", "caged", "drop2", "drop3", "shell", "triad"];

/**
 * カタログを人が読める Markdown に変換する。
 * `docs/CHORD_CATALOG.md` はこの結果と常に一致していなければならない。
 */
export function buildCatalogMarkdown(): string {
  const tuning = CATALOG_TUNING;
  const lines: string[] = [
    "# 定番コードフォーム・カタログ",
    "",
    "> このファイルは `npm run catalog` で自動生成される。手で編集しない。",
    "> 元データは `src/core/chordCatalog.ts`、仕様は `docs/SPEC.md` の [S-CATALOG] を参照。",
    "",
    "教則本やレッスンサイトで実際に教えられている押さえ方だけを収録している。",
    `全 ${CHORD_CATALOG.length} エントリ。`,
    "",
    "タブ譜は **6弦→1弦** の順に並べたフレット番号で、`x` はミュート（弾かない弦）。",
    "ルート弦・転回形・構成音は、タブ譜から機械的に導出したもの。",
    "",
  ];

  for (const family of FAMILY_ORDER) {
    const shapes = CHORD_CATALOG.filter((s) => s.family === family);
    lines.push(`## ${SHAPE_FAMILY_LABELS[family]}（${shapes.length}件）`, "");
    lines.push("| コード | 押さえ方 | タブ譜 | ルート弦 | 転回形 | 構成音 | 備考 |");
    lines.push("| --- | --- | --- | --- | --- | --- | --- |");

    for (const shape of shapes) {
      const analysis = analyzeCatalogShape(shape);
      const quality = getChordQuality(shape.qualityId);
      const chord = `${noteName(shape.root, "en", "sharp")}${quality.symbol}`;
      const notes = analysis.positions
        .map((p) => noteName(pitchClassAt(tuning, p), "en", "sharp"))
        .join(" ");
      const note = [shape.note, shape.omits?.length ? "5度省略" : ""].filter(Boolean).join(" / ");
      lines.push(
        `| ${chord} | ${shape.name} | \`${shape.tab}\` | ${analysis.rootString}弦 | ` +
          `${INVERSION_LABELS[analysis.inversion]} | ${notes} | ${note || "-"} |`,
      );
    }
    lines.push("");
  }

  lines.push("## 出典", "");
  for (const source of CATALOG_SOURCES) {
    lines.push(`- ${source.label} — ${source.url}`);
  }
  lines.push("");

  return lines.join("\n");
}
