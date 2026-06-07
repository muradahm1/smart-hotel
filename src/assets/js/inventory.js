// Inventory Management - RAMZ Hotel

// Realtime subscription handle
let _inventoryChannel = null;

async function loadInventoryDashboard() {
    await Promise.all([loadIngredients(), loadLowStockAlerts()]);
    setupInventoryRealtime();
}

function setupInventoryRealtime() {
    if (!window.supabaseClient || _inventoryChannel) return;

    _inventoryChannel = window.supabaseClient
        .channel('inventory-changes')
        .on('postgres_changes',
            { event: '*', schema: 'public', table: 'ingredients' },
            () => loadInventoryDashboard()
        )
        .on('postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'stock_movements' },
            () => loadInventoryDashboard()
        )
        .subscribe();
}

// ── Ingredients ──────────────────────────────────────────────

async function loadIngredients() {
    const grid = document.getElementById('ingredientsGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="empty-state">Loading...</div>';

    try {
        const { data, error } = await window.supabaseClient
            .from('ingredients')
            .select('*')
            .order('name');
        if (error) throw error;
        renderIngredients(data || []);
        updateInventoryStats(data || []);
    } catch (err) {
        grid.innerHTML = `<div class="empty-state">Error: ${err.message}</div>`;
    }
}

function renderIngredients(items) {
    const grid = document.getElementById('ingredientsGrid');
    if (!items.length) {
        grid.innerHTML = '<div class="empty-state">No ingredients yet. Add your first ingredient.</div>';
        return;
    }

    // Use the highest stock value across all items as the scale reference
    const maxStock = Math.max(...items.map(i => parseFloat(i.current_stock) || 0), 1);

    grid.innerHTML = items.map(item => {
        const stock    = parseFloat(item.current_stock) || 0;
        const minLevel = parseFloat(item.min_stock_level) || 0;

        // Bar fills relative to the highest stock in the list so differences are visible
        const pct = Math.min(100, Math.round((stock / maxStock) * 100));

        const statusClass = stock <= 0         ? 'out'
                          : stock <= minLevel  ? 'low'
                          : 'ok';
        const statusLabel = statusClass === 'out' ? 'Out of Stock'
                          : statusClass === 'low' ? 'Low Stock'
                          : 'In Stock';

        return `
        <div class="inv-card">
            <div class="inv-card-header">
                <div>
                    <h4>${item.name}</h4>
                    <small>${item.category || 'Uncategorized'} · SKU: ${item.sku || '—'}</small>
                </div>
                <span class="inv-status inv-status-${statusClass}">${statusLabel}</span>
            </div>
            <div class="inv-stock-bar" title="${stock} ${item.base_unit} remaining">
                <div class="inv-stock-fill inv-fill-${statusClass}" style="width:${pct}%"></div>
            </div>
            <div class="inv-card-meta">
                <span><strong>${stock}</strong> ${item.base_unit}</span>
                <span>Min: ${minLevel} ${item.base_unit}</span>
                <span>Cost: ${formatCurrency(item.cost_per_unit)}/${item.base_unit}</span>
            </div>
            <div class="inv-card-actions">
                <button class="btn btn-primary btn-sm" onclick="openRestockModal('${item.id}','${item.name}','${item.base_unit}')">
                    <i class="fas fa-plus"></i> Restock
                </button>
                <button class="btn btn-outline btn-sm" onclick="openWasteModal('${item.id}','${item.name}','${item.base_unit}')">
                    <i class="fas fa-trash-alt"></i> Log Waste
                </button>
                <button class="btn btn-danger btn-sm" onclick="deleteIngredient('${item.id}')">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>`;
    }).join('');
}

function updateInventoryStats(items) {
    const total = items.length;
    const low = items.filter(i => i.current_stock <= i.min_stock_level && i.current_stock > 0).length;
    const out = items.filter(i => i.current_stock <= 0).length;
    const value = items.reduce((sum, i) => sum + (i.current_stock * i.cost_per_unit), 0);

    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('invTotalItems', total);
    set('invLowStock', low);
    set('invOutOfStock', out);
    set('invTotalValue', formatCurrency(value));
}

// ── Low Stock Alerts ─────────────────────────────────────────

async function loadLowStockAlerts() {
    const panel = document.getElementById('lowStockAlerts');
    if (!panel) return;
    try {
        const { data, error } = await window.supabaseClient
            .from('ingredients')
            .select('name, current_stock, min_stock_level, base_unit');
        if (error) throw error;

        const alerts = (data || []).filter(i => i.current_stock <= i.min_stock_level);
        if (!alerts.length) {
            panel.innerHTML = '<p style="color:#4caf50"><i class="fas fa-check-circle"></i> All stock levels are healthy.</p>';
            return;
        }
        panel.innerHTML = alerts.map(a => `
            <div class="alert-row">
                <i class="fas fa-exclamation-triangle" style="color:#f39c12"></i>
                <span><strong>${a.name}</strong> — ${a.current_stock} ${a.base_unit} remaining (min: ${a.min_stock_level})</span>
            </div>`).join('');
    } catch (err) {
        panel.innerHTML = `<p style="color:#e74c3c">Could not load alerts: ${err.message}</p>`;
    }
}

// ── Add Ingredient ───────────────────────────────────────────

window.showAddIngredientForm = function () {
    document.getElementById('addIngredientForm').style.display = 'block';
    document.getElementById('ingForm').reset();
};

window.hideAddIngredientForm = function () {
    document.getElementById('addIngredientForm').style.display = 'none';
};

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('ingForm');
    if (form) form.addEventListener('submit', saveIngredient);
});

