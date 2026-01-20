// ==============================
// DOM: Items UI
// ==============================
const nameInput = document.getElementById("itemName");
const qtyInput = document.getElementById("itemQty");
const expInput = document.getElementById("itemExp");
const addBtn = document.getElementById("addBtn");
const list = document.getElementById("list");

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
  if (label) label.textContent = `Current Fridge: ${getFridgeName(fridgeId) || fridgeId}`;
}

// ==============================
// ITEMS STORAGE
// ==============================
function loadFridge(fridgeId) {
  items = JSON.parse(localStorage.getItem(itemsKey(fridgeId))) || [];
  updateFridgeHeader(fridgeId);
  render();
}

function saveFridge() {
  const id = getCurrentFridgeId();
  if (id) localStorage.setItem(itemsKey(id), JSON.stringify(items));
}

function saveAndRender() {
  saveFridge();
  render();
}

// ==============================
// RENDER ITEMS
// ==============================
function render() {
  if (!getCurrentFridgeId()) return;
  list.innerHTML = "";

  items.sort((a, b) => daysLeft(a.exp) - daysLeft(b.exp)).forEach((item, i) => {
    const days = daysLeft(item.exp);
    const li = document.createElement("li");
    li.innerHTML = `
      <div class="item-row">
        <div class="item-text">
          ${item.name} (x${item.qty}) — ${days <= 0 ? "EXPIRED" : `${days} day(s)`}
          <div class="bar ${freshnessClass(days)}"></div>
        </div>
        <button class="del">✕</button>
      </div>
    `;
    li.querySelector(".del").onclick = () => {
      items.splice(i, 1);
      saveAndRender();
    };
    list.appendChild(li);
  });
}

// ==============================
// ADD ITEM
// ==============================
addBtn?.addEventListener("click", () => {
  const name = nameInput.value.trim();
  const qty = Number(qtyInput.value || 1);
  const exp = expInput.value;
  if (!name || !exp) return;
  items.push({ name, qty, exp });
  nameInput.value = qtyInput.value = expInput.value = "";
  saveAndRender();
});

// ==============================
// FLOWS
// ==============================
function boot() {
  getOrCreateLocalUserId();
  const id = getCurrentFridgeId();
  id ? (showScreen("appRoot"), loadFridge(id)) : showScreen("onboarding");
}

function beginCreateFlow() {
  showScreen("createSetup");
}

function finalizeCreateFlow() {
  const name = $("createFridgeNameInput").value.trim();
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
  const code = $("joinCodeInput").value.trim().toUpperCase();
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
  $("infoFridgeName").textContent = getFridgeName(id);
  $("infoFridgeCode").textContent = id;
  showScreen("fridgeInfo");
}

async function copyFridgeCode() {
  await navigator.clipboard.writeText(getCurrentFridgeId());
  alert("Code copied ✅");
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
  boot();
});
