const apiBaseUrl = "http://localhost:3000";

const profileLoading = document.getElementById("profileLoading");
const profileContent = document.getElementById("profileContent");
const profileError = document.getElementById("profileError");

const layoutModeSelect = document.getElementById("layoutMode");
const menuSearchInput = document.getElementById("menuSearchInput");
const categoryChips = document.getElementById("categoryChips");
const profileMenuGrid = document.getElementById("profileMenuGrid");
const profileMenuEmpty = document.getElementById("profileMenuEmpty");

const bannerImageInput = document.getElementById("bannerImageInput");
const chooseBannerBtn = document.getElementById("chooseBannerBtn");
const saveBannerBtn = document.getElementById("saveBannerBtn");
const bannerFileName = document.getElementById("bannerFileName");
const bannerMessage = document.getElementById("bannerMessage");

let vendor = null;
let menuItems = [];
let activeCategory = "All";
let layoutMode = "list";
let settingsSaveTimer = null;

async function saveProfileSettings() {
  if (!vendor) return;

  const payload = {
    layout_mode: layoutMode,
    recommended_item_ids: menuItems.filter((item) => item.isRecommended).map((item) => item.id),
    best_seller_item_ids: menuItems.filter((item) => item.isBestSeller).map((item) => item.id),
    item_order: menuItems.map((item) => item.id),
  };

  const response = await fetch(`${apiBaseUrl}/api/vendor/stall-profile/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload),
  });

  if (response.status !== 200) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || "Could not save stall profile settings");
  }
}

function queueSaveProfileSettings() {
  clearTimeout(settingsSaveTimer);
  settingsSaveTimer = setTimeout(async () => {
    try {
      await saveProfileSettings();
    } catch (error) {
      console.error("Error saving stall profile settings:", error);
    }
  }, 180);
}

function applyLayoutClass() {
  profileMenuGrid.classList.remove("stall-profile-grid", "stall-profile-spotlight");
  if (layoutMode === "grid") profileMenuGrid.classList.add("stall-profile-grid");
  if (layoutMode === "spotlight") profileMenuGrid.classList.add("stall-profile-spotlight");
}

function renderCategoryChips(items) {
  const categories = ["All", ...new Set(items.map((item) => item.category).filter(Boolean))];

  categoryChips.innerHTML = categories
    .map((category) => `
      <button type="button" class="category-chip ${category === activeCategory ? "is-active" : ""}" data-category="${category}">
        ${category}
      </button>
    `)
    .join("");

  categoryChips.querySelectorAll(".category-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      activeCategory = chip.dataset.category;
      renderCategoryChips(menuItems);
      renderMenu();
    });
  });
}

function itemImageSrc(item) {
  return item.image ? `/uploads/${item.image}` : "images/dish-default.svg";
}

function getFilteredItems() {
  const search = menuSearchInput.value.trim().toLowerCase();

  let filtered = [...menuItems];
  if (activeCategory !== "All") {
    filtered = filtered.filter((item) => item.category === activeCategory);
  }
  if (search) {
    filtered = filtered.filter((item) => item.name.toLowerCase().includes(search));
  }

  if (layoutMode === "spotlight") {
    filtered.sort((a, b) => {
      const aWeight = (a.isRecommended ? 2 : 0) + (a.isBestSeller ? 1 : 0);
      const bWeight = (b.isRecommended ? 2 : 0) + (b.isBestSeller ? 1 : 0);
      if (aWeight !== bWeight) return bWeight - aWeight;
      return 0;
    });
  }

  return filtered;
}

function statusTagHtml(item) {
  const tags = [];
  if (item.isRecommended) {
    tags.push('<span class="profile-item-tag profile-item-tag-recommended">Recommended</span>');
  }
  if (item.isBestSeller) {
    tags.push('<span class="profile-item-tag profile-item-tag-bestseller">Best Seller</span>');
  }
  return tags.join("");
}

function renderMenu() {
  applyLayoutClass();

  const filtered = getFilteredItems();

  if (filtered.length === 0) {
    profileMenuGrid.style.display = "none";
    profileMenuEmpty.style.display = "block";
    return;
  }

  profileMenuGrid.style.display = "";
  profileMenuEmpty.style.display = "none";

  profileMenuGrid.innerHTML = filtered
    .map((item) => `
      <div class="stall-item-card" data-item-id="${item.id}">
        <img src="${itemImageSrc(item)}" alt="" class="stall-item-img" />
        <div class="stall-item-info">
          <h3>${item.name}</h3>
          <span class="mono">$${Number(item.price).toFixed(2)}</span>
          ${item.category ? `<span class="muted">${item.category}</span>` : ""}
          <div class="profile-item-tags">${statusTagHtml(item)}</div>
          <div class="profile-item-actions">
            <button type="button" class="dash-link-btn" data-toggle-recommended="${item.id}">${item.isRecommended ? "Remove Recommended" : "Mark Recommended"}</button>
            <button type="button" class="dash-link-btn" data-toggle-bestseller="${item.id}">${item.isBestSeller ? "Remove Best Seller" : "Mark Best Seller"}</button>
            <button type="button" class="dash-link-btn" data-move-up="${item.id}">Move Up</button>
            <button type="button" class="dash-link-btn" data-move-down="${item.id}">Move Down</button>
          </div>
          <div class="profile-item-image-row">
            <input type="file" id="imageInput_${item.id}" accept="image/jpeg,image/png,image/webp" />
            <button type="button" class="btn btn-ghost" data-save-image="${item.id}">Change Image</button>
          </div>
        </div>
      </div>
    `)
    .join("");

  wireItemControls();
}

function reorderItem(itemId, direction) {
  const index = menuItems.findIndex((item) => item.id === itemId);
  if (index < 0) return;

  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= menuItems.length) return;

  const [moved] = menuItems.splice(index, 1);
  menuItems.splice(target, 0, moved);
  queueSaveProfileSettings();
  renderMenu();
}

async function updateItemImage(itemId) {
  const item = menuItems.find((entry) => entry.id === itemId);
  const input = document.getElementById(`imageInput_${itemId}`);

  if (!item || !input?.files?.[0]) {
    alert("Choose an image first.");
    return;
  }

  const file = input.files[0];

  try {
    const cuisineResponse = await fetch(`${apiBaseUrl}/api/vendor/menu/${itemId}/cuisines`, {
      method: "GET",
      credentials: "include",
    });

    if (cuisineResponse.status !== 200) {
      throw new Error("Unable to load item cuisines for update.");
    }

    const cuisineData = await cuisineResponse.json();
    const formData = new FormData();
    formData.append("name", item.name);
    formData.append("price", Number(item.price));
    formData.append("category", item.category || "");
    (cuisineData.cuisine_ids || []).forEach((id) => formData.append("cuisine_ids", id));
    formData.append("image", file);

    const response = await fetch(`${apiBaseUrl}/api/vendor/menu/${itemId}`, {
      method: "PUT",
      credentials: "include",
      body: formData,
    });

    if (response.status !== 200) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Could not update item image.");
    }

    await loadStallProfile();
  } catch (error) {
    console.error("Error updating item image:", error);
    alert(error.message || "Could not update this item image.");
  }
}

function wireItemControls() {
  profileMenuGrid.querySelectorAll("[data-toggle-recommended]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const itemId = Number(btn.dataset.toggleRecommended);
      const item = menuItems.find((entry) => entry.id === itemId);
      if (!item) return;
      item.isRecommended = !item.isRecommended;
      queueSaveProfileSettings();
      renderMenu();
    });
  });

  profileMenuGrid.querySelectorAll("[data-toggle-bestseller]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const itemId = Number(btn.dataset.toggleBestseller);
      const item = menuItems.find((entry) => entry.id === itemId);
      if (!item) return;
      item.isBestSeller = !item.isBestSeller;
      queueSaveProfileSettings();
      renderMenu();
    });
  });

  profileMenuGrid.querySelectorAll("[data-move-up]").forEach((btn) => {
    btn.addEventListener("click", () => reorderItem(Number(btn.dataset.moveUp), "up"));
  });

  profileMenuGrid.querySelectorAll("[data-move-down]").forEach((btn) => {
    btn.addEventListener("click", () => reorderItem(Number(btn.dataset.moveDown), "down"));
  });

  profileMenuGrid.querySelectorAll("[data-save-image]").forEach((btn) => {
    btn.addEventListener("click", () => updateItemImage(Number(btn.dataset.saveImage)));
  });
}

function renderProfileHeader() {
  document.getElementById("stallEyebrow").textContent = `Stall ${vendor.stall_number || "—"}`;
  document.getElementById("stallName").textContent = vendor.business_name;
  document.getElementById("stallRating").textContent =
    vendor.review_count > 0
      ? `★ ${Number(vendor.avg_rating).toFixed(1)} average (${vendor.review_count} review${vendor.review_count === 1 ? "" : "s"})`
      : "No reviews yet";

  document.getElementById("stallBannerImage").src = vendor.banner_image
    ? `/uploads/${vendor.banner_image}`
    : "images/stall-banner.svg";
}

function setBannerMessage(message, type = "") {
  bannerMessage.textContent = message;
  bannerMessage.className = `form-message ${type}`.trim();
}

async function loadStallProfile() {
  const response = await fetch(`${apiBaseUrl}/api/vendor/stall-profile`, {
    method: "GET",
    credentials: "include",
  });

  if (response.status === 401) {
    window.location.href = "vendor-login.html";
    return;
  }

  if (response.status !== 200) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error || "Could not load stall profile");
  }

  const data = await response.json();
  vendor = data.vendor;
  const settings = data.settings || {};
  layoutMode = settings.layout_mode || "list";
  layoutModeSelect.value = layoutMode;

  menuItems = data.menu.map((item) => ({
    ...item,
    isRecommended: Boolean(item.is_recommended),
    isBestSeller: Boolean(item.is_best_seller),
  }));

  renderProfileHeader();
  renderCategoryChips(menuItems);
  renderMenu();
}

layoutModeSelect.addEventListener("change", () => {
  layoutMode = layoutModeSelect.value;
  queueSaveProfileSettings();
  renderMenu();
});

menuSearchInput.addEventListener("input", renderMenu);

chooseBannerBtn.addEventListener("click", () => bannerImageInput.click());

bannerImageInput.addEventListener("change", () => {
  const file = bannerImageInput.files?.[0];
  bannerFileName.textContent = file ? file.name : "No file selected";
});

saveBannerBtn.addEventListener("click", async () => {
  const file = bannerImageInput.files?.[0];
  if (!file) {
    setBannerMessage("Choose a banner image first.", "is-warning");
    return;
  }

  saveBannerBtn.disabled = true;
  saveBannerBtn.textContent = "Saving...";
  setBannerMessage("", "");

  try {
    const formData = new FormData();
    formData.append("banner_image", file);

    const response = await fetch(`${apiBaseUrl}/api/vendor/stall-profile/banner`, {
      method: "PUT",
      credentials: "include",
      body: formData,
    });

    if (response.status !== 200) {
      const errorBody = await response.json().catch(() => ({}));
      throw new Error(errorBody.error || "Could not update banner");
    }

    setBannerMessage("Banner updated.", "is-success");
    bannerImageInput.value = "";
    bannerFileName.textContent = "No file selected";
    await loadStallProfile();
  } catch (error) {
    console.error("Error updating banner:", error);
    setBannerMessage(error.message || "Could not update banner.", "is-error");
  } finally {
    saveBannerBtn.disabled = false;
    saveBannerBtn.textContent = "Save Banner";
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

(async function init() {
  try {
    await loadStallProfile();
    profileLoading.style.display = "none";
    profileContent.style.display = "block";
  } catch (error) {
    console.error("Error loading stall profile page:", error);
    profileLoading.style.display = "none";
    profileError.textContent = error.message || "Could not load stall profile.";
    profileError.style.display = "block";
  }
})();