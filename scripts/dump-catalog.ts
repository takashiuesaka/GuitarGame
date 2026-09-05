/**
 * docs/CHORD_CATALOG.md を生成する。
 *
 *   npm run catalog
 *
 * カタログ本体（src/core/chordCatalog.ts）が唯一の正で、
 * このドキュメントは常にそこから機械的に生成する。手で編集しない。
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCatalogMarkdown } from "../src/core/chordCatalogDoc.ts";

const outPath = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "CHORD_CATALOG.md");
writeFileSync(outPath, buildCatalogMarkdown(), "utf8");
console.log(`docs/CHORD_CATALOG.md を生成しました: ${outPath}`);
