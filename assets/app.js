// SeasonWear フロント: data/items.json を読み、ブランド×シーズン×性別で絞り込み表示。
"use strict";

const state = {
  all: [],
  gender: "all",
  year: "all",
  type: "all",
  sort: "new",
  brands: new Set(), // 空 = すべてのブランド
  brandQuery: "", // ブランド検索欄の入力
  brandSearchText: {}, // id -> ラベル+キーワードの検索用文字列（日本語読み含む）
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
    /* fallthrough */
  }
  try {
    // ブランド検索を日本語読み（keywords）でも効かせるため config を読む
    const bRes = await fetch("config/brands.json", { cache: "no-store" });
    const bData = await bRes.json();
    for (const b of bData.brands || []) {
      state.brandSearchText[b.id] = `${b.label} ${(b.keywords || []).join(" ")}`.toLowerCase();
    }
  } catch (e) {
    /* config が読めなくてもラベル検索は動く */
  }
  if (!state.all.length) {
    grid.innerHTML = "";
    emptyMsg.hidden = false;
    emptyMsg.textContent = "データを読み込めませんでした。";
    return;
  }
  buildBrandChips();
  buildYearOptions();
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

// データに存在するブランド一覧（id→label）
function allBrands() {
  const seen = new Map();
  for (const it of state.all) if (!seen.has(it.brand)) seen.set(it.brand, it.brandLabel);
  return [...seen.entries()].sort((a, b) => a[1].localeCompare(b[1], "ja"));
}

function buildBrandChips() {
  const box = $("#f-brands");
  const q = state.brandQuery.trim().toLowerCase();
  const list = allBrands().filter(([id, label]) => {
    if (!q || state.brands.has(id)) return true;
    const st = state.brandSearchText[id] || label.toLowerCase();
    return st.includes(q);
  });
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
  if (!list.length) {
    const p = document.createElement("span");
    p.className = "muted";
    p.textContent = "該当するブランドがありません";
    box.appendChild(p);
  }
  updateBrandCount();
}

function updateBrandCount() {
  const n = state.brands.size;
  $("#brand-count").textContent = n ? `（${n} 選択中）` : "（タップで複数選択）";
}

function buildYearOptions() {
  const sel = $("#f-year");
  // データに実在する年だけを新しい順で
  const years = [...new Set(state.all.map((i) => i.seasonYear))].sort((a, b) => b - a);
  sel.innerHTML = '<option value="all">すべての年</option>';
  for (const y of years) {
    const o = document.createElement("option");
    o.value = String(y);
    o.textContent = `${y} 年`;
    sel.appendChild(o);
  }
}

function bindControls() {
  $("#f-gender").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    setSegment("#f-gender", btn);
    state.gender = btn.dataset.val;
    render();
  });
  $("#f-year").addEventListener("change", (e) => { state.year = e.target.value; render(); });
  $("#f-type").addEventListener("change", (e) => { state.type = e.target.value; render(); });
  $("#f-sort").addEventListener("change", (e) => { state.sort = e.target.value; render(); });
  $("#f-brand-search").addEventListener("input", (e) => {
    state.brandQuery = e.target.value;
    buildBrandChips();
  });
}

function setSegment(sel, btn) {
  $(sel).querySelectorAll("button").forEach((b) => b.classList.remove("active"));
  btn.classList.add("active");
}

function applyFilters() {
  let items = state.all.slice();
  if (state.brands.size) items = items.filter((i) => state.brands.has(i.brand));
  if (state.gender !== "all")
    items = items.filter((i) => i.gender === state.gender || i.gender === "UNISEX");
  if (state.year !== "all") items = items.filter((i) => String(i.seasonYear) === state.year);
  if (state.type !== "all") items = items.filter((i) => i.seasonType === state.type);
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
