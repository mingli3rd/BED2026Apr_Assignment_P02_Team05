const apiBaseUrl = "http://localhost:3000";

const dashboardLoading = document.getElementById("dashboardLoading");
const dashboardContent = document.getElementById("dashboardContent");
const dashboardError = document.getElementById("dashboardError");
const agreementUploadForm = document.getElementById("agreementUploadForm");
const agreementDocumentInput = document.getElementById("agreementDocumentInput");
const chooseAgreementDocumentBtn = document.getElementById("chooseAgreementDocumentBtn");
const agreementDocumentName = document.getElementById("agreementDocumentName");
const agreementUploadMessage = document.getElementById("agreementUploadMessage");
const uploadAgreementBtn = document.getElementById("uploadAgreementBtn");

const statusLabels = {
  active: "Active",
  expiring_soon: "Expiring Soon",
  expired: "Expired",
};

const statusClasses = {
  active: "status-completed",
  expiring_soon: "status-pending",
  expired: "status-expired",
};

function renderNotifications(notifications) {
  const container = document.getElementById("notificationBanners");
  const sidebarDot = document.getElementById("sidebarNotifDot");

  if (!notifications || notifications.length === 0) {
    container.innerHTML = "";
    sidebarDot.style.display = "none";
    return;
  }

  sidebarDot.style.display = "inline-block";

  container.innerHTML = notifications
    .map(
      (note) => `
        <div class="notif-banner notif-banner-${note.type}">
          <span class="notif-banner-icon">${note.type === "danger" ? "⚠" : "⏰"}</span>
          <span>${note.message}</span>
        </div>
      `
    )
    .join("");
}

function renderAgreements(agreements) {
  const list = document.getElementById("agreementsList");
  const emptyState = document.getElementById("agreementsEmptyState");

  if (!agreements || agreements.length === 0) {
    list.style.display = "none";
    emptyState.style.display = "block";
    return;
  }

  list.style.display = "flex";
  emptyState.style.display = "none";

  list.innerHTML = agreements
    .map((a) => {
      const startDate = new Date(a.start_date).toLocaleDateString("en-SG", { year: "numeric", month: "short", day: "numeric" });
      const endDate = new Date(a.end_date).toLocaleDateString("en-SG", { year: "numeric", month: "short", day: "numeric" });
      const statusClass = statusClasses[a.renewal_status] || "status-pending";
      const statusLabel = statusLabels[a.renewal_status] || a.renewal_status;
      const documentLink = a.document_path
        ? `<a class="agreement-document-link" href="/uploads/${a.document_path}" target="_blank" rel="noreferrer">View uploaded document</a>`
        : "";

      const expiryNote =
        a.renewal_status === "active"
          ? `${a.days_until_expiry} days remaining`
          : a.renewal_status === "expiring_soon"
          ? `Only ${a.days_until_expiry} days left`
          : `Expired ${Math.abs(a.days_until_expiry)} days ago`;

      return `
        <div class="agreement-card">
          <div class="agreement-card-header">
            <span class="status-badge ${statusClass}">${statusLabel}</span>
            <span class="mono muted">$${Number(a.monthly_rent).toFixed(2)} / month</span>
          </div>
          <div class="agreement-card-dates">
            <span>${startDate}</span>
            <span class="agreement-arrow">→</span>
            <span>${endDate}</span>
          </div>
          <p class="agreement-card-expiry">${expiryNote}</p>
          ${a.notes ? `<p class="agreement-card-notes">${a.notes}</p>` : ""}
          ${documentLink}
        </div>
      `;
    })
    .join("");
}

function setUploadMessage(message, type = "") {
  agreementUploadMessage.textContent = message;
  agreementUploadMessage.className = `form-message ${type}`.trim();
}

chooseAgreementDocumentBtn?.addEventListener("click", () => {
  agreementDocumentInput?.click();
});

agreementDocumentInput?.addEventListener("change", () => {
  const file = agreementDocumentInput.files?.[0];
  agreementDocumentName.textContent = file ? file.name : "No file selected";
});

agreementUploadForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const file = agreementDocumentInput.files?.[0];
  if (!file) {
    setUploadMessage("Please choose a document before uploading.", "is-warning");
    return;
  }

  uploadAgreementBtn.disabled = true;
  uploadAgreementBtn.textContent = "Uploading...";
  setUploadMessage("", "");

  try {
    const formData = new FormData();
    formData.append("agreement_document", file);

    const response = await fetch(`${apiBaseUrl}/api/vendor/rental-agreements/latest/document`, {
      method: "PUT",
      credentials: "include",
      body: formData,
    });

    if (response.status === 200) {
      agreementDocumentInput.value = "";
      agreementDocumentName.textContent = "No file selected";
      setUploadMessage("Rental agreement updated successfully.", "is-success");
      await loadRentalAgreements();
      return;
    }

    if (response.status === 401 || response.status === 403) {
      window.location.href = "vendor-login.html";
      return;
    }

    const errorBody = await response.json().catch(() => ({}));
    setUploadMessage(errorBody.error || "Could not upload the document.", "is-warning");
  } catch (error) {
    console.error("Error uploading rental agreement document:", error);
    setUploadMessage("Could not upload the document right now. Please try again.", "is-error");
  } finally {
    uploadAgreementBtn.disabled = false;
    uploadAgreementBtn.textContent = "Upload to Latest Agreement";
  }
});

async function loadRentalAgreements() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/vendor/rental-agreements`, {
      method: "GET",
      credentials: "include",
    });

    if (response.status === 200) {
      const data = await response.json();
      renderNotifications(data.notifications);
      renderAgreements(data.agreements);

      dashboardLoading.style.display = "none";
      dashboardContent.style.display = "block";

    } else if (response.status === 401 || response.status === 403) {
      window.location.href = "vendor-login.html";

    } else {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || `Unexpected status: ${response.status}`);
    }

  } catch (error) {
    console.error("Error loading rental agreements:", error);
    dashboardLoading.style.display = "none";
    dashboardError.textContent = error.message || "Could not load rental agreements. Please try again.";
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

loadRentalAgreements();
