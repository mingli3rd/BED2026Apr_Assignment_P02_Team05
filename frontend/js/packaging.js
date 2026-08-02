const apiBaseUrl = "http://localhost:3000";

const dashboardLoading = document.getElementById("dashboardLoading");
const dashboardContent = document.getElementById("dashboardContent");
const dashboardError = document.getElementById("dashboardError");

const optionFormPanel = document.getElementById("optionFormPanel");
const optionForm = document.getElementById("optionForm");
const formTitle = document.getElementById("formTitle");
const formMessage = document.getElementById("formMessage");
const optionIdInput = document.getElementById("optionId");
const descriptionInput = document.getElementById("optionDescription");
const surchargeInput = document.getElementById("optionSurcharge");
const isEnabledInput = document.getElementById("optionIsEnabled");

// --- Render the packaging options table ---
function renderOptionsTable(options) {
  const tbody = document.getElementById("optionsTableBody");
  const emptyState = document.getElementById("optionsEmptyState");
  const table = document.querySelector(".dash-table");

  if (!options || options.length === 0) {
    table.style.display = "none";
    emptyState.style.display = "block";
    return;
  }

  table.style.display = "table";
  emptyState.style.display = "none";

  tbody.innerHTML = options
    .map(
      (option) => `
        <tr>
          <td>${option.description}</td>
          <td class="mono">+$${Number(option.surcharge).toFixed(2)}</td>
          <td>
            <span class="status-pill ${option.is_enabled ? "status-completed" : "status-expired"}" style="display:inline-block;">
              ${option.is_enabled ? "Offered" : "Disabled"}
            </span>
          </td>
          <td>
            <div class="menu-table-actions">
              <button class="dash-link-btn" data-edit-id="${option.id}">Edit</button>
              <button class="dash-link-btn dash-link-btn-danger" data-delete-id="${option.id}">Remove</button>
            </div>
          </td>
        </tr>
      `
    )
    .join("");

  document.querySelectorAll("[data-edit-id]").forEach((btn) => {
    btn.addEventListener("click", () => openEditForm(btn.dataset.editId, options));
  });
  document.querySelectorAll("[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", () => handleDelete(btn.dataset.deleteId));
  });
}

// --- Load packaging options from the server ---
async function loadOptions() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/vendor/packaging`, {
      method: "GET",
      credentials: "include",
    });

    if (response.status === 200) {
      const options = await response.json();
      renderOptionsTable(options);
      dashboardLoading.style.display = "none";
      dashboardContent.style.display = "block";

    } else if (response.status === 401) {
      window.location.href = "vendor-login.html";

    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }

  } catch (error) {
    console.error("Error loading packaging options:", error);
    dashboardLoading.style.display = "none";
    dashboardError.textContent = "Could not load your packaging options. Please try again.";
    dashboardError.style.display = "block";
  }
}

// --- Form open/close/reset helpers ---
function resetForm() {
  optionIdInput.value = "";
  optionForm.reset();
  isEnabledInput.checked = true;
  formMessage.textContent = "";
  formMessage.className = "form-message";
}

function openAddForm() {
  resetForm();
  formTitle.textContent = "Add Packaging Option";
  optionFormPanel.style.display = "block";
  optionFormPanel.scrollIntoView({ behavior: "smooth" });
}

function openEditForm(optionId, options) {
  resetForm();
  const option = options.find((o) => String(o.id) === String(optionId));
  if (!option) return;

  formTitle.textContent = "Edit Packaging Option";
  optionIdInput.value = option.id;
  descriptionInput.value = option.description;
  surchargeInput.value = Number(option.surcharge).toFixed(2);
  isEnabledInput.checked = Boolean(option.is_enabled);

  optionFormPanel.style.display = "block";
  optionFormPanel.scrollIntoView({ behavior: "smooth" });
}

function closeForm() {
  optionFormPanel.style.display = "none";
  resetForm();
}

// --- Create/Update submit handler ---
optionForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const optionId = optionIdInput.value;
  const isEditing = Boolean(optionId);

  const saveBtn = document.getElementById("saveOptionBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  try {
    const url = isEditing ? `${apiBaseUrl}/api/vendor/packaging/${optionId}` : `${apiBaseUrl}/api/vendor/packaging`;
    const method = isEditing ? "PUT" : "POST";

    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        description: descriptionInput.value.trim(),
        surcharge: parseFloat(surchargeInput.value) || 0,
        is_enabled: isEnabledInput.checked,
      }),
    });

    if (response.status === 200 || response.status === 201) {
      closeForm();
      await loadOptions();

    } else if (response.status === 400) {
      const errorBody = await response.json();
      formMessage.textContent = `Validation error: ${errorBody.error}`;
      formMessage.className = "form-message is-warning";

    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }

  } catch (error) {
    console.error("Error saving packaging option:", error);
    formMessage.textContent = "Something went wrong. Please try again.";
    formMessage.className = "form-message is-error";

  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Option";
  }
});

// --- Delete (disable) handler ---
async function handleDelete(optionId) {
  const confirmed = confirm("Remove this packaging option? Customers won't be able to select it anymore.");
  if (!confirmed) return;

  try {
    const response = await fetch(`${apiBaseUrl}/api/vendor/packaging/${optionId}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (response.status === 200) {
      await loadOptions();
    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }
  } catch (error) {
    console.error("Error removing packaging option:", error);
    alert("Could not remove this option. Please try again.");
  }
}

// --- Wire up buttons ---
document.getElementById("addOptionBtn").addEventListener("click", openAddForm);
document.getElementById("cancelFormBtn").addEventListener("click", closeForm);

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
loadOptions();
