// Reports & Analytics functionality
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        loadReportsData();
        setupDateFilter();
    }, 500);
});

let salesChart, itemsChart, serveTimeChart;

function setupDateFilter() {
    document.getElementById('dateRange').addEventListener('change', function() {
        loadReportsData();
    });
}

async function loadReportsData() {
    if (!supabase) {
        console.error('Supabase not initialized');
        return;
    }
    
    try {
        const dateRange = document.getElementById('dateRange').value;
        const dateFilter = getDateFilter(dateRange);
        
        const { data: orders, error } = await supabase
            .from('orders')
            .select('*')
            .gte('created_at', dateFilter)
            .order('created_at', { ascending: false });
            
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
                            return '$' + value.toFixed(2);
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Revenue: $' + context.parsed.y.toFixed(2);
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
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No orders found</td></tr>';
        return;
    }

    tbody.innerHTML = orders.slice(0, 20).map(order => `
        <tr>
            <td>${order.id.substring(0, 8)}...</td>
            <td>Table ${order.table_number}</td>
            <td>${order.customer_name || 'Guest'}</td>
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

    tbody.innerHTML = sortedItems.map(([itemName, data]) => {
        const avgServeTime = data.serveTimeCount > 0 ? 
            Math.round(data.totalServeTime / data.serveTimeCount) : 0;
        
        return `
            <tr>
                <td>${itemName}</td>
                <td style="text-transform: capitalize;">${data.category}</td>
                <td>${data.quantity}</td>
                <td>${formatCurrency(data.revenue)}</td>
                <td>${avgServeTime} min</td>
            </tr>
        `;
    }).join('');
}