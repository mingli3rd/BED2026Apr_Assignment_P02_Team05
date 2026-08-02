const apiBaseUrl = "http://localhost:3000";

const dashboardLoading = document.getElementById("dashboardLoading");
const dashboardError = document.getElementById("dashboardError");
const queueNotSetupPanel = document.getElementById("queueNotSetupPanel");
const queueManagedPanels = document.getElementById("queueManagedPanels");

const nowServingNumber = document.getElementById("nowServingNumber");
const queueStatusBadges = document.getElementById("queueStatusBadges");
const callNextBtn = document.getElementById("callNextBtn");
const togglePauseBtn = document.getElementById("togglePauseBtn");
const toggleOpenBtn = document.getElementById("toggleOpenBtn");
const queueActionMessage = document.getElementById("queueActionMessage");

let refreshTimer = null;
let currentStatus = null;

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins === 1) return "1 min ago";
  return `${mins} min ago`;
}

function renderBadges(status) {
  queueStatusBadges.innerHTML = `
    <span class="queue-badge ${status.is_open ? "queue-badge-open" : "queue-badge-closed"}">${status.is_open ? "Open" : "Closed"}</span>
    ${status.is_open ? `<span class="queue-badge ${status.is_paused ? "queue-badge-paused" : "queue-badge-open"}">${status.is_paused ? "Paused" : "Running"}</span>` : ""}
  `;
  togglePauseBtn.textContent = status.is_paused ? "Resume Queue" : "Pause Queue";
  toggleOpenBtn.textContent = status.is_open ? "Close Queue" : "Reopen Queue";
  callNextBtn.disabled = !status.is_open;
}

function renderQueueTable(entries) {
  const tbody = document.getElementById("queueTableBody");
  const emptyState = document.getElementById("queueEmptyState");
  const table = document.querySelector(".dash-table");

  if (!entries || entries.length === 0) {
    table.style.display = "none";
    emptyState.style.display = "block";
    return;
  }

  table.style.display = "table";
  emptyState.style.display = "none";

  tbody.innerHTML = entries
    .map(
      (entry) => `
        <tr>
          <td class="mono">#${entry.queue_number}</td>
          <td>${entry.patron_name || "Guest"}</td>
          <td><span class="status-badge ${entry.status === "called" ? "status-preparing" : "status-pending"}">${entry.status}</span></td>
          <td class="muted">${timeAgo(entry.joined_at)}</td>
        </tr>
      `
    )
    .join("");
}

async function loadQueue() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/vendor/queue`, {
      method: "GET",
      credentials: "include",
    });

    if (response.status === 401) {
      window.location.href = "vendor-login.html";
      return;
    }
    if (response.status !== 200) {
      throw new Error(`Unexpected status: ${response.status}`);
    }

    const data = await response.json();
    dashboardLoading.style.display = "none";

    document.getElementById("dashboardContent").style.display = "block";

    if (!data.set_up) {
      queueNotSetupPanel.style.display = "block";
      queueManagedPanels.style.display = "none";
      return;
    }

    queueNotSetupPanel.style.display = "none";
    queueManagedPanels.style.display = "block";

    currentStatus = data.status;
    nowServingNumber.textContent = data.status.now_serving || "—";
    renderBadges(data.status);
    renderQueueTable(data.entries);

  } catch (error) {
    console.error("Error loading queue:", error);
    dashboardLoading.style.display = "none";
    dashboardError.textContent = "Could not load your queue. Please try again.";
    dashboardError.style.display = "block";
  }
}

function startAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  loadQueue();
  refreshTimer = setInterval(loadQueue, 5000);
}

document.getElementById("enableQueueBtn").addEventListener("click", async () => {
  try {
    const response = await fetch(`${apiBaseUrl}/api/vendor/queue/enable`, {
      method: "POST",
      credentials: "include",
    });
    if (response.status === 201) {
      await loadQueue();
    } else {
      const errorBody = await response.json().catch(() => ({}));
      alert(errorBody.error || "Could not enable the digital queue.");
    }
  } catch (error) {
    console.error("Error enabling queue:", error);
    alert("Could not enable the digital queue. Please try again.");
  }
});

callNextBtn.addEventListener("click", async () => {
  callNextBtn.disabled = true;
  try {
    const response = await fetch(`${apiBaseUrl}/api/vendor/queue/call-next`, {
      method: "POST",
      credentials: "include",
    });
    const data = await response.json();
    queueActionMessage.textContent = data.message || "";
    await loadQueue();
  } catch (error) {
    console.error("Error calling next customer:", error);
    queueActionMessage.textContent = "Error advancing the queue.";
  } finally {
    callNextBtn.disabled = false;
  }
});

togglePauseBtn.addEventListener("click", async () => {
  try {
    const nextPaused = !currentStatus.is_paused;
    const response = await fetch(`${apiBaseUrl}/api/vendor/queue/pause`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ is_paused: nextPaused }),
    });
    const data = await response.json();
    queueActionMessage.textContent = data.message || "";
    await loadQueue();
  } catch (error) {
    console.error("Error toggling pause:", error);
    queueActionMessage.textContent = "Error updating the queue.";
  }
});

toggleOpenBtn.addEventListener("click", async () => {
  try {
    const nextOpen = !currentStatus.is_open;
    const response = await fetch(`${apiBaseUrl}/api/vendor/queue/open`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ is_open: nextOpen }),
    });
    const data = await response.json();
    queueActionMessage.textContent = data.message || "";
    await loadQueue();
  } catch (error) {
    console.error("Error toggling open state:", error);
    queueActionMessage.textContent = "Error updating the queue.";
  }
});

document.getElementById("logoutBtn")?.addEventListener("click", async () => {
  try {
    await fetch(`${apiBaseUrl}/api/auth/logout`, { method: "POST", credentials: "include" });
  } catch (error) {
    console.error("Error logging out:", error);
  } finally {
    window.location.href = "vendor-login.html";
  }
});

// --- Init ---
startAutoRefresh();
