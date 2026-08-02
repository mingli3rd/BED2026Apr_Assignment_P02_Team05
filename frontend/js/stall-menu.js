const apiBaseUrl = "http://localhost:3000";
const neaApiBaseUrl = "http://localhost:4000";
redirectIfVendor();

// Checks whether this patron has already favourited the given vendor, and
// sets the heart button's initial visual state accordingly
async function setInitialLikeState(likeBtn, vendorId) {
  try {
    const response = await fetch(`${apiBaseUrl}/api/patron/favourites/ids`, {
      method: "GET",
      credentials: "include",
    });
    if (response.status !== 200) return;
    const data = await response.json();
    if (data.vendor_ids.includes(parseInt(vendorId))) {
      likeBtn.classList.add("is-liked");
    }
  } catch (error) {
    // Not logged in as a patron — button just stays unfilled
  }
}

async function toggleStallFavourite(likeBtn) {
  const vendorId = parseInt(likeBtn.dataset.vendorId);
  const isLiked = likeBtn.classList.contains("is-liked");

  try {
    if (isLiked) {
      const response = await fetch(`${apiBaseUrl}/api/patron/favourites/${vendorId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (response.status === 200) {
        likeBtn.classList.remove("is-liked");
      } else if (response.status === 401) {
        window.location.href = "patron-login.html";
      }
    } else {
      const response = await fetch(`${apiBaseUrl}/api/patron/favourites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ vendor_id: vendorId }),
      });
      if (response.status === 201) {
        likeBtn.classList.add("is-liked");
      } else if (response.status === 401) {
        window.location.href = "patron-login.html";
      }
    }
  } catch (error) {
    console.error("Error toggling favourite:", error);
  }
}

function gradeClass(grade) {
  return { A: "grade-a", B: "grade-b", C: "grade-c", D: "grade-d" }[grade] || "grade-none";
}

function formatGradeDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-SG", { day: "numeric", month: "short", year: "numeric" });
}

// Fetches this stall's current hygiene grade directly from the main
// backend's HygieneGrades/Inspections tables — the same data the NEA
// service reads, just queried here instead, so this doesn't depend on
// that separate service being up. Hides the whole widget if the stall
// has no grade recorded at all.
async function loadStallGrade(vendorId) {
  const wrap = document.getElementById("hygieneGradeWrap");
  const badge = document.getElementById("stallGradeBadge");
  try {
    const response = await fetch(`${apiBaseUrl}/api/stalls/${vendorId}/hygiene-grade`);
    if (response.status !== 200) return;

    const data = await response.json();
    if (!data.has_grade) return; // no grade on record yet — leave the widget hidden

    badge.textContent = data.grade;
    badge.className = `grade-badge ${gradeClass(data.grade)}`;
    wrap.style.display = "inline-block";

    loadHygieneHistory(vendorId);
  } catch (error) {
    console.error("Error loading hygiene grade:", error);
  }
}

// Fetches the full grade history for the dropdown. Loaded alongside the
// current grade (not lazily on click) since it's a lightweight query and
// this keeps the dropdown feeling instant when opened.
async function loadHygieneHistory(vendorId) {
  const listEl = document.getElementById("hygieneHistoryList");
  try {
    const response = await fetch(`${apiBaseUrl}/api/stalls/${vendorId}/hygiene-history`);
    if (response.status !== 200) {
      listEl.innerHTML = '<p class="muted hygiene-history-empty">Could not load grade history.</p>';
      return;
    }

    const history = await response.json();
    if (!history || history.length === 0) {
      listEl.innerHTML = '<p class="muted hygiene-history-empty">No past grades on record.</p>';
      return;
    }

    listEl.innerHTML = history
      .map(
        (entry) => `
          <div class="hygiene-history-item">
            <div class="hygiene-history-item-top">
              <span class="grade-badge ${gradeClass(entry.grade)}">${entry.grade}</span>
              <span class="hygiene-history-dates">${formatGradeDate(entry.valid_from)} – ${formatGradeDate(entry.valid_to)}</span>
            </div>
            <div class="hygiene-history-score">Inspection score: ${entry.score}/100</div>
            ${entry.remarks ? `<div class="hygiene-history-remarks">"${entry.remarks}"</div>` : ""}
          </div>
        `
      )
      .join("");
  } catch (error) {
    console.error("Error loading hygiene grade history:", error);
    listEl.innerHTML = '<p class="muted hygiene-history-empty">Could not load grade history.</p>';
  }
}

