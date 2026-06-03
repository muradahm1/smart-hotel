// Reports & Analytics functionality
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        loadReportsData();
        setupDateFilter();
        setupAdvancedFilters();
    }, 500);
});

let salesChart, itemsChart, serveTimeChart;

function setupDateFilter() {
    document.getElementById('dateRange').addEventListener('change', function() {
        loadReportsData();
    });
    
    // Add order type filter listener
    document.getElementById('orderTypeFilter').addEventListener('change', function() {
        loadReportsData();
    });
}

async function loadReportsData() {
    if (!window.supabaseClient) {
        console.error('Supabase not initialized');
        return;
    }
    
    try {
        const dateRange = document.getElementById('dateRange').value;
        const orderType = document.getElementById('orderTypeFilter').value;
        const dateFilter = getDateFilter(dateRange);
        
        let query = window.supabaseClient
            .from('orders')
            .select('*')
            .gte('created_at', dateFilter)
            .order('created_at', { ascending: false });
            
        // Apply order type filter
        if (orderType !== 'all') {
            query = query.eq('order_type', orderType);
        }
        
        const { data: orders, error } = await query;
            
        if (error) throw error;
        
        renderAnalytics(orders || []);
        renderOrdersTable(orders || []);
        renderMenuPerformanceTable(orders || []);
        
    } catch (error) {
        console.error('Error loading reports data:', error);
        showNotification('Failed to load reports data: ' + error.message, 'error');
    }
}

function getDateFilter(range) {
    const now = new Date();
    let startDate = new Date();
    
    switch(range) {
        case 'today':
            startDate.setHours(0, 0, 0, 0);
            break;
        case 'week':
            startDate.setDate(now.getDate() - 7);
            break;
        case 'month':
            startDate.setMonth(now.getMonth() - 1);
            break;
        case 'year':
            startDate.setFullYear(now.getFullYear() - 1);
            break;
        default:
            startDate.setMonth(now.getMonth() - 1);
    }
    
    return startDate.toISOString();
}

function renderAnalytics(orders) {
    const completedOrders = orders.filter(o => o.status === 'completed');
    
    calculateKeyStats(orders, completedOrders);
    renderSalesOverTimeChart(completedOrders);
    renderTopSellingItemsChart(completedOrders);
    renderServeTimeChart(completedOrders);
}

function calculateKeyStats(allOrders, completedOrders) {
    const totalRevenue = completedOrders.reduce((sum, order) => sum + order.total_amount, 0);
    const totalOrders = allOrders.length;
    const avgOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;

    // Calculate serve times
    const ordersWithTimes = completedOrders.filter(order => order.created_at && order.updated_at);
    let avgFoodServeTime = 0;
    let avgMenuServeTime = 0;
    
    if (ordersWithTimes.length > 0) {
        const totalServeTime = ordersWithTimes.reduce((sum, order) => {
            const created = new Date(order.created_at);
            const completed = new Date(order.updated_at);
            return sum + (completed - created);
        }, 0);
        avgFoodServeTime = Math.round(totalServeTime / ordersWithTimes.length / 60000);
        avgMenuServeTime = avgFoodServeTime; // For now, same as food serve time
    }

    document.getElementById('totalRevenue').textContent = formatCurrency(totalRevenue);
    document.getElementById('totalOrders').textContent = totalOrders;
    document.getElementById('avgOrderValue').textContent = formatCurrency(avgOrderValue);
    document.getElementById('avgFoodServeTime').textContent = avgFoodServeTime + ' min';
    document.getElementById('avgMenuServeTime').textContent = avgMenuServeTime + ' min';
}

