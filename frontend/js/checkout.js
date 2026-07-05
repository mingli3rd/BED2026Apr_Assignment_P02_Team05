const apiBaseUrl = "http://localhost:3000";
const PACKAGING_FEE_PER_ITEM = 0.30;

function renderCheckoutSummary() {
  const cart = getCart();

  if (cart.length === 0) {
    document.getElementById("checkoutEmptyState").style.display = "block";
    document.getElementById("checkoutContent").style.display = "none";
    return;
  }

  const groups = getCartVendorGroups();
  const orderGroupsContainer = document.getElementById("orderGroups");

  let subtotal = 0;
  let orderIndex = 1;

  orderGroupsContainer.innerHTML = Object.keys(groups)
    .map((vendorId) => {
      const group = groups[vendorId];
      const groupSubtotal = group.items.reduce((sum, item) => sum + getCartLineTotal(item), 0);
      subtotal += groupSubtotal;

      const itemCount = group.items.reduce((sum, item) => sum + item.quantity, 0);
      const packaging = itemCount * PACKAGING_FEE_PER_ITEM;

      const html = `
        <div class="dash-panel">
          <div class="dash-panel-header">
            <h2>Order #${orderIndex}: ${group.vendor_name}</h2>
            <span class="mono">$${(groupSubtotal + packaging).toFixed(2)}</span>
          </div>
          <ul class="dash-list">
            ${group.items
              .map((item) => {
                const addOnsText = (item.add_ons || []).map((a) => a.name).join(", ");
                return `
                  <li class="dash-list-item">
                    <span>${item.quantity}x ${item.name}${addOnsText ? ` (+ ${addOnsText})` : ""}</span>
                    <span class="mono muted">$${getCartLineTotal(item).toFixed(2)}</span>
                  </li>
                `;
              })
              .join("")}
          </ul>
        </div>
      `;
      orderIndex++;
      return html;
    })
    .join("");

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const packagingFee = totalItems * PACKAGING_FEE_PER_ITEM;
  const total = subtotal + packagingFee;

  document.getElementById("breakdownSubtotal").textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById("breakdownPackaging").textContent = `$${packagingFee.toFixed(2)}`;
  document.getElementById("breakdownTotal").textContent = `$${total.toFixed(2)}`;
}

async function submitPayment() {
  const cart = getCart();
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
  const forceFail = document.getElementById("simulateFailure").checked;
  const guestEmail = document.getElementById("guestEmail").value.trim();

  const payButton = document.getElementById("payButton");
  const messageEl = document.getElementById("checkoutMessage");

  payButton.disabled = true;
  payButton.textContent = "Processing payment...";
  messageEl.textContent = "";

  try {
    const response = await fetch(`${apiBaseUrl}/api/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // sends patron cookie if logged in; ignored for guests
      body: JSON.stringify({
        cart_items: cart,
        payment_method: paymentMethod,
        force_fail: forceFail,
        guest_email: guestEmail,
      }),
    });

    if (response.status === 201) {
      const data = await response.json();
      showSuccessState(data.orders, data.is_guest);
      clearCartStore();

    } else if (response.status === 402) {
      const errorBody = await response.json();
      showFailureState(errorBody.error);

    } else if (response.status === 400) {
      const errorBody = await response.json();
      messageEl.textContent = `Validation error: ${errorBody.error}`;
      messageEl.className = "form-message is-warning";

    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }

  } catch (error) {
    console.error("Error submitting payment:", error);
    messageEl.textContent = "Something went wrong. Please try again.";
    messageEl.className = "form-message is-error";

  } finally {
    payButton.disabled = false;
    payButton.textContent = "Pay Now";
  }
}

const GUEST_ORDERS_SESSION_KEY = "hawkerhub_guest_order_ids";

function trackGuestOrderIds(orders) {
  try {
    const existingRaw = sessionStorage.getItem(GUEST_ORDERS_SESSION_KEY);
    const existing = existingRaw ? JSON.parse(existingRaw) : [];
    const newIds = orders.map((o) => o.order_id);
    sessionStorage.setItem(GUEST_ORDERS_SESSION_KEY, JSON.stringify([...existing, ...newIds]));
  } catch (error) {
    console.error("Error tracking guest order IDs:", error);
  }
}

function showSuccessState(orders, isGuest) {
  document.getElementById("checkoutForm").style.display = "none";
  document.getElementById("successState").style.display = "block";

  const estimatedMinutes = 15 + Math.floor(Math.random() * 10);
  document.getElementById("successSummary").textContent =
    `${orders.length} order${orders.length > 1 ? "s" : ""} placed. Estimated preparation time: ${estimatedMinutes} minutes.`;

  document.getElementById("successOrdersList").innerHTML = orders
    .map(
      (order) => `
        <div class="dash-panel">
          <div class="dash-panel-header">
            <h2>Order #${order.order_id}: ${order.vendor_name}</h2>
            <span class="mono">$${Number(order.total).toFixed(2)}</span>
          </div>
          <div class="breakdown-row"><span>Subtotal</span><span class="mono">$${Number(order.subtotal).toFixed(2)}</span></div>
          <div class="breakdown-row"><span>Packaging</span><span class="mono">$${Number(order.packaging_fee).toFixed(2)}</span></div>
        </div>
      `
    )
    .join("");

  const viewOrdersBtn = document.getElementById("viewOrdersBtn");
  const saveInfoUpsell = document.getElementById("saveInfoUpsell");

  if (isGuest) {
    // Track these order IDs so guest-orders.html can look them up this session
    trackGuestOrderIds(orders);
    viewOrdersBtn.href = "guest-orders.html";
    saveInfoUpsell.style.display = "block";
  } else {
    // Already a logged-in patron — they have real persistent order history,
    // no need for the "save my info" upsell
    viewOrdersBtn.href = "patron-orders.html";
    saveInfoUpsell.style.display = "none";
  }
}

function showFailureState(reason) {
  document.getElementById("checkoutForm").style.display = "none";
  document.getElementById("failureState").style.display = "block";
  document.getElementById("failureReason").textContent = reason || "Your payment could not be processed.";
}

document.getElementById("payButton").addEventListener("click", submitPayment);

document.getElementById("retryPaymentBtn").addEventListener("click", () => {
  document.getElementById("failureState").style.display = "none";
  document.getElementById("checkoutForm").style.display = "block";
  document.getElementById("simulateFailure").checked = false;
});

renderCheckoutSummary();