async function getSession() {
    const { data } = await window.supabaseClient.auth.getSession();
    return data?.session;
}

async function saveIngredient(e) {
    e.preventDefault();

    const session = await getSession();
    if (!session) {
        showNotification('You must be logged in to add ingredients', 'error');
        return;
    }

    const data = {
        name: document.getElementById('ingName').value.trim(),
        category: document.getElementById('ingCategory').value.trim(),
        sku: document.getElementById('ingSku').value.trim() || null,
        base_unit: document.getElementById('ingUnit').value,
        current_stock: parseFloat(document.getElementById('ingStock').value) || 0,
        min_stock_level: parseFloat(document.getElementById('ingMinStock').value) || 0,
        cost_per_unit: parseFloat(document.getElementById('ingCost').value) || 0,
        supplier: document.getElementById('ingSupplier').value.trim() || null,
    };

    try {
        const { error } = await window.supabaseClient.from('ingredients').insert([data]);
        if (error) throw error;
        showNotification('Ingredient added successfully', 'success');
        hideAddIngredientForm();
        loadInventoryDashboard();
    } catch (err) {
        showNotification('Failed to add ingredient: ' + err.message, 'error');
    }
}

async function deleteIngredient(id) {
    if (!confirm('Delete this ingredient?')) return;

    const session = await getSession();
    if (!session) {
        showNotification('You must be logged in to delete ingredients', 'error');
        return;
    }

    try {
        const { error } = await window.supabaseClient.from('ingredients').delete().eq('id', id);
        if (error) throw error;
        showNotification('Ingredient deleted', 'success');
        loadInventoryDashboard();
    } catch (err) {
        showNotification('Failed to delete: ' + err.message, 'error');
    }
}

// ── Restock Modal ─────────────────────────────────────────────

window.openRestockModal = function (id, name, unit) {
    showStockModal('restock', id, name, unit);
};

window.openWasteModal = function (id, name, unit) {
    showStockModal('waste', id, name, unit);
};

function showStockModal(type, id, name, unit) {
    const modal = document.getElementById('stockModal');
    document.getElementById('stockModalTitle').textContent = type === 'restock' ? `Restock: ${name}` : `Log Waste: ${name}`;
    document.getElementById('stockModalIngId').value = id;
    document.getElementById('stockModalType').value = type;
    document.getElementById('stockModalUnit').textContent = unit;
    document.getElementById('stockModalQty').value = '';
    document.getElementById('stockModalNotes').value = '';
    modal.style.display = 'flex';
}

