/**
 * StockFlow - Inventory Management System
 * A lightweight, vanilla JS inventory tracker with localStorage persistence
 */

// ==========================================
// Configuration & Constants
// ==========================================
const STORAGE_KEY = 'stockflow_inventory';
const LOW_STOCK_THRESHOLD = 5;

// ==========================================
// State Management
// ==========================================
let inventory = [];
let editingItemId = null;
let deletingItemId = null;

// ==========================================
// DOM Elements
// ==========================================
const elements = {
  // Stats
  totalItems: document.getElementById('totalItems'),
  totalQuantity: document.getElementById('totalQuantity'),
  totalCategories: document.getElementById('totalCategories'),
  lowStockCount: document.getElementById('lowStockCount'),
  
  // Search & Filter
  searchInput: document.getElementById('searchInput'),
  categoryFilter: document.getElementById('categoryFilter'),
  
  // Table
  tableBody: document.getElementById('inventoryTableBody'),
  emptyState: document.getElementById('emptyState'),
  
  // Add/Edit Modal
  itemModal: document.getElementById('itemModal'),
  modalTitle: document.getElementById('modalTitle'),
  itemForm: document.getElementById('itemForm'),
  itemId: document.getElementById('itemId'),
  itemName: document.getElementById('itemName'),
  itemSku: document.getElementById('itemSku'),
  itemCategory: document.getElementById('itemCategory'),
  itemQuantity: document.getElementById('itemQuantity'),
  itemUnit: document.getElementById('itemUnit'),
  itemNotes: document.getElementById('itemNotes'),
  addItemBtn: document.getElementById('addItemBtn'),
  cancelBtn: document.getElementById('cancelBtn'),
  modalClose: document.getElementById('modalClose'),
  
  // Delete Modal
  deleteModal: document.getElementById('deleteModal'),
  deleteItemName: document.getElementById('deleteItemName'),
  confirmDeleteBtn: document.getElementById('confirmDeleteBtn'),
  cancelDeleteBtn: document.getElementById('cancelDeleteBtn'),
  deleteModalClose: document.getElementById('deleteModalClose'),
  
  // Theme & Toast
  themeToggle: document.getElementById('themeToggle'),
  toastContainer: document.getElementById('toastContainer'),
};

// ==========================================
// LocalStorage Functions
// ==========================================

/**
 * Load inventory from localStorage
 */
function loadInventory() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    inventory = stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Error loading inventory:', error);
    inventory = [];
  }
}

/**
 * Save inventory to localStorage
 */
function saveInventory() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(inventory));
  } catch (error) {
    console.error('Error saving inventory:', error);
    showToast('Failed to save data', 'error');
  }
}

// ==========================================
// Utility Functions
// ==========================================

/**
 * Generate a unique ID for new items
 */
