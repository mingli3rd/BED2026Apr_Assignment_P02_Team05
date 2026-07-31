const apiBaseUrl = "http://localhost:3000";

const dashboardLoading = document.getElementById("dashboardLoading");
const dashboardContent = document.getElementById("dashboardContent");
const dashboardError = document.getElementById("dashboardError");

// Maps order status values to a CSS class for colour-coded badges
const statusClassMap = {
  pending: "status-pending",
  preparing: "status-preparing",
  completed: "status-completed",
  cancelled: "status-expired",
};

const ORDER_STATUS_OPTIONS = ["pending", "preparing", "completed", "cancelled"];

function renderOrdersTable(orders) {
  const tbody = document.getElementById("ordersTableBody");
  const emptyState = document.getElementById("ordersEmptyState");
  const table = document.querySelector(".dash-table");

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
        (s) => `<option value="${s}" ${s === order.status ? "selected" : ""}>${s}</option>`
      ).join("");

      return `
        <tr>
          <td class="mono">#${order.order_number || order.order_id}</td>
          <td>${order.item}</td>
          <td>${order.customer}</td>
          <td>
            <select class="status-select ${statusClass}" data-order-id="${order.order_id}">
              ${optionsHtml}
            </select>
          </td>
          <td class="mono muted">${order.time}</td>
        </tr>
      `;
    })
    .join("");

  // Wire up status dropdowns
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
      // Update the dropdown's colour to match the new status
      const newClass = statusClassMap[newStatus] || "status-pending";
      selectEl.className = `status-select ${newClass}`;
    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }
  } catch (error) {
    console.error("Error updating order status:", error);
    alert("Could not update order status. Please try again.");
    selectEl.className = previousClass; // revert visual state on failure
  } finally {
    selectEl.disabled = false;
  }
}

async function loadDashboard() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/vendor/dashboard`, {
      method: "GET",
      credentials: "include", // sends the HTTP-only cookie automatically
    });

    if (response.status === 200) {
      const data = await response.json();

      document.getElementById("welcomeMessage").textContent = data.summary.message;
      document.getElementById("pendingOrders").textContent = data.summary.pending_orders;
      document.getElementById("menuItems").textContent = data.summary.menu_items;
      document.getElementById("avgRating").textContent = data.summary.avg_rating
        ? `${data.summary.avg_rating} ★`
        : "–";
      document.getElementById("todayRevenue").textContent = `$${Number(data.summary.today_revenue || 0).toFixed(2)}`;

      const approvalBadge = document.getElementById("approvalBadge");
      approvalBadge.textContent = (data.vendor.approval_status || "unknown").toUpperCase();

      renderOrdersTable(data.recent_orders);

      dashboardLoading.style.display = "none";
      dashboardContent.style.display = "block";

    } else if (response.status === 401) {
      // Not logged in, or session expired — send back to login
      window.location.href = "vendor-login.html";

    } else if (response.status === 403) {
      dashboardLoading.style.display = "none";
      dashboardError.textContent = "This dashboard is only accessible to vendor accounts.";
      dashboardError.style.display = "block";

    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }

  } catch (error) {
    console.error("Error loading dashboard:", error);
    dashboardLoading.style.display = "none";
    dashboardError.textContent = "Could not load dashboard. Please try logging in again.";
    dashboardError.style.display = "block";
  }
}

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  try {
    await fetch(`${apiBaseUrl}/api/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch (error) {
    console.error("Error logging out:", error);
  } finally {
    window.location.href = "vendor-login.html";
  }
});

loadDashboard();