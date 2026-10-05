/* ===================================
   Admin Dashboard - JavaScript
   =================================== */

document.addEventListener('DOMContentLoaded', () => {
    // Check if user is logged in and is admin
    if (!AuthManager.isLoggedIn()) {
        window.location.href = '/';
        return;
    }

    const user = AuthManager.getCurrentUser();
    if (!user || !user.is_admin) {
        showToast('Admin access required', 'error');
        setTimeout(() => window.location.href = '/', 1500);
        return;
    }

    document.getElementById('navUserName').textContent = user.name;
    loadAdminData();
});

async function loadAdminData() {
    try {
        // Load stats
        const stats = await ApiClient.get('/api/admin/stats');
        document.getElementById('statUsers').textContent = stats.total_users;
        document.getElementById('statOrders').textContent = stats.total_orders;
        document.getElementById('statRevenue').textContent = '₹' + (stats.total_revenue || 0).toLocaleString();
        document.getElementById('statContacts').textContent = stats.total_contacts;
        document.getElementById('statVerified').textContent = stats.verified_users + ' verified';
        document.getElementById('statPending').textContent = stats.pending_orders + ' pending';
        document.getElementById('statUnread').textContent = stats.unread_contacts + ' unread';

        // Load all tabs
        await Promise.all([loadAdminOrders(), loadAdminContacts(), loadAdminUsers()]);
    } catch (err) {
        if (err.status === 403) {
            showToast('Admin access required', 'error');
            setTimeout(() => window.location.href = '/', 1500);
        } else {
            showToast(err.message || 'Failed to load data', 'error');
        }
    }
}

async function loadAdminOrders() {
    const data = await ApiClient.get('/api/admin/orders');
    const tbody = document.getElementById('adminOrdersBody');

    if (data.orders.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No orders yet</td></tr>';
        return;
    }

    tbody.innerHTML = data.orders.map(order => `
        <tr>
            <td><strong>#${order.id}</strong></td>
            <td>${order.user_name || 'N/A'}<br><small style="color:var(--text-muted);">${order.user_email || ''}</small></td>
            <td>${order.product_name}</td>
            <td><strong>₹${order.total_price.toLocaleString()}</strong></td>
            <td>
                <select class="status-select status-${order.status}" onchange="updateOrderStatus(${order.id}, this.value, this)">
                    <option value="pending" ${order.status === 'pending' ? 'selected' : ''}>Pending</option>
                    <option value="confirmed" ${order.status === 'confirmed' ? 'selected' : ''}>Confirmed</option>
                    <option value="shipped" ${order.status === 'shipped' ? 'selected' : ''}>Shipped</option>
                    <option value="delivered" ${order.status === 'delivered' ? 'selected' : ''}>Delivered</option>
                    <option value="cancelled" ${order.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
            </td>
            <td>
                ${order.shiprocket_awb
                    ? `${order.courier_name || 'Courier'}: ${order.shiprocket_awb}`
                    : `${order.shiprocket_order_id ? 'AWB pending' : order.payment_status === 'paid' ? 'Booking pending' : 'Not paid'}`
                }
                ${order.payment_status === 'paid' && !order.shiprocket_awb
                    ? `<br><button class="btn-mark-read" onclick="retryShiprocketBooking(${order.id}, this)">Retry booking</button>`
                    : ''
                }
            </td>
            <td>${new Date(order.created_at).toLocaleDateString()}</td>
        </tr>
    `).join('');
}

async function loadAdminContacts() {
    const data = await ApiClient.get('/api/admin/contacts');
    const tbody = document.getElementById('adminContactsBody');

    if (data.contacts.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="table-empty">No messages yet</td></tr>';
        return;
    }

    tbody.innerHTML = data.contacts.map(contact => `
        <tr class="${contact.is_read ? '' : 'unread-row'}">
            <td><strong>${contact.name}</strong><br><small style="color:var(--text-muted);">${contact.email}</small></td>
            <td>${contact.interest || '-'}</td>
            <td class="message-cell">${contact.message}</td>
            <td>${new Date(contact.created_at).toLocaleDateString()}</td>
            <td>
                ${contact.is_read
                    ? '<span class="badge badge-read">Read</span>'
                    : `<button class="btn-mark-read" onclick="markContactRead(${contact.id}, this)">Mark Read</button>`
                }
            </td>
        </tr>
    `).join('');
}

async function loadAdminUsers() {
    const data = await ApiClient.get('/api/admin/users');
    const tbody = document.getElementById('adminUsersBody');

    if (data.users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="table-empty">No users yet</td></tr>';
        return;
    }

    tbody.innerHTML = data.users.map(user => `
        <tr>
            <td><strong>${user.name}</strong></td>
            <td>${user.email}</td>
            <td>${user.phone || '-'}</td>
            <td>
                ${user.is_verified
                    ? '<span class="badge-verified">✅ Verified</span>'
                    : '<span class="badge-unverified">⏳ Unverified</span>'
                }
            </td>
            <td>${new Date(user.created_at).toLocaleDateString()}</td>
        </tr>
    `).join('');
}

async function updateOrderStatus(orderId, newStatus, selectEl) {
    try {
        await ApiClient.put(`/api/admin/orders/${orderId}`, { status: newStatus });
        selectEl.className = `status-select status-${newStatus}`;
        showToast('Order status updated!');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function retryShiprocketBooking(orderId, button) {
    button.disabled = true;
    button.textContent = 'Retrying...';
    try {
        await ApiClient.post(`/api/admin/orders/${orderId}/shiprocket`, {});
        showToast('Shiprocket booking completed');
        await loadAdminOrders();
    } catch (err) {
        showToast(err.message || 'Shiprocket booking failed', 'error');
        button.disabled = false;
        button.textContent = 'Retry booking';
    }
}

async function markContactRead(contactId, btn) {
    try {
        await ApiClient.put(`/api/admin/contacts/${contactId}/read`);
        btn.closest('tr').classList.remove('unread-row');
        btn.replaceWith(Object.assign(document.createElement('span'), {
            className: 'badge badge-read', textContent: 'Read'
        }));
        showToast('Marked as read');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function switchAdminTab(btn, panelId) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(panelId).classList.add('active');
}

function handleLogout() {
    AuthManager.logout();
    window.location.href = '/';
}
