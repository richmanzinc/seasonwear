// SeasonWear フロント: data/items.json を読み、ブランド×シーズン×性別で絞り込み表示。
"use strict";

const state = {
  all: [],
  category: "all",
  gender: "all",
  season: "all",
  sort: "new",
  brands: new Set(), // 空 = すべてのブランド
};

const $ = (sel) => document.querySelector(sel);
const grid = $("#grid");
const emptyMsg = $("#empty");

const yen = (n) => "¥" + Number(n).toLocaleString("ja-JP");

async function init() {
  try {
    const res = await fetch("data/items.json", { cache: "no-store" });
    const data = await res.json();
    state.all = data.items || [];
    renderUpdated(data);
  } catch (e) {
    grid.innerHTML = "";
    emptyMsg.hidden = false;
    emptyMsg.textContent = "データを読み込めませんでした。";
    return;
  }
  buildBrandChips();
  buildSeasonOptions();
  bindControls();
  render();
}

function renderUpdated(data) {
  const el = $("#updated-at");
  if (!data.updatedAt) return;
  const d = new Date(data.updatedAt);
  const label = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} 更新`;
  el.textContent = data.sample ? `サンプルデータ（${label}）` : label;
}

// カテゴリに応じたブランド一覧（データに存在するものだけ）
function brandsForCategory() {
  const seen = new Map();
  for (const it of state.all) {
    if (state.category !== "all" && it.category !== state.category) continue;
    if (!seen.has(it.brand)) seen.set(it.brand, it.brandLabel);
  }
  return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1]));
}

function buildBrandChips() {
  const box = $("#f-brands");
  const list = brandsForCategory();
  box.innerHTML = "";
  for (const [id, label] of list) {
    const b = document.createElement("button");
    b.className = "chip" + (state.brands.has(id) ? " active" : "");
    b.textContent = label;
    b.dataset.id = id;
    b.addEventListener("click", () => {
      if (state.brands.has(id)) state.brands.delete(id);
      else state.brands.add(id);
      b.classList.toggle("active");
      updateBrandCount();
      render();
    });
    box.appendChild(b);
  }
  updateBrandCount();
}

function updateBrandCount() {
  const n = state.brands.size;
  $("#brand-count").textContent = n ? `（${n} 選択中）` : "（タップで複数選択）";
}

function buildSeasonOptions() {
  const sel = $("#f-season");
  // データに実在するシーズンだけを新しい順で
  const map = new Map();
  for (const it of state.all) {
    const key = `${it.seasonYear}-${it.seasonType}`;
    if (!map.has(key)) map.set(key, it);
  }
  const seasons = [...map.values()].sort(
    (a, b) => b.seasonYear - a.seasonYear || (a.seasonType < b.seasonType ? 1 : -1)
  );
  sel.innerHTML = '<option value="all">すべてのシーズン</option>';
  for (const s of seasons) {
    const o = document.createElement("option");
    o.value = `${s.seasonYear}-${s.seasonType}`;
    o.textContent = s.seasonLabel;
    sel.appendChild(o);
  }
}

function bindControls() {
  $("#f-category").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    setSegment("#f-category", btn);
    state.category = btn.dataset.val;
    state.brands.clear(); // カテゴリ変更時はブランド選択をリセット
    buildBrandChips();
    render();
  });
  $("#f-gender").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    setSegment("#f-gender", btn);
    state.gender = btn.dataset.val;
    render();
  });
  $("#f-season").addEventListener("change", (e) => { state.season = e.target.value; render(); });
  $("#f-sort").addEventListener("change", (e) => { state.sort = e.target.value; render(); });
}

function setSegment(sel, btn) {
  $(sel).querySelectorAll("button").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
}

function applyFilters() {
  let items = state.all.slice();
  if (state.category !== "all") items = items.filter((i) => i.category === state.category);
  if (state.brands.size) items = items.filter((i) => state.brands.has(i.brand));
  if (state.gender !== "all")
    items = items.filter((i) => i.gender === state.gender || i.gender === "UNISEX");
  if (state.season !== "all") {
    const [y, t] = state.season.split("-");
    items = items.filter((i) => String(i.seasonYear) === y && i.seasonType === t);
  }
  switch (state.sort) {
    case "price-asc": items.sort((a, b) => a.price - b.price); break;
    case "price-desc": items.sort((a, b) => b.price - a.price); break;
    default:
      items.sort((a, b) => b.seasonYear - a.seasonYear || (a.seasonType < b.seasonType ? 1 : -1));
  }
  return items;
}

const GENDER_LABEL = { MEN: "MEN", WOMEN: "WOMEN", UNISEX: "UNISEX" };

function render() {
  const items = applyFilters();
  $("#result-count").textContent = `${items.length} 件`;
  emptyMsg.hidden = items.length !== 0;

  const frag = document.createDocumentFragment();
  for (const it of items) {
    const a = document.createElement("a");
    a.className = "card";
    a.href = it.affiliateUrl || "#";
    a.target = "_blank";
    a.rel = "sponsored noopener";
    a.innerHTML = `
      <div class="thumb"><img loading="lazy" src="${escapeAttr(it.imageUrl)}" alt="${escapeAttr(it.brandLabel)}"></div>
      <div class="card-body">
        <div class="badges">
          <span class="badge season">${escapeHtml(it.seasonLabel)}</span>
          <span class="badge">${GENDER_LABEL[it.gender] || ""}</span>
        </div>
        <div class="brand-label">${escapeHtml(it.brandLabel)}</div>
        <div class="title">${escapeHtml(it.title)}</div>
        <div class="bottom">
          <span class="price">${yen(it.price)}<span> 税込</span></span>
          <span class="shop">${escapeHtml(it.shopName)}</span>
        </div>
      </div>`;
    frag.appendChild(a);
  }
  grid.innerHTML = "";
  grid.appendChild(frag);
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
const escapeAttr = escapeHtml;

init();
