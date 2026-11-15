// SEO用の静的ページを事前生成する。
//   - b/index.html                … ブランド一覧
//   - b/<brand>/index.html        … ブランド別ページ（例: sacai の古着）
//   - b/<brand>/<yy><ss|aw>/index.html … ブランド×シーズン（例: sacai 22SS）
//   - sitemap.xml                 … 全ページのサイトマップ
//
// 検索で「ブランド名 22ss」等が、対応する専用ページにヒットするようにする。
//   node scripts/build-pages.mjs
//
// 公開URLのベース（独自ドメインにしたら SITE_BASE 環境変数か下記を変更）
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "b");
const SITE_BASE = (process.env.SITE_BASE || "https://richmanzinc.github.io/seasonwear").replace(/\/$/, "");
const SITE_NAME = "SeasonWear";

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const yen = (n) => "¥" + Number(n).toLocaleString("ja-JP");

const seasonSlug = (it) => `${String(it.seasonYear).slice(-2)}${it.seasonType.toLowerCase()}`; // 22ss
const seasonShort = (it) => `${String(it.seasonYear).slice(-2)}${it.seasonType}`; // 22SS

function cardHTML(it) {
  return `<a class="card" href="${esc(it.affiliateUrl || "#")}" target="_blank" rel="sponsored noopener">
  <div class="thumb"><img loading="lazy" src="${esc(it.imageUrl)}" alt="${esc(it.brandLabel)} ${esc(it.seasonLabel)}"></div>
  <div class="card-body">
    <div class="badges"><span class="badge season">${esc(it.seasonLabel)}</span><span class="badge">${esc(it.gender)}</span></div>
    <div class="brand-label">${esc(it.brandLabel)}</div>
    <div class="title">${esc(it.title)}</div>
    <div class="bottom"><span class="price">${yen(it.price)}<span> 税込</span></span><span class="shop">${esc(it.shopName)}</span></div>
  </div>
</a>`;
}

