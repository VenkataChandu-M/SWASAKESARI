/* ===================================
   CHECKOUT FLOW - Sampurna Ayurvedic
   Step 1: Quantity
   Step 2: Address
   Step 3: Payment (Online / COD)
   Step 4: Confirmation
   =================================== */

const PRODUCT = {
    name: 'Swasa Kesari Syrup 200ml',
    price: 699,
    codAdvance: 0,
    image: null
};

let checkoutState = {
    step: 1,
    quantity: 1,
    paymentMethod: 'online',
    address: {}
};

// Fetch product config from server
async function loadProductConfig() {
    try {
        const data = await ApiClient.get('/api/razorpay-config');
        PRODUCT.name = data.product_name || PRODUCT.name;
        PRODUCT.price = data.product_price || PRODUCT.price;
        PRODUCT.codAdvance = data.cod_advance !== undefined ? data.cod_advance : 0;
    } catch (e) { /* use defaults */ }
}

// =====================
// Open Checkout
// =====================
function openCheckout() {
    if (!AuthManager.isLoggedIn()) {
        showToast('Please login to buy', 'error');
        ModalController.open('loginModal');
        return;
    }

    const user = AuthManager.getCurrentUser();
    checkoutState = { step: 1, quantity: 1, paymentMethod: 'online', address: {} };
    updateCheckoutUI();
    ModalController.open('checkoutModal');
}

// =====================
// Step Navigation
// =====================
function goToStep(step) {
    // Validate before going forward
    if (step === 2 && checkoutState.step === 1) {
        // Quantity step - always valid (min 1)
    }

    if (step === 3 && checkoutState.step === 2) {
        // Validate address
        const fields = ['shipping_name', 'shipping_phone', 'shipping_address',
                        'shipping_city', 'shipping_state', 'shipping_pincode'];
        const errorEl = document.getElementById('addressError');
        for (const field of fields) {
            const input = document.getElementById(field);
            if (!input || !input.value.trim()) {
                errorEl.textContent = `${field.replace('shipping_', '').replace('_', ' ')} is required`;
                input.classList.add('input-error');
                input.focus();
                return;
            }
            input.classList.remove('input-error');
        }

        const pincode = document.getElementById('shipping_pincode').value.trim();
        if (!/^\d{6}$/.test(pincode)) {
            errorEl.textContent = 'Please enter a valid 6-digit pincode';
            return;
        }
        errorEl.textContent = '';

        // Save address
        checkoutState.address = {};
        fields.forEach(f => {
            checkoutState.address[f] = document.getElementById(f).value.trim();
        });
    }

    checkoutState.step = step;
    updateCheckoutUI();
}

// =====================
// Update UI
// =====================
function updateCheckoutUI() {
    const step = checkoutState.step;

    // Update step indicators
    document.querySelectorAll('.checkout-step-dot').forEach((dot, i) => {
        dot.classList.toggle('active', i + 1 === step);
        dot.classList.toggle('completed', i + 1 < step);
    });

    // Show/hide panels
    document.querySelectorAll('.checkout-panel').forEach(p => p.classList.remove('active'));
    const panel = document.getElementById(`checkoutStep${step}`);
    if (panel) panel.classList.add('active');

    // Update quantity display
    const total = PRODUCT.price * checkoutState.quantity;
    const qtyDisplay = document.getElementById('qtyDisplay');
    const totalDisplay = document.getElementById('totalDisplay');
    const qtyValue = document.getElementById('qtyValue');
    if (qtyDisplay) qtyDisplay.textContent = checkoutState.quantity;
    if (qtyValue) qtyValue.textContent = checkoutState.quantity;
    if (totalDisplay) totalDisplay.textContent = `₹${total.toLocaleString()}`;

    // Update payment step summary
    const payTotal = document.getElementById('payTotal');
    const codInfo = document.getElementById('codInfo');
    const onlineAmt = document.getElementById('onlineAmt');

    if (payTotal) payTotal.textContent = `₹${total.toLocaleString()}`;
    if (onlineAmt) onlineAmt.textContent = `₹${total.toLocaleString()}`;

    // Update Pay button text
    const payBtn = document.getElementById('payNowBtn');
    if (payBtn && !payBtn.disabled) {
        payBtn.textContent = checkoutState.paymentMethod === 'cod' ?
            `Place Order (COD ₹${total.toLocaleString()})` : `Pay ₹${total.toLocaleString()}`;
    }

    // Pre-fill address from user
    if (step === 2) {
        const user = AuthManager.getCurrentUser();
        const nameField = document.getElementById('shipping_name');
        const phoneField = document.getElementById('shipping_phone');
        if (nameField && !nameField.value) nameField.value = user?.name || '';
        if (phoneField && !phoneField.value) phoneField.value = user?.phone || '';
    }
}

// =====================
// Quantity Controls
// =====================
function changeQty(delta) {
    const newQty = checkoutState.quantity + delta;
    if (newQty >= 1 && newQty <= 10) {
        checkoutState.quantity = newQty;
        updateCheckoutUI();
    }
}

