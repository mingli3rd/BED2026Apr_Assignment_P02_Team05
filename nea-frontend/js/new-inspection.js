const apiBaseUrl = "http://localhost:4000";

async function checkSession() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/nea/auth/me`, { method: "GET", credentials: "include" });
    if (response.status !== 200) {
      window.location.href = "login.html";
      return null;
    }
    const data = await response.json();
    document.getElementById("officerName").textContent = data.officer.email;
    return data.officer;
  } catch (error) {
    console.error("checkSession() error:", error);
    window.location.href = "login.html";
    return null;
  }
}

async function loadVendors() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/nea/vendors`, { method: "GET", credentials: "include" });
    const vendors = await response.json();

    const select = document.getElementById("vendorSelect");
    select.innerHTML =
      `<option value="" disabled selected>Select a stall</option>` +
      vendors
        .map((v) => `<option value="${v.id}">${v.business_name} (${v.stall_number || "no stall #"}) — ${v.approval_status}</option>`)
        .join("");
  } catch (error) {
    console.error("loadVendors() error:", error);
  }
}

document.getElementById("inspectionForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const vendor_id = document.getElementById("vendorSelect").value;
  const scheduled_date = document.getElementById("scheduledDateInput").value;
  const messageDiv = document.getElementById("message");
  const submitBtn = document.getElementById("submitBtn");

  if (!vendor_id) {
    messageDiv.textContent = "Please select a stall.";
    messageDiv.className = "form-message is-warning";
    return;
  }
  if (!scheduled_date) {
    messageDiv.textContent = "Please choose a date.";
    messageDiv.className = "form-message is-warning";
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Scheduling...";

  try {
    const response = await fetch(`${apiBaseUrl}/api/nea/inspections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ vendor_id: parseInt(vendor_id), scheduled_date }),
    });

    if (response.status === 201) {
      const data = await response.json();
      messageDiv.textContent = data.message;
      messageDiv.className = "form-message is-success";
      document.getElementById("inspectionForm").reset();

    } else if (response.status === 400 || response.status === 409) {
      const errorBody = await response.json();
      messageDiv.textContent = errorBody.error;
      messageDiv.className = "form-message is-warning";

    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }

  } catch (error) {
    console.error("Error scheduling inspection:", error);
    messageDiv.textContent = "Something went wrong. Please try again.";
    messageDiv.className = "form-message is-error";

  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Schedule Inspection";
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  try {
    await fetch(`${apiBaseUrl}/api/nea/auth/logout`, { method: "POST", credentials: "include" });
  } catch (error) {
    console.error("Error logging out:", error);
  } finally {
    window.location.href = "login.html";
  }
});

(async function init() {
  const officer = await checkSession();
  if (officer) {
    loadVendors();
  }
})();