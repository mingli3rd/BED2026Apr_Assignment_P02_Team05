const apiBaseUrl = "http://localhost:3000";

const dashboardLoading = document.getElementById("dashboardLoading");
const dashboardContent = document.getElementById("dashboardContent");
const dashboardError = document.getElementById("dashboardError");

const statusClassMap = {
  pending: "status-pending",
  preparing: "status-preparing",
  completed: "status-completed",
  cancelled: "status-expired",
};

const ORDER_STATUS_OPTIONS = ["pending", "preparing", "completed", "cancelled"];

function renderOrdersStats(orders) {
  const totalOrders = orders.length;
  const pendingOrders = orders.filter((order) => order.status === "pending").length;
  const completedOrders = orders.filter((order) => order.status === "completed").length;
  const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);

  document.getElementById("totalOrdersCount").textContent = totalOrders;
  document.getElementById("pendingOrdersCount").textContent = pendingOrders;
  document.getElementById("completedOrdersCount").textContent = completedOrders;
  document.getElementById("totalRevenue").textContent = `$${totalRevenue.toFixed(2)}`;
}

function renderOrdersTable(orders) {
  const tbody = document.getElementById("ordersTableBody");
  const emptyState = document.getElementById("ordersEmptyState");
  const table = document.querySelector(".vendor-orders-table");

  if (!orders || orders.length === 0) {
    table.style.display = "none";
    emptyState.style.display = "block";
    return;
  }

  table.style.display = "table";
  emptyState.style.display = "none";

  tbody.innerHTML = orders
    .map((order) => {
      const statusClass = statusClassMap[order.status] || "status-pending";
      const optionsHtml = ORDER_STATUS_OPTIONS.map(
        (status) => `<option value="${status}" ${status === order.status ? "selected" : ""}>${status}</option>`
      ).join("");

      return `
        <tr>
          <td class="mono">#${order.order_number}</td>
          <td>
            <div>${order.customer}</div>
            <div class="muted" style="font-size:12px;">${order.customer_email || ""}</div>
          </td>
          <td>${order.items}</td>
          <td>
            <select class="status-select ${statusClass}" data-order-id="${order.order_id}">
              ${optionsHtml}
            </select>
          </td>
          <td class="mono">$${Number(order.total_amount || 0).toFixed(2)}</td>
          <td>
            <div>${order.payment_status}</div>
            <div class="muted" style="font-size:12px;">${order.payment_method || ""}</div>
          </td>
          <td class="mono muted">${order.time}</td>
        </tr>
      `;
    })
    .join("");

  tbody.querySelectorAll(".status-select").forEach((select) => {
    select.addEventListener("change", () => handleStatusChange(select));
  });
}

async function handleStatusChange(selectEl) {
  const orderId = selectEl.dataset.orderId;
  const newStatus = selectEl.value;
  const previousClass = selectEl.className;

  selectEl.disabled = true;

  try {
    const response = await fetch(`${apiBaseUrl}/api/vendor/orders/${orderId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: newStatus }),
    });

    if (response.status === 200) {
      selectEl.className = `status-select ${statusClassMap[newStatus] || "status-pending"}`;
    } else if (response.status === 401) {
      window.location.href = "vendor-login.html";
    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }
  } catch (error) {
    console.error("Error updating order status:", error);
    alert("Could not update order status. Please try again.");
    selectEl.className = previousClass;
  } finally {
    selectEl.disabled = false;
  }
}

async function loadOrders() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/vendor/orders`, {
      method: "GET",
      credentials: "include",
    });

    if (response.status === 200) {
      const data = await response.json();
      renderOrdersStats(data.orders);
      renderOrdersTable(data.orders);
      dashboardLoading.style.display = "none";
      dashboardContent.style.display = "block";
    } else if (response.status === 401) {
      window.location.href = "vendor-login.html";
    } else if (response.status === 403) {
      dashboardLoading.style.display = "none";
      dashboardError.textContent = "This page is only accessible to vendor accounts.";
      dashboardError.style.display = "block";
    } else {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || `Unexpected status: ${response.status}`);
    }
  } catch (error) {
    console.error("Error loading vendor orders:", error);
    dashboardLoading.style.display = "none";
    dashboardError.textContent = "Could not load your orders. Please try again.";
    dashboardError.style.display = "block";
  }
}

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  try {
    await fetch(`${apiBaseUrl}/api/auth/logout`, { method: "POST", credentials: "include" });
  } catch (error) {
    console.error("Error logging out:", error);
  } finally {
    window.location.href = "vendor-login.html";
  }
});

loadOrders();