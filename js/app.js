/* app.js - DOM controller. All data access goes through DataService. */

const SCOOPS_PER_TUB = 32;
const EXPIRY_WARNING_DAYS = 7;

let session = null;
let products = [];
let categories = [];
let suppliers = [];

const $ = (id) => document.getElementById(id);

/* ---------- helpers ---------- */
function localDateStr() {
  return new Date().toLocaleDateString('en-CA');
}
function isTub(product) {
  const cat = categories.find(c => c.id === product.category_id);
  if (!cat) return false;
  const name = cat.category_name.toLowerCase();
  return name.includes('ice cream') || name.includes('tub');
}
function scoopsAvailable(product) {
  return isTub(product) ? Math.round(product.stock_tubs * SCOOPS_PER_TUB) : product.stock_tubs;
}
function daysUntil(dateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + 'T00:00:00');
  return Math.round((target - today) / 86400000);
}
function isExpired(dateStr) { return daysUntil(dateStr) < 0; }
function isExpiringSoon(dateStr) {
  const d = daysUntil(dateStr);
  return d >= 0 && d <= EXPIRY_WARNING_DAYS;
}
function lookupName(list, id, field) {
  const item = list.find(x => x.id === id);
  return item ? item[field] : '-';
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 2200);
}
function statusBadge(p) {
  if (isExpired(p.expiry_date)) return '<span class="badge badge-dark">Expired</span>';
  if (p.stock_tubs === 0) return '<span class="badge badge-red">Out of Stock</span>';
  if (p.stock_tubs <= p.min_stock_alert) return '<span class="badge badge-yellow">Low Stock</span>';
  return '<span class="badge badge-green">In Stock</span>';
}

/* ---------- loading ---------- */
async function loadAll() {
  [products, categories, suppliers] = await Promise.all([
    DataService.getProducts(), DataService.getCategories(), DataService.getSuppliers()
  ]);
}
async function refreshAll() {
  await loadAll();
  renderSummaryCards(products);
  handleFilter();
  renderOrderProductOptions();
  renderCategoryOptions();
  renderCategoryTable();
  renderSupplierTable();
  await renderOrderTable();
}

/* ---------- renderers ---------- */
function renderSummaryCards(list) {
  $('total-products-count').textContent = list.length;
  $('total-stock-count').textContent = list.reduce((sum, p) => sum + scoopsAvailable(p), 0);
  $('low-stock-count').textContent = list.filter(p => p.stock_tubs <= p.min_stock_alert).length;
  $('expiring-soon-count').textContent = list.filter(p => isExpiringSoon(p.expiry_date)).length;
}

function renderProductTable(list) {
  const tbody = $('product-table-body');
  if (!list.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="muted">No products found.</td></tr>';
    return;
  }
  const isAdmin = session.role === 'Admin';
  tbody.innerHTML = list.map(p => {
    const unit = isTub(p) ? 'tubs' : 'units';
    const stockDisplay = Number.isInteger(p.stock_tubs) ? p.stock_tubs : p.stock_tubs.toFixed(2);
    const unavailable = scoopsAvailable(p) < 1 || isExpired(p.expiry_date);
    const rowClass = isExpired(p.expiry_date) ? 'row-expired' : (isExpiringSoon(p.expiry_date) ? 'row-warning' : '');
    return `
      <tr class="${rowClass}">
        <td><strong>${escapeHtml(p.name)}</strong></td>
        <td>${escapeHtml(lookupName(categories, p.category_id, 'category_name'))}</td>
        <td>${stockDisplay} ${unit}</td>
        <td>${scoopsAvailable(p)}</td>
        <td>${escapeHtml(p.expiry_date)}</td>
        <td>₹${p.price}</td>
        <td>${statusBadge(p)}</td>
        <td>
          <button class="btn btn-sm btn-sell sell-btn" data-id="${p.id}" ${unavailable ? 'disabled' : ''}>Sell 1</button>
          ${isAdmin ? `
            <button class="btn btn-sm btn-edit edit-btn" data-id="${p.id}">Edit</button>
            <button class="btn btn-sm btn-delete delete-btn" data-id="${p.id}">Delete</button>` : ''}
        </td>
      </tr>`;
  }).join('');
}

function renderCategoryOptions() {
  const opts = categories.map(c => `<option value="${c.id}">${escapeHtml(c.category_name)}</option>`).join('');
  const currentFilter = $('category-filter').value;
  $('category-filter').innerHTML = '<option value="">All categories</option>' + opts;
  $('category-filter').value = currentFilter;
  $('category-select').innerHTML = opts;
  $('supplier-select').innerHTML = suppliers.map(s => `<option value="${s.id}">${escapeHtml(s.supplier_name)}</option>`).join('');
}

