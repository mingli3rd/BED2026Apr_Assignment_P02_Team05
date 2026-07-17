const apiBaseUrl = "http://localhost:3000";
const neaApiBaseUrl = "http://localhost:4000";
redirectIfVendor();

function gradeClass(grade) {
  return { A: "grade-a", B: "grade-b", C: "grade-c", D: "grade-d" }[grade] || "";
}

// Fetches this specific stall's current hygiene grade from the NEA
// service. Degrades gracefully — if the NEA service is offline or the
// stall has no grade yet, the badge just stays hidden.
async function loadStallGrade(vendorId) {
  const badge = document.getElementById("stallGradeBadge");
  try {
    const response = await fetch(`${neaApiBaseUrl}/api/nea/public/hygiene-grades`);
    if (response.status !== 200) return;

    const grades = await response.json();
    const match = grades.find((g) => g.vendor_id === parseInt(vendorId));

    if (match && match.grade) {
      badge.textContent = match.grade;
      badge.className = `grade-badge ${gradeClass(match.grade)}`;
      badge.style.display = "inline-block";
    }
  } catch (error) {
    console.error("Error loading hygiene grade (NEA service may be offline):", error);
  }
}

let currentVendorId = null;
let currentMenu = [];
let modalItem = null;
let activeCategory = "All";

function getVendorIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("vendor_id");
}

// getCategoryImage() and getItemImage() are now defined in cart-store.js
// (shared across stall-menu.html, cart.html, and checkout.html)

// --- Category chips ---
function renderCategoryChips(menu) {
  const container = document.getElementById("categoryChips");
  const categories = ["All", ...new Set(menu.map((item) => item.category).filter(Boolean))];

  container.innerHTML = categories
    .map(
      (cat) => `
        <button type="button" class="category-chip ${cat === activeCategory ? "is-active" : ""}" data-category="${cat}">
          ${cat}
        </button>
      `
    )
    .join("");

  container.querySelectorAll(".category-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      activeCategory = chip.dataset.category;
      applyFilters();
      container.querySelectorAll(".category-chip").forEach((c) => c.classList.remove("is-active"));
      chip.classList.add("is-active");
    });
  });
}

// --- Search + category filtering (client-side, over the already-loaded menu) ---
function applyFilters() {
  const searchTerm = document.getElementById("menuSearchInput").value.trim().toLowerCase();

  let filtered = currentMenu;

  if (activeCategory !== "All") {
    filtered = filtered.filter((item) => item.category === activeCategory);
  }

  if (searchTerm) {
    filtered = filtered.filter((item) => item.name.toLowerCase().includes(searchTerm));
  }

  renderMenu(filtered);
}

document.getElementById("menuSearchInput").addEventListener("input", applyFilters);

function renderMenu(menu) {
  const grid = document.getElementById("menuGrid");
  const noResults = document.getElementById("menuNoResults");

  if (!menu || menu.length === 0) {
    grid.innerHTML = "";
    grid.style.display = "none";
    noResults.style.display = "block";
    return;
  }

  grid.style.display = "flex";
  noResults.style.display = "none";

  grid.innerHTML = menu
    .map(
      (item) => `
        <div class="stall-item-card">
          <img src="${getItemImage(item)}" alt="" class="stall-item-img" />
          <div class="stall-item-info">
            <h3>${item.name}</h3>
            <span class="mono">$${Number(item.price).toFixed(2)}</span>
            ${item.category ? `<span class="muted">${item.category}</span>` : ""}
          </div>
          <button class="btn btn-primary btn-small" data-item-id="${item.id}">+ Add</button>
        </div>
      `
    )
    .join("");

  grid.querySelectorAll("[data-item-id]").forEach((btn) => {
    btn.addEventListener("click", () => openAddOnModal(btn.dataset.itemId));
  });
}

// Vendor-specific banner photos. Prefers the vendor's own uploaded banner
// (vendor.banner_image from the database); if none was uploaded, falls back
// to this hardcoded map of stock photos we added manually for a few
// existing demo stalls, and finally to a generic illustrated banner.
const VENDOR_BANNER_IMAGES = {
  1: "images/ah-huat-chicken-rice-banner.jpg", // Ah Huat Chicken Rice
  2: "images/lucky-wanton-noodle-banner.jpg",  // Lucky Wanton Noodle
  3: "images/nasi-lemak-corner-banner.jpg",    // Nasi Lemak Corner
};

function updateStallBanner(vendorId, bannerImage) {
  const bannerImg = document.querySelector(".stall-banner-img");
  if (!bannerImg) return;

  if (bannerImage) {
    bannerImg.src = `/uploads/${bannerImage}`;
  } else {
    bannerImg.src = VENDOR_BANNER_IMAGES[vendorId] || "images/stall-banner.svg";
  }
}

