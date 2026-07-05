const apiBaseUrl = "http://localhost:3000";

let currentVendorId = null;
let currentMenu = [];
let modalItem = null;

function getVendorIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("vendor_id");
}

async function loadStallPicker() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/stalls`);
    const vendors = await response.json();

    const select = document.getElementById("stallSelect");
    select.innerHTML = vendors
      .map((v) => `<option value="${v.id}">${v.business_name} (${v.stall_number})</option>`)
      .join("");

    const urlVendorId = getVendorIdFromUrl();
    const defaultVendorId = urlVendorId || (vendors[0] && vendors[0].id);

    if (defaultVendorId) {
      select.value = defaultVendorId;
      loadStallMenu(defaultVendorId);
    }

    select.addEventListener("change", () => {
      loadStallMenu(select.value);
    });
  } catch (error) {
    console.error("Error loading stall list:", error);
  }
}

function getCategoryImage(category) {
  const normalized = (category || "").toLowerCase();
  if (normalized === "main") return "images/dish-main.svg";
  if (normalized === "side") return "images/dish-side.svg";
  if (normalized === "drink") return "images/dish-drink.svg";
  if (normalized === "dessert") return "images/dish-dessert.svg";
  return "images/dish-default.svg";
}

function renderMenu(menu) {
  const grid = document.getElementById("menuGrid");

  if (!menu || menu.length === 0) {
    grid.innerHTML = `<p class="dash-empty-state">This stall hasn't listed any menu items yet.</p>`;
    return;
  }

  grid.innerHTML = menu
    .map(
      (item) => `
        <div class="stall-item-card">
          <img src="${getCategoryImage(item.category)}" alt="" class="stall-item-img" />
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

// Vendor-specific banner photos. Add an entry here as real stall photos
// become available; any vendor not listed falls back to the generic
// illustrated banner.
const VENDOR_BANNER_IMAGES = {
  1: "images/ah-huat-chicken-rice-banner.jpg", // Ah Huat Chicken Rice
  2: "images/lucky-wanton-noodle-banner.jpg",  // Lucky Wanton Noodle
  3: "images/nasi-lemak-corner-banner.jpg",    // Nasi Lemak Corner
};

function updateStallBanner(vendorId) {
  const bannerImg = document.querySelector(".stall-banner-img");
  if (!bannerImg) return;
  bannerImg.src = VENDOR_BANNER_IMAGES[vendorId] || "images/stall-banner.svg";
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

      document.getElementById("stallEyebrow").textContent = `Stall ${data.vendor.stall_number}`;
      document.getElementById("stallName").textContent = data.vendor.business_name;
      updateStallBanner(vendorId);

      renderMenu(data.menu);
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

// --- Add-on modal ---
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
  if (event.target.classList.contains("modal-addon-checkbox") || event.target.id === "modalQuantity") {
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
    quantity,
    add_ons: selectedAddOns,
  });

  document.getElementById("addOnModal").style.display = "none";
  showToast(`Added ${quantity}x ${modalItem.name} to cart`);
});

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.style.display = "block";
  setTimeout(() => {
    toast.style.display = "none";
  }, 2500);
}

loadStallPicker();