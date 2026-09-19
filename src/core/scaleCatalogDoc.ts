import { midiAt, pitchClassAt } from "./fretboard";
import { noteName } from "./notes";
import { SCALE_CATALOG_SOURCES, SCALE_PATTERNS, SCALE_TYPE_LABELS, scalePatternPositions } from "./scaleCatalog";
import { getTuning } from "./tuning";

export function buildScaleCatalogMarkdown(): string {
  const tuning = getTuning("standard");
  const pitch = (midi: number) => `${noteName(midi % 12, "en")}${Math.floor(midi / 12) - 1}`;
  const lines = [
    "# 実用スケール運指カタログ",
    "",
    "> `npm run catalog:scales` で自動生成。元データは `src/core/scaleCatalog.ts`。",
    "> 仕様は `docs/SPEC.md` の [S-NOTE-07]〜[S-NOTE-10] を参照。",
    "",
    `メジャー ${SCALE_PATTERNS.filter((pattern) => pattern.scaleType === "major").length} 形、ナチュラルマイナー ${SCALE_PATTERNS.filter((pattern) => pattern.scaleType === "natural-minor").length} 形、合計 **${SCALE_PATTERNS.length} 形**。`,
    "教則の本文・図・TAB・教材データで確認した位置集合を収録する。すべての運指やCAGED全形を網羅するものではない。",
    "音が理論上合うという理由だけで、長方形内の位置を補充したり、他の弦へ形をずらしたりしない。",
    "",
    "## 使い方と音域",
    "",
    "- 音名クイズのブロック行で「スケール運指カタログ」を選び、スケール・ルート弦・ルート位置・音域・運指パターンを選ぶ。",
    "- 「ブロック適用」をONにすると、○で示した運指とRの位置だけが回答対象。同じ音名の位置はすべて選ぶ。",
    "- 「高音側」は指定ルート以上、「低音側」は指定ルート以下を原典の運指から抽出。「両側」は指定ルートより高い音と低い音を含む原典の全形。",
    "- 音域の抽出と別オクターブのルートへの基準変更はアプリ側の派生処理であり、独立した教則形として数えない。",
    "- 指定ルートから上か下の1オクターブ内に7種類の構成音と両端のルートがそろう候補だけを表示する。",
    "- 「高音側」は高いフレット番号という意味ではない。例えば6弦10fのD3より5弦7fのE3の方が高い。",
    "- Cメジャーを6弦8f（C3）から弾く高音側は選べるが、1オクターブ低いC2は標準調弦の最低音E2より低いため、低音側だけの完全な1オクターブは選べない。",
    "- 原典のパターン名やポジション番号は、移調後のフレット番号とは限らない。",
    "",
    "## 収録した位置",
    "",
    "各弦の欄はフレット番号。`—` はその弦を使わない。音域と位置数は原典の収録集合から計算している。",
    "",
    "| ID | スケール | パターン | 6弦 | 5弦 | 4弦 | 3弦 | 2弦 | 1弦 | 位置数 | 実音域 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
  ];
  for (const pattern of SCALE_PATTERNS) {
    const positions = scalePatternPositions(pattern);
    const pitches = positions.map((pos) => midiAt(tuning, pos));
    lines.push(`| ${pattern.id} | ${noteName(pattern.tonic, "en")} ${SCALE_TYPE_LABELS[pattern.scaleType]} | ${pattern.name} | ${pattern.frets.map((frets) => frets.join(", ") || "—").join(" | ")} | ${positions.length} | ${pitch(Math.min(...pitches))}〜${pitch(Math.max(...pitches))} |`);
  }
  lines.push("", "## 出典との対応・注意点", "");
  for (const pattern of SCALE_PATTERNS) {
    const roots = scalePatternPositions(pattern).filter((pos) => pitchClassAt(tuning, pos) === pattern.tonic);
    const sources = pattern.sourceIds.map((id) => {
      const source = SCALE_CATALOG_SOURCES.find((entry) => entry.id === id);
      if (!source) throw new Error(`スケールカタログの出典が見つかりません: ${id}`);
      return `[${source.title}](${source.url})`;
    });
    lines.push(
      `### ${pattern.name}（${pattern.id}）`, "",
      pattern.note, "",
      `原典配置のルート: ${roots.map((pos) => `${pos.string}弦${pos.fret}f`).join("、")}。`,
      `出典: ${sources.join(" ／ ")}。`, "",
    );
  }
  lines.push(
    "## 移調・チューニング", "",
    "- メジャー／ナチュラルマイナーをそれぞれ12キーで使用できる。選択したキーのルートへ、同じ弦構成のまま全フレットを同じ量だけ平行移動する。",
    "- 0〜24フレットからはみ出す候補は除外し、切り詰めたり別の音を補充したりしない。",
    "- 半音下げは全弦が同じだけ下がるため、実際のキーを保つようフレット位置を移す。",
    "- ドロップDでは6弦を他の弦と同じ形のまま移調できない。使用する弦の調弦差が一様でない候補は除外し、6弦を使わない運指の範囲だけを利用する。",
    "- 別チューニング専用の教則運指を収録したという意味ではない。弦ごとに違うフレット補正をして実用性を推測しない。",
    "",
    "## 調査と検証の範囲", "",
    "- 確認日: 2026-09-12。メジャー／自然短音階の2テーマを各6レーンで調査し、出典の独立性と座標の整合性を確認した。",
    "- 調査レーンのモデル多様性は保証していない。レーンの一致だけを裏付けとせず、教材の独立性と直接確認を重視する。",
    "- 主な根拠は英語の公開教則。日本語の一次教則の独立確認はできていない。",
    "- 原典間で最低音・最高音が違う形は統合しない。複数サイトが同じ系列の場合は独立した根拠として数えない。",
    "- 基本ボックスと厳密な2オクターブの形は区別する。原典の題名に音域の誤記がある場合は、音高計算の結果と相違を明記した。",
    "- 原図は画素・OCR等で座標を確認したものを含む。写真・図版・文章は転載せず、音の位置という事実データと出典を記録する。",
    "- 単一の教則のみで確認した形も含むため、すべてを唯一の標準運指や、すべての人に最適な運指とは扱わない。",
    "- 座標、構成音、12キーへの移調、音域、全位置回答、UI保存・切替は自動テストで確認する。数値上正しいだけで教則の裏付けがあるとは判定しない。",
    "",
    "## 参照箇所", "",
  );
  for (const source of SCALE_CATALOG_SOURCES) {
    lines.push(`- [${source.title}](${source.url}) — ${source.locator}`);
  }
  lines.push("");
  return lines.join("\n");
}
