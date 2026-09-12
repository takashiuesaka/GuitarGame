# 実用スケール運指カタログ

> `npm run catalog:scales` で自動生成。元データは `src/core/scaleCatalog.ts`。
> 仕様は `docs/SPEC.md` の [S-NOTE-07]〜[S-NOTE-10] を参照。

メジャー 7 形、ナチュラルマイナー 4 形、合計 **11 形**。
教則の本文・図・TAB・教材データで確認した位置集合を収録する。すべての運指やCAGED全形を網羅するものではない。
音が理論上合うという理由だけで、長方形内の位置を補充したり、他の弦へ形をずらしたりしない。

## 使い方と音域

- 音名クイズのブロック行で「スケール運指カタログ」を選び、スケール・ルート弦・ルート位置・音域・運指パターンを選ぶ。
- 「ブロック適用」をONにすると、○で示した運指とRの位置だけが回答対象。同じ音名の位置はすべて選ぶ。
- 「高音側」は指定ルート以上、「低音側」は指定ルート以下を原典の運指から抽出。「両側」は指定ルートより高い音と低い音を含む原典の全形。
- 音域の抽出と別オクターブのルートへの基準変更はアプリ側の派生処理であり、独立した教則形として数えない。
- 指定ルートから上か下の1オクターブ内に7種類の構成音と両端のルートがそろう候補だけを表示する。
- 「高音側」は高いフレット番号という意味ではない。例えば6弦10fのD3より5弦7fのE3の方が高い。
- Cメジャーを6弦8f（C3）から弾く高音側は選べるが、1オクターブ低いC2は標準調弦の最低音E2より低いため、低音側だけの完全な1オクターブは選べない。
- 原典のパターン名やポジション番号は、移調後のフレット番号とは限らない。

## 収録した位置

各弦の欄はフレット番号。`—` はその弦を使わない。音域と位置数は原典の収録集合から計算している。

| ID | スケール | パターン | 6弦 | 5弦 | 4弦 | 3弦 | 2弦 | 1弦 | 位置数 | 実音域 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| major-basic-box | C メジャー | 基本ボックス（6弦系） | 8, 10 | 7, 8, 10 | 7, 9, 10 | 7, 9, 10 | 8, 10 | 7, 8, 10 | 16 | C3〜D5 |
| major-first-octave | C メジャー | 基本の1オクターブ（6〜4弦） | 8, 10 | 7, 8, 10 | 7, 9, 10 | — | — | — | 8 | C3〜C4 |
| major-seventh-box | C メジャー | 第7ポジションの全形 | 7, 8, 10 | 7, 8, 10 | 7, 9, 10 | 7, 9, 10 | 8, 10 | 7, 8, 10 | 17 | B2〜D5 |
| major-fifth-octave | C メジャー | 5弦からの1オクターブ | — | 3, 5 | 2, 3, 5 | 2, 4, 5 | — | — | 8 | C3〜C4 |
| major-3nps | C メジャー | 3NPS（6弦からの全形） | 8, 10, 12 | 8, 10, 12 | 9, 10, 12 | 9, 10, 12 | 10, 12, 13 | 10, 12, 13 | 18 | C3〜F5 |
| major-fourth-3nps | C メジャー | 4弦からの1オクターブ（3NPS系） | — | — | 10, 12, 14 | 10, 12, 14 | 12, 13 | — | 8 | C4〜C5 |
| major-third-3nps | C メジャー | 3弦からの1オクターブ（3NPS系） | — | — | — | 5, 7, 9 | 6, 8, 10 | 7, 8 | 8 | C4〜C5 |
| minor-basic-box | A ナチュラルマイナー | 基本ボックス（6弦系） | 5, 7, 8 | 5, 7, 8 | 5, 7 | 4, 5, 7 | 5, 6, 8 | 5, 7, 8 | 17 | A2〜C5 |
| minor-fifth-box | A ナチュラルマイナー | 基本ボックス（5弦系） | — | 12, 14, 15 | 12, 14, 15 | 12, 14 | 12, 13, 15 | 12, 13, 15 | 14 | A3〜G5 |
| minor-position-three | A ナチュラルマイナー | AGT 第3ポジションの全形 | 10, 12, 13 | 10, 12 | 9, 10, 12 | 9, 10, 12 | 10, 12, 13 | 10, 12, 13 | 17 | D3〜F5 |
| minor-two-octaves | A ナチュラルマイナー | 2オクターブの練習形 | 5, 7, 8 | 5, 7, 8 | 5, 7 | 4, 5, 7 | 5, 6, 8 | 5 | 15 | A2〜A4 |

