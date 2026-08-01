const apiBaseUrl = "http://localhost:3000";
const PACKAGING_FEE_PER_ITEM = 0.30;
redirectIfVendor();

// Fetches a vendor's currently-enabled eco packaging options (public route).
async function fetchPackagingOptions(vendorId) {
  try {
    const response = await fetch(`${apiBaseUrl}/api/stalls/${vendorId}/packaging`);
    if (response.status !== 200) return [];
    return await response.json();
  } catch (error) {
    console.error(`Error loading packaging options for vendor ${vendorId}:`, error);
    return [];
  }
}

// Given a vendor's fetched options + the customer's stored choice, works
// out what to display and charge for that vendor's order. Mirrors the
// backend's resolvePackaging() logic in checkoutModel.js exactly, so the
// price shown here matches what actually gets charged.
function resolveGroupPackaging(itemCount, options, choiceOptionId) {
  const standardFee = itemCount * PACKAGING_FEE_PER_ITEM;

  if (choiceOptionId) {
    const chosen = options.find((o) => String(o.id) === String(choiceOptionId));
    if (chosen) {
      const ecoFeePerItem = PACKAGING_FEE_PER_ITEM + Number(chosen.surcharge);
      return {
        label: `🌱 ${chosen.description}`,
        fee: itemCount * ecoFeePerItem,
      };
    }
  }

  return { label: "Standard packaging", fee: standardFee };
}

async function renderCheckoutSummary() {
  const cart = getCart();

  if (cart.length === 0) {
    document.getElementById("checkoutEmptyState").style.display = "block";
    document.getElementById("checkoutContent").style.display = "none";
    return;
  }

  const groups = getCartVendorGroups();
  const vendorIds = Object.keys(groups);
  const orderGroupsContainer = document.getElementById("orderGroups");

  // Fetch each vendor's packaging options in parallel so the fee shown
  // here matches what the customer picked on the cart page
  const packagingByVendor = {};
  await Promise.all(
    vendorIds.map(async (vendorId) => {
      packagingByVendor[vendorId] = await fetchPackagingOptions(vendorId);
    })
  );

  let subtotal = 0;
  let packagingTotal = 0;
  let orderIndex = 1;

  orderGroupsContainer.innerHTML = vendorIds
    .map((vendorId) => {
      const group = groups[vendorId];
      const groupSubtotal = group.items.reduce((sum, item) => sum + getCartLineTotal(item), 0);
      subtotal += groupSubtotal;

      const itemCount = group.items.reduce((sum, item) => sum + item.quantity, 0);
      const choiceOptionId = getPackagingChoice(vendorId);
      const packaging = resolveGroupPackaging(itemCount, packagingByVendor[vendorId], choiceOptionId);
      packagingTotal += packaging.fee;

      const specialRequest = getSpecialRequest(vendorId);

      const html = `
        <div class="dash-panel">
          <div class="dash-panel-header">
            <h2>Order #${orderIndex}: ${group.vendor_name}</h2>
            <span class="mono">$${(groupSubtotal + packaging.fee).toFixed(2)}</span>
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
          <div class="breakdown-row" style="margin-top:10px;">
            <span>Packaging: ${packaging.label}</span>
            <span class="mono muted">$${packaging.fee.toFixed(2)}</span>
          </div>
          <label class="checkbox-field" style="margin-top:8px;">
            <input type="checkbox" class="cutlery-checkbox" data-vendor-id="${vendorId}" checked />
            <span>Include cutlery</span>
          </label>
          ${specialRequest ? `
            <div class="breakdown-row">
              <span>Special request</span>
              <span class="muted" style="text-align:right; max-width:60%;">${specialRequest}</span>
            </div>
          ` : ""}
        </div>
      `;
      orderIndex++;
      return html;
    })
    .join("");

  const total = subtotal + packagingTotal;

  document.getElementById("breakdownSubtotal").textContent = `$${subtotal.toFixed(2)}`;
  document.getElementById("breakdownPackaging").textContent = `$${packagingTotal.toFixed(2)}`;
  document.getElementById("breakdownTotal").textContent = `$${total.toFixed(2)}`;
}

// Builds the vendor_options payload the backend expects:
// { [vendor_id]: { packaging_option_id, special_request, include_cutlery } }
function buildVendorOptions(vendorIds) {
  const vendorOptions = {};
  vendorIds.forEach((vendorId) => {
    const cutleryCheckbox = document.querySelector(`.cutlery-checkbox[data-vendor-id="${vendorId}"]`);
    vendorOptions[vendorId] = {
      packaging_option_id: getPackagingChoice(vendorId) || null,
      special_request: getSpecialRequest(vendorId),
      include_cutlery: cutleryCheckbox ? cutleryCheckbox.checked : true,
    };
  });
  return vendorOptions;
}

async function submitPayment() {
  const cart = getCart();
  const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked').value;
  const forceFail = document.getElementById("simulateFailure").checked;
  const guestEmail = document.getElementById("guestEmail").value.trim();
  const vendorIds = Object.keys(getCartVendorGroups());

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
        vendor_options: buildVendorOptions(vendorIds),
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
          <div class="breakdown-row">
            <span>Packaging: ${order.packaging_type === "eco" ? "🌱 " : ""}${order.packaging_description}</span>
            <span class="mono">$${Number(order.packaging_fee).toFixed(2)}</span>
          </div>
          <div class="breakdown-row">
            <span>Cutlery</span>
            <span class="muted">${order.include_cutlery ? "Included" : "Not included"}</span>
          </div>
          ${order.special_request ? `
            <div class="breakdown-row">
              <span>Special request</span>
              <span class="muted" style="text-align:right; max-width:60%;">${order.special_request}</span>
            </div>
          ` : ""}
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