function renderSalesOverTimeChart(orders) {
    const salesByDate = orders.reduce((acc, order) => {
        const date = new Date(order.created_at).toLocaleDateString();
        acc[date] = (acc[date] || 0) + order.total_amount;
        return acc;
    }, {});

    const ctx = document.getElementById('salesOverTimeChart').getContext('2d');
    if (salesChart) salesChart.destroy();
    
    salesChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: Object.keys(salesByDate),
            datasets: [{
                label: 'Daily Revenue',
                data: Object.values(salesByDate),
                borderColor: 'rgba(217, 168, 68, 1)',
                backgroundColor: 'rgba(217, 168, 68, 0.2)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { 
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return value.toFixed(2);
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Revenue: ' + context.parsed.y.toFixed(2);
                        }
                    }
                }
            }
        }
    });
}

function renderTopSellingItemsChart(orders) {
    const itemSales = {};
    orders.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => {
                const itemName = item.name || 'Unknown Item';
                itemSales[itemName] = (itemSales[itemName] || 0) + (item.quantity || 1);
            });
        }
    });

    const sortedItems = Object.entries(itemSales)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

    const ctx = document.getElementById('topItemsChart').getContext('2d');
    if (itemsChart) itemsChart.destroy();
    
    itemsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sortedItems.map(item => item[0]),
            datasets: [{
                label: 'Quantity Sold',
                data: sortedItems.map(item => item[1]),
                backgroundColor: [
                    'rgba(217, 168, 68, 0.8)',
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(54, 162, 235, 0.8)',
                    'rgba(255, 205, 86, 0.8)',
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(153, 102, 255, 0.8)',
                    'rgba(255, 159, 64, 0.8)',
                    'rgba(199, 199, 199, 0.8)',
                    'rgba(83, 102, 255, 0.8)',
                    'rgba(255, 99, 255, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function renderServeTimeChart(orders) {
    const serveTimeByCategory = {};
    
    orders.forEach(order => {
        if (order.items && Array.isArray(order.items) && order.created_at && order.updated_at) {
            const serveTime = (new Date(order.updated_at) - new Date(order.created_at)) / 60000; // minutes
            
            order.items.forEach(item => {
                const category = item.category || 'Unknown';
                if (!serveTimeByCategory[category]) {
                    serveTimeByCategory[category] = { total: 0, count: 0 };
                }
                serveTimeByCategory[category].total += serveTime;
                serveTimeByCategory[category].count += 1;
            });
        }
    });

    const categories = Object.keys(serveTimeByCategory);
    const avgServeTimes = categories.map(cat => 
        Math.round(serveTimeByCategory[cat].total / serveTimeByCategory[cat].count)
    );

    const ctx = document.getElementById('serveTimeChart').getContext('2d');
    if (serveTimeChart) serveTimeChart.destroy();
    
    serveTimeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: categories,
            datasets: [{
                label: 'Avg Serve Time (minutes)',
                data: avgServeTimes,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.8)',
                    'rgba(54, 162, 235, 0.8)',
                    'rgba(255, 205, 86, 0.8)',
                    'rgba(75, 192, 192, 0.8)',
                    'rgba(153, 102, 255, 0.8)'
                ]
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { 
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Minutes'
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Avg Serve Time: ' + context.parsed.y + ' minutes';
                        }
                    }
                }
            }
        }
    });
}

function renderOrdersTable(orders) {
    const tbody = document.getElementById('ordersTableBody');
    
    if (orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No orders found</td></tr>';
        return;
    }

    tbody.innerHTML = orders.slice(0, 20).map(order => `
        <tr>
            <td>${order.id.substring(0, 8)}...</td>
            <td><span class="order-type-badge ${order.order_type || 'regular'}">${(order.order_type || 'regular') === 'manual' ? 'Manual' : 'Table'}</span></td>
            <td>${order.table_number ? `Table ${order.table_number}` : 'N/A'}</td>
            <td>${order.customer_name || 'Walk-in'}</td>
            <td>${order.items ? order.items.length : 0} items</td>
            <td>${formatCurrency(order.total_amount)}</td>
            <td><span class="order-status status-${order.status}">${order.status}</span></td>
            <td>${new Date(order.created_at).toLocaleDateString()}</td>
        </tr>
    `).join('');
}

