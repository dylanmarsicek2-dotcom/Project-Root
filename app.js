// ==============================
// CONSTANTS
// ==============================
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Tune these if you want
const NEEDS_ATTENTION_DAYS = 3;   // items expiring in <= 3 days show up
const NEEDS_ATTENTION_MAX  = 5;   // max pills shown on dashboard

// ==============================
// STORAGE KEYS + MODELS
// ==============================
const STORAGE_KEYS = {
  fridgeId: "fridji_fridge_id",
  userId: "fridji_user_id",
  fridges: "fridji_fridges",
};

function itemsKey(fridgeId) {
  return `fridji_items_${fridgeId}`;
}

let items = [];

// ==============================
// HELPERS
// ==============================
function $(id) { return document.getElementById(id); }

function showScreen(screenId) {
  const screens = ["onboarding", "createSetup", "createdScreen", "joinConfirm", "fridgeInfo", "appRoot"];
  screens.forEach(s => $(s)?.classList.add("hidden"));
  $(screenId)?.classList.remove("hidden");
}

function generateCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function getOrCreateLocalUserId() {
  let id = localStorage.getItem(STORAGE_KEYS.userId);
  if (!id) {
    id = "U_" + crypto.randomUUID();
    localStorage.setItem(STORAGE_KEYS.userId, id);
  }
  return id;
}

// ==============================
// DATE / FRESHNESS
// ==============================
function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysLeft(expDateStr) {
  const today = startOfDay(new Date());
  const exp = startOfDay(new Date(expDateStr + "T00:00:00"));
  return Math.ceil((exp - today) / MS_PER_DAY);
}

function freshnessClass(days) {
  if (days <= 0) return "expired";
  if (days <= 2) return "bad";
  if (days <= 5) return "warn";
  return "good";
}

// Dashboard “pill” status (uses your existing CSS: .pill.good + .dot.good)
function attentionStatus(days) {
  if (days <= 0) return { pill: "good", dot: "good", right: "Expired" }; // keep your look
  if (days <= 1) return { pill: "good", dot: "good", right: "1d" };
  return { pill: "good", dot: "good", right: `${days}d` };
}

// ==============================
// FRIDGE REGISTRY
// ==============================
function getFridgeRegistry() {
  return JSON.parse(localStorage.getItem(STORAGE_KEYS.fridges)) || {};
}

function saveFridgeRegistry(reg) {
  localStorage.setItem(STORAGE_KEYS.fridges, JSON.stringify(reg));
}

function registerFridge(code, name) {
  const reg = getFridgeRegistry();
  reg[code] = { name, createdAt: new Date().toISOString() };
  saveFridgeRegistry(reg);
}

function getFridgeName(code) {
  return getFridgeRegistry()[code]?.name || null;
}

function generateUniqueFridgeCode() {
  let code;
  do {
    code = generateCode();
  } while (getFridgeRegistry()[code]);
  return code;
}

// ==============================
// CURRENT FRIDGE
// ==============================
function getCurrentFridgeId() {
  return localStorage.getItem(STORAGE_KEYS.fridgeId);
}

function setCurrentFridgeId(fridgeId) {
  localStorage.setItem(STORAGE_KEYS.fridgeId, fridgeId);
}

function clearFridge() {
  localStorage.removeItem(STORAGE_KEYS.fridgeId);
}

function updateFridgeHeader(fridgeId) {
  const label = $("currentFridgeLabel");
  if (!label) return;
  label.textContent = `Current Fridge: ${getFridgeName(fridgeId) || fridgeId}`;
}

// ==============================
// ITEMS STORAGE
// ==============================
function loadFridge(fridgeId) {
  items = JSON.parse(localStorage.getItem(itemsKey(fridgeId))) || [];
  updateFridgeHeader(fridgeId);
  renderAll();
}

function saveFridge() {
  const id = getCurrentFridgeId();
  if (id) localStorage.setItem(itemsKey(id), JSON.stringify(items));
}

function saveAndRender() {
  saveFridge();
  renderAll();
}

// ==============================
// RENDER: INVENTORY LIST (viewInventory)
// ==============================
function renderInventoryList() {
  const listEl = $("list");
  if (!listEl) return; // if not on inventory view, just skip

  listEl.innerHTML = "";

  const sorted = [...items].sort((a, b) => daysLeft(a.exp) - daysLeft(b.exp));

  sorted.forEach((item, idx) => {
    const days = daysLeft(item.exp);

    const li = document.createElement("li");
    li.className = days <= 0 ? "expired" : "";

    li.innerHTML = `
      <div class="item-row">
        <div class="item-text">
          ${item.name} (x${item.qty}) — ${days <= 0 ? "EXPIRED" : `${days} day(s)`}
          ${days <= 0 ? `<span class="badge-expired"><span class="warn">⚠️</span>EXPIRED</span>` : ""}
          <div class="bar ${freshnessClass(days)}"></div>
        </div>
        <button class="del">✕</button>
      </div>
    `;

    li.querySelector(".del").onclick = () => {
      // delete using original index in items array, not sorted index
      const realIndex = items.findIndex(
        it => it.name === item.name && it.qty === item.qty && it.exp === item.exp
      );
      if (realIndex !== -1) items.splice(realIndex, 1);
      saveAndRender();
    };

    listEl.appendChild(li);
  });
}