## 出典との対応・注意点

### 基本ボックス（6弦系）（major-basic-box）

FretjamのC配置とGuitareoのG配置を+5した形が一致。16位置、C3〜D5。

原典配置のルート: 6弦8f、4弦10f、1弦8f。
出典: [Fretjam — The Major Scale on Guitar](https://www.fretjam.com/major-scale.html) ／ [Guitareo — The Major Guitar Scale](https://www.guitarlessons.com/guitar-lessons/guitar-scales/major-guitar-scale)。

### 基本の1オクターブ（6〜4弦）（major-first-octave）

Guitareoが明示する最初の1オクターブ。FaChords steps[1]とも一致するC3〜C4の8位置。

原典配置のルート: 6弦8f、4弦10f。
出典: [Guitareo — The Major Guitar Scale](https://www.guitarlessons.com/guitar-lessons/guitar-scales/major-guitar-scale) ／ [Fretjam — The Major Scale on Guitar](https://www.fretjam.com/major-scale.html) ／ [FaChords — C major lesson data](https://www.fachords.com/tools/get-json-lessons/?lesson=c_major_scale)。

### 第7ポジションの全形（major-seventh-box）

原典の全形はB2〜D5。6弦8fのCより低いBも含む。基本ボックスとは別の収録音。

原典配置のルート: 6弦8f、4弦10f、1弦8f。
出典: [GuitarScale.org — C Major](https://www.guitarscale.org/c-major.html)。

### 5弦からの1オクターブ（major-fifth-octave）

Fretjamの5弦ルートボックスからC3〜C4を抽出した8位置。FaChords steps[4]の1オクターブ教材とも完全一致する。Fretjamの全形とは区別する。

原典配置のルート: 5弦3f、3弦5f。
出典: [Fretjam — The Major Scale on Guitar](https://www.fretjam.com/major-scale.html) ／ [FaChords — C major lesson data](https://www.fachords.com/tools/get-json-lessons/?lesson=c_major_scale)。

### 3NPS（6弦からの全形）（major-3nps）

教材steps[13]の18位置をそのまま採録。原典の「2 octaves」という題名と異なり、実音域はC3〜F5。

原典配置のルート: 6弦8f、4弦10f、2弦13f。
出典: [FaChords — C Major Scale](https://www.fachords.com/major-scale/) ／ [FaChords — C major lesson data](https://www.fachords.com/tools/get-json-lessons/?lesson=c_major_scale)。

### 4弦からの1オクターブ（3NPS系）（major-fourth-3nps）

教材steps[7]の8位置。上のルートで止まるため弦ごとの音数は3・3・2。

原典配置のルート: 4弦10f、2弦13f。
出典: [FaChords — C Major Scale](https://www.fachords.com/major-scale/) ／ [FaChords — C major lesson data](https://www.fachords.com/tools/get-json-lessons/?lesson=c_major_scale)。

### 3弦からの1オクターブ（3NPS系）（major-third-3nps）

教材steps[10]の8位置。3・3・2音で、G弦とB弦の間隔の違いを含む。

原典配置のルート: 3弦5f、1弦8f。
出典: [FaChords — C Major Scale](https://www.fachords.com/major-scale/) ／ [FaChords — C major lesson data](https://www.fachords.com/tools/get-json-lessons/?lesson=c_major_scale)。

### 基本ボックス（6弦系）（minor-basic-box）

17位置、A2〜C5。3弦4fへの移動も原典どおり保持する。

原典配置のルート: 6弦5f、4弦7f、1弦5f。
出典: [Fender — A Minor Guitar Scale](https://www.fender.com/articles/scales/a-minor-guitar-scale) ／ [Fretjam — Natural Minor Scale on Guitar](https://www.fretjam.com/natural-minor-scale.html) ／ [Applied Guitar Theory — Natural Minor Scale](https://appliedguitartheory.com/lessons/natural-minor-scale/)。

### 基本ボックス（5弦系）（minor-fifth-box）

掲載図とAマイナーの5弦12f指定に基づく14位置。6弦は使わない。

原典配置のルート: 5弦12f、3弦14f。
出典: [Fretjam — Natural Minor Scale on Guitar](https://www.fretjam.com/natural-minor-scale.html)。

### AGT 第3ポジションの全形（minor-position-three）

Gマイナーの原図を+2移調した17位置。5弦12fと2弦10fがA。ルートより低い音も含む。

原典配置のルート: 5弦12f、2弦10f。
出典: [Applied Guitar Theory — Natural Minor Scale](https://appliedguitartheory.com/lessons/natural-minor-scale/)。

### 2オクターブの練習形（minor-two-octaves）

TABの上行部分15位置、A2〜A4。基本ボックスの上端2音を含まない独立した教材例。

原典配置のルート: 6弦5f、4弦7f、1弦5f。
出典: [Guitar Command — A Minor Scale Guitar TAB](https://www.guitarcommand.com/a-minor-scale-guitar/) ／ [GuitarScale.org — A Minor](https://www.guitarscale.org/a-minor.html)。

## 移調・チューニング

- メジャー／ナチュラルマイナーをそれぞれ12キーで使用できる。選択したキーのルートへ、同じ弦構成のまま全フレットを同じ量だけ平行移動する。
- 0〜24フレットからはみ出す候補は除外し、切り詰めたり別の音を補充したりしない。
- 半音下げは全弦が同じだけ下がるため、実際のキーを保つようフレット位置を移す。
- ドロップDでは6弦を他の弦と同じ形のまま移調できない。使用する弦の調弦差が一様でない候補は除外し、6弦を使わない運指の範囲だけを利用する。
- 別チューニング専用の教則運指を収録したという意味ではない。弦ごとに違うフレット補正をして実用性を推測しない。

## 調査と検証の範囲

- 確認日: 2026-09-12。メジャー／自然短音階の2テーマを各6レーンで調査し、出典の独立性と座標の整合性を確認した。
- 調査レーンのモデル多様性は保証していない。レーンの一致だけを裏付けとせず、教材の独立性と直接確認を重視する。
- 主な根拠は英語の公開教則。日本語の一次教則の独立確認はできていない。
- 原典間で最低音・最高音が違う形は統合しない。複数サイトが同じ系列の場合は独立した根拠として数えない。
- 基本ボックスと厳密な2オクターブの形は区別する。原典の題名に音域の誤記がある場合は、音高計算の結果と相違を明記した。
- 原図は画素・OCR等で座標を確認したものを含む。写真・図版・文章は転載せず、音の位置という事実データと出典を記録する。
- 単一の教則のみで確認した形も含むため、すべてを唯一の標準運指や、すべての人に最適な運指とは扱わない。
- 座標、構成音、12キーへの移調、音域、全位置回答、UI保存・切替は自動テストで確認する。数値上正しいだけで教則の裏付けがあるとは判定しない。

## 参照箇所

- [Fretjam — The Major Scale on Guitar](https://www.fretjam.com/major-scale.html) — Basic major scale guitar patterns（6弦・5弦ルート図）
- [Guitareo — The Major Guitar Scale](https://www.guitarlessons.com/guitar-lessons/guitar-scales/major-guitar-scale) — 各弦のフレット説明と最初の1オクターブの段階練習
- [GuitarScale.org — C Major](https://www.guitarscale.org/c-major.html) — Shapes: 7th position（c_major_box1.png）
- [FaChords — C Major Scale](https://www.fachords.com/major-scale/) — インタラクティブ教材 c_major_scale
- [FaChords — C major lesson data](https://www.fachords.com/tools/get-json-lessons/?lesson=c_major_scale) — lessons.c_major_scale.steps[1], [4], [7], [10], [13].frets
- [Fender — A Minor Guitar Scale](https://www.fender.com/articles/scales/a-minor-guitar-scale) — 5th Position の図（本文の誤記ではなく実音で自然短音階と確認）
- [Fretjam — Natural Minor Scale on Guitar](https://www.fretjam.com/natural-minor-scale.html) — Natural minor scale guitar basics（6弦・5弦ルート図）
- [Applied Guitar Theory — Natural Minor Scale](https://appliedguitartheory.com/lessons/natural-minor-scale/) — Position 1 / Position 3 の図（GマイナーをAへ移調）
- [Guitar Command — A Minor Scale Guitar TAB](https://www.guitarcommand.com/a-minor-scale-guitar/) — 2 Octave A Natural Minor Scale のTAB
- [GuitarScale.org — A Minor](https://www.guitarscale.org/a-minor.html) — A Minor 2 octaves（a_minor.png）
