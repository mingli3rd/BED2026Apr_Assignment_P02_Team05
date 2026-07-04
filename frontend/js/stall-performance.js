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

function renderSalesChart(dailyTrend) {
  const canvas = document.getElementById("salesChart");
  const emptyState = document.getElementById("salesEmptyState");

  if (!dailyTrend || dailyTrend.length === 0) {
    canvas.style.display = "none";
    emptyState.style.display = "block";
    return;
  }

  canvas.style.display = "block";
  emptyState.style.display = "none";

  const labels = dailyTrend.map((day) =>
    new Date(day.order_date).toLocaleDateString("en-SG", { weekday: "short", day: "numeric" })
  );
  const revenues = dailyTrend.map((day) => day.daily_revenue);

  new Chart(canvas, {
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
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: CHART_COLORS.muted }, grid: { color: "rgba(245,241,230,0.08)" } },
        y: { ticks: { color: CHART_COLORS.muted }, grid: { color: "rgba(245,241,230,0.08)" }, beginAtZero: true },
      },
    },
  });
}

function renderRatingChart(distribution) {
  const canvas = document.getElementById("ratingChart");

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

async function loadPerformance() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/vendor/performance`, {
      method: "GET",
      credentials: "include",
    });

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

loadPerformance();