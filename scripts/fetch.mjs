// 楽天市場 商品検索API からブランド別に古着を取得し、
// デリバリーシーズンが明記された商品だけを data/items.json に書き出す。
//
// 使い方:
//   RAKUTEN_APP_ID=xxx RAKUTEN_AFFILIATE_ID=yyy node scripts/fetch.mjs
//   （ローカルは .env に書けば自動で読み込む）

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { normalizeItem } from "./parse.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const API = "https://app.rakuten.co.jp/services/api/IchibaItem/Search/20220601";

// 取得パラメータ（省エネ設定）
const PAGES_PER_KEYWORD = 2;   // キーワードごとに取得するページ数（1ページ30件）
const HITS = 30;               // 1ページ件数（最大30）
const MAX_PER_BRAND = 48;      // シーズン絞り込み後のブランド上限
const SLEEP_MS = 1100;         // API マナー（1リクエスト/秒強）
const USED_KEYWORD = "古着";    // 横断検索に付与する語

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// .env をごく簡易に読む（依存ライブラリなし）
async function loadDotenv() {
  try {
    const txt = await readFile(join(ROOT, ".env"), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    /* .env が無くてもOK */
  }
}

async function searchPage({ appId, affId, keyword, page }) {
  const url = new URL(API);
  url.searchParams.set("applicationId", appId);
  if (affId) url.searchParams.set("affiliateId", affId);
  url.searchParams.set("keyword", keyword);
  url.searchParams.set("hits", String(HITS));
  url.searchParams.set("page", String(page));
  url.searchParams.set("imageFlag", "1"); // 画像ありのみ
  url.searchParams.set("format", "json");
  url.searchParams.set("formatVersion", "2"); // Items を素の配列で返す

  const res = await fetch(url, { headers: { "User-Agent": "seasonwear-bot" } });
  if (res.status === 429) {
    await sleep(3000);
    return searchPage({ appId, affId, keyword, page });
  }
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
  const data = await res.json();
  // formatVersion=2 では data.Items が Item オブジェクトの配列
  return Array.isArray(data.Items) ? data.Items : [];
}

async function main() {
  await loadDotenv();
  const appId = process.env.RAKUTEN_APP_ID;
  const affId = process.env.RAKUTEN_AFFILIATE_ID;
  if (!appId) {
    console.error("ERROR: RAKUTEN_APP_ID が未設定です（Rakuten Developers のアプリIDが必要）。");
    process.exit(1);
  }
  if (!affId) {
    console.warn("WARN: RAKUTEN_AFFILIATE_ID が未設定。アフィリエイトリンクは付きません。");
  }

  const brandsCfg = JSON.parse(await readFile(join(ROOT, "config", "brands.json"), "utf8"));
  const allItems = [];

  for (const brand of brandsCfg.brands) {
    const seen = new Set();
    const picked = [];

    for (const kw of brand.keywords) {
      if (picked.length >= MAX_PER_BRAND) break;
      const keyword = `${kw} ${USED_KEYWORD}`;

      for (let page = 1; page <= PAGES_PER_KEYWORD; page++) {
        if (picked.length >= MAX_PER_BRAND) break;
        let raw;
        try {
          raw = await searchPage({ appId, affId, keyword, page });
        } catch (e) {
          console.warn(`  skip ${brand.id} "${keyword}" p${page}: ${e.message}`);
          await sleep(SLEEP_MS);
          continue;
        }
        for (const item of raw) {
          const norm = normalizeItem(item, brand);
          if (!norm) continue; // シーズン表記なし → 不採用
          if (seen.has(norm.itemCode)) continue;
          seen.add(norm.itemCode);
          picked.push(norm);
          if (picked.length >= MAX_PER_BRAND) break;
        }
        await sleep(SLEEP_MS);
        if (raw.length < HITS) break; // これ以上ページが無い
      }
    }

    console.log(`${brand.label}: ${picked.length} 件（シーズン明記のみ）`);
    allItems.push(...picked);
  }

  // 新しいシーズン順 → 価格順に並べておく（UIでも並べ替え可）
  allItems.sort(
    (a, b) => b.seasonYear - a.seasonYear || (a.seasonType < b.seasonType ? 1 : -1)
  );

  const out = { updatedAt: new Date().toISOString(), count: allItems.length, items: allItems };
  await writeFile(join(ROOT, "data", "items.json"), JSON.stringify(out, null, 2) + "\n");
  console.log(`\n合計 ${allItems.length} 件を data/items.json に書き出しました。`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