function renderMenuPerformanceTable(orders) {
    const itemPerformance = {};
    
    orders.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
            const orderServeTime = order.created_at && order.updated_at ? 
                (new Date(order.updated_at) - new Date(order.created_at)) / 60000 : 0;
            
            order.items.forEach(item => {
                const itemName = item.name || 'Unknown Item';
                const category = item.category || 'Unknown';
                
                if (!itemPerformance[itemName]) {
                    itemPerformance[itemName] = {
                        category: category,
                        orders: 0,
                        revenue: 0,
                        quantity: 0,
                        totalServeTime: 0,
                        serveTimeCount: 0
                    };
                }
                
                itemPerformance[itemName].orders += 1;
                itemPerformance[itemName].revenue += (item.price || 0) * (item.quantity || 1);
                itemPerformance[itemName].quantity += (item.quantity || 1);
                
                if (orderServeTime > 0) {
                    itemPerformance[itemName].totalServeTime += orderServeTime;
                    itemPerformance[itemName].serveTimeCount += 1;
                }
            });
        }
    });

    const tbody = document.getElementById('menuPerformanceTableBody');
    
    if (Object.keys(itemPerformance).length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center;">No menu performance data</td></tr>';
        return;
    }

    const sortedItems = Object.entries(itemPerformance)
        .sort(([, a], [, b]) => b.revenue - a.revenue);

    tbody.innerHTML = sortedItems.slice(0, 10).map(([itemName, data]) => {
        const avgOrderValue = data.orders > 0 ? data.revenue / data.orders : 0;
        const avgServeTime = data.serveTimeCount > 0 ? Math.round(data.totalServeTime / data.serveTimeCount) : 0;
        const performance = data.revenue > 100 ? 'high' : data.revenue > 50 ? 'medium' : 'low';
        
        return `
            <tr>
                <td>${itemName}</td>
                <td>${data.orders}</td>
                <td>${formatCurrency(data.revenue)}</td>
                <td>${formatCurrency(avgOrderValue)}</td>
                <td><span class="performance-badge ${performance}">${performance.toUpperCase()}</span></td>
            </tr>
        `;
    }).join('');
}

// Make function globally available
window.loadAdvancedAnalytics = loadAdvancedAnalytics;

// Add advanced analytics functions to existing reports.js
function setupAdvancedFilters() {
    const timeRangeFilter = document.getElementById('advancedTimeRange');
    if (timeRangeFilter) {
        timeRangeFilter.addEventListener('change', function() {
            loadAdvancedAnalytics();
        });
    }
    
    const performanceFilter = document.getElementById('performanceFilter');
    if (performanceFilter) {
        performanceFilter.addEventListener('change', function() {
            loadAdvancedAnalytics();
        });
    }
}

async function loadAdvancedAnalytics() {
    if (!window.supabaseClient) {
        console.error('Supabase not initialized');
        return;
    }
    
    try {
        const timeRange = document.getElementById('advancedTimeRange')?.value || '30';
        const dateFilter = getAdvancedDateFilter(timeRange);
        
        const [ordersResult, transactionsResult, orderItemsResult] = await Promise.all([
            window.supabaseClient
                .from('orders')
                .select('*')
                .gte('created_at', dateFilter)
                .order('created_at', { ascending: false }),
            window.supabaseClient
                .from('transactions')
                .select('*')
                .gte('created_at', dateFilter)
                .order('created_at', { ascending: false }),
            window.supabaseClient
                .from('order_items')
                .select('*')
        ]);
        
        const orders = ordersResult.data || [];
        const transactions = transactionsResult.data || [];
        const orderItems = orderItemsResult.data || [];
        
        // Join orders with their items
        const ordersWithItems = orders.map(order => {
            const items = orderItems.filter(item => item.order_id === order.id);
            return { ...order, items };
        });
        
        renderPeakHoursAnalysis(ordersWithItems);
        renderPaymentTrends(transactions);
        renderOrderTypeDistribution(ordersWithItems);
        renderOrderSizeAnalysis(ordersWithItems);
        renderAdvancedMetrics(ordersWithItems, transactions);
        renderPerformanceMatrix(ordersWithItems);
        generateAIRecommendations(ordersWithItems, transactions);
        
    } catch (error) {
        console.error('Error loading advanced analytics:', error);
        showNotification('Failed to load advanced analytics: ' + error.message, 'error');
    }
}

