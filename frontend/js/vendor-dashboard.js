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

// Complaints reuse the same visual status language as orders (same CSS
// classes), just mapped onto their own 3-stage workflow instead of 4.
const complaintStatusClassMap = {
  open: "status-pending",
  investigating: "status-preparing",
  resolved: "status-completed",
};

const COMPLAINT_STATUS_OPTIONS = ["open", "investigating", "resolved"];

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
          <td class="mono">${order.id}</td>
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

function renderComplaintsTable(complaints) {
  const tbody = document.getElementById("complaintsTableBody");
  const emptyState = document.getElementById("complaintsEmptyState");
  const table = document.getElementById("complaintsTable");

  if (!complaints || complaints.length === 0) {
    table.style.display = "none";
    emptyState.style.display = "block";
    return;
  }

  table.style.display = "table";
  emptyState.style.display = "none";

  tbody.innerHTML = complaints
    .map((complaint) => {
      const statusClass = complaintStatusClassMap[complaint.status] || "status-pending";
      const optionsHtml = COMPLAINT_STATUS_OPTIONS.map(
        (s) => `<option value="${s}" ${s === complaint.status ? "selected" : ""}>${s}</option>`
      ).join("");

      return `
        <tr>
          <td>${complaint.description}</td>
          <td>${complaint.patron_name || "Guest"}</td>
          <td>
            <select class="status-select ${statusClass}" data-complaint-id="${complaint.id}">
              ${optionsHtml}
            </select>
          </td>
          <td class="mono muted">${notifTimeAgo(complaint.created_at)}</td>
        </tr>
      `;
    })
    .join("");

  // Wire up status dropdowns — same interaction pattern as the orders table
  tbody.querySelectorAll(".status-select").forEach((select) => {
    select.addEventListener("change", () => handleComplaintStatusChange(select));
  });
}

async function handleComplaintStatusChange(selectEl) {
  const complaintId = selectEl.dataset.complaintId;
  const newStatus = selectEl.value;
  const previousClass = selectEl.className;

  selectEl.disabled = true;

  try {
    const response = await fetch(`${apiBaseUrl}/api/vendor/complaints/${complaintId}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: newStatus }),
    });

    if (response.status === 200) {
      const newClass = complaintStatusClassMap[newStatus] || "status-pending";
      selectEl.className = `status-select ${newClass}`;
    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }
  } catch (error) {
    console.error("Error updating complaint status:", error);
    alert("Could not update complaint status. Please try again.");
    selectEl.className = previousClass; // revert visual state on failure
  } finally {
    selectEl.disabled = false;
  }
}

async function loadComplaints() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/vendor/complaints`, {
      method: "GET",
      credentials: "include",
    });
    if (response.status === 200) {
      const complaints = await response.json();
      renderComplaintsTable(complaints);
    } else if (response.status !== 401) {
      // 401 just means not logged in yet — loadDashboard() already handles
      // redirecting in that case, so there's no need to duplicate that here
      throw new Error(`Unexpected status: ${response.status}`);
    }
  } catch (error) {
    console.error("Error loading complaints:", error);
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
loadComplaints();

// =========================================================
// NOTIFICATION BELL (Complaint Notifications, and reusable
// for any future notification type e.g. new orders)
// =========================================================

const NOTIF_POLL_INTERVAL_MS = 15000; // check for new notifications every 15s

const notifBellBtn = document.getElementById("notifBellBtn");
const notifBellPanel = document.getElementById("notifBellPanel");
const notifBellCount = document.getElementById("notifBellCount");
const notifBellList = document.getElementById("notifBellList");
const notifMarkAllBtn = document.getElementById("notifMarkAllBtn");

let notifPanelOpen = false;

function notifTimeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.round(hours / 24)} day(s) ago`;
}

async function refreshUnreadCount() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/vendor/notifications/unread-count`, {
      method: "GET",
      credentials: "include",
    });
    if (response.status !== 200) return;
    const data = await response.json();
    if (data.unread_count > 0) {
      notifBellCount.textContent = data.unread_count > 99 ? "99+" : data.unread_count;
      notifBellCount.style.display = "inline-block";
    } else {
      notifBellCount.style.display = "none";
    }
  } catch (error) {
    console.error("Error checking notification count:", error);
  }
}

function renderNotifList(notifications) {
  if (!notifications || notifications.length === 0) {
    notifBellList.innerHTML = '<p class="notif-bell-empty">No notifications yet.</p>';
    return;
  }

  notifBellList.innerHTML = notifications
    .map(
      (n) => `
        <button class="notif-item ${n.is_read ? "" : "is-unread"}" data-notif-id="${n.id}">
          <span class="notif-item-type">${n.type.replace("_", " ")}</span>
          <p class="notif-item-message">${n.message}</p>
          <span class="notif-item-time">${notifTimeAgo(n.created_at)}</span>
        </button>
      `
    )
    .join("");

  notifBellList.querySelectorAll(".notif-item").forEach((item) => {
    item.addEventListener("click", () => handleNotifClick(item));
  });
}

async function loadNotifications() {
  notifBellList.innerHTML = '<p class="notif-bell-empty">Loading...</p>';
  try {
    const response = await fetch(`${apiBaseUrl}/api/vendor/notifications`, {
      method: "GET",
      credentials: "include",
    });
    if (response.status === 200) {
      const notifications = await response.json();
      renderNotifList(notifications);
    } else {
      notifBellList.innerHTML = '<p class="notif-bell-empty">Could not load notifications.</p>';
    }
  } catch (error) {
    console.error("Error loading notifications:", error);
    notifBellList.innerHTML = '<p class="notif-bell-empty">Could not load notifications.</p>';
  }
}

async function handleNotifClick(itemEl) {
  const notifId = itemEl.dataset.notifId;
  const notifType = itemEl.querySelector(".notif-item-type")?.textContent.trim();

  if (notifType === "complaint") {
    // A complaint notification may point to a complaint that arrived after
    // this page loaded — refresh the table so it's there to update.
    loadComplaints();
  }

  if (!itemEl.classList.contains("is-unread")) return; // already read, nothing to do

  itemEl.classList.remove("is-unread");
  try {
    await fetch(`${apiBaseUrl}/api/vendor/notifications/${notifId}/read`, {
      method: "PUT",
      credentials: "include",
    });
    refreshUnreadCount();
  } catch (error) {
    console.error("Error marking notification as read:", error);
  }
}

notifMarkAllBtn.addEventListener("click", async (event) => {
  event.stopPropagation();
  try {
    await fetch(`${apiBaseUrl}/api/vendor/notifications/read-all`, {
      method: "PUT",
      credentials: "include",
    });
    notifBellList.querySelectorAll(".notif-item").forEach((item) => item.classList.remove("is-unread"));
    refreshUnreadCount();
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
  }
});

notifBellBtn.addEventListener("click", (event) => {
  event.stopPropagation();
  notifPanelOpen = !notifPanelOpen;
  notifBellPanel.style.display = notifPanelOpen ? "block" : "none";
  notifBellBtn.setAttribute("aria-expanded", String(notifPanelOpen));
  if (notifPanelOpen) {
    loadNotifications();
  }
});

// Close the panel when clicking anywhere else on the page
document.addEventListener("click", (event) => {
  if (notifPanelOpen && !document.getElementById("notifBellWrap").contains(event.target)) {
    notifPanelOpen = false;
    notifBellPanel.style.display = "none";
    notifBellBtn.setAttribute("aria-expanded", "false");
  }
});

refreshUnreadCount();
setInterval(refreshUnreadCount, NOTIF_POLL_INTERVAL_MS);