// depth = ルートからの階層。rel = ルートへの相対パス。
function pageHTML({ depth, title, desc, canonical, h1, lead, breadcrumb, body }) {
  const rel = "../".repeat(depth);
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
<link rel="stylesheet" href="${rel}assets/style.css">
</head>
<body>
<header class="site-header"><div class="wrap">
  <a class="brand brand-link" href="${rel}"><span class="logo">SEASON<span>WEAR</span></span></a>
  <p class="ad-note">本サイトは楽天アフィリエイトによる広告（PR）を含みます</p>
</div></header>
<main class="wrap">
  <nav class="breadcrumb">${breadcrumb}</nav>
  <h1 class="page-h1">${esc(h1)}</h1>
  ${lead ? `<p class="lead">${esc(lead)}</p>` : ""}
  ${body}
  <p class="back"><a href="${rel}">← すべての商品を見る（${esc(SITE_NAME)}）</a></p>
</main>
<footer class="site-footer"><div class="wrap">
  <p>${esc(SITE_NAME)} は楽天市場の商品を紹介するアフィリエイトサイトです。掲載価格・在庫は楽天側の表示が最新です。</p>
  <p class="credit">Supported by <a href="https://webservice.rakuten.co.jp/" target="_blank" rel="noopener">Rakuten Developers</a></p>
</div></footer>
</body>
</html>
`;
}

async function main() {
  const data = JSON.parse(await readFile(join(ROOT, "data", "items.json"), "utf8"));
  const items = data.items || [];
  const brandsCfg = JSON.parse(await readFile(join(ROOT, "config", "brands.json"), "utf8"));
  const brandLabelById = new Map(brandsCfg.brands.map((b) => [b.id, b.label]));

  // クリーンに作り直す
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  // ブランド単位・ブランド×シーズン単位にグループ化
  const byBrand = new Map(); // id -> items[]
  const bySeason = new Map(); // `${id}|${slug}` -> {items, year, type, slug}
  for (const it of items) {
    if (!byBrand.has(it.brand)) byBrand.set(it.brand, []);
    byBrand.get(it.brand).push(it);
    const slug = seasonSlug(it);
    const key = `${it.brand}|${slug}`;
    if (!bySeason.has(key))
      bySeason.set(key, { items: [], year: it.seasonYear, type: it.seasonType, slug, brand: it.brand });
    bySeason.get(key).items.push(it);
  }

  const urls = [`${SITE_BASE}/`, `${SITE_BASE}/b/`];
  const brandsWithItems = [...byBrand.keys()].sort((a, b) =>
    (brandLabelById.get(a) || a).localeCompare(brandLabelById.get(b) || b, "ja"));

  // --- b/index.html（ブランド一覧） ---
  const brandListHTML = `<ul class="brand-index">` +
    brandsWithItems.map((id) => {
      const label = brandLabelById.get(id) || id;
      return `<li><a href="${esc(id)}/">${esc(label)}</a> <span class="muted">(${byBrand.get(id).length})</span></li>`;
    }).join("") + `</ul>`;
  await writeFile(join(OUT, "index.html"), pageHTML({
    depth: 1,
    title: `ブランド一覧 | ${SITE_NAME}`,
    desc: `デザイナーズ・ラグジュアリーブランドの古着をブランド別・シーズン別に探せます。`,
    canonical: `${SITE_BASE}/b/`,
    h1: `ブランド一覧`,
    lead: `ブランドを選ぶと、シーズン別（例: 22SS）の古着一覧に進めます。`,
    breadcrumb: `<a href="../">${esc(SITE_NAME)}</a> › ブランド一覧`,
    body: brandListHTML,
  }));

  // --- ブランド別 & ブランド×シーズン ---
  for (const id of brandsWithItems) {
    const label = brandLabelById.get(id) || id;
    const bItems = byBrand.get(id).slice().sort(
      (a, b) => b.seasonYear - a.seasonYear || (a.seasonType < b.seasonType ? 1 : -1));
    await mkdir(join(OUT, id), { recursive: true });

    // そのブランドのシーズン一覧
    const seasons = [...bySeason.values()]
      .filter((s) => s.brand === id)
      .sort((a, b) => b.year - a.year || (a.type < b.type ? 1 : -1));

    const seasonLinks = seasons.length
      ? `<nav class="season-links"><span class="muted">シーズンで絞り込む:</span> ` +
        seasons.map((s) => `<a href="${s.slug}/">${s.year.toString().slice(-2)}${s.type}</a>`).join(" ") +
        `</nav>`
      : "";

    // ブランドページ
    await writeFile(join(OUT, id, "index.html"), pageHTML({
      depth: 2,
      title: `${label} 古着・中古通販 | ${SITE_NAME}`,
      desc: `${label} の古着・中古アイテムをシーズン別（例: 22SS, 23AW）に探せます。大手ブランド古着チェーンから厳選。`,
      canonical: `${SITE_BASE}/b/${id}/`,
      h1: `${label} の古着`,
      lead: `${label} のデリバリーシーズンが明記された古着を集めました。`,
      breadcrumb: `<a href="../../">${esc(SITE_NAME)}</a> › <a href="../">ブランド一覧</a> › ${esc(label)}`,
      body: seasonLinks + `<div class="grid">` + bItems.map(cardHTML).join("") + `</div>`,
    }));
    urls.push(`${SITE_BASE}/b/${id}/`);

    // ブランド×シーズンページ
    for (const s of seasons) {
      const sItems = s.items.slice().sort((a, b) => a.price - b.price);
      const short = `${s.year.toString().slice(-2)}${s.type}`; // 22SS
      await mkdir(join(OUT, id, s.slug), { recursive: true });
      await writeFile(join(OUT, id, s.slug, "index.html"), pageHTML({
        depth: 3,
        title: `${label} ${short} 古着・中古 | ${SITE_NAME}`,
        desc: `${label} ${short}（${s.year}年${s.type === "SS" ? "春夏" : "秋冬"}）の古着・中古アイテム一覧。大手ブランド古着チェーンから。`,
        canonical: `${SITE_BASE}/b/${id}/${s.slug}/`,
        h1: `${label} ${short} の古着`,
        lead: `${label} ${s.year} ${s.type} コレクションの古着を集めました。`,
        breadcrumb: `<a href="../../../">${esc(SITE_NAME)}</a> › <a href="../../">ブランド一覧</a> › <a href="../">${esc(label)}</a> › ${esc(short)}`,
        body: `<div class="grid">` + sItems.map(cardHTML).join("") + `</div>`,
      }));
      urls.push(`${SITE_BASE}/b/${id}/${s.slug}/`);
    }
  }

  // --- sitemap.xml ---
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${esc(u)}</loc></url>`).join("\n")}
</urlset>
`;
  await writeFile(join(ROOT, "sitemap.xml"), sitemap);

  console.log(`生成完了: ブランド ${brandsWithItems.length} / シーズンページ ${bySeason.size} / URL ${urls.length}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
