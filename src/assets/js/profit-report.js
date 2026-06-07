// ============================================================
// RAMZ — Sales, Cost & Profit Reporting System
// ============================================================

const ProfitReport = (() => {

    // ── State ─────────────────────────────────────────────────
    let _data = {
        orders: [], transactions: [], orderItems: [],
        menuItems: [], recipes: [], ingredients: [],
        expenses: _loadExpenses()
    };

    // ── Date Helpers ──────────────────────────────────────────
    function _range(preset, customFrom, customTo) {
        const now = new Date();
        let from = new Date(), to = new Date();
        to.setHours(23, 59, 59, 999);

        switch (preset) {
            case 'today':
                from.setHours(0, 0, 0, 0);
                break;
            case 'week':
                from.setDate(now.getDate() - 6);
                from.setHours(0, 0, 0, 0);
                break;
            case 'month':
                from = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case 'custom':
                from = new Date(customFrom + 'T00:00:00');
                to   = new Date(customTo   + 'T23:59:59');
                break;
            default:
                from.setDate(now.getDate() - 6);
                from.setHours(0, 0, 0, 0);
        }
        return { from, to };
    }

    function _prevRange(preset, from, to) {
        const diff = to - from;
        return { from: new Date(from - diff - 1), to: new Date(from - 1) };
    }

    // ── Data Fetching ─────────────────────────────────────────
    async function _fetchAll(from, to) {
        const sb = window.supabaseClient;
        const f  = from.toISOString(), t = to.toISOString();

        const [ord, trx, oi, mi, rec, ing] = await Promise.all([
            sb.from('orders').select('*').gte('created_at', f).lte('created_at', t).eq('status', 'completed'),
            sb.from('transactions').select('*').gte('created_at', f).lte('created_at', t),
            sb.from('order_items').select('*, menu_items(id,name,price,category)'),
            sb.from('menu_items').select('*'),
            sb.from('recipes').select('*, ingredients(id,name,cost_per_unit,base_unit)'),
            sb.from('ingredients').select('id,name,cost_per_unit,base_unit')
        ]);

        _data.orders      = ord.data  || [];
        _data.transactions= trx.data  || [];
        _data.orderItems  = oi.data   || [];
        _data.menuItems   = mi.data   || [];
        _data.recipes     = rec.data  || [];
        _data.ingredients = ing.data  || [];
    }

    // ── COGS Engine ───────────────────────────────────────────
    function _cogForMenuItem(menuItemId, qty = 1) {
        const recipes = _data.recipes.filter(r => r.menu_item_id === menuItemId);
        if (!recipes.length) return 0;
        const unitCost = recipes.reduce((sum, r) => {
            const cost = parseFloat(r.ingredients?.cost_per_unit || 0);
            return sum + cost * parseFloat(r.quantity_required || 0);
        }, 0);
        return unitCost * qty;
    }

    // ── Core Calculations ─────────────────────────────────────
    function _calcSummary() {
        const revenue   = _data.orders.reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);
        const orderCount= _data.orders.length;
        const avgOrder  = orderCount ? revenue / orderCount : 0;
        return { revenue, orderCount, avgOrder };
    }

    function _calcCOGS() {
        let total = 0;
        _data.orders.forEach(order => {
            const items = _data.orderItems.filter(i => i.order_id === order.id);
            items.forEach(i => {
                total += _cogForMenuItem(i.menu_item_id, parseFloat(i.quantity || 1));
            });
        });
        return total;
    }

    function _calcProductPerformance() {
        const map = {};
        _data.orders.forEach(order => {
            const items = _data.orderItems.filter(i => i.order_id === order.id);
            items.forEach(i => {
                const name = i.menu_items?.name || 'Unknown';
                const cat  = i.menu_items?.category || '—';
                const qty  = parseFloat(i.quantity || 1);
                const rev  = parseFloat(i.price || 0) * qty;
                const cog  = _cogForMenuItem(i.menu_item_id, qty);
                if (!map[name]) map[name] = { name, category: cat, qty: 0, revenue: 0, cogs: 0 };
                map[name].qty     += qty;
                map[name].revenue += rev;
                map[name].cogs    += cog;
            });
        });
        return Object.values(map)
            .map(p => ({ ...p, profit: p.revenue - p.cogs, margin: p.revenue ? ((p.revenue - p.cogs) / p.revenue * 100) : 0 }))
            .sort((a, b) => b.revenue - a.revenue);
    }

    function _calcTrend() {
        const byDate = {};
        _data.orders.forEach(o => {
            const d = o.created_at.slice(0, 10);
            if (!byDate[d]) byDate[d] = { revenue: 0, cogs: 0, orders: 0 };
            byDate[d].revenue += parseFloat(o.total_amount || 0);
            byDate[d].orders  += 1;
            const items = _data.orderItems.filter(i => i.order_id === o.id);
            items.forEach(i => {
                byDate[d].cogs += _cogForMenuItem(i.menu_item_id, parseFloat(i.quantity || 1));
            });
        });
        return Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b))
            .map(([date, v]) => ({ date, ...v, profit: v.revenue - v.cogs }));
    }

    function _totalExpenses() {
        return Object.values(_data.expenses).reduce((s, v) => s + parseFloat(v || 0), 0);
    }

    // ── Expense Persistence ───────────────────────────────────
    function _loadExpenses() {
        try { return JSON.parse(localStorage.getItem('ramz_expenses') || '{}'); }
        catch (_) { return {}; }
    }

    function _saveExpenses(obj) {
        _data.expenses = obj;
        localStorage.setItem('ramz_expenses', JSON.stringify(obj));
    }

    // ── Chart Instances ───────────────────────────────────────
    let _trendChart = null;

    function _renderTrendChart(trend) {
        const ctx = document.getElementById('pr_trendChart');
        if (!ctx) return;
        if (_trendChart) _trendChart.destroy();

        _trendChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: trend.map(t => t.date),
                datasets: [
                    { label: 'Revenue',  data: trend.map(t => t.revenue), borderColor: '#c9b48c', backgroundColor: 'rgba(201,180,140,0.15)', fill: true, tension: 0.3 },
                    { label: 'COGS',     data: trend.map(t => t.cogs),    borderColor: '#e74c3c', backgroundColor: 'rgba(231,76,60,0.1)',    fill: true, tension: 0.3 },
                    { label: 'Profit',   data: trend.map(t => t.profit),  borderColor: '#4caf50', backgroundColor: 'rgba(76,175,80,0.1)',    fill: true, tension: 0.3 }
                ]
            },
            options: {
                responsive: true,
                plugins: { legend: { labels: { color: '#f0f0f0' } } },
                scales: {
                    x: { ticks: { color: '#a0a0a0' }, grid: { color: '#333' } },
                    y: { ticks: { color: '#a0a0a0', callback: v => v.toFixed(0) }, grid: { color: '#333' } }
                }
            }
        });
    }

    // ── UI Render ─────────────────────────────────────────────
    function _fc(n) { return parseFloat(n || 0).toFixed(2); }

    function _renderKPIs(summary, cogs, expenses) {
        const gross  = summary.revenue - cogs;
        const net    = gross - expenses;
        const gMargin= summary.revenue ? (gross / summary.revenue * 100) : 0;
        const nMargin= summary.revenue ? (net  / summary.revenue * 100) : 0;

        const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        set('pr_revenue',   _fc(summary.revenue));
        set('pr_orders',    summary.orderCount);
        set('pr_avgOrder',  _fc(summary.avgOrder));
        set('pr_cogs',      _fc(cogs));
        set('pr_grossProfit', _fc(gross));
        set('pr_grossMargin', gMargin.toFixed(1) + '%');
        set('pr_expenses',  _fc(expenses));
        set('pr_netProfit', _fc(net));
        set('pr_netMargin', nMargin.toFixed(1) + '%');

        // Colour net profit
        const np = document.getElementById('pr_netProfit');
        if (np) np.style.color = net >= 0 ? '#4caf50' : '#e74c3c';
    }

    function _renderProductTable(products) {
        const tbody = document.getElementById('pr_productBody');
        if (!tbody) return;
        if (!products.length) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:#a0a0a0">No sales data for this period</td></tr>';
            return;
        }
        tbody.innerHTML = products.slice(0, 15).map((p, i) => `
            <tr>
                <td>${i + 1}. ${p.name}</td>
                <td style="color:#a0a0a0">${p.category}</td>
                <td>${Math.round(p.qty)}</td>
                <td style="color:#c9b48c">${_fc(p.revenue)}</td>
                <td style="color:#e74c3c">${_fc(p.cogs)}</td>
                <td style="color:${p.profit >= 0 ? '#4caf50' : '#e74c3c'}">${_fc(p.profit)} <small>(${p.margin.toFixed(1)}%)</small></td>
            </tr>`).join('');
    }

    function _renderExpenseInputs() {
        const fields = ['rent','salary','utilities','marketing','other'];
        fields.forEach(f => {
            const el = document.getElementById('pr_exp_' + f);
            if (el) el.value = _data.expenses[f] || '';
        });
    }

    function _renderPrevComparison(summary, prevSummary) {
        const pct = (curr, prev) => {
            if (!prev) return curr > 0 ? '+100%' : '0%';
            const d = ((curr - prev) / prev * 100);
            return (d >= 0 ? '+' : '') + d.toFixed(1) + '%';
        };
        const col = v => v.startsWith('-') ? '#e74c3c' : '#4caf50';
        const set = (id, v) => {
            const el = document.getElementById(id);
            if (el) { el.textContent = v; el.style.color = col(v); }
        };
        const rPct = pct(summary.revenue, prevSummary.revenue);
        const oPct = pct(summary.orderCount, prevSummary.orderCount);
        set('pr_revChange',    rPct);
        set('pr_ordersChange', oPct);
    }

    // ── PDF Export ────────────────────────────────────────────
    function _exportPDF(summary, cogs, expenses, products, trend, dateLabel) {
        const gross   = summary.revenue - cogs;
        const net     = gross - expenses;
        const gMargin = summary.revenue ? (gross / summary.revenue * 100) : 0;
        const nMargin = summary.revenue ? (net   / summary.revenue * 100) : 0;

        const expRows = Object.entries(_data.expenses)
            .filter(([, v]) => parseFloat(v) > 0)
            .map(([k, v]) => `<tr><td style="text-transform:capitalize;padding:6px 8px">${k}</td><td style="text-align:right;padding:6px 8px">${_fc(v)}</td></tr>`)
            .join('');

        const prodRows = products.slice(0, 20).map((p, i) => `
            <tr style="border-bottom:1px solid #eee">
                <td style="padding:6px 8px">${i+1}. ${p.name}</td>
                <td style="padding:6px 8px;text-align:center">${Math.round(p.qty)}</td>
                <td style="padding:6px 8px;text-align:right">${_fc(p.revenue)}</td>
                <td style="padding:6px 8px;text-align:right">${_fc(p.cogs)}</td>
                <td style="padding:6px 8px;text-align:right;color:${p.profit >= 0 ? '#27ae60' : '#e74c3c'}">${_fc(p.profit)}</td>
                <td style="padding:6px 8px;text-align:right">${p.margin.toFixed(1)}%</td>
            </tr>`).join('');

        const trendRows = trend.map(t => `
            <tr style="border-bottom:1px solid #eee">
                <td style="padding:5px 8px">${t.date}</td>
                <td style="padding:5px 8px;text-align:right">${t.orders}</td>
                <td style="padding:5px 8px;text-align:right">${_fc(t.revenue)}</td>
                <td style="padding:5px 8px;text-align:right">${_fc(t.cogs)}</td>
                <td style="padding:5px 8px;text-align:right;color:${t.profit>=0?'#27ae60':'#e74c3c'}">${_fc(t.profit)}</td>
            </tr>`).join('');

        const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
        <title>RAMZ — Business Report ${dateLabel}</title>
        <style>
            * { margin:0; padding:0; box-sizing:border-box; }
            body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 13px; color: #1a1a1a; background: #fff; }
            .page { max-width: 900px; margin: 0 auto; padding: 40px; }
            .header { border-bottom: 3px solid #c9b48c; padding-bottom: 20px; margin-bottom: 30px; display:flex; justify-content:space-between; align-items:flex-end; }
            .header h1 { font-size: 28px; color: #1a1a1a; letter-spacing: -0.5px; }
            .header .meta { text-align:right; color:#666; font-size:12px; }
            .header .meta strong { display:block; font-size:15px; color:#c9b48c; }
            .section { margin-bottom: 32px; }
            .section-title { font-size:16px; font-weight:700; color:#c9b48c; border-bottom:1px solid #e8e8e8; padding-bottom:8px; margin-bottom:16px; text-transform:uppercase; letter-spacing:1px; }
            .kpi-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
            .kpi { background:#f9f9f9; border:1px solid #eee; border-radius:8px; padding:16px; }
            .kpi .label { font-size:11px; color:#888; text-transform:uppercase; letter-spacing:0.5px; margin-bottom:4px; }
            .kpi .value { font-size:22px; font-weight:700; color:#1a1a1a; }
            .kpi .sub   { font-size:11px; color:#aaa; margin-top:2px; }
            .kpi.highlight { background:#fffdf5; border-color:#c9b48c; }
            .kpi.profit-pos { background:#f0faf0; border-color:#4caf50; }
            .kpi.profit-pos .value { color:#27ae60; }
            .kpi.profit-neg { background:#fff5f5; border-color:#e74c3c; }
            .kpi.profit-neg .value { color:#e74c3c; }
            table { width:100%; border-collapse:collapse; font-size:12px; }
            thead { background:#f5f5f5; }
            thead th { padding:8px; text-align:left; font-weight:600; color:#555; border-bottom:2px solid #ddd; }
            .total-row { font-weight:700; background:#f9f9f9; }
            .footer { margin-top:40px; padding-top:16px; border-top:1px solid #eee; text-align:center; color:#aaa; font-size:11px; }
            @media print { .page { padding:20px; } }
        </style></head><body><div class="page">

        <div class="header">
            <div>
                <h1>RAMZ HOTEL</h1>
                <div style="color:#888;font-size:13px;margin-top:4px">Business Performance Report</div>
            </div>
            <div class="meta">
                <strong>${dateLabel}</strong>
                Generated: ${new Date().toLocaleString()}
            </div>
        </div>

        <!-- Sales Summary -->
        <div class="section">
            <div class="section-title">📊 Sales Summary</div>
            <div class="kpi-grid">
                <div class="kpi highlight"><div class="label">Total Revenue</div><div class="value">${_fc(summary.revenue)}</div></div>
                <div class="kpi"><div class="label">Total Orders</div><div class="value">${summary.orderCount}</div></div>
                <div class="kpi"><div class="label">Avg Order Value</div><div class="value">${_fc(summary.avgOrder)}</div></div>
            </div>
        </div>

        <!-- Profitability -->
        <div class="section">
            <div class="section-title">💰 Profitability</div>
            <div class="kpi-grid">
                <div class="kpi"><div class="label">Cost of Goods (COGS)</div><div class="value">${_fc(cogs)}</div></div>
                <div class="kpi ${gross>=0?'profit-pos':'profit-neg'}"><div class="label">Gross Profit</div><div class="value">${_fc(gross)}</div><div class="sub">Margin: ${gMargin.toFixed(1)}%</div></div>
                <div class="kpi"><div class="label">Operating Expenses</div><div class="value">${_fc(expenses)}</div></div>
            </div>
            <div class="kpi-grid" style="margin-top:12px">
                <div class="kpi ${net>=0?'profit-pos':'profit-neg'}" style="grid-column:1/4">
                    <div class="label">Net Profit (after expenses)</div>
                    <div class="value" style="font-size:28px">${_fc(net)}</div>
                    <div class="sub">Net Margin: ${nMargin.toFixed(1)}%</div>
                </div>
            </div>
        </div>

        ${expRows ? `
        <!-- Expenses -->
        <div class="section">
            <div class="section-title">🧾 Operating Expenses</div>
            <table>
                <thead><tr><th>Category</th><th style="text-align:right">Amount</th></tr></thead>
                <tbody>${expRows}</tbody>
                <tfoot><tr class="total-row"><td style="padding:6px 8px">Total</td><td style="text-align:right;padding:6px 8px">${_fc(expenses)}</td></tr></tfoot>
            </table>
        </div>` : ''}

        <!-- Product Performance -->
        <div class="section">
            <div class="section-title">🏆 Product Performance</div>
            <table>
                <thead><tr><th>Product</th><th style="text-align:center">Qty</th><th style="text-align:right">Revenue</th><th style="text-align:right">COGS</th><th style="text-align:right">Profit</th><th style="text-align:right">Margin</th></tr></thead>
                <tbody>${prodRows || '<tr><td colspan="6" style="text-align:center;padding:12px;color:#aaa">No product data</td></tr>'}</tbody>
            </table>
        </div>

        <!-- Daily Trend -->
        ${trend.length ? `
        <div class="section">
            <div class="section-title">📈 Daily Trend</div>
            <table>
                <thead><tr><th>Date</th><th style="text-align:right">Orders</th><th style="text-align:right">Revenue</th><th style="text-align:right">COGS</th><th style="text-align:right">Profit</th></tr></thead>
                <tbody>${trendRows}</tbody>
            </table>
        </div>` : ''}

        <div class="footer">RAMZ HOTEL POS System · Confidential Business Report · ${new Date().toLocaleDateString()}</div>
        </div></body></html>`;

        const win = window.open('', '_blank', 'width=960,height=800');
        win.document.write(html);
        win.document.close();
        setTimeout(() => { win.print(); }, 600);
    }

    // ── Main Load ─────────────────────────────────────────────
    async function load() {
        const preset    = document.getElementById('pr_period')?.value || 'week';
        const customFrom= document.getElementById('pr_from')?.value;
        const customTo  = document.getElementById('pr_to')?.value;
        const { from, to } = _range(preset, customFrom, customTo);

        // Show loading state
        document.getElementById('pr_revenue')?.closest('.pr-kpi-grid')
            ?.querySelectorAll('.pr-kpi-value')
            .forEach(el => el.textContent = '...');

        try {
            await _fetchAll(from, to);

            // Also fetch previous period for comparison
            const prev = _prevRange(preset, from, to);
            const prevSb = window.supabaseClient;
            const { data: prevOrders } = await prevSb.from('orders')
                .select('total_amount').gte('created_at', prev.from.toISOString())
                .lte('created_at', prev.to.toISOString()).eq('status', 'completed');

            const prevRevenue    = (prevOrders || []).reduce((s, o) => s + parseFloat(o.total_amount || 0), 0);
            const prevOrderCount = (prevOrders || []).length;
            const prevSummary    = { revenue: prevRevenue, orderCount: prevOrderCount };

            const summary  = _calcSummary();
            const cogs     = _calcCOGS();
            const products = _calcProductPerformance();
            const trend    = _calcTrend();
            const expenses = _totalExpenses();

            _renderKPIs(summary, cogs, expenses);
            _renderProductTable(products);
            _renderTrendChart(trend);
            _renderPrevComparison(summary, prevSummary);
            _renderExpenseInputs();

            // Store for PDF
            window._prSnapshot = { summary, cogs, expenses, products, trend };

        } catch (err) {
            console.error('Profit report error:', err);
        }
    }

    function saveExpenses() {
        const fields = ['rent','salary','utilities','marketing','other'];
        const obj = {};
        fields.forEach(f => {
            const el = document.getElementById('pr_exp_' + f);
            obj[f] = parseFloat(el?.value || 0) || 0;
        });
        _saveExpenses(obj);
        load();
        // brief visual feedback
        const btn = document.getElementById('pr_saveExpenses');
        if (btn) { btn.textContent = '✓ Saved'; setTimeout(() => btn.textContent = 'Save & Recalculate', 1500); }
    }

    function exportPDF() {
        if (!window._prSnapshot) return;
        const period = document.getElementById('pr_period')?.value || 'week';
        const label  = period === 'custom'
            ? `${document.getElementById('pr_from')?.value} → ${document.getElementById('pr_to')?.value}`
            : { today:'Today', week:'This Week', month:'This Month' }[period] || period;
        const { summary, cogs, expenses, products, trend } = window._prSnapshot;
        _exportPDF(summary, cogs, expenses, products, trend, label);
    }

    function onPeriodChange() {
        const custom = document.getElementById('pr_customRange');
        if (custom) custom.style.display = document.getElementById('pr_period')?.value === 'custom' ? 'flex' : 'none';
        load();
    }

    return { load, saveExpenses, exportPDF, onPeriodChange };
})();

// Make globally accessible
window.ProfitReport = ProfitReport;
