/* ===================================
   User Dashboard - JavaScript
   =================================== */

const STATUS_STEPS = ['pending', 'confirmed', 'shipped', 'delivered'];
const STATUS_ICONS = { pending: '📋', confirmed: '✅', shipped: '🚚', delivered: '📦', cancelled: '❌' };

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in
    if (!AuthManager.isLoggedIn()) {
        window.location.href = '/';
        return;
    }

    loadDashboard();
});

async function loadDashboard() {
    try {
        // Load profile & stats
        const profileData = await ApiClient.get('/api/user/profile');
        const user = profileData.user;
        const stats = profileData.stats;

        // Update UI
        document.getElementById('dashUserName').textContent = user.name;
        document.getElementById('navUserName').textContent = user.name;
        document.getElementById('totalOrders').textContent = stats.total_orders;
        document.getElementById('totalSpent').textContent = '₹' + (stats.total_spent || 0).toLocaleString();
        document.getElementById('userEmail').textContent = user.email;
        document.getElementById('userPhone').textContent = user.phone || 'Not set';

        // Verification badge
        const badge = document.getElementById('verificationBadge');
        const badgeIcon = document.getElementById('badgeIcon');
        const badgeText = document.getElementById('badgeText');
        if (user.is_verified) {
            badge.classList.add('verified');
            badgeIcon.textContent = '✅';
            badgeText.textContent = 'Verified';
        } else {
            badgeIcon.textContent = '⏳';
            badgeText.textContent = 'Unverified';
        }

        // Profile form
        document.getElementById('profileName').textContent = user.name;
        document.getElementById('profileEmail').textContent = user.email;
        document.getElementById('editName').value = user.name;
        document.getElementById('editPhone').value = user.phone || '';

        // Load orders
        await loadOrders();
    } catch (err) {
        if (err.status === 401 || err.status === 422) {
            window.location.href = '/';
        }
    }

    // Profile form submit
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                const result = await ApiClient.put('/api/user/profile', {
                    name: document.getElementById('editName').value,
                    phone: document.getElementById('editPhone').value
                });
                showToast('Profile updated successfully!');
                document.getElementById('dashUserName').textContent = result.user.name;
                document.getElementById('navUserName').textContent = result.user.name;
                document.getElementById('profileName').textContent = result.user.name;
                ApiClient.setUser(result.user);
            } catch (err) {
                showToast(err.message || 'Failed to update', 'error');
            }
        });
    }
}

async function loadOrders() {
    const container = document.getElementById('ordersContent');
    try {
        const data = await ApiClient.get('/api/orders');

        if (data.orders.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📦</div>
                    <p class="empty-state-text">No orders yet. Visit the store to place your first order!</p>
                    <a href="/" class="btn btn-primary">Browse Products</a>
                </div>`;
            return;
        }

        container.innerHTML = `<div class="orders-list">
            ${data.orders.map(order => `
                <div class="order-card" onclick="showOrderDetail(${order.id})">
                    <div class="order-card-header">
                        <span class="order-id">Order #${order.id}</span>
                        <span class="order-date">${new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </div>
                    <div class="order-card-body">
                        <span class="order-product">🌿 ${order.product_name}</span>
                        <span class="order-price">₹${order.total_price.toLocaleString()}</span>
                        <span class="order-status-badge status-${order.status}">
                            ${STATUS_ICONS[order.status] || '📋'} ${order.status}
                        </span>
                    </div>
                    ${order.status !== 'cancelled' ? renderMiniTimeline(order.status) : ''}
                </div>
            `).join('')}
        </div>`;
    } catch (err) {
        container.innerHTML = `<div class="dash-loading">Failed to load orders</div>`;
    }
}

function renderMiniTimeline(currentStatus) {
    const currentIndex = STATUS_STEPS.indexOf(currentStatus);
    const progressPercent = currentIndex >= 0 ? (currentIndex / (STATUS_STEPS.length - 1)) * 100 : 0;

    return `
        <div class="order-timeline">
            <div class="timeline-progress" style="width: calc(${progressPercent}% - 40px);"></div>
            ${STATUS_STEPS.map((step, i) => `
                <div class="timeline-step ${i < currentIndex ? 'completed' : ''} ${i === currentIndex ? 'current' : ''}">
                    <div class="timeline-dot">${i <= currentIndex ? '✓' : (i + 1)}</div>
                    <span class="timeline-label">${step}</span>
                </div>
            `).join('')}
        </div>`;
}

async function showOrderDetail(orderId) {
    try {
        const data = await ApiClient.get(`/api/orders/${orderId}`);
        const order = data.order;

        document.getElementById('orderDetailId').textContent = `Order #${order.id}`;

        const currentIndex = STATUS_STEPS.indexOf(order.status);
        const progressPercent = currentIndex >= 0 ? (currentIndex / (STATUS_STEPS.length - 1)) * 100 : 0;

        document.getElementById('orderDetailContent').innerHTML = `
            <div class="order-status-badge status-${order.status}" style="margin: 0 auto 20px; display: inline-flex;">
                ${STATUS_ICONS[order.status] || '📋'} ${order.status}
            </div>

            ${order.status !== 'cancelled' ? `
            <div class="order-timeline">
                <div class="timeline-progress" style="width: calc(${progressPercent}% - 40px);"></div>
                ${STATUS_STEPS.map((step, i) => `
                    <div class="timeline-step ${i < currentIndex ? 'completed' : ''} ${i === currentIndex ? 'current' : ''}">
                        <div class="timeline-dot">${i <= currentIndex ? '✓' : (i + 1)}</div>
                        <span class="timeline-label">${step}</span>
                    </div>
                `).join('')}
            </div>` : ''}

            <div class="order-detail-grid">
                <div class="detail-item">
                    <div class="detail-label">Product</div>
                    <div class="detail-value">🌿 ${order.product_name}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Quantity</div>
                    <div class="detail-value">${order.quantity}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Total Price</div>
                    <div class="detail-value">₹${order.total_price.toLocaleString()}</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Ordered On</div>
                    <div class="detail-value">${new Date(order.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                </div>
            </div>`;

        ModalController.open('orderDetailModal');
    } catch (err) {
        showToast('Failed to load order details', 'error');
    }
}

function switchDashTab(btn, panelId) {
    document.querySelectorAll('.dash-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.dash-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(panelId).classList.add('active');
}

function handleLogout() {
    AuthManager.logout();
    window.location.href = '/';
}
