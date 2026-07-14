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

// Run on every page load
updateCartBadge();