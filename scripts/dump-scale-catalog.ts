/** 出典付き運指データから docs/SCALE_CATALOG.md を生成する。 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildScaleCatalogMarkdown } from "../src/core/scaleCatalogDoc.ts";

const outPath = join(dirname(fileURLToPath(import.meta.url)), "..", "docs", "SCALE_CATALOG.md");
writeFileSync(outPath, buildScaleCatalogMarkdown(), "utf8");
console.log(`docs/SCALE_CATALOG.md を生成しました: ${outPath}`);