window.closeStockModal = function () {
    document.getElementById('stockModal').style.display = 'none';
};

window.submitStockModal = async function () {
    const session = await getSession();
    if (!session) {
        showNotification('You must be logged in to update stock', 'error');
        return;
    }

    const ingId = document.getElementById('stockModalIngId').value;
    const type = document.getElementById('stockModalType').value;
    const qty = parseFloat(document.getElementById('stockModalQty').value);
    const notes = document.getElementById('stockModalNotes').value.trim();

    if (!qty || qty <= 0) {
        showNotification('Enter a valid quantity', 'error');
        return;
    }

    try {
        // Fetch current stock
        const { data: ing, error: fetchErr } = await window.supabaseClient
            .from('ingredients').select('current_stock').eq('id', ingId).single();
        if (fetchErr) throw fetchErr;

        const prev = ing.current_stock;
        const change = type === 'restock' ? qty : -qty;
        const next = Math.max(0, prev + change);

        // Insert movement (trigger updates current_stock)
        const { error } = await window.supabaseClient.from('stock_movements').insert([{
            ingredient_id: ingId,
            type: type === 'restock' ? 'purchase' : 'waste',
            quantity_change: change,
            previous_quantity: prev,
            new_quantity: next,
            notes: notes || null,
        }]);
        if (error) throw error;

        showNotification(type === 'restock' ? 'Stock restocked' : 'Waste logged', 'success');
        closeStockModal();
        loadInventoryDashboard();
    } catch (err) {
        showNotification('Error: ' + err.message, 'error');
    }
};

// ── Recipe Manager ────────────────────────────────────────────

