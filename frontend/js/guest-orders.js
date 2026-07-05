const apiBaseUrl = "http://localhost:3000";
const GUEST_ORDERS_SESSION_KEY = "hawkerhub_guest_order_ids";

const statusClassMap = {
  pending: "status-pending",
  preparing: "status-preparing",
  completed: "status-completed",
  cancelled: "status-expired",
};

async function loadGuestOrders() {
  const listContainer = document.getElementById("guestOrdersList");
  const emptyState = document.getElementById("guestOrdersEmptyState");

  let orderIds = [];
  try {
    const raw = sessionStorage.getItem(GUEST_ORDERS_SESSION_KEY);
    orderIds = raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error("Error reading guest order IDs:", error);
  }

  if (orderIds.length === 0) {
    emptyState.style.display = "block";
    return;
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/guest/orders?order_ids=${orderIds.join(",")}`);

    if (response.status !== 200) {
      throw new Error(`Unexpected status: ${response.status}`);
    }

    const orders = await response.json();

    if (orders.length === 0) {
      emptyState.style.display = "block";
      return;
    }

    listContainer.innerHTML = orders
      .map((order) => {
        const statusClass = statusClassMap[order.order_status] || "status-pending";
        const date = new Date(order.created_at).toLocaleString("en-SG", {
          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
        });

        return `
          <div class="dash-panel">
            <div class="dash-panel-header">
              <h2>Order #${order.order_id}: ${order.vendor_name}</h2>
              <span class="status-badge ${statusClass}">${order.order_status}</span>
            </div>
            <p class="muted" style="font-size:13.5px; margin: 0 0 8px;">${order.items || "—"}</p>
            <div class="breakdown-row">
              <span>Placed ${date}</span>
              <span class="mono">$${Number(order.total_amount).toFixed(2)}</span>
            </div>
          </div>
        `;
      })
      .join("");

  } catch (error) {
    console.error("Error loading guest orders:", error);
    listContainer.innerHTML = `<p class="form-message is-warning">Could not load your orders. Please try again.</p>`;
  }
}

loadGuestOrders();