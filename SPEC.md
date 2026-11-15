# SeasonWear 仕様書

楽天に出店する古着を、**ブランド × シーズン**で絞り込んで表示する、アフィリエイトリンク集約の静的サイト。

- リポジトリ: `richmanzinc/seasonwear`
- 作成日: 2026-11-15

---

## 1. コンセプト

デザイナーズ／ラグジュアリーブランドの古着を、楽天市場から横断検索し、
**ブランド × デリバリーシーズン × メンズ/ウィメンズ**で絞り込める一覧を提供する。
シーズンは商品名・説明に**明記された個体だけ**を採用する（推測しない）。
各商品は**楽天アフィリエイトリンク**経由で楽天の商品ページに飛ばす。

サイト自身は商品を持たず在庫も持たない。リンクを並べるだけ。収益はアフィリエイト報酬。

---

## 2. アーキテクチャ（省エネ・静的）

```
楽天ウェブサービス 商品検索API (IchibaItem/Search, 無料)
        │  ← GitHub Actions が 1日1回 cron で実行
        ▼
   scripts/fetch.mjs        … API を叩いてブランド別に検索・整形・シーズン判定
        │
        ▼
   data/items.json          … ブランド×シーズンのタグ付き商品データ
        │  ← コミットして Pages に反映
        ▼
   index.html + app.js      … ブラウザが JSON を読み、クライアント側で絞り込み表示
        │
        ▼
   GitHub Pages             … 無料ホスティングで公開
```

- **サーバー費ゼロ**。ビルドなし（素の HTML/CSS/JS）。
- バッチは Node.js（標準 `fetch`）。GitHub Actions 上で実行。
- データ更新はリアルタイム不要 → **1日1回**で十分。

---

## 3. データソース：楽天ウェブサービス

- API: **楽天市場 商品検索API（IchibaItem/Search/20220601）**
- 必要なキー（いずれも無料）:
  - `applicationId`（楽天アプリID）… **未取得 → これから取得**（Rakuten Developers で登録）
  - `affiliateId`（楽天アフィリエイトID）… **取得済み**
- `affiliateId` を渡すと、レスポンスに **`affiliateUrl`（アフィリエイトリンク）** が入る。
- 画像は API が返す `mediumImageUrls` を使用（規約準拠の提供URL）。スクレイピング・画像転載は**しない**。
- マナー: 1リクエスト/秒程度。ブランドごとに検索 → ページング。

> IDは GitHub Actions の **Secrets** に格納し、コードには埋め込まない。
> ローカル実行時は `.env`（gitignore 済み）から読む。

---

## 4. 絞り込み仕様

### 4-1. ブランド

- 収集方法: **楽天全体を横断**（ブランド名キーワード + 「古着 / USED」で検索）。
- 対象ブランドは `config/brands.json` で管理。追加は追記するだけ。
- スタートセット（後から増減可）:

**デザイナーズ**
COMME des GARÇONS / Yohji Yamamoto / ISSEY MIYAKE / sacai / UNDERCOVER /
Maison Margiela / Rick Owens / Raf Simons / Jil Sander / Dries Van Noten /
kolor / Number (N)ine

**ラグジュアリー**
GUCCI / PRADA / Saint Laurent / Celine / Bottega Veneta / Balenciaga /
Dior / Louis Vuitton / Burberry / Loewe / Fendi / Miu Miu

### 4-2. シーズン（デリバリーシーズン特化）

**方針: キーワードからの季節推測はしない。** 商品名（`itemName`）または商品説明
（`itemCaption`）に**デリバリーシーズンが明記されている商品だけを採用**する。
シーズン表記が見つからない商品は**そもそも一覧に載せない**（除外）。

- デリバリーシーズン = コレクションの投入期（例: 2020年春夏 = `20SS`、2022-23年秋冬 = `22-23AW`）。
- 認識するパターン（大文字小文字・区切り・全半角のゆらぎ込み）:
  - `20SS` / `2020SS` / `SS20` / `SS2020`
  - `22AW` / `2022AW` / `AW22` / `22-23AW`
  - `S/S`, `A/W` 表記、年付き（`2021 S/S` など）
  - 日本語: `20春夏`, `2020秋冬`, `22-23秋冬`
- 正規化して格納:
  - `seasonType`: `"SS"` | `"AW"`
  - `seasonYear`: 西暦4桁（`2020`。範囲表記は開始年）
  - `seasonLabel`: 表示用（例 `"2020 SS"`, `"2022-23 AW"`）
  - `seasonRaw`: 元の一致文字列（例 `"20AW"`）

表示ルール:
- シーズンのフィルタ候補は、**実データに存在するシーズンだけ**を新しい順で動的生成
  （例: `2024 SS` / `2023 AW` / `2023 SS` …）。
- `SS` / `AW` のタイプだけでの絞り込みも可。

> ※ 表記ゆれで取りこぼす可能性はあるが、「確実にシーズンが分かる個体」に特化する方針。
> パターンは後から追加して拾いを改善する。

