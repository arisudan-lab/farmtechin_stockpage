/**
 * StockFlow - Scan-only Inventory Management
 * Auto-add items using barcode scan
 */

// ==========================================
// Configuration
// ==========================================
const STORAGE_KEY = "stockflow_inventory";
const LOW_STOCK_THRESHOLD = 5;

// ==========================================
// State
// ==========================================
let inventory = [];
let deletingItemId = null;
let cameraStream = null;
let scanCooldown = false;

// ==========================================
// DOM Elements
// ==========================================
const elements = {
  totalItems: document.getElementById("totalItems"),
  totalQuantity: document.getElementById("totalQuantity"),
  totalCategories: document.getElementById("totalCategories"),
  lowStockCount: document.getElementById("lowStockCount"),

  searchInput: document.getElementById("searchInput"),
  categoryFilter: document.getElementById("categoryFilter"),

  tableBody: document.getElementById("inventoryTableBody"),
  emptyState: document.getElementById("emptyState"),

  itemModal: document.getElementById("itemModal"),
  modalClose: document.getElementById("modalClose"),
  addItemBtn: document.getElementById("addItemBtn"),

  deleteModal: document.getElementById("deleteModal"),
  deleteItemName: document.getElementById("deleteItemName"),
  confirmDeleteBtn: document.getElementById("confirmDeleteBtn"),
  cancelDeleteBtn: document.getElementById("cancelDeleteBtn"),
  deleteModalClose: document.getElementById("deleteModalClose"),

  themeToggle: document.getElementById("themeToggle"),
  toastContainer: document.getElementById("toastContainer"),

  video: document.getElementById("camera")
};

// ==========================================
// Storage
// ==========================================
function loadInventory() {
  inventory = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
}

function saveInventory() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(inventory));
}

// ==========================================
// Utils
// ==========================================
function generateId() {
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getCategories() {
  return [...new Set(inventory.map(i => i.category))];
}

// ==========================================
// Toast
// ==========================================
function showToast(msg, type = "success") {
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${msg}</span>`;
  elements.toastContainer.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ==========================================
// Theme
// ==========================================
elements.themeToggle.addEventListener("click", () => {
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  document.documentElement.setAttribute("data-theme", dark ? "light" : "dark");
});

// ==========================================
// Stats
// ==========================================
function updateStats() {
  elements.totalItems.textContent = inventory.length;
  elements.totalQuantity.textContent = inventory.reduce((s, i) => s + i.quantity, 0);
  elements.totalCategories.textContent = getCategories().length;
  elements.lowStockCount.textContent =
    inventory.filter(i => i.quantity < LOW_STOCK_THRESHOLD).length;
}

// ==========================================
// Category Filter
// ==========================================
function updateCategoryFilter() {
  const current = elements.categoryFilter.value;
  elements.categoryFilter.innerHTML = `<option value="all">All Categories</option>`;
  getCategories().forEach(c => {
    const opt = document.createElement("option");
    opt.value = c;
    opt.textContent = c;
    elements.categoryFilter.appendChild(opt);
  });
  elements.categoryFilter.value = current;
}

// ==========================================
// Table Rendering
// ==========================================
function renderTable() {
  const q = elements.searchInput.value.toLowerCase();
  const cat = elements.categoryFilter.value;

  const filtered = inventory.filter(i =>
    (i.name.toLowerCase().includes(q) || i.sku.includes(q)) &&
    (cat === "all" || i.category === cat)
  );

  if (!filtered.length) {
    elements.tableBody.innerHTML = "";
    elements.emptyState.classList.add("visible");
    return;
  }

  elements.emptyState.classList.remove("visible");
  elements.tableBody.innerHTML = filtered.map(rowHTML).join("");
  bindRowEvents();
}

function rowHTML(item) {
  return `
    <tr>
      <td>${item.name}</td>
      <td>${item.sku}</td>
      <td><span class="category-badge">${item.category}</span></td>
      <td>
        <div class="quantity-controls">
          <button class="quantity-btn dec" data-id="${item.id}">−</button>
          <span>${item.quantity}</span>
          <button class="quantity-btn inc" data-id="${item.id}">+</button>
        </div>
      </td>
      <td>${item.unit}</td>
      <td>
        <button class="action-btn delete" data-id="${item.id}">🗑️</button>
      </td>
    </tr>`;
}

function bindRowEvents() {
  document.querySelectorAll(".inc").forEach(b =>
    b.onclick = () => changeQty(b.dataset.id, 1)
  );
  document.querySelectorAll(".dec").forEach(b =>
    b.onclick = () => changeQty(b.dataset.id, -1)
  );
  document.querySelectorAll(".delete").forEach(b =>
    b.onclick = () => openDeleteModal(b.dataset.id)
  );
}

// ==========================================
// Inventory Ops
// ==========================================
function changeQty(id, d) {
  const item = inventory.find(i => i.id === id);
  if (!item) return;
  item.quantity = Math.max(0, item.quantity + d);
  saveInventory();
  updateStats();
  renderTable();
}

// ==========================================
// Delete
// ==========================================
function openDeleteModal(id) {
  deletingItemId = id;
  elements.deleteItemName.textContent =
    inventory.find(i => i.id === id)?.name || "";
  elements.deleteModal.classList.add("active");
}

function closeDeleteModal() {
  elements.deleteModal.classList.remove("active");
  deletingItemId = null;
}

elements.confirmDeleteBtn.onclick = () => {
  inventory = inventory.filter(i => i.id !== deletingItemId);
  saveInventory();
  updateStats();
  updateCategoryFilter();
  renderTable();
  closeDeleteModal();
};

elements.cancelDeleteBtn.onclick = closeDeleteModal;
elements.deleteModalClose.onclick = closeDeleteModal;

// ==========================================
// Camera
// ==========================================
async function startCamera() {
  cameraStream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment" }
  });
  elements.video.srcObject = cameraStream;
}

function stopCamera() {
  cameraStream?.getTracks().forEach(t => t.stop());
  cameraStream = null;
}

// ==========================================
// Auto Scan → Add Item
// ==========================================
function onBarcodeDetected(barcode) {
  if (scanCooldown) return;
  scanCooldown = true;

  const item = inventory.find(i => i.sku === barcode);

  if (item) {
    item.quantity += 1;
  } else {
    inventory.unshift({
      id: generateId(),
      name: "Auto Product",
      sku: barcode,
      category: "General",
      quantity: 1,
      unit: "pcs"
    });
  }

  saveInventory();
  updateStats();
  updateCategoryFilter();
  renderTable();
  showToast("Item added");

  setTimeout(() => scanCooldown = false, 1200);
}

// ==========================================
// Modal
// ==========================================
function openAddModal() {
  elements.itemModal.classList.add("active");
  startCamera();

  // TEMP SIMULATION
  setTimeout(() => onBarcodeDetected("SKU-" + Date.now()), 2000);
}

function closeItemModal() {
  elements.itemModal.classList.remove("active");
  stopCamera();
}

elements.addItemBtn.onclick = openAddModal;
elements.modalClose.onclick = closeItemModal;

// ==========================================
// Init
// ==========================================
function init() {
  loadInventory();
  updateStats();
  updateCategoryFilter();
  renderTable();
  elements.searchInput.oninput = renderTable;
  elements.categoryFilter.onchange = renderTable;
}

document.addEventListener("DOMContentLoaded", init);