const RecipeManager = (() => {
    let _menuItems   = [];
    let _ingredients = [];
    let _recipes     = [];

    // ── Data ─────────────────────────────────────────────────
    async function _fetchAll() {
        const sb = window.supabaseClient;
        const [mi, ing, rec] = await Promise.all([
            sb.from('menu_items').select('id,name,price,category').order('name'),
            sb.from('ingredients').select('id,name,base_unit,cost_per_unit').order('name'),
            sb.from('recipes').select(`
                id, menu_item_id, ingredient_id, quantity_required, unit,
                menu_items(id,name,price),
                ingredients(id,name,base_unit,cost_per_unit)
            `).order('menu_item_id')
        ]);
        _menuItems   = mi.data  || [];
        _ingredients = ing.data || [];
        _recipes     = rec.data || [];
    }

    // ── Populate selects ──────────────────────────────────────
    function _populateSelects() {
        // Filter dropdown
        const filter = document.getElementById('recipeFilterItem');
        if (filter) {
            const current = filter.value;
            filter.innerHTML = '<option value="">All menu items</option>' +
                _menuItems.map(m => `<option value="${m.id}" ${m.id===current?'selected':''}>${m.name}</option>`).join('');
        }

        // Form menu item select
        const miSel = document.getElementById('recipeMenuItem');
        if (miSel) {
            const current = miSel.value;
            miSel.innerHTML = '<option value="">Select menu item...</option>' +
                _menuItems.map(m => `<option value="${m.id}" ${m.id===current?'selected':''}>${m.name} (${formatCurrency(m.price)})</option>`).join('');
        }

        // Form ingredient select
        const ingSel = document.getElementById('recipeIngredient');
        if (ingSel) {
            const current = ingSel.value;
            ingSel.innerHTML = '<option value="">Select ingredient...</option>' +
                _ingredients.map(i => `<option value="${i.id}" ${i.id===current?'selected':''}
                    data-unit="${i.base_unit}" data-cost="${i.cost_per_unit}">
                    ${i.name} (${i.base_unit} · ${formatCurrency(i.cost_per_unit)}/unit)
                </option>`).join('');
        }
    }

    // ── Render table ──────────────────────────────────────────
    function _renderTable() {
        const tbody  = document.getElementById('recipesTableBody');
        const filter = document.getElementById('recipeFilterItem')?.value;

        const rows = filter
            ? _recipes.filter(r => r.menu_item_id === filter)
            : _recipes;

        if (!rows.length) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-secondary)">
                No recipes yet. Click "Add Recipe Row" to link a menu item to its ingredients.
            </td></tr>`;
            _renderSummary([]);
            return;
        }

        // Group by menu item for zebra banding
        let lastItemId = null;
        let band = false;

        tbody.innerHTML = rows.map(r => {
            if (r.menu_item_id !== lastItemId) {
                lastItemId = r.menu_item_id;
                band = !band;
            }
            const unitCost  = parseFloat(r.ingredients?.cost_per_unit || 0);
            const qty       = parseFloat(r.quantity_required || 0);
            const lineCost  = unitCost * qty;
            const bg        = band ? 'background:rgba(201,180,140,0.04)' : '';

            return `<tr style="border-bottom:1px solid var(--border-light);${bg}">
                <td style="padding:0.8rem 1rem;color:var(--accent-gold);font-weight:600">${r.menu_items?.name || '—'}</td>
                <td style="padding:0.8rem 1rem">${r.ingredients?.name || '—'}</td>
                <td style="padding:0.8rem 1rem;text-align:right">${qty} ${r.unit}</td>
                <td style="padding:0.8rem 1rem;text-align:right;color:var(--text-secondary)">${formatCurrency(unitCost)}/${r.unit}</td>
                <td style="padding:0.8rem 1rem;text-align:right;color:#e74c3c;font-weight:600">${formatCurrency(lineCost)}</td>
                <td style="padding:0.8rem 1rem;text-align:center">
                    <button class="btn btn-outline btn-sm" onclick="RecipeManager.edit('${r.id}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-danger btn-sm" style="margin-left:0.3rem" onclick="RecipeManager.remove('${r.id}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>`;
        }).join('');

        _renderSummary(rows);
    }

    // ── Cost summary per menu item ────────────────────────────
    function _renderSummary(rows) {
        const summary = document.getElementById('recipeSummary');
        const body    = document.getElementById('recipeSummaryBody');
        if (!summary || !body) return;

        const byItem = {};
        rows.forEach(r => {
            const id   = r.menu_item_id;
            const name = r.menu_items?.name || '—';
            const price= parseFloat(r.menu_items?.price || 0);
            const cost = parseFloat(r.ingredients?.cost_per_unit || 0) * parseFloat(r.quantity_required || 0);
            if (!byItem[id]) byItem[id] = { name, price, totalCost: 0 };
            byItem[id].totalCost += cost;
        });

        const items = Object.values(byItem);
        if (!items.length) { summary.style.display = 'none'; return; }
        summary.style.display = 'block';

        body.innerHTML = items.map(item => {
            const margin = item.price > 0 ? ((item.price - item.totalCost) / item.price * 100) : 0;
            const color  = margin > 60 ? '#4caf50' : margin > 30 ? '#f39c12' : '#e74c3c';
            return `<div style="background:var(--background-dark);border-radius:8px;padding:0.9rem 1rem;border:1px solid var(--border-light)">
                <div style="font-weight:600;color:var(--text-primary);margin-bottom:0.4rem">${item.name}</div>
                <div style="font-size:0.82rem;color:var(--text-secondary)">Sell price: <strong style="color:var(--accent-gold)">${formatCurrency(item.price)}</strong></div>
                <div style="font-size:0.82rem;color:var(--text-secondary)">Ingredient cost: <strong style="color:#e74c3c">${formatCurrency(item.totalCost)}</strong></div>
                <div style="font-size:0.82rem;color:var(--text-secondary)">Gross margin: <strong style="color:${color}">${margin.toFixed(1)}%</strong></div>
            </div>`;
        }).join('');
    }

    // ── Cost preview while typing ─────────────────────────────
    function onIngredientChange() {
        const sel     = document.getElementById('recipeIngredient');
        const opt     = sel?.options[sel.selectedIndex];
        const unit    = opt?.dataset?.unit || '—';
        const cost    = parseFloat(opt?.dataset?.cost || 0);
        const qty     = parseFloat(document.getElementById('recipeQty')?.value || 0);

        document.getElementById('recipeUnit').textContent = unit;

        const preview = document.getElementById('recipeCostPreview');
        const val     = document.getElementById('recipeCostValue');
        if (preview && val && cost > 0) {
            preview.style.display = 'block';
            val.textContent = formatCurrency(cost * (qty || 1));

            // update on qty change too
            document.getElementById('recipeQty').oninput = () => {
                const q = parseFloat(document.getElementById('recipeQty').value || 0);
                val.textContent = formatCurrency(cost * q);
            };
        }
    }

    // ── CRUD ──────────────────────────────────────────────────
    async function save() {
        const id  = document.getElementById('recipeEditId').value;
        const mid = document.getElementById('recipeMenuItem').value;
        const iid = document.getElementById('recipeIngredient').value;
        const qty = parseFloat(document.getElementById('recipeQty').value);

        const sel  = document.getElementById('recipeIngredient');
        const unit = sel?.options[sel.selectedIndex]?.dataset?.unit || 'g';

        if (!mid || !iid || !qty || qty <= 0) {
            showNotification('Fill in all fields with a valid quantity', 'error');
            return;
        }

        try {
            let err;
            if (id) {
                ({ error: err } = await window.supabaseClient
                    .from('recipes')
                    .update({ menu_item_id: mid, ingredient_id: iid, quantity_required: qty, unit })
                    .eq('id', id));
            } else {
                // Check duplicate
                const dup = _recipes.find(r => r.menu_item_id === mid && r.ingredient_id === iid);
                if (dup) {
                    showNotification('This ingredient is already in that recipe. Edit the existing row instead.', 'error');
                    return;
                }
                ({ error: err } = await window.supabaseClient
                    .from('recipes')
                    .insert([{ menu_item_id: mid, ingredient_id: iid, quantity_required: qty, unit }]));
            }

            if (err) throw err;
            showNotification(id ? 'Recipe updated' : 'Recipe row added', 'success');
            hideForm();
            await load();
        } catch (e) {
            showNotification('Error: ' + e.message, 'error');
        }
    }

    async function remove(id) {
        if (!confirm('Delete this recipe row?')) return;
        const { error } = await window.supabaseClient.from('recipes').delete().eq('id', id);
        if (error) { showNotification('Delete failed: ' + error.message, 'error'); return; }
        showNotification('Recipe row deleted', 'success');
        await load();
    }

    function edit(id) {
        const r = _recipes.find(r => r.id === id);
        if (!r) return;

        showAddForm();
        document.getElementById('recipeFormTitle').textContent = 'Edit Recipe Row';
        document.getElementById('recipeEditId').value          = r.id;
        document.getElementById('recipeMenuItem').value        = r.menu_item_id;
        document.getElementById('recipeIngredient').value      = r.ingredient_id;
        document.getElementById('recipeQty').value             = r.quantity_required;
        onIngredientChange();
    }

    // ── UI helpers ────────────────────────────────────────────
    function showAddForm() {
        document.getElementById('recipeFormTitle').textContent = 'Add Recipe Row';
        document.getElementById('recipeEditId').value = '';
        document.getElementById('recipeMenuItem').value = '';
        document.getElementById('recipeIngredient').value = '';
        document.getElementById('recipeQty').value = '';
        document.getElementById('recipeUnit').textContent = '—';
        document.getElementById('recipeCostPreview').style.display = 'none';
        document.getElementById('recipeForm').style.display = 'block';
        document.getElementById('recipeForm').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function hideForm() {
        document.getElementById('recipeForm').style.display = 'none';
    }

    // ── Main load ─────────────────────────────────────────────
    async function load() {
        try {
            await _fetchAll();
            _populateSelects();
            _renderTable();
        } catch (e) {
            console.error('RecipeManager load error:', e);
        }
    }

    return { load, save, edit, remove, showAddForm, hideForm, onIngredientChange };
})();

window.RecipeManager = RecipeManager;

// Hook into inventory dashboard load
const _origLoadInventory = loadInventoryDashboard;
window.loadInventoryDashboard = async function () {
    await _origLoadInventory();
    await RecipeManager.load();
};