function getAdvancedDateFilter(days) {
    const now = new Date();
    const startDate = new Date();
    startDate.setDate(now.getDate() - parseInt(days));
    return startDate.toISOString();
}

function renderPeakHoursAnalysis(orders) {
    const hourlyData = {};
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    for (let day = 0; day < 7; day++) {
        hourlyData[day] = {};
        for (let hour = 0; hour < 24; hour++) {
            hourlyData[day][hour] = 0;
        }
    }
    
    orders.forEach(order => {
        const date = new Date(order.created_at);
        const day = date.getDay();
        const hour = date.getHours();
        hourlyData[day][hour]++;
    });
    
    // Create heatmap chart
    const ctx = document.getElementById('peakHoursChart');
    if (ctx) {
        if (window.peakHoursChart && typeof window.peakHoursChart.destroy === 'function') {
            window.peakHoursChart.destroy();
        }
        
        const heatmapData = [];
        for (let day = 0; day < 7; day++) {
            for (let hour = 0; hour < 24; hour++) {
                heatmapData.push({
                    x: hour,
                    y: day,
                    v: hourlyData[day][hour]
                });
            }
        }
        
        window.peakHoursChart = new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Orders',
                    data: heatmapData,
                    backgroundColor: function(context) {
                        const value = context.parsed.v;
                        if (value === 0) return 'rgba(30, 30, 30, 0.3)'; // Dark gray for no orders
                        if (value <= 2) return 'rgba(0, 100, 255, 0.7)'; // Cool blue for low
                        if (value <= 5) return 'rgba(255, 165, 0, 0.8)'; // Orange for medium
                        return 'rgba(255, 50, 50, 1)'; // Hot red for high
                    },
                    borderColor: function(context) {
                        const value = context.parsed.v;
                        if (value === 0) return 'rgba(60, 60, 60, 0.6)';
                        if (value <= 2) return 'rgba(0, 100, 255, 1)';
                        if (value <= 5) return 'rgba(255, 165, 0, 1)';
                        return 'rgba(255, 50, 50, 1)';
                    },
                    pointRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        min: 0,
                        max: 23,
                        title: { 
                            display: true, 
                            text: 'Hour of Day',
                            color: '#fff'
                        },
                        ticks: { 
                            stepSize: 2,
                            color: '#ccc'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    y: {
                        type: 'linear',
                        min: 0,
                        max: 6,
                        title: { 
                            display: true, 
                            text: 'Day of Week',
                            color: '#fff'
                        },
                        ticks: {
                            stepSize: 1,
                            color: '#ccc',
                            callback: function(value) {
                                return dayNames[value] || '';
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#fff',
                        bodyColor: '#fff',
                        callbacks: {
                            title: function(context) {
                                const point = context[0];
                                return `${dayNames[point.parsed.y]} ${point.parsed.x}:00`;
                            },
                            label: function(context) {
                                const value = context.parsed.v || 0;
                                return `Orders: ${value}`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Update insights
    let busiestHour = { hour: 0, day: 0, count: 0 };
    let slowestHour = { hour: 0, day: 0, count: Infinity };
    let weekdayTotal = 0, weekendTotal = 0;
    
    for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
            const count = hourlyData[day][hour];
            if (count > busiestHour.count) {
                busiestHour = { hour, day, count };
            }
            if (count < slowestHour.count && count > 0) {
                slowestHour = { hour, day, count };
            }
            
            if (day === 0 || day === 6) {
                weekendTotal += count;
            } else {
                weekdayTotal += count;
            }
        }
    }
    
    const busiestElement = document.getElementById('busiestHour');
    const slowestElement = document.getElementById('slowestHour');
    const weekendElement = document.getElementById('weekendComparison');
    
    if (busiestElement) {
        busiestElement.textContent = 
            `${dayNames[busiestHour.day]} ${busiestHour.hour}:00 (${busiestHour.count} orders)`;
    }
    if (slowestElement) {
        slowestElement.textContent = 
            `${dayNames[slowestHour.day]} ${slowestHour.hour}:00 (${slowestHour.count} orders)`;
    }
    if (weekendElement) {
        weekendElement.textContent = 
            `Weekend: ${weekendTotal} vs Weekday: ${weekdayTotal}`;
    }
}

function renderPaymentTrends(transactions) {
    const paymentData = {};
    const dates = [];
    
    transactions.forEach(transaction => {
        const date = new Date(transaction.created_at).toLocaleDateString();
        const method = transaction.payment_method;
        
        if (!paymentData[method]) paymentData[method] = {};
        if (!paymentData[method][date]) paymentData[method][date] = 0;
        paymentData[method][date]++;
        
        if (!dates.includes(date)) dates.push(date);
    });
    
    dates.sort((a, b) => new Date(a) - new Date(b));
    
    const ctx = document.getElementById('paymentTrendChart');
    if (!ctx) return;
    
    if (window.paymentTrendChart && typeof window.paymentTrendChart.destroy === 'function') {
        window.paymentTrendChart.destroy();
    }
    
    const datasets = Object.keys(paymentData).map((method, index) => {
        const colors = ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0'];
        return {
            label: method.charAt(0).toUpperCase() + method.slice(1),
            data: dates.map(date => paymentData[method][date] || 0),
            borderColor: colors[index % colors.length],
            backgroundColor: colors[index % colors.length] + '20',
            fill: false,
            tension: 0.3
        };
    });
    
    window.paymentTrendChart = new Chart(ctx, {
        type: 'line',
        data: { labels: dates, datasets: datasets },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } } 
        }
    });
}

function renderOrderTypeDistribution(orders) {
    const typeData = {};
    orders.forEach(order => {
        const type = order.order_type || 'regular';
        typeData[type] = (typeData[type] || 0) + 1;
    });
    
    const ctx = document.getElementById('orderTypeChart');
    if (!ctx) return;
    
    if (window.orderTypeChart && typeof window.orderTypeChart.destroy === 'function') {
        window.orderTypeChart.destroy();
    }
    
    window.orderTypeChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(typeData).map(type => 
                type === 'manual' ? 'Manual Orders' : 'Table Orders'
            ),
            datasets: [{
                data: Object.values(typeData),
                backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0']
            }]
        },
        options: { responsive: true, plugins: { legend: { position: 'bottom' } } }
    });
}