// ==============================
// RENDER: DASHBOARD “NEEDS ATTENTION” (viewDashboard)
// Requires: <div id="needsAttentionList"></div> in index.html
// ==============================
function renderNeedsAttention() {
  const box = $("needsAttentionList");
  if (!box) return; // if you forgot to add the div, nothing will render

  box.innerHTML = "";

  const attention = [...items]
    .map(it => ({ ...it, _days: daysLeft(it.exp) }))
    .sort((a, b) => a._days - b._days)
    .filter(it => it._days <= NEEDS_ATTENTION_DAYS)
    .slice(0, NEEDS_ATTENTION_MAX);

  // If nothing is urgent, show "All good" pill
  if (attention.length === 0) {
    const el = document.createElement("div");
    el.className = "pill good";
    el.innerHTML = `
      <span class="dot good"></span>
      <span>All good</span>
      <span class="right-tag">OK</span>
    `;
    box.appendChild(el);
    return;
  }

  attention.forEach(it => {
    const s = attentionStatus(it._days);

    const pill = document.createElement("div");
    pill.className = `pill ${s.pill}`;
    pill.innerHTML = `
      <span class="dot ${s.dot}"></span>
      <span>${it.name} <span style="opacity:.75;">(x${it.qty})</span></span>
      <span class="right-tag">${s.right}</span>
    `;
    box.appendChild(pill);
  });
}

// ==============================
// MASTER RENDER
// ==============================
function renderAll() {
  if (!getCurrentFridgeId()) return;
  renderInventoryList();
  renderNeedsAttention();
}

// ==============================
// ADD ITEM (Inventory view)
// ==============================
function wireAddItem() {
  const nameInput = $("itemName");
  const qtyInput  = $("itemQty");
  const expInput  = $("itemExp");
  const addBtn    = $("addBtn");

  if (!addBtn || !nameInput || !qtyInput || !expInput) return;

  addBtn.addEventListener("click", () => {
    const name = nameInput.value.trim();
    const qty  = Number(qtyInput.value || 1);
    const exp  = expInput.value;

    if (!name || !exp) return;

    items.push({ name, qty, exp });

    nameInput.value = "";
    qtyInput.value  = "";
    expInput.value  = "";

    saveAndRender();
  });
}

// ==============================
// FLOWS
// ==============================
function boot() {
  getOrCreateLocalUserId();
  const id = getCurrentFridgeId();
  if (id) {
    showScreen("appRoot");
    loadFridge(id);
  } else {
    showScreen("onboarding");
  }
}

function beginCreateFlow() {
  showScreen("createSetup");
}

function finalizeCreateFlow() {
  const name = $("createFridgeNameInput")?.value.trim();
  if (!name) return alert("Name your fridge");

  const code = generateUniqueFridgeCode();
  registerFridge(code, name);
  setCurrentFridgeId(code);

  $("createdFridgeName").textContent = name;
  $("createdFridgeCode").textContent = code;

  showScreen("createdScreen");
}

function continueIntoAppFromCreated() {
  const id = getCurrentFridgeId();
  showScreen("appRoot");
  loadFridge(id);
}

function beginJoinFlow() {
  const code = $("joinCodeInput")?.value.trim().toUpperCase();
  const name = getFridgeName(code);
  if (!name) return alert("Invalid code");

  $("joinFridgeName").textContent = name;
  $("joinFridgeCode").textContent = code;

  window.__pendingJoinCode = code;
  showScreen("joinConfirm");
}

function confirmJoinYes() {
  setCurrentFridgeId(window.__pendingJoinCode);
  showScreen("appRoot");
  loadFridge(window.__pendingJoinCode);
}

function confirmJoinNo() {
  window.__pendingJoinCode = null;
  showScreen("onboarding");
}

// ==============================
// FRIDGE INFO
// ==============================
function openFridgeInfo() {
  const id = getCurrentFridgeId();
  $("infoFridgeName").textContent = getFridgeName(id) || id;
  $("infoFridgeCode").textContent = id;
  showScreen("fridgeInfo");
}

async function copyFridgeCode() {
  try {
    await navigator.clipboard.writeText(getCurrentFridgeId());
    alert("Code copied ✅");
  } catch {
    alert("Couldn’t copy — try manually selecting the code.");
  }
}

function switchFridge() {
  clearFridge();
  items = [];
  showScreen("onboarding");
}

// ==============================
// INIT
// ==============================
document.addEventListener("DOMContentLoaded", () => {
  $("btnCreateFridge")?.addEventListener("click", beginCreateFlow);
  $("btnJoinFridge")?.addEventListener("click", beginJoinFlow);
  $("btnCreateConfirm")?.addEventListener("click", finalizeCreateFlow);
  $("btnCreatedContinue")?.addEventListener("click", continueIntoAppFromCreated);
  $("btnJoinYes")?.addEventListener("click", confirmJoinYes);
  $("btnJoinNo")?.addEventListener("click", confirmJoinNo);

  $("btnFridgeInfo")?.addEventListener("click", openFridgeInfo);
  $("btnCopyFridgeCode")?.addEventListener("click", copyFridgeCode);
  $("btnBackToApp")?.addEventListener("click", () => showScreen("appRoot"));
  $("btnSwitchFridge")?.addEventListener("click", switchFridge);

  // If you have a "Back" button on createSetup, wire it safely
  $("btnCreateCancel")?.addEventListener("click", () => showScreen("onboarding"));

  wireAddItem();
  boot();
});
