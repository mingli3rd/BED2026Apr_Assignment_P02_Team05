const apiBaseUrl = "http://localhost:3000";

const dashboardLoading = document.getElementById("dashboardLoading");
const dashboardContent = document.getElementById("dashboardContent");
const dashboardError = document.getElementById("dashboardError");

// Chart colour tokens, matching the CSS custom properties in main.css
const CHART_COLORS = {
  mustard: "#E8A33D",
  stoolRed: "#D64933",
  chalk: "#F5F1E6",
  muted: "#8FA69D",
  tealMid: "#1F473D",
};

const ALLOWED_DAYS = [7, 30, 90];
let currentDays = 7;

// Keep a handle on the sales chart instance so we can destroy it before
// re-rendering — otherwise Chart.js stacks a new chart on the same canvas
// every time the filter changes.
let salesChartInstance = null;

function renderSalesChart(dailyTrend) {
  const canvas = document.getElementById("salesChart");
  const emptyState = document.getElementById("salesEmptyState");

  if (typeof Chart === "undefined") return; // charting library unavailable

  if (salesChartInstance) {
    salesChartInstance.destroy();
    salesChartInstance = null;
  }

  if (!dailyTrend || dailyTrend.length === 0) {
    canvas.style.display = "none";
    emptyState.style.display = "block";
    return;
  }

  canvas.style.display = "block";
  emptyState.style.display = "none";

  const labels = dailyTrend.map((day) =>
    new Date(day.order_date).toLocaleDateString("en-SG", { month: "short", day: "numeric" })
  );
  const revenues = dailyTrend.map((day) => day.daily_revenue);

  salesChartInstance = new Chart(canvas, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Revenue ($)",
          data: revenues,
          borderColor: CHART_COLORS.mustard,
          backgroundColor: "rgba(232, 163, 61, 0.15)",
          fill: true,
          tension: 0.3,
          pointBackgroundColor: CHART_COLORS.mustard,
          // With up to 90 points, dots get noisy — hide them past 7 days.
          pointRadius: revenues.length > 14 ? 0 : 3,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          ticks: {
            color: CHART_COLORS.muted,
            // Thin out x-axis labels for longer ranges so they don't overlap.
            maxTicksLimit: revenues.length > 14 ? 10 : undefined,
          },
          grid: { color: "rgba(245,241,230,0.08)" },
        },
        y: { 
          ticks: {
            color: CHART_COLORS.muted,
            callback: (value) => `$${value}`
          },           
          grid: { color: "rgba(245,241,230,0.08)" }, 
          beginAtZero: true 
        },
      },
    },
  });
}

function renderRatingChart(distribution) {
  const canvas = document.getElementById("ratingChart");

  if (typeof Chart === "undefined") return; // charting library unavailable

  const labels = distribution.map((d) => `${d.rating}★`);
  const counts = distribution.map((d) => d.count);

  new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Reviews",
          data: counts,
          backgroundColor: CHART_COLORS.stoolRed,
          borderRadius: 4,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: CHART_COLORS.muted }, grid: { display: false } },
        y: { ticks: { color: CHART_COLORS.muted, stepSize: 1 }, grid: { color: "rgba(245,241,230,0.08)" }, beginAtZero: true },
      },
    },
  });
}

function renderTopItems(items) {
  const list = document.getElementById("topItemsList");
  const emptyState = document.getElementById("topItemsEmptyState");

  if (!items || items.length === 0) {
    list.style.display = "none";
    emptyState.style.display = "block";
    return;
  }

  list.style.display = "block";
  emptyState.style.display = "none";

  list.innerHTML = items
    .map(
      (item) => `
        <li class="dash-list-item">
          <span>${item.name}</span>
          <span class="mono muted">${item.total_quantity} sold · $${Number(item.total_revenue).toFixed(2)}</span>
        </li>
      `
    )
    .join("");
}

function renderFeedbackList(comments) {
  const list = document.getElementById("feedbackList");
  const emptyState = document.getElementById("feedbackEmptyState");

  if (!comments || comments.length === 0) {
    list.style.display = "none";
    emptyState.style.display = "block";
    return;
  }

  list.style.display = "block";
  emptyState.style.display = "none";

  list.innerHTML = comments
    .map(
      (fb) => `
        <li class="dash-list-item dash-list-item-stacked">
          <span class="mono">${"★".repeat(fb.rating)}${"☆".repeat(5 - fb.rating)}</span>
          <span>${fb.comment}</span>
        </li>
      `
    )
    .join("");
}