async function loadStallMenu(vendorId) {
  currentVendorId = vendorId;
  document.getElementById("menuLoading").style.display = "block";
  document.getElementById("menuError").style.display = "none";
  document.getElementById("menuGrid").innerHTML = "";

  try {
    const response = await fetch(`${apiBaseUrl}/api/stalls/${vendorId}/menu`);

    if (response.status === 200) {
      const data = await response.json();
      currentMenu = data.menu;
      activeCategory = "All";

      document.getElementById("stallEyebrow").textContent = `Stall ${data.vendor.stall_number}`;
      document.getElementById("stallName").textContent = data.vendor.business_name;
      updateStallBanner(vendorId, data.vendor.banner_image);
      loadStallGrade(vendorId);

      renderCategoryChips(currentMenu);
      renderMenu(currentMenu);
      document.getElementById("menuLoading").style.display = "none";

    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }
  } catch (error) {
    console.error("Error loading stall menu:", error);
    document.getElementById("menuLoading").style.display = "none";
    document.getElementById("menuError").textContent = "Could not load this stall's menu.";
    document.getElementById("menuError").style.display = "block";
  }
}

// --- Add-on bottom sheet ---
function openAddOnModal(itemId) {
  modalItem = currentMenu.find((i) => String(i.id) === String(itemId));
  if (!modalItem) return;

  document.getElementById("modalItemName").textContent = modalItem.name;
  document.getElementById("modalItemPrice").textContent = `$${Number(modalItem.price).toFixed(2)} base price`;
  document.getElementById("modalQuantity").value = 1;

  const addOnsContainer = document.getElementById("modalAddOns");
  if (modalItem.add_ons && modalItem.add_ons.length > 0) {
    addOnsContainer.innerHTML = modalItem.add_ons
      .map(
        (addOn) => `
          <label class="checkbox-field modal-addon-row">
            <span>
              <input type="checkbox" class="modal-addon-checkbox" value="${addOn.id}" data-price="${addOn.extra_price}" data-name="${addOn.name}" />
              <span>${addOn.name}</span>
            </span>
            <span class="mono muted">${addOn.extra_price > 0 ? "+$" + Number(addOn.extra_price).toFixed(2) : "Free"}</span>
          </label>
        `
      )
      .join("");
  } else {
    addOnsContainer.innerHTML = `<p class="muted" style="font-size:13px;">No add-ons available for this item.</p>`;
  }

  updateModalTotal();
  document.getElementById("addOnModal").style.display = "flex";
}

function updateModalTotal() {
  if (!modalItem) return;
  const quantity = parseInt(document.getElementById("modalQuantity").value) || 1;
  const selectedAddOns = Array.from(document.querySelectorAll(".modal-addon-checkbox:checked"));
  const addOnsTotal = selectedAddOns.reduce((sum, cb) => sum + Number(cb.dataset.price), 0);
  const total = (Number(modalItem.price) + addOnsTotal) * quantity;
  document.getElementById("modalTotalPrice").textContent = `$${total.toFixed(2)}`;
}

document.addEventListener("change", (event) => {
  if (event.target.classList.contains("modal-addon-checkbox")) {
    updateModalTotal();
  }
});

// Quantity stepper buttons in the bottom sheet
document.getElementById("modalQtyMinus").addEventListener("click", () => {
  const input = document.getElementById("modalQuantity");
  const current = parseInt(input.value) || 1;
  if (current > 1) {
    input.value = current - 1;
    updateModalTotal();
  }
});

document.getElementById("modalQtyPlus").addEventListener("click", () => {
  const input = document.getElementById("modalQuantity");
  const current = parseInt(input.value) || 1;
  if (current < 50) {
    input.value = current + 1;
    updateModalTotal();
  }
});

document.getElementById("modalCancelBtn").addEventListener("click", () => {
  document.getElementById("addOnModal").style.display = "none";
});

document.getElementById("modalAddBtn").addEventListener("click", () => {
  const quantity = parseInt(document.getElementById("modalQuantity").value) || 1;
  const selectedAddOns = Array.from(document.querySelectorAll(".modal-addon-checkbox:checked")).map((cb) => ({
    id: parseInt(cb.value),
    name: cb.dataset.name,
    extra_price: Number(cb.dataset.price),
  }));

  const stallName = document.getElementById("stallName").textContent;

  addToCartStore({
    menu_item_id: modalItem.id,
    vendor_id: parseInt(currentVendorId),
    vendor_name: stallName,
    name: modalItem.name,
    price: modalItem.price,
    category: modalItem.category,
    image: modalItem.image,
    quantity,
    add_ons: selectedAddOns,
  });

  document.getElementById("addOnModal").style.display = "none";
  showToast(`Added ${quantity}x ${modalItem.name} to cart`);
  updateFloatingCartBar();
});

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.style.display = "flex";
  setTimeout(() => {
    toast.style.display = "none";
  }, 2500);
}

// --- Floating cart bar ---
function updateFloatingCartBar() {
  const bar = document.getElementById("floatingCartBar");
  const cart = getCart();

  if (cart.length === 0) {
    bar.style.display = "none";
    return;
  }

  const count = getCartItemCount();
  const total = cart.reduce((sum, item) => sum + getCartLineTotal(item), 0);

  document.getElementById("floatingCartCount").textContent = `${count} item${count === 1 ? "" : "s"}`;
  document.getElementById("floatingCartTotal").textContent = `$${total.toFixed(2)}`;
  bar.style.display = "flex";
}

// This page always arrives via a specific stall link from stalls.html
// (e.g. stall-menu.html?vendor_id=3) — if someone lands here without a
// vendor_id, send them to the directory to pick one instead.
const initialVendorId = getVendorIdFromUrl();
if (!initialVendorId) {
  window.location.href = "stalls.html";
} else {
  loadStallMenu(initialVendorId);
}

updateFloatingCartBar();