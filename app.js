let db = [];
let salesLog = [];
let sellTargetIdx = -1;

/* ── Load ── */
async function loadInventory() {
  try {
    const res = await fetch('inventory.json');
    db = await res.json();
    renderList();
  } catch (e) {
    document.getElementById('item-list').innerHTML =
      '<div class="empty-state">Could not load inventory.json — open via a local server.</div>';
  }
}

/* ── Toast ── */
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.display = 'block';
  setTimeout(() => (t.style.display = 'none'), 2200);
}

/* ── Tabs ── */
function setTab(tab) {
  ['browse', 'add', 'stats'].forEach(t => {
    document.getElementById('view-' + t).classList.toggle('hidden', t !== tab);
    document.getElementById('tab-' + t).classList.toggle('active', t === tab);
  });
  closeSellModal();
  closeEditModal();
  updateTabIcons(tab);
  if (tab === 'stats') renderStats();
  if (tab === 'browse') renderList();
}

function updateTabIcons(active) {
  ['browse', 'add', 'stats'].forEach(t => {
    const box = document.getElementById('tab-' + t);
    const color = t === active ? '#D85A30' : '#888780';
    box.querySelectorAll('[stroke]').forEach(el => el.setAttribute('stroke', color));
    box.querySelector('span').style.color = t === active ? '#712B13' : '#888780';
  });
}

