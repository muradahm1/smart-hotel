// Inventory Management - RAMZ Hotel

async function loadInventoryDashboard() {
    await Promise.all([loadIngredients(), loadLowStockAlerts()]);
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

    grid.innerHTML = items.map(item => {
        const pct = item.min_stock_level > 0
            ? Math.min(100, (item.current_stock / item.min_stock_level) * 100)
            : 100;
        const statusClass = item.current_stock <= 0 ? 'out'
            : item.current_stock <= item.min_stock_level ? 'low' : 'ok';
        const statusLabel = statusClass === 'out' ? 'Out of Stock'
            : statusClass === 'low' ? 'Low Stock' : 'In Stock';

        return `
        <div class="inv-card">
            <div class="inv-card-header">
                <div>
                    <h4>${item.name}</h4>
                    <small>${item.category || 'Uncategorized'} · SKU: ${item.sku || '—'}</small>
                </div>
                <span class="inv-status inv-status-${statusClass}">${statusLabel}</span>
            </div>
            <div class="inv-stock-bar">
                <div class="inv-stock-fill inv-fill-${statusClass}" style="width:${pct}%"></div>
            </div>
            <div class="inv-card-meta">
                <span><strong>${item.current_stock}</strong> ${item.base_unit}</span>
                <span>Min: ${item.min_stock_level} ${item.base_unit}</span>
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
    try {
        const { data, error } = await window.supabaseClient
            .from('ingredients')
            .select('name, current_stock, min_stock_level, base_unit')
            .lte('current_stock', window.supabaseClient.rpc ? undefined : undefined);

        // Fetch all and filter client-side (avoids complex RPC)
        const { data: all, error: err2 } = await window.supabaseClient
            .from('ingredients')
            .select('name, current_stock, min_stock_level, base_unit');

        if (err2) return;
        const alerts = (all || []).filter(i => i.current_stock <= i.min_stock_level);
        const panel = document.getElementById('lowStockAlerts');
        if (!panel) return;

        if (!alerts.length) {
            panel.innerHTML = '<p style="color:#4caf50"><i class="fas fa-check-circle"></i> All stock levels are healthy.</p>';
            return;
        }
        panel.innerHTML = alerts.map(a => `
            <div class="alert-row">
                <i class="fas fa-exclamation-triangle" style="color:#f39c12"></i>
                <span><strong>${a.name}</strong> — ${a.current_stock} ${a.base_unit} remaining (min: ${a.min_stock_level})</span>
            </div>`).join('');
    } catch (_) {}
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

async function saveIngredient(e) {
    e.preventDefault();
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