function renderCategoryTable() {
  $('category-table-body').innerHTML = categories.map(c => `
    <tr><td>${c.id}</td><td>${escapeHtml(c.category_name)}</td><td>${escapeHtml(c.description)}</td>
    <td><button class="btn btn-sm btn-delete delete-category-btn" data-id="${c.id}">Delete</button></td></tr>`).join('');
}

function renderSupplierTable() {
  $('supplier-table-body').innerHTML = suppliers.map(s => `
    <tr><td>${s.id}</td><td>${escapeHtml(s.supplier_name)}</td><td>${escapeHtml(s.phone)}</td><td>${escapeHtml(s.email)}</td>
    <td><button class="btn btn-sm btn-delete delete-supplier-btn" data-id="${s.id}">Delete</button></td></tr>`).join('');
}

async function renderUserTable() {
  const users = await DataService.getUsers();
  $('user-table-body').innerHTML = users.map(u =>
    `<tr><td>${u.id}</td><td>${escapeHtml(u.name)}</td><td>${escapeHtml(u.email)}</td><td>${u.role}</td></tr>`).join('');
}

function renderOrderProductOptions() {
  const available = products.filter(p => scoopsAvailable(p) > 0 && !isExpired(p.expiry_date));
  $('order-product').innerHTML = available.length
    ? available.map(p => `<option value="${p.id}">${escapeHtml(p.name)} (₹${p.price} — ${scoopsAvailable(p)} left)</option>`).join('')
    : '<option value="">No items available</option>';
  updateOrderTotal();
}

async function renderOrderTable() {
  const orders = (await DataService.getOrders()).slice().reverse();
  $('order-table-body').innerHTML = orders.length ? orders.map(o => `
    <tr><td>${o.id}</td><td>${escapeHtml(lookupName(products, o.product_id, 'name'))}</td>
    <td>${o.quantity_scoops}</td><td>₹${o.total_price}</td><td>${o.order_date}</td><td>${escapeHtml(o.staff_name)}</td></tr>`).join('')
    : '<tr><td colspan="6" class="muted">No orders yet.</td></tr>';
}

/* ---------- filtering ---------- */
function handleFilter() {
  const q = $('search-input').value.trim().toLowerCase();
  const cat = $('category-filter').value;
  const filtered = products.filter(p =>
    p.name.toLowerCase().includes(q) && (!cat || p.category_id === Number(cat)));
  renderProductTable(filtered);
}

/* ---------- stock helpers ---------- */
function deductStock(product, qty) {
  const perUnit = isTub(product) ? 1 / SCOOPS_PER_TUB : 1;
  const raw = product.stock_tubs - qty * perUnit;
  return Math.max(0, Math.round(raw * 100000) / 100000);
}

async function sellOne(productId) {
  const p = products.find(x => x.id === productId);
  if (!p || scoopsAvailable(p) < 1) return toast('Out of stock');
  if (isExpired(p.expiry_date)) return toast('This batch has expired');
  await DataService.updateProduct(p.id, { stock_tubs: deductStock(p, 1) });
  await DataService.addOrder({
    product_id: p.id, quantity_scoops: 1, total_price: p.price,
    order_date: localDateStr(), staff_name: session.name
  });
  await refreshAll();
  toast(`Sold 1 × ${p.name}`);
}

/* ---------- modal ---------- */
function openProductModal(product) {
  $('modal-title').textContent = product ? 'Edit Product' : 'Add Product';
  $('product-form').reset();
  $('product-id').value = product ? product.id : '';
  if (product) {
    $('p-name').value = product.name;
    $('category-select').value = product.category_id;
    $('supplier-select').value = product.supplier_id;
    $('p-stock').value = product.stock_tubs;
    $('p-min').value = product.min_stock_alert;
    $('expiry-input').value = product.expiry_date;
    $('p-price').value = product.price;
  }
  $('product-modal').classList.remove('hidden');
}
function closeProductModal() { $('product-modal').classList.add('hidden'); }

/* ---------- navigation + roles ---------- */
function showView(viewId) {
  document.querySelectorAll('.view-section').forEach(s => s.classList.add('hidden'));
  $(viewId).classList.remove('hidden');
  document.querySelectorAll('#sidebar a[data-view]').forEach(a =>
    a.classList.toggle('active', a.dataset.view === viewId));
  if (viewId === 'users-view') renderUserTable();
}

