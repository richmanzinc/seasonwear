// 商品名・説明から「デリバリーシーズン」と「性別」を判定する共通ロジック。
// fetch.mjs（本番API）と gen-sample.mjs（サンプル生成）の両方から使う。

// 全角英数字・空白を半角へ正規化
function normalizeText(s) {
  if (!s) return "";
  return String(s)
    .replace(/[！-～]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/　/g, " ");
}

// 2桁年 → 4桁年（50以上は1900年代、未満は2000年代）
function yy2yyyy(yy) {
  const n = parseInt(yy, 10);
  return n >= 50 ? 1900 + n : 2000 + n;
}

// デリバリーシーズンを検出。見つからなければ null。
// 例: "20AW", "2022SS", "AW22", "22-23AW", "S/S20", "2020 秋冬"
export function parseSeason(rawText) {
  const text = normalizeText(rawText);

  // 年(範囲可) → タイプ の順:  22-23AW / 2020SS / 20 秋冬
  const reYearFirst =
    /(?<![0-9])(\d{4}|\d{2})(?:\s*[-–]\s*(\d{2}))?\s*(S\s*\/?\s*S|A\s*\/?\s*W|春夏|秋冬)/i;
  // タイプ → 年 の順:  AW22 / SS2020 / S/S 20
  const reTypeFirst =
    /(S\s*\/?\s*S|A\s*\/?\s*W|春夏|秋冬)\s*(\d{4}|\d{2})(?:\s*[-–]\s*(\d{2}))?(?![0-9])/i;

  let m = text.match(reYearFirst);
  let startRaw, endRaw, typeRaw;
  if (m) {
    [, startRaw, endRaw, typeRaw] = m;
  } else {
    m = text.match(reTypeFirst);
    if (!m) return null;
    [, typeRaw, startRaw, endRaw] = m;
  }

  // タイプ正規化
  const t = typeRaw.replace(/\s|\//g, "").toUpperCase();
  const seasonType = t === "SS" || t === "春夏" ? "SS" : "AW";

  // 年正規化
  const seasonYear = startRaw.length === 4 ? parseInt(startRaw, 10) : yy2yyyy(startRaw);

  // ラベル（範囲表記対応）
  let seasonLabel = `${seasonYear} ${seasonType}`;
  if (endRaw) {
    const end2 = String(endRaw).padStart(2, "0");
    seasonLabel = `${seasonYear}-${end2} ${seasonType}`;
  }

  return {
    seasonType,
    seasonYear,
    seasonLabel,
    seasonRaw: m[0].trim(),
  };
}

// 性別を判定（MEN / WOMEN / UNISEX）
export function parseGender(rawText) {
  const text = normalizeText(rawText);
  const men = /(メンズ|MEN'?S|MENS|\bMEN\b|男性|紳士)/i.test(text);
  const women = /(レディース|ウィメンズ|ウイメンズ|WOMEN'?S|WMNS|\bWOMEN\b|女性|婦人)/i.test(text);
  if (men && !women) return "MEN";
  if (women && !men) return "WOMEN";
  return "UNISEX";
}

// 楽天APIの1商品(Item)を正規化。シーズン無しなら null（＝不採用）。
export function normalizeItem(rawItem, brand) {
  const name = rawItem.itemName || "";
  const caption = rawItem.itemCaption || "";
  const season = parseSeason(`${name} ${caption}`);
  if (!season) return null; // シーズン表記が無い商品は採用しない

  const image =
    (rawItem.mediumImageUrls && rawItem.mediumImageUrls[0] &&
      (rawItem.mediumImageUrls[0].imageUrl || rawItem.mediumImageUrls[0])) ||
    (rawItem.smallImageUrls && rawItem.smallImageUrls[0] &&
      (rawItem.smallImageUrls[0].imageUrl || rawItem.smallImageUrls[0])) ||
    "";

  return {
    brand: brand.id,
    brandLabel: brand.label,
    category: brand.category,
    seasonType: season.seasonType,
    seasonYear: season.seasonYear,
    seasonLabel: season.seasonLabel,
    seasonRaw: season.seasonRaw,
    gender: parseGender(`${name} ${caption}`),
    title: name,
    price: Number(rawItem.itemPrice) || 0,
    imageUrl: String(image).replace(/\?_ex=\d+x\d+$/, "") || image,
    affiliateUrl: rawItem.affiliateUrl || rawItem.itemUrl || "",
    shopName: rawItem.shopName || "",
    itemCode: rawItem.itemCode || "",
  };
}
