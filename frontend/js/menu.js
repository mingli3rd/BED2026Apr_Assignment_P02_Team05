const apiBaseUrl = "http://localhost:3000";

const dashboardLoading = document.getElementById("dashboardLoading");
const dashboardContent = document.getElementById("dashboardContent");
const dashboardError = document.getElementById("dashboardError");

const menuFormPanel = document.getElementById("menuFormPanel");
const menuItemForm = document.getElementById("menuItemForm");
const formTitle = document.getElementById("formTitle");
const formMessage = document.getElementById("formMessage");
const itemIdInput = document.getElementById("itemId");
const itemNameInput = document.getElementById("itemName");
const itemPriceInput = document.getElementById("itemPrice");
const itemCategoryInput = document.getElementById("itemCategory");
const cuisineCheckboxes = document.getElementById("cuisineCheckboxes");

let allCuisines = [];

// --- Load cuisines and render as checkboxes ---
async function loadCuisines() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/cuisines`, {
      method: "GET",
      credentials: "include",
    });

    if (response.status !== 200) return;

    allCuisines = await response.json();

    cuisineCheckboxes.innerHTML = allCuisines
      .map(
        (cuisine) => `
          <label class="checkbox-field">
            <input type="checkbox" class="cuisine-checkbox" value="${cuisine.id}" />
            <span>${cuisine.name}</span>
          </label>
        `
      )
      .join("");
  } catch (error) {
    console.error("Error loading cuisines:", error);
  }
}

function getSelectedCuisineIds() {
  return Array.from(document.querySelectorAll(".cuisine-checkbox:checked")).map((cb) => parseInt(cb.value));
}

function setCheckedCuisines(cuisineIds) {
  document.querySelectorAll(".cuisine-checkbox").forEach((cb) => {
    cb.checked = cuisineIds.includes(parseInt(cb.value));
  });
}

// --- Render the menu items table ---
function renderMenuTable(items) {
  const tbody = document.getElementById("menuTableBody");
  const emptyState = document.getElementById("menuEmptyState");
  const table = document.querySelector(".dash-table");

  if (!items || items.length === 0) {
    table.style.display = "none";
    emptyState.style.display = "block";
    return;
  }

  table.style.display = "table";
  emptyState.style.display = "none";

  tbody.innerHTML = items
    .map(
      (item) => `
        <tr>
          <td class="menu-table-item-cell">
            <img src="${item.image ? "/uploads/" + item.image : "images/dish-default.svg"}" alt="" class="menu-table-thumb" />
            ${item.name}
          </td>
          <td class="mono">$${Number(item.price).toFixed(2)}</td>
          <td class="muted">${item.category || "—"}</td>
          <td class="muted">${item.cuisines || "—"}</td>
          <td class="menu-table-actions">
            <button class="dash-link-btn" data-edit-id="${item.id}">Edit</button>
            <button class="dash-link-btn dash-link-btn-danger" data-delete-id="${item.id}">Delete</button>
          </td>
        </tr>
      `
    )
    .join("");

  // Wire up Edit/Delete buttons after rendering
  document.querySelectorAll("[data-edit-id]").forEach((btn) => {
    btn.addEventListener("click", () => openEditForm(btn.dataset.editId, items));
  });
  document.querySelectorAll("[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", () => handleDelete(btn.dataset.deleteId));
  });
}

// --- Load menu items from the server ---
async function loadMenuItems() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/vendor/menu`, {
      method: "GET",
      credentials: "include",
    });

    if (response.status === 200) {
      const items = await response.json();
      renderMenuTable(items);
      dashboardLoading.style.display = "none";
      dashboardContent.style.display = "block";

    } else if (response.status === 401) {
      window.location.href = "vendor-login.html";

    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }

  } catch (error) {
    console.error("Error loading menu items:", error);
    dashboardLoading.style.display = "none";
    dashboardError.textContent = "Could not load your menu. Please try again.";
    dashboardError.style.display = "block";
  }
}

// --- Form open/close/reset helpers ---
function resetForm() {
  itemIdInput.value = "";
  menuItemForm.reset();
  document.querySelectorAll(".cuisine-checkbox").forEach((cb) => (cb.checked = false));
  document.getElementById("itemImagePreview").style.display = "none";
  document.getElementById("itemImageHint").textContent = "Required for new items. JPEG, PNG, or WebP, max 5MB.";
  formMessage.textContent = "";
  formMessage.className = "form-message";
}