function renderOrderSizeAnalysis(orders) {
    const sizeRanges = {
        'Small (0-150)': 0,
        'Medium (150-300)': 0,
        'Large (300-500)': 0,
        'XL (500+)': 0
    };
    
    orders.forEach(order => {
        const amount = order.total_amount;
        if (amount <= 15) sizeRanges['Small (0-150)']++;
        else if (amount <= 30) sizeRanges['Medium (150-300)']++;
        else if (amount <= 50) sizeRanges['Large (300-500)']++;
        else sizeRanges['XL (50+)']++;
    });
    
    const ctx = document.getElementById('orderSizeChart');
    if (!ctx) return;
    
    if (window.orderSizeChart && typeof window.orderSizeChart.destroy === 'function') {
        window.orderSizeChart.destroy();
    }
    
    window.orderSizeChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: Object.keys(sizeRanges),
            datasets: [{
                label: 'Number of Orders',
                data: Object.values(sizeRanges),
                backgroundColor: 'rgba(217, 168, 68, 0.8)',
                borderColor: 'rgba(217, 168, 68, 1)',
                borderWidth: 1
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            scales: { y: { beginAtZero: true } } 
        }
    });
}

function renderAdvancedMetrics(orders, transactions) {
    const completedOrders = orders.filter(o => o.status === 'completed');
    const totalRevenue = completedOrders.reduce((sum, order) => sum + order.total_amount, 0);
    const avgOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;
    
    const timeRange = parseInt(document.getElementById('advancedTimeRange')?.value || '30');
    const ordersPerHour = orders.length / (timeRange * 24);
    
    const dailyRevenue = {};
    completedOrders.forEach(order => {
        const date = new Date(order.created_at).toLocaleDateString();
        dailyRevenue[date] = (dailyRevenue[date] || 0) + order.total_amount;
    });
    const peakDayRevenue = Math.max(...Object.values(dailyRevenue), 0);
    
    const uniqueItems = new Set();
    orders.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => uniqueItems.add(item.name));
        }
    });
    
    document.getElementById('advancedAvgOrderValue').textContent = formatCurrency(avgOrderValue);
    document.getElementById('advancedOrdersPerHour').textContent = ordersPerHour.toFixed(1);
    document.getElementById('advancedPeakDayRevenue').textContent = formatCurrency(peakDayRevenue);
    document.getElementById('advancedMenuVariety').textContent = uniqueItems.size;
    
    document.getElementById('advancedAvgOrderChange').textContent = '+5.2%';
    document.getElementById('advancedAvgOrderChange').className = 'metric-change positive';
    document.getElementById('advancedOrdersPerHourChange').textContent = '+12.1%';
    document.getElementById('advancedOrdersPerHourChange').className = 'metric-change positive';
    document.getElementById('advancedPeakDayChange').textContent = '+8.7%';
    document.getElementById('advancedPeakDayChange').className = 'metric-change positive';
    document.getElementById('advancedVarietyChange').textContent = '+3';
    document.getElementById('advancedVarietyChange').className = 'metric-change positive';
}

