// =========================================================
// CART STORE — single source of truth for the cart UI.
//
// Cart lives in localStorage for everyone (guests and logged-in
// patrons alike), so the UI works instantly without waiting on
// network calls. If a patron is logged in, writes are also mirrored
// to the DB-backed cart (POST /api/cart) so that CRUD endpoint gets
// exercised — but the localStorage copy remains what the UI reads
// from directly.
//
// Cart item shape:
// { menu_item_id, vendor_id, vendor_name, name, price, category, image, quantity, add_ons: [{id, name, extra_price}] }
// =========================================================

const CART_STORAGE_KEY = "hawkerhub_cart";

// Vendors run a stall, they don't order from one — any ordering page that
// includes this check will redirect a logged-in vendor straight to their
// dashboard instead of letting them browse/order.
async function redirectIfVendor() {
  try {
    const response = await fetch("http://localhost:3000/api/auth/session", {
      method: "GET",
      credentials: "include",
    });
    const data = await response.json();
    if (data.role === "vendor") {
      window.location.href = "vendor-dashboard.html";
    }
  } catch (error) {
    // Not logged in as a vendor (or server unreachable) — let the page load normally
  }
}

// Category-based fallback icon, used whenever an item has no real uploaded
// photo. Shared here so both the stall menu page and the cart page render
// items consistently.
function getCategoryImage(category) {
  const normalized = (category || "").toLowerCase();
  if (normalized === "main") return "images/dish-main.svg";
  if (normalized === "side") return "images/dish-side.svg";
  if (normalized === "drink") return "images/dish-drink.svg";
  if (normalized === "dessert") return "images/dish-dessert.svg";
  return "images/dish-default.svg";
}

// Prefers a real uploaded photo (item.image, from the database) over the
// generic category icon
function getItemImage(item) {
  if (item.image) {
    return `/uploads/${item.image}`;
  }
  return getCategoryImage(item.category);
}

function getCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error("Error reading cart from storage:", error);
    return [];
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  updateCartBadge();
}

// Adds an item to the cart. If an identical item (same menu item + same
// exact set of add-ons) already exists, its quantity is increased instead
// of creating a duplicate line.
function addToCartStore(newItem) {
  const cart = getCart();

  const addOnIds = (newItem.add_ons || []).map((a) => a.id).sort().join(",");
  const existingIndex = cart.findIndex((item) => {
    const itemAddOnIds = (item.add_ons || []).map((a) => a.id).sort().join(",");
    return item.menu_item_id === newItem.menu_item_id && itemAddOnIds === addOnIds;
  });

  if (existingIndex >= 0) {
    cart[existingIndex].quantity += newItem.quantity;
  } else {
    cart.push(newItem);
  }

  saveCart(cart);

  // Mirror to the DB cart if logged in as a patron (fire-and-forget —
  // the localStorage copy is authoritative for the UI regardless of
  // whether this succeeds)
  fetch("http://localhost:3000/api/cart", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      menu_item_id: newItem.menu_item_id,
      vendor_id: newItem.vendor_id,
      quantity: newItem.quantity,
      add_on_ids: (newItem.add_ons || []).map((a) => a.id),
    }),
  }).catch(() => {
    // Not logged in, or server unreachable — fine, localStorage still has it
  });
}

function updateCartItemQuantity(index, quantity) {
  const cart = getCart();
  if (cart[index]) {
    cart[index].quantity = quantity;
    saveCart(cart);
  }
}

function removeCartItemAt(index) {
  const cart = getCart();
  cart.splice(index, 1);
  saveCart(cart);
}

function clearCartStore() {
  saveCart([]);
  // Packaging choices and special requests are keyed by vendor_id, not
  // tied to specific cart line items, so they don't get cleaned up by
  // removing items one by one — clear them out here instead, once the
  // whole cart (and therefore every order) is done.
  localStorage.removeItem(PACKAGING_CHOICE_KEY);
  localStorage.removeItem(SPECIAL_REQUEST_KEY);
}

function getCartItemCount() {
  return getCart().reduce((sum, item) => sum + item.quantity, 0);
}

function getCartLineTotal(item) {
  const addOnsTotal = (item.add_ons || []).reduce((sum, a) => sum + Number(a.extra_price), 0);
  return (Number(item.price) + addOnsTotal) * item.quantity;
}

function getCartVendorGroups() {
  const cart = getCart();
  const groups = {};
  cart.forEach((item, index) => {
    if (!groups[item.vendor_id]) {
      groups[item.vendor_id] = { vendor_name: item.vendor_name, items: [] };
    }
    groups[item.vendor_id].items.push({ ...item, cartIndex: index });
  });
  return groups;
}

// Updates the cart badge icon (item count) wherever it appears on the page
function updateCartBadge() {
  const badge = document.getElementById("cartBadge");
  if (!badge) return;
  const count = getCartItemCount();
  if (count > 0) {
    badge.textContent = count;
    badge.style.display = "inline-flex";
  } else {
    badge.style.display = "none";
  }
}

// =========================================================
// PER-VENDOR PACKAGING CHOICE + SPECIAL REQUEST
//
// Both are order-level (one per vendor group), not per cart line item, so
// they're stored separately from the cart array itself, keyed by vendor_id.
// Set on the cart page, read on the checkout page, sent to the backend as
// `vendor_options` at payment time (see checkout.js).
// =========================================================

const PACKAGING_CHOICE_KEY = "hawkerhub_packaging_choices"; // { [vendor_id]: packaging_option_id | null }
const SPECIAL_REQUEST_KEY = "hawkerhub_special_requests"; // { [vendor_id]: "free text" }

function readJsonStore(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : {};
  } catch (error) {
    console.error(`Error reading ${key} from storage:`, error);
    return {};
  }
}

function writeJsonStore(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// packagingOptionId should be a number (the chosen option's id) or null
// for "standard packaging, no eco option selected"
function setPackagingChoice(vendorId, packagingOptionId) {
  const choices = readJsonStore(PACKAGING_CHOICE_KEY);
  choices[vendorId] = packagingOptionId;
  writeJsonStore(PACKAGING_CHOICE_KEY, choices);
}

function getPackagingChoice(vendorId) {
  const choices = readJsonStore(PACKAGING_CHOICE_KEY);
  return choices[vendorId] ?? null;
}

function setSpecialRequest(vendorId, text) {
  const requests = readJsonStore(SPECIAL_REQUEST_KEY);
  requests[vendorId] = text;
  writeJsonStore(SPECIAL_REQUEST_KEY, requests);
}

function getSpecialRequest(vendorId) {
  const requests = readJsonStore(SPECIAL_REQUEST_KEY);
  return requests[vendorId] || "";
}

// Run on every page load
updateCartBadge();