/* ── Browse / List ── */
function renderList() {
  const q = document.getElementById('searchInput').value.trim().toLowerCase();
  const filtered = q ? db.filter(i => i.name.toLowerCase().includes(q)) : db;
  const count = document.getElementById('result-count');
  const el = document.getElementById('item-list');

  count.textContent = q
    ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''} found`
    : `${db.length} items total`;

  if (!filtered.length) {
    el.innerHTML = '<div class="empty-state">No items found.</div>';
    return;
  }

  el.innerHTML = filtered.map(item => {
    const realIdx = db.indexOf(item);
    const outOfStock = item.qty === 0;
    const rowClass = outOfStock ? 'item-row out-of-stock' : 'item-row';
    const zeroTag = outOfStock ? '<span class="qty-zero">OUT</span>' : '';
    const sellBtn = outOfStock
      ? `<button class="btn-sell" disabled style="opacity:0.4;cursor:not-allowed">Sell</button>`
      : `<button class="btn-sell" onclick="openSellModal(${realIdx})">Sell</button>`;

    return `
      <div class="${rowClass}">
        <div class="item-info">
          <div class="item-name">${item.name}${zeroTag}</div>
          <div class="item-meta">Qty: ${item.qty} &nbsp;·&nbsp; Orig: ₱${item.original}</div>
        </div>
        <span class="item-price">₱${item.price}/pc</span>
        <div class="row-actions">
          ${sellBtn}
          <button class="btn-edit" onclick="openEditModal(${realIdx})">Edit</button>
          <button class="btn-del" onclick="deleteItem(${realIdx})">Del</button>
        </div>
      </div>`;
  }).join('');
}

/* ── Sell / Deduct Modal ── */
function openSellModal(idx) {
  sellTargetIdx = idx;
  const item = db[idx];
  document.getElementById('sell-name').textContent = item.name;
  document.getElementById('sell-meta').textContent =
    `Stock: ${item.qty} pcs  ·  ₱${item.price} per pc`;
  document.getElementById('sell-qty').value = 1;
  document.getElementById('sell-qty').max = item.qty;
  updateSalePreview();
  document.getElementById('view-sell-modal').classList.remove('hidden');
}

function closeSellModal() {
  document.getElementById('view-sell-modal').classList.add('hidden');
  sellTargetIdx = -1;
}

function updateSalePreview() {
  if (sellTargetIdx < 0) return;
  const item = db[sellTargetIdx];
  const qty = Math.max(1, Math.min(parseInt(document.getElementById('sell-qty').value) || 1, item.qty));
  document.getElementById('sell-qty').value = qty;
  const total = qty * item.price;
  document.getElementById('sale-preview-amount').textContent = '₱' + total.toLocaleString();
}

function confirmSell() {
  if (sellTargetIdx < 0) return;
  const item = db[sellTargetIdx];
  const qty = parseInt(document.getElementById('sell-qty').value) || 0;

  if (qty <= 0 || qty > item.qty) {
    showToast('Invalid quantity.');
    return;
  }

  const total = qty * item.price;
  item.qty -= qty;

  salesLog.unshift({
    name: item.name,
    qty,
    pricePerPc: item.price,
    total,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  });

  closeSellModal();
  renderList();
  showToast(`Sold ${qty} × ${item.name} — ₱${total.toLocaleString()}`);
}

/* ── Add Item ── */

const originalInput = document.getElementById('f-orig');
const priceInput = document.getElementById('f-price');

originalInput.addEventListener('input', function () {
    let original = parseFloat(this.value);

    if (!isNaN(original)) {
        let computedPrice = Math.round(original + 2);
        priceInput.value = computedPrice;
    } else {
        priceInput.value = '';
    }
});


function saveItem() {
  const name = document.getElementById('f-name').value.trim().toUpperCase();
  const qty = parseInt(document.getElementById('f-qty').value);
  const original = parseFloat(document.getElementById('f-orig').value);
  const price = Math.round(parseFloat(document.getElementById('f-price').value));

  if (!name || isNaN(qty) || isNaN(original) || isNaN(price)) {
    showToast('Please fill in all fields.');
    return;
  }

  db.push({ name, qty, original, price });
  document.getElementById('f-name').value = '';
  document.getElementById('f-qty').value = '';
  document.getElementById('f-orig').value = '';
  document.getElementById('f-price').value = '';
  showToast('Item added!');
  setTab('browse');
}

/* ── Edit Modal ── */
function openEditModal(idx) {
  const item = db[idx];
  document.getElementById('edit-idx').value = idx;
  document.getElementById('m-name').value = item.name;
  document.getElementById('m-qty').value = item.qty;
  document.getElementById('m-orig').value = item.original;
  document.getElementById('m-price').value = item.price;
  document.getElementById('view-edit-modal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('view-edit-modal').classList.add('hidden');
}

function saveEdit() {
  const idx = parseInt(document.getElementById('edit-idx').value);
  const name = document.getElementById('m-name').value.trim().toUpperCase();
  const qty = parseInt(document.getElementById('m-qty').value);
  const original = parseFloat(document.getElementById('m-orig').value);
  const price = Math.round(parseFloat(document.getElementById('m-price').value));

  if (!name || isNaN(qty) || isNaN(original) || isNaN(price)) {
    showToast('Please fill in all fields.');
    return;
  }

  db[idx] = { name, qty, original, price };
  closeEditModal();
  renderList();
  showToast('Item updated!');
}

/* ── Delete ── */
function deleteItem(idx) {
  const name = db[idx].name;
  db.splice(idx, 1);
  renderList();
  showToast(`"${name}" removed.`);
}

/* ── Stats ── */
function renderStats() {
  const total = db.length;
  const totalQty = db.reduce((s, i) => s + i.qty, 0);
  const highPrice = db.length ? Math.max(...db.map(i => i.price)) : 0;
  const totalSales = salesLog.reduce((s, l) => s + l.total, 0);

  document.getElementById('s-total').textContent = total;
  document.getElementById('s-qty').textContent = totalQty.toLocaleString();
  document.getElementById('s-sales').textContent = '₱' + totalSales.toLocaleString();
  document.getElementById('s-high').textContent = '₱' + highPrice;

  const lowStock = db.filter(i => i.qty < 3);
  const ls = document.getElementById('low-stock');
  ls.innerHTML = lowStock.length
    ? lowStock.map(i => `
        <div class="item-row">
          <div class="item-info">
            <div class="item-name">${i.name}</div>
            <div class="item-meta" style="color:#A32D2D">Qty: ${i.qty}</div>
          </div>
          <span class="item-price">₱${i.price}/pc</span>
        </div>`).join('')
    : '<div class="empty-state" style="padding:0.75rem 0">No low stock items.</div>';

  const logEl = document.getElementById('sales-log');
  logEl.innerHTML = salesLog.length
    ? salesLog.map(l => `
        <div class="log-row">
          <div>
            <div class="log-name">${l.name}</div>
            <div class="log-detail">${l.qty} pc × ₱${l.pricePerPc} &nbsp;·&nbsp; ${l.time}</div>
          </div>
          <span class="log-amount">+₱${l.total.toLocaleString()}</span>
        </div>`).join('')
    : '<div class="empty-state" style="padding:0.75rem 0">No sales recorded yet.</div>';
}

/* ── Init ── */
document.addEventListener('DOMContentLoaded', () => {
  loadInventory();
  updateTabIcons('browse');
});