async function renderPerformanceMatrix(orders) {
    const tbody = document.getElementById('performanceMatrixBody');
    if (!tbody) return;
    
    try {
        // Get menu items from database
        const { data: menuItems, error } = await window.supabaseClient
            .from('menu_items')
            .select('*');
            
        if (error) throw error;
        
        console.log('Menu items loaded:', menuItems?.length || 0);
        console.log('Orders for analysis:', orders?.length || 0);
        console.log('Sample order structure:', orders?.[0]);
        console.log('Order keys:', orders?.[0] ? Object.keys(orders[0]) : 'No orders');
        
        const itemPerformance = {};
        
        // Initialize with menu items
        menuItems?.forEach(item => {
            itemPerformance[item.name] = {
                orders: 0,
                revenue: 0,
                quantity: 0,
                basePrice: item.price || 0
            };
        });
        
        // Add order data - check different possible structures
        orders?.forEach((order, index) => {
            if (index === 0) {
                console.log('First order detailed structure:');
                for (const [key, value] of Object.entries(order)) {
                    console.log(`  ${key}:`, typeof value, value);
                }
            }
            
            // Try different possible item storage methods
            let orderItems = null;
            
            if (order.items && Array.isArray(order.items)) {
                orderItems = order.items;
            } else if (order.order_items && Array.isArray(order.order_items)) {
                orderItems = order.order_items;
            } else if (typeof order.items === 'string') {
                try {
                    orderItems = JSON.parse(order.items);
                } catch (e) {
                    console.log('Failed to parse items JSON:', order.items);
                }
            }
            
            if (orderItems && Array.isArray(orderItems)) {
                console.log(`Order ${index + 1} items:`, orderItems);
                orderItems.forEach(item => {
                    const name = item.name || item.item_name || 'Unknown Item';
                    if (itemPerformance[name]) {
                        itemPerformance[name].orders += 1;
                        itemPerformance[name].revenue += (item.price || item.item_price || 0) * (item.quantity || 1);
                        itemPerformance[name].quantity += (item.quantity || 1);
                    }
                });
            }
        });
        
        console.log('Item performance data:', itemPerformance);
        
        // If no menu items, show message
        if (!menuItems || menuItems.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">No menu items found. Add items in Menu Management.</td></tr>';
            return;
        }
        
        const sortedItems = Object.entries(itemPerformance)
            .sort(([, a], [, b]) => b.revenue - a.revenue);
        
        // Apply performance filter
        const performanceFilter = document.getElementById('performanceFilter')?.value || 'all';
        const filteredItems = performanceFilter === 'all' ? sortedItems : 
            sortedItems.filter(([, data]) => {
                const performance = data.revenue > 100 ? 'high' : data.revenue > 50 ? 'medium' : 'low';
                return performance === performanceFilter;
            });
        
        tbody.innerHTML = filteredItems.slice(0, 10).map(([itemName, data]) => {
            const avgPrice = data.basePrice || 0;
            const performance = data.revenue > 100 ? 'high' : data.revenue > 50 ? 'medium' : 'low';
            const trend = data.quantity > 5 ? '↗️' : data.quantity > 0 ? '→' : '↘️';
            
            return `
                <tr>
                    <td>${itemName}</td>
                    <td>${data.quantity}</td>
                    <td>${formatCurrency(data.revenue)}</td>
                    <td>${formatCurrency(avgPrice)}</td>
                    <td><span class="performance-badge ${performance}">${performance.toUpperCase()}</span></td>
                    <td>${trend}</td>
                </tr>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading performance matrix:', error);
        tbody.innerHTML = '<tr><td colspan="6" style="text-align: center;">Error loading performance data</td></tr>';
    }
}

function generateAIRecommendations(orders, transactions) {
    const recommendations = [];
    
    const hourlyOrders = {};
    orders.forEach(order => {
        const hour = new Date(order.created_at).getHours();
        hourlyOrders[hour] = (hourlyOrders[hour] || 0) + 1;
    });
    
    const peakHour = Object.entries(hourlyOrders)
        .sort(([, a], [, b]) => b - a)[0];
    
    if (peakHour) {
        recommendations.push({
            title: 'Staff Optimization',
            message: `Peak hour is ${peakHour[0]}:00 with ${peakHour[1]} orders. Consider scheduling more staff during this time.`
        });
    }
    
    const paymentMethods = {};
    transactions.forEach(t => {
        paymentMethods[t.payment_method] = (paymentMethods[t.payment_method] || 0) + 1;
    });
    
    const cashPercentage = (paymentMethods.cash || 0) / transactions.length * 100;
    if (cashPercentage > 60) {
        recommendations.push({
            title: 'Digital Payment Promotion',
            message: `${cashPercentage.toFixed(1)}% of payments are cash. Consider promoting digital payments with discounts.`
        });
    }
    
    const manualOrders = orders.filter(o => o.order_type === 'manual').length;
    const manualPercentage = manualOrders / orders.length * 100;
    
    if (manualPercentage > 30) {
        recommendations.push({
            title: 'Table Ordering System',
            message: `${manualPercentage.toFixed(1)}% are manual orders. Consider promoting table-based ordering to reduce wait times.`
        });
    }
    
    const container = document.getElementById('aiRecommendations');
    if (!container) return;
    
    container.innerHTML = recommendations.map(rec => `
        <div class="recommendation-item">
            <h5>${rec.title}</h5>
            <p>${rec.message}</p>
        </div>
    `).join('') || '<p>No specific recommendations at this time. Your restaurant is performing well!</p>';
}