function openAddForm() {
  resetForm();
  formTitle.textContent = "Add Menu Item";
  menuFormPanel.style.display = "block";
  menuFormPanel.scrollIntoView({ behavior: "smooth" });
}

async function openEditForm(itemId, items) {
  resetForm();
  const item = items.find((i) => String(i.id) === String(itemId));
  if (!item) return;

  formTitle.textContent = "Edit Menu Item";
  itemIdInput.value = item.id;
  itemNameInput.value = item.name;
  itemPriceInput.value = item.price;
  itemCategoryInput.value = item.category || "";

  // Show the item's current photo, and make it clear a new upload is optional
  if (item.image) {
    const preview = document.getElementById("itemImagePreview");
    preview.src = `/uploads/${item.image}`;
    preview.style.display = "block";
  }
  document.getElementById("itemImageHint").textContent = "Leave blank to keep the current photo. JPEG, PNG, or WebP, max 5MB.";

  // Fetch this item's currently assigned cuisine IDs to check the right boxes
  try {
    const response = await fetch(`${apiBaseUrl}/api/vendor/menu/${item.id}/cuisines`, {
      method: "GET",
      credentials: "include",
    });
    if (response.status === 200) {
      const data = await response.json();
      setCheckedCuisines(data.cuisine_ids);
    }
  } catch (error) {
    console.error("Error loading item cuisines:", error);
  }

  menuFormPanel.style.display = "block";
  menuFormPanel.scrollIntoView({ behavior: "smooth" });
}

function closeForm() {
  menuFormPanel.style.display = "none";
  resetForm();
}

// --- Create/Update submit handler ---
menuItemForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const itemId = itemIdInput.value;
  const isEditing = Boolean(itemId);
  const imageFile = document.getElementById("itemImage").files[0];

  if (!isEditing && !imageFile) {
    formMessage.textContent = "Please upload a photo for this item.";
    formMessage.className = "form-message is-warning";
    return;
  }

  const saveBtn = document.getElementById("saveItemBtn");
  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  try {
    const url = isEditing ? `${apiBaseUrl}/api/vendor/menu/${itemId}` : `${apiBaseUrl}/api/vendor/menu`;
    const method = isEditing ? "PUT" : "POST";

    // FormData instead of JSON since we're sending a file — the browser
    // sets the correct multipart Content-Type header automatically
    const formData = new FormData();
    formData.append("name", itemNameInput.value.trim());
    formData.append("price", parseFloat(itemPriceInput.value));
    formData.append("category", itemCategoryInput.value);
    getSelectedCuisineIds().forEach((id) => formData.append("cuisine_ids", id));
    if (imageFile) {
      formData.append("image", imageFile);
    }

    const response = await fetch(url, {
      method,
      credentials: "include",
      body: formData,
    });

    if (response.status === 200 || response.status === 201) {
      closeForm();
      await loadMenuItems();

    } else if (response.status === 409) {
      const errorBody = await response.json();
      formMessage.textContent = errorBody.error;
      formMessage.className = "form-message is-warning";

    } else if (response.status === 400) {
      const errorBody = await response.json();
      formMessage.textContent = `Validation error: ${errorBody.error}`;
      formMessage.className = "form-message is-warning";

    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }

  } catch (error) {
    console.error("Error saving menu item:", error);
    formMessage.textContent = "Something went wrong. Please try again.";
    formMessage.className = "form-message is-error";

  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Item";
  }
});

// --- Delete handler ---
async function handleDelete(itemId) {
  const confirmed = confirm("Delete this menu item? This cannot be undone.");
  if (!confirmed) return;

  try {
    const response = await fetch(`${apiBaseUrl}/api/vendor/menu/${itemId}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (response.status === 200) {
      await loadMenuItems();
    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }
  } catch (error) {
    console.error("Error deleting menu item:", error);
    alert("Could not delete this item. Please try again.");
  }
}

// --- Wire up buttons ---
document.getElementById("itemImage").addEventListener("change", (event) => {
  const file = event.target.files[0];
  const preview = document.getElementById("itemImagePreview");
  if (file) {
    preview.src = URL.createObjectURL(file);
    preview.style.display = "block";
  }
});

document.getElementById("addItemBtn").addEventListener("click", openAddForm);
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
(async function init() {
  await loadCuisines();
  await loadMenuItems();
})();