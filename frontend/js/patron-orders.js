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
      const statusClass = statusClassMap[order.order_status] || "status-pending";
      const date = new Date(order.created_at).toLocaleDateString("en-SG", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      return `
        <tr>
          <td class="mono">ORD-${order.order_id}</td>
          <td>${order.vendor_name}</td>
          <td class="muted">${order.items || "—"}</td>
          <td class="mono">$${Number(order.total_amount).toFixed(2)}</td>
          <td><span class="status-badge ${statusClass}">${order.order_status}</span></td>
          <td class="mono muted">${date}</td>
        </tr>
      `;
    })
    .join("");
}

async function loadOrders() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/patron/orders`, {
      method: "GET",
      credentials: "include",
    });

    if (response.status === 200) {
      const data = await response.json();

      document.getElementById("welcomeMessage").textContent = data.welcome_message;
      renderOrdersTable(data.orders);

      dashboardLoading.style.display = "none";
      dashboardContent.style.display = "block";

    } else if (response.status === 401) {
      window.location.href = "patron-login.html";

    } else if (response.status === 403) {
      dashboardLoading.style.display = "none";
      dashboardError.textContent = "This page is only accessible to patron accounts.";
      dashboardError.style.display = "block";

    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }

  } catch (error) {
    console.error("Error loading orders:", error);
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
    window.location.href = "patron-login.html";
  }
});

loadOrders();