function generateId() {
  return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get current ISO timestamp
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Get all unique categories from inventory
 */
function getCategories() {
  return [...new Set(inventory.map(item => item.category))].sort();
}

// ==========================================
// Toast Notifications
// ==========================================

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - 'success' or 'error'
 */
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✓' : '✕'}</span>
    <span class="toast-message">${message}</span>
  `;
  
  elements.toastContainer.appendChild(toast);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ==========================================
// Theme Management
// ==========================================

/**
 * Initialize and handle dark mode toggle
 */
function initTheme() {
  // Check for saved theme preference or system preference
  const savedTheme = localStorage.getItem('stockflow_theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
  
  // Toggle theme on button click
  elements.themeToggle.addEventListener('click', () => {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('stockflow_theme', newTheme);
  });
}

// ==========================================
// Stats Dashboard
// ==========================================

/**
 * Update the dashboard statistics
 */
function updateStats() {
  const totalItems = inventory.length;
  const totalQuantity = inventory.reduce((sum, item) => sum + item.quantity, 0);
  const categories = getCategories().length;
  const lowStock = inventory.filter(item => item.quantity < LOW_STOCK_THRESHOLD).length;
  
  elements.totalItems.textContent = totalItems;
  elements.totalQuantity.textContent = totalQuantity;
  elements.totalCategories.textContent = categories;
  elements.lowStockCount.textContent = lowStock;
}

// ==========================================
// Category Filter
// ==========================================

/**
 * Update the category filter dropdown with current categories
 */
function updateCategoryFilter() {
  const categories = getCategories();
  const currentValue = elements.categoryFilter.value;
  
  // Clear existing options except "All Categories"
  elements.categoryFilter.innerHTML = '<option value="all">All Categories</option>';
  
  // Add category options
  categories.forEach(category => {
    const option = document.createElement('option');
    option.value = category;
    option.textContent = category;
    elements.categoryFilter.appendChild(option);
  });
  
  // Restore selected value if it still exists
  if (categories.includes(currentValue)) {
    elements.categoryFilter.value = currentValue;
  }
}

// ==========================================
// Inventory Table
// ==========================================

/**
 * Render the inventory table with filtered items
 */
function renderTable() {
  const searchQuery = elements.searchInput.value.toLowerCase();
  const categoryFilter = elements.categoryFilter.value;
  
  // Filter items based on search and category
  const filteredItems = inventory.filter(item => {
    const matchesSearch = 
      item.name.toLowerCase().includes(searchQuery) ||
      item.sku.toLowerCase().includes(searchQuery);
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });
  
  // Show/hide empty state
  if (filteredItems.length === 0) {
    elements.tableBody.innerHTML = '';
    elements.emptyState.classList.add('visible');
  } else {
    elements.emptyState.classList.remove('visible');
    elements.tableBody.innerHTML = filteredItems.map(item => createTableRow(item)).join('');
  }
  
  // Attach event listeners to new elements
  attachRowEventListeners();
}

/**
 * Create HTML for a table row
 * @param {object} item - The inventory item
 */
function createTableRow(item) {
  const isLowStock = item.quantity < LOW_STOCK_THRESHOLD;
  
  return `
    <tr data-id="${item.id}">
      <td>
        <div class="item-name">${escapeHtml(item.name)}</div>
        ${item.notes ? `<div class="item-notes">${escapeHtml(item.notes)}</div>` : ''}
      </td>
      <td>${escapeHtml(item.sku)}</td>
      <td><span class="category-badge">${escapeHtml(item.category)}</span></td>
      <td>
        <div class="quantity-controls">
          <button class="quantity-btn decrease" data-id="${item.id}">−</button>
          <span class="quantity-value">${item.quantity}</span>
          <button class="quantity-btn increase" data-id="${item.id}">+</button>
        </div>
        ${isLowStock ? '<span class="low-stock-badge">⚠️ Low</span>' : ''}
      </td>
      <td>${escapeHtml(item.unit)}</td>
      <td>
        <div class="action-buttons">
          <button class="action-btn edit" data-id="${item.id}" title="Edit">✏️</button>
          <button class="action-btn delete" data-id="${item.id}" title="Delete">🗑️</button>
        </div>
      </td>
    </tr>
  `;
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Attach event listeners to table row buttons
 */
function attachRowEventListeners() {
  // Quantity increase buttons
  document.querySelectorAll('.quantity-btn.increase').forEach(btn => {
    btn.addEventListener('click', () => updateQuantity(btn.dataset.id, 1));
  });
  
  // Quantity decrease buttons
  document.querySelectorAll('.quantity-btn.decrease').forEach(btn => {
    btn.addEventListener('click', () => updateQuantity(btn.dataset.id, -1));
  });
  
  // Edit buttons
  document.querySelectorAll('.action-btn.edit').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });
  
  // Delete buttons
  document.querySelectorAll('.action-btn.delete').forEach(btn => {
    btn.addEventListener('click', () => openDeleteModal(btn.dataset.id));
  });
}

// ==========================================
// CRUD Operations
// ==========================================

/**
 * Add a new item to inventory
 * @param {object} itemData - The item data (without id and timestamps)
 */
function addItem(itemData) {
  const newItem = {
    ...itemData,
    id: generateId(),
    createdAt: getTimestamp(),
    updatedAt: getTimestamp(),
  };
  
  inventory.unshift(newItem); // Add to beginning of array
  saveInventory();
  updateStats();
  updateCategoryFilter();
  renderTable();
  showToast(`${newItem.name} added successfully`);
}

/**
 * Update an existing item
 * @param {string} id - The item ID
 * @param {object} updates - The fields to update
 */
function updateItem(id, updates) {
  const index = inventory.findIndex(item => item.id === id);
  if (index !== -1) {
    inventory[index] = {
      ...inventory[index],
      ...updates,
      updatedAt: getTimestamp(),
    };
    saveInventory();
    updateStats();
    updateCategoryFilter();
    renderTable();
    showToast(`${inventory[index].name} updated successfully`);
  }
}

/**
 * Update item quantity
 * @param {string} id - The item ID
 * @param {number} delta - Amount to add (positive) or subtract (negative)
 */
function updateQuantity(id, delta) {
  const item = inventory.find(item => item.id === id);
  if (item) {
    const newQuantity = Math.max(0, item.quantity + delta);
    updateItem(id, { quantity: newQuantity });
  }
}

/**
 * Delete an item from inventory
 * @param {string} id - The item ID
 */
function deleteItem(id) {
  const item = inventory.find(item => item.id === id);
  if (item) {
    inventory = inventory.filter(item => item.id !== id);
    saveInventory();
    updateStats();
    updateCategoryFilter();
    renderTable();
    showToast(`${item.name} deleted`);
  }
}

// ==========================================
// Modal Handling
// ==========================================

/**
 * Open the add item modal
 */
function openAddModal() {
  editingItemId = null;
  elements.modalTitle.textContent = 'Add New Item';
  elements.itemForm.reset();
  elements.itemModal.classList.add('active');
  elements.itemName.focus();
}

/**
 * Open the edit item modal
 * @param {string} id - The item ID to edit
 */
function openEditModal(id) {
  const item = inventory.find(item => item.id === id);
  if (!item) return;
  
  editingItemId = id;
  elements.modalTitle.textContent = 'Edit Item';
  
  // Populate form with item data
  elements.itemName.value = item.name;
  elements.itemSku.value = item.sku;
  elements.itemCategory.value = item.category;
  elements.itemQuantity.value = item.quantity;
  elements.itemUnit.value = item.unit;
  elements.itemNotes.value = item.notes || '';
  
  elements.itemModal.classList.add('active');
  elements.itemName.focus();
}

/**
 * Close the add/edit modal
 */
function closeItemModal() {
  elements.itemModal.classList.remove('active');
  editingItemId = null;
}

/**
 * Open the delete confirmation modal
 * @param {string} id - The item ID to delete
 */
function openDeleteModal(id) {
  const item = inventory.find(item => item.id === id);
  if (!item) return;
  
  deletingItemId = id;
  elements.deleteItemName.textContent = item.name;
  elements.deleteModal.classList.add('active');
}

/**
 * Close the delete confirmation modal
 */
function closeDeleteModal() {
  elements.deleteModal.classList.remove('active');
  deletingItemId = null;
}

// ==========================================
// Form Handling
// ==========================================

/**
 * Handle form submission for add/edit
 * @param {Event} e - The submit event
 */
function handleFormSubmit(e) {
  e.preventDefault();
  
  const itemData = {
    name: elements.itemName.value.trim(),
    sku: elements.itemSku.value.trim(),
    category: elements.itemCategory.value.trim(),
    quantity: parseInt(elements.itemQuantity.value, 10),
    unit: elements.itemUnit.value,
    notes: elements.itemNotes.value.trim(),
  };
  
  if (editingItemId) {
    updateItem(editingItemId, itemData);
  } else {
    addItem(itemData);
  }
  
  closeItemModal();
}

// ==========================================
// Event Listeners Setup
// ==========================================

function initEventListeners() {
  // Add item button
  elements.addItemBtn.addEventListener('click', openAddModal);
  
  // Form submission
  elements.itemForm.addEventListener('submit', handleFormSubmit);
  
  // Modal close buttons
  elements.modalClose.addEventListener('click', closeItemModal);
  elements.cancelBtn.addEventListener('click', closeItemModal);
  
  // Close modal on overlay click
  elements.itemModal.addEventListener('click', (e) => {
    if (e.target === elements.itemModal) closeItemModal();
  });
  
  // Delete modal
  elements.deleteModalClose.addEventListener('click', closeDeleteModal);
  elements.cancelDeleteBtn.addEventListener('click', closeDeleteModal);
  elements.confirmDeleteBtn.addEventListener('click', () => {
    if (deletingItemId) {
      deleteItem(deletingItemId);
      closeDeleteModal();
    }
  });
  
  elements.deleteModal.addEventListener('click', (e) => {
    if (e.target === elements.deleteModal) closeDeleteModal();
  });
  
  // Search and filter
  elements.searchInput.addEventListener('input', renderTable);
  elements.categoryFilter.addEventListener('change', renderTable);
  
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeItemModal();
      closeDeleteModal();
    }
  });
}

// ==========================================
// Initialization
// ==========================================

/**
 * Initialize the application
 */
function init() {
  loadInventory();
  initTheme();
  initEventListeners();
  updateStats();
  updateCategoryFilter();
  renderTable();
  
  console.log('📦 StockFlow initialized successfully!');
}

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', init);

const video = document.getElementById("camera");
let cameraStream = null;

/* Start camera */
async function startCamera() {
  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }
    });
    video.srcObject = cameraStream;
  } catch (err) {
    showToast("Camera access denied", "error");
  }
}

/* Stop camera */
function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
}

/* Open modal */
function openAddModal() {
  document.getElementById("itemModal").classList.add("active");
  startCamera();
}

/* Close modal */
function closeItemModal() {
  document.getElementById("itemModal").classList.remove("active");
  stopCamera();
}

/* Buttons */
document.getElementById("addItemBtn").onclick = openAddModal;
document.getElementById("modalClose").onclick = closeItemModal;
document.getElementById("cancelBtn").onclick = closeItemModal;

/* Temporary save */
document.getElementById("saveBtn").onclick = () => {
  showToast("Barcode scanning logic pending", "error");
};
