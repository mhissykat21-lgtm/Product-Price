// ─── WILCY POS — app.js ─────────────────────────────────────────────────────

const STORE_KEY = 'wilcy_pos_v2';

// Default seed data matching data.json structure
const DEFAULT_DATA = {
  items: [
    { id: 'demo001', name: 'Wireless Earbuds',      sku: 'WE-001', qty: 25, origPrice: 450,  price: 799  },
    { id: 'demo002', name: 'USB-C Hub 7-in-1',      sku: 'UC-007', qty: 4,  origPrice: 620,  price: 950  },
    { id: 'demo003', name: 'Mechanical Keyboard',   sku: 'MK-104', qty: 0,  origPrice: 1200, price: 1850 },
    { id: 'demo004', name: 'Phone Stand Adjustable',sku: 'PS-ADJ', qty: 18, origPrice: 85,   price: 149  }
  ],
  sales: []
};

// ── PERSISTENCE ────────────────────────────────────────────────────────────────

function loadData() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { /* ignore */ }
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

function saveData() {
  localStorage.setItem(STORE_KEY, JSON.stringify(db));
}

// ── STATE ──────────────────────────────────────────────────────────────────────

let db = loadData();
let editingId  = null;
let deleteId   = null;

// ── HELPERS ────────────────────────────────────────────────────────────────────

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function fmt(n) {
  return '₱' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── INIT ───────────────────────────────────────────────────────────────────────

function init() {
  const el = document.getElementById('dateBadge');
  if (el) {
    el.textContent = new Date().toLocaleDateString('en-US', {
      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
    });
  }
  renderAll();
  bindEvents();
}

function renderAll() {
  renderDashboard();
  renderTable();
  renderSalesLog();
  populateSellSelect();
}

// ── DASHBOARD ──────────────────────────────────────────────────────────────────

function renderDashboard() {
  const today      = todayStr();
  const todaySales = db.sales.filter(s => s.date === today);
  const totalItems = todaySales.reduce((a, s) => a + s.qty, 0);
  const totalRev   = todaySales.reduce((a, s) => a + s.revenue, 0);

  setText('totalTxns',    todaySales.length);
  setText('totalItemsSub', `${totalItems} item${totalItems !== 1 ? 's' : ''} sold today`);
  setText('totalRevenue',  fmt(totalRev));
  setText('totalRevSub',   `from ${todaySales.length} transaction${todaySales.length !== 1 ? 's' : ''}`);

  // Best seller — by cumulative quantity across all sales
  const qtyMap = {};
  db.sales.forEach(s => { qtyMap[s.itemId] = (qtyMap[s.itemId] || 0) + s.qty; });

  let bestId = null, bestQty = 0;
  for (const [id, q] of Object.entries(qtyMap)) {
    if (q > bestQty) { bestQty = q; bestId = id; }
  }

  if (bestId) {
    const item = db.items.find(i => i.id === bestId);
    setText('bestSellerName', item ? item.name : 'Unknown');
    setText('bestSellerSub',  `${bestQty} units sold total`);
  } else {
    setText('bestSellerName', '—');
    setText('bestSellerSub',  'no sales recorded yet');
  }
}

function setText(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

// ── INVENTORY TABLE ────────────────────────────────────────────────────────────

function renderTable() {
  const q      = (document.getElementById('searchInput')?.value || '').toLowerCase();
  const body   = document.getElementById('inventoryBody');
  if (!body) return;

  const filtered = db.items.filter(i =>
    i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)
  );

  if (!filtered.length) {
    body.innerHTML = `<tr><td colspan="6">
      <div class="empty-state">
        <div class="empty-icon">📦</div>
        <p>${db.items.length ? 'No items match your search.' : 'No items yet. Click "Add Item" to get started.'}</p>
      </div>
    </td></tr>`;
    return;
  }

  // Best seller lookup
  const qtyMap = {};
  db.sales.forEach(s => { qtyMap[s.itemId] = (qtyMap[s.itemId] || 0) + s.qty; });
  const maxSold = Math.max(0, ...Object.values(qtyMap));

  body.innerHTML = filtered.map(item => {
    const margin  = item.price - item.origPrice;
    const isBest  = maxSold > 0 && (qtyMap[item.id] || 0) === maxSold;
    let qtyClass  = 'qty-ok';
    let badge     = '';

    if (item.qty === 0) {
      qtyClass = 'qty-out';
      badge = '<span class="badge badge-out">Out of Stock</span>';
    } else if (item.qty <= 5) {
      qtyClass = 'qty-low';
      badge = '<span class="badge badge-low">⚠ Low</span>';
    }

    const bestBadge = isBest ? '<span class="badge badge-best">🏆 Best</span>' : '';

    return `<tr>
      <td>
        <div class="td-sku">${escHtml(item.sku)}</div>
        <div class="td-name">${escHtml(item.name)}${bestBadge}${badge}</div>
      </td>
      <td><span class="${qtyClass}">${item.qty}</span></td>
      <td class="td-mono">${fmt(item.origPrice)}</td>
      <td class="td-mono">${fmt(item.price)}</td>
      <td class="${margin >= 0 ? 'margin-pos' : 'margin-neg'}">${margin >= 0 ? '+' : ''}${fmt(margin)}</td>
      <td>
        <div class="td-actions">
          <button class="btn btn-sm btn-sell" onclick="quickSellSelect('${item.id}')">Sell</button>
          <button class="btn btn-sm btn-edit" onclick="openEditModal('${item.id}')">Edit</button>
          <button class="btn btn-sm btn-del"  onclick="openConfirm('${item.id}')">Delete</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ── ADD / EDIT MODAL ───────────────────────────────────────────────────────────

function openAddModal() {
  editingId = null;
  setText('modalTitle', 'Add New Item');
  ['mName','mSku','mQty','mOrigPrice','mPrice'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  openModal('itemModal');
}

function openEditModal(id) {
  const item = db.items.find(i => i.id === id);
  if (!item) return;
  editingId = id;
  setText('modalTitle', 'Edit Item');
  setVal('mName',      item.name);
  setVal('mSku',       item.sku);
  setVal('mQty',       item.qty);
  setVal('mOrigPrice', item.origPrice);
  setVal('mPrice',     item.price);
  openModal('itemModal');
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function saveItem() {
  const name      = document.getElementById('mName')?.value.trim()     || '';
  const sku       = document.getElementById('mSku')?.value.trim()      || '';
  const qty       = parseInt(document.getElementById('mQty')?.value)    ?? NaN;
  const origPrice = parseFloat(document.getElementById('mOrigPrice')?.value) ?? NaN;
  const price     = parseFloat(document.getElementById('mPrice')?.value) ?? NaN;

  if (!name)                        return toast('Item name is required.',          'error');
  if (!sku)                         return toast('SKU is required.',                'error');
  if (isNaN(qty)  || qty  < 0)      return toast('Enter a valid quantity.',         'error');
  if (isNaN(origPrice) || origPrice < 0) return toast('Enter a valid original price.','error');
  if (isNaN(price)|| price < 0)     return toast('Enter a valid price per piece.',  'error');

  if (editingId) {
    const idx = db.items.findIndex(i => i.id === editingId);
    if (idx > -1) db.items[idx] = { ...db.items[idx], name, sku, qty, origPrice, price };
    toast(`"${name}" updated successfully!`, 'success');
  } else {
    if (db.items.some(i => i.sku === sku)) return toast('SKU already exists.', 'error');
    db.items.push({ id: genId(), name, sku, qty, origPrice, price });
    toast(`"${name}" added to inventory!`, 'success');
  }

  saveData();
  closeModal('itemModal');
  renderAll();
}

// ── DELETE ─────────────────────────────────────────────────────────────────────

function openConfirm(id) {
  const item = db.items.find(i => i.id === id);
  if (!item) return;
  deleteId = id;
  const el = document.getElementById('confirmMsg');
  if (el) el.innerHTML = `This will permanently remove <strong>${escHtml(item.name)}</strong> from inventory. This cannot be undone.`;
  openModal('confirmModal');
}

function confirmDelete() {
  if (!deleteId) return;
  const item = db.items.find(i => i.id === deleteId);
  db.items = db.items.filter(i => i.id !== deleteId);
  saveData();
  closeModal('confirmModal');
  deleteId = null;
  renderAll();
  toast(`"${item?.name}" removed from inventory.`, 'warn');
}

// ── SELL ───────────────────────────────────────────────────────────────────────

function populateSellSelect() {
  const sel = document.getElementById('sellItem');
  if (!sel) return;
  const prev = sel.value;

  sel.innerHTML = '<option value="">— choose an item —</option>' +
    db.items.map(i =>
      `<option value="${i.id}"${i.qty === 0 ? ' disabled' : ''}>
        ${escHtml(i.sku)} · ${escHtml(i.name)} (${i.qty}${i.qty === 0 ? ' — OUT' : ' left'})
      </option>`
    ).join('');

  if (prev) sel.value = prev;
  onSellItemChange();
}

function onSellItemChange() {
  const id   = document.getElementById('sellItem')?.value;
  const info = document.getElementById('selectedInfo');
  if (!info) return;

  if (!id) {
    info.classList.remove('show');
    resetSellPreview();
    return;
  }

  const item = db.items.find(i => i.id === id);
  if (!item) { info.classList.remove('show'); return; }

  info.classList.add('show');
  setText('infoName',   item.name);
  setText('infoStock',  item.qty);
  setText('infoPrice',  fmt(item.price));
  setText('infoMargin', fmt(item.price - item.origPrice));

  const qtyEl = document.getElementById('sellQty');
  if (qtyEl) qtyEl.value = '';
  resetSellPreview();
}

function updateSellPreview() {
  const id  = document.getElementById('sellItem')?.value;
  const qty = parseInt(document.getElementById('sellQty')?.value) || 0;

  if (!id || qty <= 0) { resetSellPreview(); return; }

  const item = db.items.find(i => i.id === id);
  if (!item) { resetSellPreview(); return; }

  const revenue = (item.price - item.origPrice) * qty;
  const total   = item.price * qty;

  setText('previewRevenue', fmt(revenue));
  setText('previewTotal',   fmt(total));
}

function resetSellPreview() {
  setText('previewRevenue', '₱0.00');
  setText('previewTotal',   '₱0.00');
}

function quickSellSelect(id) {
  const sel = document.getElementById('sellItem');
  if (sel) sel.value = id;
  onSellItemChange();
  document.getElementById('sellQty')?.focus();
  document.getElementById('sellQty')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function processSale() {
  const id  = document.getElementById('sellItem')?.value;
  const qty = parseInt(document.getElementById('sellQty')?.value);

  if (!id)             return toast('Please select an item.', 'error');
  if (isNaN(qty) || qty <= 0) return toast('Enter a valid quantity to sell.', 'error');

  const idx = db.items.findIndex(i => i.id === id);
  if (idx < 0) return toast('Item not found.', 'error');

  const item = db.items[idx];
  if (qty > item.qty) return toast(`Only ${item.qty} unit${item.qty !== 1 ? 's' : ''} in stock!`, 'error');

  const revenue = (item.price - item.origPrice) * qty;
  const total   = item.price * qty;

  db.items[idx].qty -= qty;
  db.sales.push({
    id:         genId(),
    itemId:     id,
    itemName:   item.name,
    sku:        item.sku,
    qty,
    pricePerPc: item.price,
    origPrice:  item.origPrice,
    revenue,
    total,
    date: todayStr(),
    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  });

  saveData();

  // Reset sell panel
  setVal('sellItem', '');
  setVal('sellQty', '');
  document.getElementById('selectedInfo')?.classList.remove('show');
  resetSellPreview();

  renderAll();
  toast(`Sold ${qty}× ${item.name} — Revenue: ${fmt(revenue)}`, 'success');
}

// ── SALES LOG ──────────────────────────────────────────────────────────────────

function renderSalesLog() {
  const body       = document.getElementById('salesLogBody');
  const countEl    = document.getElementById('saleCount');
  if (!body) return;

  const today      = todayStr();
  const todaySales = db.sales.filter(s => s.date === today).slice().reverse();

  if (countEl) countEl.textContent = `${todaySales.length} record${todaySales.length !== 1 ? 's' : ''}`;

  if (!todaySales.length) {
    body.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><p>No sales recorded today.</p></div>`;
    return;
  }

  body.innerHTML = todaySales.map(s => `
    <div class="sale-row">
      <div class="sale-dot"></div>
      <div class="sale-info">
        <div class="sale-name">${escHtml(s.itemName)}</div>
        <div class="sale-meta">${s.qty} pc${s.qty !== 1 ? 's' : ''} × ${fmt(s.pricePerPc)} &nbsp;·&nbsp; ${s.time}</div>
      </div>
      <div class="sale-rev-col">
        <div class="sale-rev-amt">+${fmt(s.revenue)}</div>
        <div class="sale-rev-lbl">revenue</div>
      </div>
    </div>
  `).join('');
}

function clearSales() {
  const today = todayStr();
  const count = db.sales.filter(s => s.date === today).length;
  if (!count) return toast('No sales to clear today.', 'warn');
  db.sales = db.sales.filter(s => s.date !== today);
  saveData();
  renderAll();
  toast("Today's sales cleared.", 'warn');
}

// ── MODAL HELPERS ──────────────────────────────────────────────────────────────

function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

// ── TOAST ──────────────────────────────────────────────────────────────────────

function toast(msg, type = 'success') {
  const icons = { success: '✓', error: '✕', warn: '⚠' };
  const el    = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="t-icon">${icons[type]}</span><span>${msg}</span>`;
  document.getElementById('toastContainer')?.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ── EVENT BINDINGS ─────────────────────────────────────────────────────────────

function bindEvents() {
  // Close modals on overlay click
  ['itemModal', 'confirmModal'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', e => {
      if (e.target === e.currentTarget) closeModal(id);
    });
  });

  // Keyboard: Escape closes modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal('itemModal');
      closeModal('confirmModal');
    }
    // Ctrl+N = add item shortcut
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault();
      openAddModal();
    }
  });

  // Live search
  document.getElementById('searchInput')?.addEventListener('input', renderTable);

  // Auto-calculate mPrice from mOrigPrice (origPrice + 2) when adding new item
  document.getElementById('mOrigPrice')?.addEventListener('input', e => {
    if (!editingId) {
      const origPrice = parseFloat(e.target.value);
      if (!isNaN(origPrice) && origPrice >= 0) {
        const priceField = document.getElementById('mPrice');
        if (priceField) priceField.value = Math.round(origPrice) + 2;
      }
    }
  });

  // Sell qty preview
  document.getElementById('sellQty')?.addEventListener('input', updateSellPreview);

  // Sell item select
  document.getElementById('sellItem')?.addEventListener('change', onSellItemChange);

  // Enter key in sell qty confirms sale
  document.getElementById('sellQty')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') processSale();
  });
}

// ── BOOT ───────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);