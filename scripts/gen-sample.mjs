// サンプルの data/items.json を生成する（楽天IDが無くてもUIを確認できるように）。
// 本番の parse.mjs を通すので、タグ付けロジックは実データと同一。
//   node scripts/gen-sample.mjs

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { normalizeItem } from "./parse.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const SEASONS = ["24SS", "23AW", "23SS", "22-23AW", "22SS", "21AW", "20AW"];
const MEN = [
  { g: "メンズ", items: ["ウール チェスターコート", "中綿 MA-1 ブルゾン", "テーラード ジャケット", "ニット セーター", "カーゴ パンツ", "レザー ブーツ"] },
];
const WOMEN = [
  { g: "レディース", items: ["ロング ワンピース", "ダブル コート", "プリーツ スカート", "モヘア ニット", "ウール スラックス", "ショート ブルゾン"] },
];
const UNI = ["オーバーサイズ シャツ", "スウェット プルオーバー", "ナイロン アノラック", "デニム ジャケット"];

// 簡易乱数（毎回同じ結果にする）
let seed = 42;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const price = () => 6800 + Math.floor(rnd() * 60) * 1000;

// ブランド色でラベル入りのSVGプレースホルダ画像（オフラインでも表示できる）
function placeholder(label, hue) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="360"><rect width="100%" height="100%" fill="hsl(${hue},12%,88%)"/><rect y="300" width="100%" height="60" fill="hsl(${hue},18%,80%)"/><text x="150" y="180" font-family="sans-serif" font-size="20" fill="hsl(${hue},20%,45%)" text-anchor="middle">${label}</text><text x="150" y="335" font-family="sans-serif" font-size="13" fill="hsl(${hue},18%,40%)" text-anchor="middle">sample image</text></svg>`;
  return "data:image/svg+xml;utf8," + encodeURIComponent(svg);
}

function searchUrl(label, season) {
  return "https://search.rakuten.co.jp/search/mall/" + encodeURIComponent(`${label} ${season} 古着`);
}

async function main() {
  const brandsCfg = JSON.parse(await readFile(join(ROOT, "config", "brands.json"), "utf8"));
  const shopsCfg = JSON.parse(await readFile(join(ROOT, "config", "shops.json"), "utf8"));
  const SHOPS = (shopsCfg.trusted || []).map((s) => s.name); // 大手ショップ名のみ
  const out = [];
  let hue = 0;

  for (const brand of brandsCfg.brands) {
    hue = (hue + 37) % 360;
    const n = 2 + Math.floor(rnd() * 3); // 2〜4件
    for (let i = 0; i < n; i++) {
      const season = pick(SEASONS);
      const bucket = rnd();
      let gender, garment;
      if (bucket < 0.45) { gender = pick(MEN); garment = `メンズ ${pick(gender.items)}`; }
      else if (bucket < 0.9) { gender = pick(WOMEN); garment = `レディース ${pick(gender.items)}`; }
      else { garment = pick(UNI); }

      const title = `${brand.label} ${season} ${garment}`;
      const raw = {
        itemName: title,
        itemCaption: `${brand.label} の古着。${season} シーズンのアイテムです。中古USED。`,
        itemPrice: price(),
        mediumImageUrls: [{ imageUrl: placeholder(brand.label, hue) }],
        affiliateUrl: searchUrl(brand.label, season),
        shopName: pick(SHOPS),
        itemCode: `${brand.id}:${season}:${i}`,
      };
      const norm = normalizeItem(raw, brand);
      if (norm) out.push(norm);
    }
  }

  out.sort((a, b) => b.seasonYear - a.seasonYear || (a.seasonType < b.seasonType ? 1 : -1));
  const payload = { updatedAt: new Date().toISOString(), count: out.length, sample: true, items: out };
  await writeFile(join(ROOT, "data", "items.json"), JSON.stringify(payload, null, 2) + "\n");
  console.log(`サンプル ${out.length} 件を data/items.json に生成しました。`);
}

main().catch((e) => { console.error(e); process.exit(1); });