// Fetches this stall's currently-enabled eco packaging options and shows
// a badge if there's at least one. Uses apiBaseUrl (main backend) — same
// as hygiene grades now, both read directly from the main database.
async function loadStallEcoBadge(vendorId) {
  const badge = document.getElementById("stallEcoBadge");
  try {
    const response = await fetch(`${apiBaseUrl}/api/stalls/${vendorId}/packaging`);
    if (response.status !== 200) return;

    const options = await response.json();
    if (options.length > 0) {
      badge.style.display = "inline-flex";
      badge.title = options.map((o) => o.description).join(", ");
    }
  } catch (error) {
    console.error("Error loading eco packaging badge:", error);
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
      loadStallEcoBadge(vendorId);
      loadQueueSection(vendorId);

      const ratingEl = document.getElementById("stallRating");
      ratingEl.textContent = data.vendor.review_count > 0
        ? `★ ${Number(data.vendor.avg_rating).toFixed(1)} average (${data.vendor.review_count} review${data.vendor.review_count === 1 ? "" : "s"})`
        : "No reviews yet";

      const likeBtn = document.getElementById("stallLikeBtn");
      likeBtn.dataset.vendorId = vendorId;
      await setInitialLikeState(likeBtn, vendorId);
      likeBtn.onclick = () => toggleStallFavourite(likeBtn);

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


const reportIssueBtn = document.getElementById("reportIssueBtn");
const complaintModal = document.getElementById("complaintModal");
const complaintStallName = document.getElementById("complaintStallName");
const complaintDescription = document.getElementById("complaintDescription");
const complaintCharCount = document.getElementById("complaintCharCount");
const complaintFormMessage = document.getElementById("complaintFormMessage");
const complaintSubmitBtn = document.getElementById("complaintSubmitBtn");
const complaintCancelBtn = document.getElementById("complaintCancelBtn");

reportIssueBtn.addEventListener("click", () => {
  const stallName = document.getElementById("stallName").textContent;
  complaintStallName.textContent = `Against: ${stallName}`;
  complaintDescription.value = "";
  complaintCharCount.textContent = "0 / 500";
  complaintFormMessage.style.display = "none";
  complaintModal.style.display = "flex";
});

complaintCancelBtn.addEventListener("click", () => {
  complaintModal.style.display = "none";
});

complaintDescription.addEventListener("input", () => {
  complaintCharCount.textContent = `${complaintDescription.value.length} / 500`;
});

complaintSubmitBtn.addEventListener("click", async () => {
  const description = complaintDescription.value.trim();

  complaintFormMessage.style.display = "none";

  if (description.length < 10) {
    complaintFormMessage.textContent = "Please provide a bit more detail (at least 10 characters).";
    complaintFormMessage.style.display = "block";
    return;
  }

  complaintSubmitBtn.disabled = true;
  complaintSubmitBtn.textContent = "Submitting...";

  try {
    const response = await fetch(`${apiBaseUrl}/api/complaints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ vendor_id: parseInt(currentVendorId), description }),
    });

    const data = await response.json();

    if (response.status === 201) {
      complaintModal.style.display = "none";
      showToast("Your complaint has been submitted. The stall has been notified.");
    } else {
      complaintFormMessage.textContent = data.error || "Could not submit your complaint. Please try again.";
      complaintFormMessage.style.display = "block";
    }
  } catch (error) {
    console.error("Error submitting complaint:", error);
    complaintFormMessage.textContent = "Could not submit your complaint. Please check your connection and try again.";
    complaintFormMessage.style.display = "block";
  } finally {
    complaintSubmitBtn.disabled = false;
    complaintSubmitBtn.textContent = "Submit Complaint";
  }
});

const QUEUE_GUEST_KEY = "hawkerhub_queue_guest_id"; 

function getQueueGuestId() {
  let id = localStorage.getItem(QUEUE_GUEST_KEY);
  if (!id) {
    id = "guest-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(QUEUE_GUEST_KEY, id);
  }
  return id;
}

const queueJoinPanel = document.getElementById("queueJoinPanel");
const queueIntroText = document.getElementById("queueIntroText");
const queueStatusBadge = document.getElementById("queueStatusBadge");
const joinQueueBtn = document.getElementById("joinQueueBtn");
const joinQueueFlash = document.getElementById("joinQueueFlash");

joinQueueBtn.addEventListener("click", async () => {
  joinQueueBtn.disabled = true;
  try {
    const response = await fetch(`${apiBaseUrl}/api/queue/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include", // sends the patron cookie if logged in
      body: JSON.stringify({ vendor_id: parseInt(currentVendorId), guest_identifier: getQueueGuestId() }),
    });
    const data = await response.json();

    if (response.status === 201) {
      joinQueueFlash.textContent = `You're #${data.entry.queue_number}! Check "My Queue" in the top nav to track your spot.`;
      joinQueueFlash.style.display = "block";
      setTimeout(() => {
        joinQueueFlash.style.display = "none";
      }, 5000);
    } else {
      alert(data.error || "Could not join the queue. Please try again.");
    }
  } catch (error) {
    console.error("Error joining queue:", error);
    alert("Could not join the queue. Please check your connection and try again.");
  } finally {
    joinQueueBtn.disabled = false;
  }
});


async function loadQueueSection(vendorId, isRetry = false) {
  try {
    const response = await fetch(`${apiBaseUrl}/api/stalls/${vendorId}/queue-status`);
    if (!response.ok) {
      throw new Error(`Unexpected status: ${response.status}`);
    }
    const status = await response.json();

    if (!status.exists) {
      queueJoinPanel.style.display = "none";
      return;
    }

    queueJoinPanel.style.display = "block";
    queueStatusBadge.style.display = "inline-block";

    if (!status.is_open) {
      queueStatusBadge.className = "queue-badge queue-badge-closed";
      queueStatusBadge.textContent = "Closed";
      queueIntroText.textContent = "This stall's digital queue is currently closed.";
      joinQueueBtn.style.display = "none";
    } else if (status.is_paused) {
      // Paused means the vendor has temporarily stopped accepting new
      // queue entries entirely — same as closed, joining isn't allowed
      // until they resume.
      queueStatusBadge.className = "queue-badge queue-badge-paused";
      queueStatusBadge.textContent = "Paused";
      joinQueueBtn.style.display = "none";
      queueIntroText.textContent = "This stall's digital queue is currently paused and not accepting new joins right now. Please check back shortly.";
    } else {
      queueStatusBadge.className = "queue-badge queue-badge-open";
      queueStatusBadge.textContent = "Open";
      joinQueueBtn.style.display = "inline-flex";
      const waitingCount = status.waiting_count || 0;
      queueIntroText.textContent = waitingCount > 0
        ? `${waitingCount} customer${waitingCount === 1 ? "" : "s"} currently waiting. Join now and track your spot from "My Queue" at the top of the page.`
        : "No one's waiting right now — join and you'll likely be served straight away.";
    }
  } catch (error) {
    console.error("Error loading queue section:", error);
    if (!isRetry) {
      setTimeout(() => loadQueueSection(vendorId, true), 1500);
    } else {
      queueJoinPanel.style.display = "block";
      queueStatusBadge.style.display = "none";
      joinQueueBtn.style.display = "none";
      queueIntroText.textContent = "Could not check this stall's queue status right now. Please refresh the page to try again.";
    }
  }
}