// =====================
// Payment Method
// =====================
function selectPaymentMethod(method) {
    checkoutState.paymentMethod = method;
    document.querySelectorAll('.payment-option').forEach(opt => {
        opt.classList.toggle('selected', opt.dataset.method === method);
    });

    // Show/hide COD info
    const codInfo = document.getElementById('codInfo');
    if (codInfo) codInfo.style.display = method === 'cod' ? 'block' : 'none';

    // Update pay button amount
    const total = PRODUCT.price * checkoutState.quantity;
    const payBtn = document.getElementById('payNowBtn');
    if (payBtn) {
        payBtn.textContent = method === 'cod' ?
            `Place Order (COD ₹${total.toLocaleString()})` : `Pay ₹${total.toLocaleString()}`;
    }
}

// =====================
// Process Payment
// =====================
async function processPayment() {
    const btn = document.getElementById('payNowBtn');
    const orig = btn.innerHTML;
    btn.innerHTML = '<span>Processing...</span>';
    btn.disabled = true;

    try {
        const checkoutData = {
            quantity: checkoutState.quantity,
            payment_method: checkoutState.paymentMethod,
            ...checkoutState.address
        };

        const result = await ApiClient.post('/api/checkout', checkoutData);

        // If Cash on Delivery, backend confirms immediately
        if (checkoutState.paymentMethod === 'cod' || result.is_cod) {
            showConfirmation(result.order);
            showToast('Order placed successfully with Cash on Delivery! 📦', 'success');
            return;
        }

        // For Online payment, open Razorpay popup
        if (!result.razorpay_key || !result.razorpay_order_id) {
            throw { message: 'Razorpay is not configured correctly. Please contact support.' };
        }
        openRazorpayCheckout(result);
    } catch (err) {
        showToast(err.message || 'Checkout failed', 'error');
        btn.innerHTML = orig;
        btn.disabled = false;
    }
}

function openRazorpayCheckout(orderData) {
    const options = {
        key: orderData.razorpay_key,
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'Sampurna Ayurvedic',
        description: `${PRODUCT.name} x${checkoutState.quantity}`,
        order_id: orderData.razorpay_order_id,
        prefill: orderData.prefill,
        theme: {
            color: '#1a472a'
        },
        handler: async function(response) {
            // Payment successful - verify on backend
            try {
                const verifyResult = await ApiClient.post('/api/payment/verify', {
                    order_id: orderData.order_id,
                    razorpay_order_id: response.razorpay_order_id,
                    razorpay_payment_id: response.razorpay_payment_id,
                    razorpay_signature: response.razorpay_signature
                });

                showConfirmation(verifyResult.order);
                if (verifyResult.shiprocket?.error) {
                    showToast('Payment received, but shipment booking failed. Please contact support.', 'error');
                }
            } catch (err) {
                showToast('Payment verification failed. Contact support.', 'error');
                resetPayButton();
            }
        },
        modal: {
            ondismiss: function() {
                resetPayButton();
            }
        }
    };

    const rzp = new Razorpay(options);
    rzp.on('payment.failed', function(response) {
        showToast('Payment failed: ' + response.error.description, 'error');
        resetPayButton();
    });
    rzp.open();
}

function resetPayButton() {
    const btn = document.getElementById('payNowBtn');
    if (btn) {
        const method = checkoutState.paymentMethod;
        const total = PRODUCT.price * checkoutState.quantity;
        btn.innerHTML = method === 'cod' ?
            `<span>Place Order (COD ₹${total.toLocaleString()})</span>` :
            `<span>Pay ₹${total.toLocaleString()}</span>`;
        btn.disabled = false;
    }
}

// =====================
// Order Confirmation
// =====================
function showConfirmation(order) {
    checkoutState.step = 4;
    updateCheckoutUI();

    const content = document.getElementById('confirmationContent');
    if (!content) return;

    const isCod = order.payment_method === 'cod';

    content.innerHTML = `
        <div class="confirmation-success">
            <div class="conf-icon">✅</div>
            <h3>Order Confirmed!</h3>
            <p class="conf-id">Order #${order.id}</p>
        </div>

        <div class="conf-details">
            <div class="conf-row">
                <span>Product</span>
                <strong>🌿 ${order.product_name}</strong>
            </div>
            <div class="conf-row">
                <span>Quantity</span>
                <strong>${order.quantity}</strong>
            </div>
            <div class="conf-row">
                <span>Total Amount</span>
                <strong>₹${order.total_price.toLocaleString()}</strong>
            </div>
            <div class="conf-row">
                <span>Payment Method</span>
                <strong>${isCod ? 'Cash on Delivery' : 'Paid Online'}</strong>
            </div>
            ${isCod ? `
            <div class="conf-row highlight-row">
                <span>Pay on Delivery</span>
                <strong>₹${order.total_price.toLocaleString()}</strong>
            </div>` : ''}
            <div class="conf-row">
                <span>Delivery To</span>
                <strong>${order.shipping_name}, ${order.shipping_city}</strong>
            </div>
            ${order.shiprocket_awb ? `
            <div class="conf-row">
                <span>Tracking #</span>
                <strong>${order.shiprocket_awb}</strong>
            </div>` : ''}
        </div>

        <div class="conf-actions">
            <a href="/dashboard" class="btn btn-primary">View My Orders</a>
            <button class="btn btn-outline" onclick="ModalController.close('checkoutModal')">Continue Shopping</button>
        </div>
    `;
}

// =====================
// Initialize
// =====================
document.addEventListener('DOMContentLoaded', () => {
    loadProductConfig();
});
