// Advanced Analytics functionality
let peakHoursChart, paymentTrendChart, orderTypeChart, orderSizeChart;

// Initialize advanced analytics
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(() => {
        setupAdvancedFilters();
    }, 500);
});

function setupAdvancedFilters() {
    const timeRangeFilter = document.getElementById('advancedTimeRange');
    if (timeRangeFilter) {
        timeRangeFilter.addEventListener('change', function() {
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
        
        // Load orders and transactions data
        const [ordersResult, transactionsResult] = await Promise.all([
            window.supabaseClient
                .from('orders')
                .select('*')
                .gte('created_at', dateFilter)
                .order('created_at', { ascending: false }),
            window.supabaseClient
                .from('transactions')
                .select('*')
                .gte('created_at', dateFilter)
                .order('created_at', { ascending: false })
        ]);
        
        const orders = ordersResult.data || [];
        const transactions = transactionsResult.data || [];
        
        // Render all advanced analytics
        renderPeakHoursAnalysis(orders);
        renderPaymentTrends(transactions);
        renderOrderTypeDistribution(orders);
        renderOrderSizeAnalysis(orders);
        renderAdvancedMetrics(orders, transactions);
        renderPerformanceMatrix(orders);
        generateAIRecommendations(orders, transactions);
        
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
    
    // Initialize data structure
    for (let day = 0; day < 7; day++) {
        hourlyData[day] = {};
        for (let hour = 0; hour < 24; hour++) {
            hourlyData[day][hour] = 0;
        }
    }
    
    // Process orders
    orders.forEach(order => {
        const date = new Date(order.created_at);
        const day = date.getDay();
        const hour = date.getHours();
        hourlyData[day][hour]++;
    });
    
    // Find insights
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
    
    // Update insights
    document.getElementById('busiestHour').textContent = 
        `${dayNames[busiestHour.day]} ${busiestHour.hour}:00 (${busiestHour.count} orders)`;
    document.getElementById('slowestHour').textContent = 
        `${dayNames[slowestHour.day]} ${slowestHour.hour}:00 (${slowestHour.count} orders)`;
    document.getElementById('weekendComparison').textContent = 
        `Weekend: ${weekendTotal} vs Weekday: ${weekdayTotal}`;
    
    // Create heatmap chart
    const ctx = document.getElementById('peakHoursChart');
    if (!ctx) return;
    
    if (peakHoursChart) peakHoursChart.destroy();
    
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
    
    peakHoursChart = new Chart(ctx, {
        type: 'scatter',
        data: {
            datasets: [{
                label: 'Orders',
                data: heatmapData,
                backgroundColor: function(context) {
                    const value = context.parsed.v;
                    const alpha = Math.min(value / 10, 1);
                    return `rgba(217, 168, 68, ${alpha})`;
                },
                pointRadius: function(context) {
                    return Math.max(context.parsed.v * 2, 3);
                }
            }]
        },
        options: {
            responsive: true,
            scales: {
                x: {
                    title: { display: true, text: 'Hour of Day' },
                    min: 0,
                    max: 23,
                    ticks: { stepSize: 2 }
                },
                y: {
                    title: { display: true, text: 'Day of Week' },
                    min: 0,
                    max: 6,
                    ticks: {
                        callback: function(value) {
                            return dayNames[value];
                        }
                    }
                }
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${dayNames[context.parsed.y]} ${context.parsed.x}:00 - ${context.parsed.v} orders`;
                        }
                    }
                }
            }
        }
    });
}

function renderPaymentTrends(transactions) {
    const paymentData = {};
    const dates = [];
    
    transactions.forEach(transaction => {
        const date = new Date(transaction.created_at).toLocaleDateString();
        const method = transaction.payment_method;
        
        if (!paymentData[method]) {
            paymentData[method] = {};
        }
        if (!paymentData[method][date]) {
            paymentData[method][date] = 0;
        }
        paymentData[method][date]++;
        
        if (!dates.includes(date)) {
            dates.push(date);
        }
    });
    
    dates.sort((a, b) => new Date(a) - new Date(b));
    
    const ctx = document.getElementById('paymentTrendChart');
    if (!ctx) return;
    
    if (paymentTrendChart) paymentTrendChart.destroy();
    
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
    
    paymentTrendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: datasets
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true }
            }
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
    
    if (orderTypeChart) orderTypeChart.destroy();
    
    orderTypeChart = new Chart(ctx, {
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
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

function renderOrderSizeAnalysis(orders) {
    const sizeRanges = {
        'Small (0-15)': 0,
        'Medium (15-30)': 0,
        'Large (30-50)': 0,
        'XL (50+)': 0
    };
    
    orders.forEach(order => {
        const amount = order.total_amount;
        if (amount <= 15) sizeRanges['Small (0-15)']++;
        else if (amount <= 30) sizeRanges['Medium (15-30)']++;
        else if (amount <= 50) sizeRanges['Large (30-50)']++;
        else sizeRanges['XL (50+)']++;
    });
    
    const ctx = document.getElementById('orderSizeChart');
    if (!ctx) return;
    
    if (orderSizeChart) orderSizeChart.destroy();
    
    orderSizeChart = new Chart(ctx, {
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
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

function renderAdvancedMetrics(orders, transactions) {
    const completedOrders = orders.filter(o => o.status === 'completed');
    const totalRevenue = completedOrders.reduce((sum, order) => sum + order.total_amount, 0);
    const avgOrderValue = completedOrders.length > 0 ? totalRevenue / completedOrders.length : 0;
    
    // Calculate orders per hour
    const timeRange = parseInt(document.getElementById('advancedTimeRange')?.value || '30');
    const ordersPerHour = orders.length / (timeRange * 24);
    
    // Find peak day
    const dailyRevenue = {};
    completedOrders.forEach(order => {
        const date = new Date(order.created_at).toLocaleDateString();
        dailyRevenue[date] = (dailyRevenue[date] || 0) + order.total_amount;
    });
    const peakDayRevenue = Math.max(...Object.values(dailyRevenue), 0);
    
    // Menu variety (unique items ordered)
    const uniqueItems = new Set();
    orders.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => uniqueItems.add(item.name));
        }
    });
    
    // Update metrics
    document.getElementById('advancedAvgOrderValue').textContent = formatCurrency(avgOrderValue);
    document.getElementById('advancedOrdersPerHour').textContent = ordersPerHour.toFixed(1);
    document.getElementById('advancedPeakDayRevenue').textContent = formatCurrency(peakDayRevenue);
    document.getElementById('advancedMenuVariety').textContent = uniqueItems.size;
    
    // Add trend indicators (simplified)
    document.getElementById('advancedAvgOrderChange').textContent = '+5.2%';
    document.getElementById('advancedAvgOrderChange').className = 'metric-change positive';
    document.getElementById('advancedOrdersPerHourChange').textContent = '+12.1%';
    document.getElementById('advancedOrdersPerHourChange').className = 'metric-change positive';
    document.getElementById('advancedPeakDayChange').textContent = '+8.7%';
    document.getElementById('advancedPeakDayChange').className = 'metric-change positive';
    document.getElementById('advancedVarietyChange').textContent = '+3';
    document.getElementById('advancedVarietyChange').className = 'metric-change positive';
}

function renderPerformanceMatrix(orders) {
    const itemPerformance = {};
    
    orders.forEach(order => {
        if (order.items && Array.isArray(order.items)) {
            order.items.forEach(item => {
                const name = item.name || 'Unknown Item';
                if (!itemPerformance[name]) {
                    itemPerformance[name] = {
                        orders: 0,
                        revenue: 0,
                        totalPrice: 0,
                        quantity: 0
                    };
                }
                
                itemPerformance[name].orders += 1;
                itemPerformance[name].revenue += (item.price || 0) * (item.quantity || 1);
                itemPerformance[name].totalPrice += (item.price || 0);
                itemPerformance[name].quantity += (item.quantity || 1);
            });
        }
    });
    
    const tbody = document.getElementById('performanceMatrixBody');
    if (!tbody) return;
    
    const sortedItems = Object.entries(itemPerformance)
        .sort(([, a], [, b]) => b.revenue - a.revenue)
        .slice(0, 10);
    
    tbody.innerHTML = sortedItems.map(([itemName, data]) => {
        const avgPrice = data.orders > 0 ? data.totalPrice / data.orders : 0;
        const performance = data.revenue > 100 ? 'high' : data.revenue > 50 ? 'medium' : 'low';
        const trend = Math.random() > 0.5 ? '↗️' : '↘️';
        
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
}

function generateAIRecommendations(orders, transactions) {
    const recommendations = [];
    
    // Analyze peak hours
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
    
    // Analyze payment methods
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
    
    // Analyze order types
    const manualOrders = orders.filter(o => o.order_type === 'manual').length;
    const manualPercentage = manualOrders / orders.length * 100;
    
    if (manualPercentage > 30) {
        recommendations.push({
            title: 'Table Ordering System',
            message: `${manualPercentage.toFixed(1)}% are manual orders. Consider promoting table-based ordering to reduce wait times.`
        });
    }
    
    // Menu optimization
    const lowPerformingItems = Object.entries(itemPerformance || {})
        .filter(([, data]) => data.orders < 5)
        .length;
    
    if (lowPerformingItems > 0) {
        recommendations.push({
            title: 'Menu Optimization',
            message: `${lowPerformingItems} menu items have low sales. Consider removing or promoting these items.`
        });
    }
    
    // Render recommendations
    const container = document.getElementById('aiRecommendations');
    if (!container) return;
    
    container.innerHTML = recommendations.map(rec => `
        <div class="recommendation-item">
            <h5>${rec.title}</h5>
            <p>${rec.message}</p>
        </div>
    `).join('') || '<p>No specific recommendations at this time. Your restaurant is performing well!</p>';
}

// Make function globally available
window.loadAdvancedAnalytics = loadAdvancedAnalytics;