### 4-3. 性別（メンズ / ウィメンズ）

商品名・説明の表記から判定する唯一の区分。

- **MEN 判定語**: メンズ, MEN, MEN'S, MENS, 男性, 紳士
- **WOMEN 判定語**: レディース, ウィメンズ, WOMEN, WOMEN'S, WMNS, 女性, 婦人
- どちらも無い／両方ある → `UNISEX`（指定なし）。
- `gender`: `"MEN"` | `"WOMEN"` | `"UNISEX"` を格納。
- フィルタ「メンズ」= `MEN` + `UNISEX`、「ウィメンズ」= `WOMEN` + `UNISEX` を表示。

---

## 5. データスキーマ（`data/items.json`）

```json
{
  "updatedAt": "2026-11-15T03:00:00Z",
  "items": [
    {
      "brand": "sacai",
      "brandLabel": "sacai",
      "category": "designer",          // "designer" | "luxury"
      "seasonType": "AW",               // "SS" | "AW"
      "seasonYear": 2020,
      "seasonLabel": "2020 AW",
      "seasonRaw": "20AW",
      "gender": "MEN",                  // "MEN" | "WOMEN" | "UNISEX"
      "title": "sacai サカイ 20AW ...",
      "price": 25800,
      "imageUrl": "https://thumbnail.image.rakuten.co.jp/...",
      "affiliateUrl": "https://hb.afl.rakuten.co.jp/...",
      "shopName": "...",
      "itemCode": "shop:1234567"
    }
  ]
}
```

- **シーズン表記が無い商品は items に含めない**（採用条件）。
- 1ブランドあたり取得上限（例: 30件/ページ × 数ページ）を設け、全体で数百件規模
  → 単一 JSON（数百KB）で配信。

---

## 6. 画面（1ページ）

- ヘッダ: サイト名 + 広告（アフィリエイト）表記。
- フィルタUI:
  - カテゴリ: すべて / デザイナーズ / ラグジュアリー（ブランド選択の補助）
  - ブランド: 一覧から選択（複数可）
  - シーズン: すべて / 実在するデリバリーシーズン（例 2024 SS, 2023 AW…）を新しい順で動的生成。
    SS / AW タイプだけの絞り込みも可
  - 性別: すべて / メンズ / ウィメンズ
  - 並び替え: 新着（取得順）/ 価格安い順 / 高い順
- 一覧: 商品カード（画像・ブランド・**シーズンラベル**・性別・タイトル・価格・ショップ名）。
  - カードクリック → `affiliateUrl` を**別タブ**で開く（`rel="sponsored noopener"`）。
- フッタ: 楽天ウェブサービスのクレジット表記（規約で必須）。

---

## 7. 法的・規約対応（重要）

| 項目 | 対応 |
|---|---|
| ステマ規制（景表法, 2023.10〜） | ヘッダ/フッタに「本サイトは楽天アフィリエイトによる広告を含みます」と明記（PR表記必須） |
| 楽天ウェブサービス利用規約 | 成果物に **「Supported by Rakuten Developers」等のクレジット表示**が必要 → フッタに掲載 |
| 画像・商品情報 | APIが返す提供URL/データのみ使用。スクレイピング・無断転載はしない |
| アフィリエイト規約 | 楽天アフィリエイトの許可された掲載形態（リンク設置）に限定 |
| 個人情報 | 収集しない（ログイン・フォーム・問い合わせ機能なし） |

> 「アフィリエイトリンクだけのサイト」は一般的に存在し（比較・まとめサイト等）、
> 上記の表記義務さえ守れば法的問題はない、という整理。

---

## 8. 技術スタック

- フロント: 素の HTML / CSS / JavaScript（フレームワーク・ビルドなし）
- バッチ: Node.js（`scripts/fetch.mjs`, 標準 `fetch`）
- CI/自動化: GitHub Actions（cron `0 3 * * *` = 毎日12時JST頃）
- ホスティング: GitHub Pages
- Secrets: `RAKUTEN_APP_ID`, `RAKUTEN_AFFILIATE_ID`

---

## 9. 想定ディレクトリ構成

```
seasonwear/
├── index.html
├── assets/
│   ├── style.css
│   └── app.js
├── data/
│   └── items.json           … バッチ生成（初期はサンプルデータ）
├── config/
│   └── brands.json          … 対象ブランド定義
├── scripts/
│   └── fetch.mjs            … 楽天API取得バッチ
├── .github/workflows/
│   └── update-data.yml     … 1日1回 cron + Pages デプロイ
├── .env.example
├── .gitignore
└── SPEC.md
```

---

## 10. 進め方（段階）

1. **サンプルデータで静的サイトを先に完成**（IDなしでUI・絞り込みが動く状態）。
2. 楽天アプリIDを取得 → Secrets 登録 → バッチを実機データに切替。
3. GitHub Actions で自動更新 + GitHub Pages 公開。