function applyRole() {
  const isAdmin = session.role === 'Admin';
  document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin));
  $('user-info').textContent = `${session.name} (${session.role})`;
  showView(isAdmin ? 'dashboard-view' : 'products-view');
}

function updateOrderTotal() {
  const p = products.find(x => x.id === Number($('order-product').value));
  const qty = Number($('order-qty').value) || 0;
  $('order-total').textContent = `Total: ₹${p ? p.price * qty : 0}`;
}

/* ---------- init ---------- */
document.addEventListener('DOMContentLoaded', async () => {
  session = await DataService.getSession();
  if (!session) { window.location.href = 'index.html'; return; }

  await refreshAll();
  applyRole();

  // Sidebar navigation
  document.querySelectorAll('#sidebar a[data-view]').forEach(a =>
    a.addEventListener('click', () => showView(a.dataset.view)));
  $('logout-link').addEventListener('click', async () => {
    await DataService.logout();
    window.location.href = 'index.html';
  });

  // Search / filter
  $('search-input').addEventListener('input', handleFilter);
  $('category-filter').addEventListener('change', handleFilter);

  // Product modal
  $('add-product-btn').addEventListener('click', () => openProductModal(null));
  $('cancel-modal-btn').addEventListener('click', closeProductModal);
  $('product-modal').addEventListener('click', (e) => {
    if (e.target === $('product-modal')) closeProductModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !$('product-modal').classList.contains('hidden')) closeProductModal();
  });

  $('product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name: $('p-name').value.trim(),
      category_id: Number($('category-select').value),
      supplier_id: Number($('supplier-select').value),
      stock_tubs: Number($('p-stock').value),
      min_stock_alert: Number($('p-min').value),
      expiry_date: $('expiry-input').value,
      price: Number($('p-price').value)
    };
    const id = $('product-id').value;
    if (id) await DataService.updateProduct(Number(id), data);
    else await DataService.addProduct(data);
    closeProductModal();
    await refreshAll();
    toast('Product saved');
  });

  // Event delegation: product table buttons
  $('product-table-body').addEventListener('click', async (e) => {
    const btn = e.target;
    const id = Number(btn.dataset.id);
    if (!id) return;
    if (btn.classList.contains('sell-btn')) await sellOne(id);
    else if (btn.classList.contains('edit-btn')) openProductModal(products.find(p => p.id === id));
    else if (btn.classList.contains('delete-btn')) {
      if (confirm('Delete this product?')) {
        await DataService.deleteProduct(id);
        await refreshAll();
        toast('Product deleted');
      }
    }
  });

  // Orders
  $('order-product').addEventListener('change', updateOrderTotal);
  $('order-qty').addEventListener('input', updateOrderTotal);
  $('order-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const p = products.find(x => x.id === Number($('order-product').value));
    const qty = Number($('order-qty').value);
    if (!p) return toast('Select a product');
    if (qty > scoopsAvailable(p)) return toast(`Only ${scoopsAvailable(p)} available`);
    await DataService.updateProduct(p.id, { stock_tubs: deductStock(p, qty) });
    await DataService.addOrder({
      product_id: p.id, quantity_scoops: qty, total_price: p.price * qty,
      order_date: localDateStr(), staff_name: session.name
    });
    $('order-qty').value = 1;
    await refreshAll();
    toast('Order placed');
  });

  // Categories
  $('category-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await DataService.addCategory({ category_name: $('category-name').value.trim(), description: $('category-desc').value.trim() });
    e.target.reset();
    await refreshAll();
  });
  $('category-table-body').addEventListener('click', async (e) => {
    if (!e.target.classList.contains('delete-category-btn')) return;
    const id = Number(e.target.dataset.id);
    if (products.some(p => p.category_id === id)) return toast('Category has products');
    await DataService.deleteCategory(id);
    await refreshAll();
  });

  // Suppliers
  $('supplier-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await DataService.addSupplier({
      supplier_name: $('supplier-name').value.trim(),
      phone: $('supplier-phone').value.trim(),
      email: $('supplier-email').value.trim()
    });
    e.target.reset();
    await refreshAll();
  });
  $('supplier-table-body').addEventListener('click', async (e) => {
    if (!e.target.classList.contains('delete-supplier-btn')) return;
    const id = Number(e.target.dataset.id);
    if (products.some(p => p.supplier_id === id)) return toast('Supplier has products');
    await DataService.deleteSupplier(id);
    await refreshAll();
  });
});