function renderComplaintsList(complaints) {
  const list = document.getElementById("complaintsList");
  const emptyState = document.getElementById("complaintsEmptyState");

  if (!complaints || complaints.length === 0) {
    list.style.display = "none";
    emptyState.style.display = "block";
    return;
  }

  list.style.display = "block";
  emptyState.style.display = "none";

  list.innerHTML = complaints
    .map(
      (c) => `
        <li class="dash-list-item dash-list-item-stacked">
          <span class="status-badge ${c.status === "resolved" ? "status-completed" : "status-pending"}">${c.status}</span>
          <span>${c.description}</span>
        </li>
      `
    )
    .join("");
}

// Fetches the whole dashboard payload for a given days window.
// The API returns everything in one response, so changing the filter
// re-fetches all sections, but only the sales chart actually changes
// with `days` — the rest just re-renders with the same data.
async function fetchPerformanceData(days) {
  const response = await fetch(`${apiBaseUrl}/api/vendor/performance?days=${days}`, {
    method: "GET",
    credentials: "include",
  });
  return response;
}

async function loadPerformance(days = currentDays) {
  try {
    const response = await fetchPerformanceData(days);

    if (response.status === 200) {
      const data = await response.json();

      document.getElementById("totalRevenue").textContent = `$${Number(data.sales.total_revenue).toFixed(2)}`;
      document.getElementById("totalOrders").textContent = data.sales.total_orders;
      document.getElementById("avgRating").textContent = data.feedback.total_reviews
        ? `${Number(data.feedback.avg_rating).toFixed(1)} ★`
        : "–";
      document.getElementById("reviewCount").textContent = `Based on ${data.feedback.total_reviews} review${data.feedback.total_reviews === 1 ? "" : "s"}`;

      const openCount = data.complaints.by_status.find((s) => s.status === "open")?.count || 0;
      document.getElementById("openComplaints").textContent = openCount;

      renderSalesChart(data.sales.daily_trend);
      renderRatingChart(data.feedback.distribution);
      renderTopItems(data.top_items);
      renderFeedbackList(data.feedback.recent_comments);
      renderComplaintsList(data.complaints.recent_complaints);

      dashboardLoading.style.display = "none";
      dashboardContent.style.display = "block";

    } else if (response.status === 401) {
      window.location.href = "vendor-login.html";

    } else if (response.status === 403) {
      dashboardLoading.style.display = "none";
      dashboardError.textContent = "This page is only accessible to vendor accounts.";
      dashboardError.style.display = "block";

    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }

  } catch (error) {
    console.error("Error loading performance data:", error);
    dashboardLoading.style.display = "none";
    dashboardError.textContent = "Could not load performance data. Please try again.";
    dashboardError.style.display = "block";
  }
}

// Sales range filter buttons (7D / 30D / 90D)
function initSalesRangeFilter() {
  const group = document.getElementById("salesRangeFilter");
  if (!group) return;

  group.addEventListener("click", (event) => {
    const btn = event.target.closest(".dash-filter-btn");
    if (!btn) return;

    const days = parseInt(btn.dataset.days, 10);
    if (!ALLOWED_DAYS.includes(days) || days === currentDays) return;

    currentDays = days;

    group.querySelectorAll(".dash-filter-btn").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");

    loadPerformance(currentDays);
  });
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

// Chart.js is loaded from a CDN in the HTML. On some networks a given CDN
// can be blocked or fail to load, which would leave `Chart` undefined and
// break the charts. This helper checks whether Chart.js actually loaded,
// and if not, tries a series of alternative mirrors at runtime before
// rendering — so the dashboard works without anyone manually downloading
// a library file.
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

async function ensureChartJsLoaded() {
  if (typeof Chart !== "undefined") return; // already loaded from the HTML tag

  const mirrors = [
    "https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js",
    "https://unpkg.com/chart.js@4.4.4/dist/chart.umd.min.js",
    "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.4/chart.umd.min.js",
  ];

  for (const url of mirrors) {
    try {
      await loadScript(url);
      if (typeof Chart !== "undefined") return; // success
    } catch (error) {
      // try the next mirror
    }
  }
  throw new Error("Chart.js could not be loaded from any source.");
}

(async function init() {
  try {
    await ensureChartJsLoaded();
  } catch (error) {
    console.error(error);
    // Charts won't render, but let loadPerformance still populate the
    // stat cards and lists so the page isn't completely blank.
  }
  initSalesRangeFilter();
  loadPerformance();
})();