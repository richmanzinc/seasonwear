# SeasonWear

デザイナーズ・ラグジュアリーブランドの**古着**を、楽天市場から横断検索し、
**ブランド × デリバリーシーズン × メンズ/ウィメンズ**で絞り込めるアフィリエイトまとめサイト（静的サイト）。

- シーズンは商品名・説明に**明記された個体だけ**を採用（`20AW` / `2022SS` / `22-23AW` など）。推測はしない。
- 商品データは**楽天ウェブサービス 商品検索API**から取得。スクレイピングはしない。
- 詳細仕様は [SPEC.md](./SPEC.md)。

## 構成

```
index.html / assets/        … フロント（ビルド不要の静的サイト）
data/items.json             … 表示データ（バッチ生成。初期はサンプル）
config/brands.json          … 対象ブランド定義（追記で増やせる）
scripts/fetch.mjs           … 楽天APIから取得して items.json を生成
scripts/gen-sample.mjs      … サンプルデータ生成（IDなしでUI確認用）
scripts/parse.mjs           … シーズン/性別の判定ロジック（本番と共通）
.github/workflows/          … 1日1回の自動更新 + Pages デプロイ
```

## ローカルで動かす

```bash
# サンプルデータでUIを確認（楽天ID不要）
node scripts/gen-sample.mjs
python3 -m http.server 8000   # → http://localhost:8000
```

本番データを取得するには楽天のIDが2つ必要（いずれも無料）:

1. **楽天アプリID** … [Rakuten Developers](https://webservice.rakuten.co.jp/) でアプリ登録して発行（商品データ取得用）
2. **楽天アフィリエイトID** … [楽天アフィリエイト](https://affiliate.rakuten.co.jp/)（リンク収益化用）

```bash
cp .env.example .env    # .env に2つのIDを記入
node scripts/fetch.mjs  # data/items.json を本番データで再生成
```

## 公開（GitHub Pages）

1. リポジトリ Settings → Pages → **Source を「GitHub Actions」**に設定（1回だけ）。
2. Settings → Secrets and variables → Actions に以下を登録:
   - `RAKUTEN_APP_ID`
   - `RAKUTEN_AFFILIATE_ID`
3. `.github/workflows/update-data.yml` が毎日データを更新して自動デプロイ。
   手動実行は Actions タブの「Run workflow」から。

> アプリIDの Secret が未設定のうちは、サンプルデータのまま公開されます。

## Google AdSense

広告枠はトップページ（グリッド上/下）と各SEOページ（本文上/下）に設置済み。
未設定の間は「広告スペース」のプレースホルダが表示される。

有効化する手順:

1. AdSense で審査・承認を受ける（サイト公開後）。
2. `config/site.json` を編集:
   - `adsense.enabled` を `true`
   - `adsense.client` に発行された `ca-pub-...`
   - `adsense.slots` に各枠の広告ユニットID（任意。自動広告なら空でも可）
3. 再デプロイ（静的ページは `node scripts/build-pages.mjs` で再生成）。

> 広告の表示位置は `index.html` / 生成ページの `<div class="ad-slot" data-ad="...">` で管理。

## 法的・規約メモ

- 本サイトは楽天アフィリエイトの広告を含む旨を明記（ステマ規制 / 景表法対応）。
- フッタに「Supported by Rakuten Developers」クレジットを表示（楽天ウェブサービス規約）。
- 画像・商品情報はAPIが返す提供データのみ使用。
