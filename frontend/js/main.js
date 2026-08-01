// Mobile nav toggle for the directory board
const menuToggle = document.getElementById("menuToggle");
const boardNav = document.querySelector(".board-nav");
const boardAuth = document.getElementById("boardAuth");

if (menuToggle && boardNav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = boardNav.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", isOpen);
    if (boardAuth) {
      boardAuth.classList.toggle("is-mobile-open", isOpen);
    }
  });
}

// Sign Up / Log In dropdown toggles
document.querySelectorAll(".auth-dropdown-toggle").forEach((toggle) => {
  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    const dropdown = toggle.closest(".auth-dropdown");
    const wasOpen = dropdown.classList.contains("is-open");

    // Close any other open dropdown first
    document.querySelectorAll(".auth-dropdown.is-open").forEach((d) => d.classList.remove("is-open"));

    if (!wasOpen) {
      dropdown.classList.add("is-open");
    }
  });
});

// Click anywhere outside a dropdown to close it
document.addEventListener("click", () => {
  document.querySelectorAll(".auth-dropdown.is-open").forEach((d) => d.classList.remove("is-open"));
});

// Signature element: queue ticket number ticks up periodically
// to suggest live order activity across the platform.
const ticketNumber = document.getElementById("ticketNumber");

if (ticketNumber && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  let current = 27;
  setInterval(() => {
    current += 1;
    ticketNumber.textContent = "A" + String(current).padStart(3, "0");
  }, 4000);
}

// =========================================================
// SITE-WIDE SESSION-AWARE NAVIGATION
//
// A browser session is authenticated as exactly ONE role at a time
// (single JWT cookie) — you can never be "logged in as both a vendor
// and a patron" simultaneously. So the account area of the nav should
// reflect exactly one of three states: guest, vendor, or patron.
// =========================================================

const navApiBaseUrl = "http://localhost:3000";

// Pages a logged-in vendor is allowed to see. Any other page redirects them
// straight back to the dashboard — a vendor session should never be able to
// browse the customer-facing site without logging out first.
const VENDOR_ALLOWED_PAGES = new Set([
  "vendor-dashboard.html",
  "vendor-orders.html",
  "stall-profile.html",
  "stall-performance.html",
  "rental-agreements.html",
  "packaging.html",
  "menu.html",
  "hygiene-history.html",
]);

function getCurrentPageName() {
  const path = window.location.pathname;
  return path.substring(path.lastIndexOf("/") + 1) || "index.html";
}

async function getCurrentSessionRole() {
  try {
    const vendorRes = await fetch(`${navApiBaseUrl}/api/auth/me`, {
      method: "GET",
      credentials: "include",
    });
    if (vendorRes.status === 200) {
      const data = await vendorRes.json();
      return { role: "vendor", user: data.vendor };
    }
  } catch (error) {
    console.error("Vendor session check failed:", error);
  }

  try {
    const patronRes = await fetch(`${navApiBaseUrl}/api/auth/me/patron`, {
      method: "GET",
      credentials: "include",
    });
    if (patronRes.status === 200) {
      const data = await patronRes.json();
      return { role: "patron", user: data.patron };
    }
  } catch (error) {
    console.error("Patron session check failed:", error);
  }

  return { role: "guest", user: null };
}

async function handleNavLogout() {
  try {
    await fetch(`${navApiBaseUrl}/api/auth/logout`, { method: "POST", credentials: "include" });
  } catch (error) {
    console.error("Error logging out:", error);
  } finally {
    window.location.href = "index.html";
  }
}

// Replaces the entire Sign Up / Log In dropdown area with a single
// account pill + logout button, for whichever role is currently logged in.
function renderLoggedInAuthArea(dashboardHref, dashboardLabel) {
  if (!boardAuth) return;

  // Preserve the cart icon (if present on this page) rather than wiping it
  // out along with the Sign Up / Log In dropdowns
  const cartIcon = document.getElementById("cartIconLink");
  const cartIconHtml = cartIcon ? cartIcon.outerHTML : "";

  boardAuth.innerHTML = `
    <a href="${dashboardHref}" class="btn-nav-account">${dashboardLabel}</a>
    <button type="button" class="btn-nav-logout" id="navLogoutBtn">Log Out</button>
    ${cartIconHtml}
  `;

  document.getElementById("navLogoutBtn").addEventListener("click", handleNavLogout);

  if (typeof updateCartBadge === "function") {
    updateCartBadge();
  }
}

function updateCtaBandForVendor() {
  const ctaBand = document.getElementById("ctaBand");
  if (!ctaBand) return;
  ctaBand.innerHTML = `
    <div class="cta-band-inner" style="text-align: center;">
      <h2>Welcome back!</h2>
      <p>Head to your dashboard to manage orders, menu items, and check your stall's performance.</p>
      <a href="vendor-dashboard.html" class="btn btn-primary">Go to Dashboard</a>
    </div>
  `;
}

function updateCtaBandForPatron() {
  const ctaBand = document.getElementById("ctaBand");
  if (!ctaBand) return;
  ctaBand.innerHTML = `
    <div class="cta-band-inner" style="text-align: center;">
      <h2>Welcome back!</h2>
      <p>Check your order history, favourite stalls, and loyalty points.</p>
      <a href="patron-orders.html" class="btn btn-primary">Go to My Orders</a>
    </div>
  `;
}

// If this guest has any orders tracked in sessionStorage (placed earlier
// in this same tab), show a "Track Orders" link in the nav so they can get
// back to guest-orders.html from anywhere on the site — not just the
// checkout success screen.
function addGuestTrackOrdersLink() {
  if (!boardAuth || document.getElementById("guestTrackOrdersLink")) return;

  let orderIds = [];
  try {
    const raw = sessionStorage.getItem("hawkerhub_guest_order_ids");
    orderIds = raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error("Error reading guest order IDs:", error);
  }

  if (orderIds.length === 0) return;

  const trackLink = document.createElement("a");
  trackLink.href = "guest-orders.html";
  trackLink.id = "guestTrackOrdersLink";
  trackLink.className = "auth-dropdown-toggle";
  trackLink.textContent = `Track Orders (${orderIds.length})`;

  // Insert it before the cart icon if present, otherwise just append
  const cartIcon = document.getElementById("cartIconLink");
  if (cartIcon) {
    boardAuth.insertBefore(trackLink, cartIcon);
  } else {
    boardAuth.appendChild(trackLink);
  }
}

async function applySessionAwareNav() {
  const { role } = await getCurrentSessionRole();

  if (role === "vendor") {
    if (!VENDOR_ALLOWED_PAGES.has(getCurrentPageName())) {
      window.location.replace("vendor-dashboard.html");
      return;
    }

    renderLoggedInAuthArea("vendor-dashboard.html", "Dashboard");
    updateCtaBandForVendor();

    // Vendors run a stall, they don't order from one — hide the "Order"
    // nav link and cart icon entirely rather than showing UI they
    // shouldn't (and can't meaningfully) use
    document.querySelectorAll('a[href="stalls.html"]').forEach((link) => {
      // Only hide the nav/footer "Order" links, not links that happen to
      // point elsewhere but share this href by coincidence
      if (link.closest(".board-nav") || link.closest(".footer-links")) {
        link.style.display = "none";
      }
    });
    const cartIcon = document.getElementById("cartIconLink");
    if (cartIcon) cartIcon.style.display = "none";

    // Same reasoning as above — the featured stalls section is an ordering
    // prompt ("Real stalls, ready to order"), which doesn't apply to vendors
    const featuredStallsSection = document.getElementById("featuredStallsSection");
    if (featuredStallsSection) featuredStallsSection.style.display = "none";

  } else if (role === "patron") {
    renderLoggedInAuthArea("profile.html", "My Profile");
    updateCtaBandForPatron();

    // Already have an account — the hero's "Create an account" prompt
    // doesn't apply to a logged-in patron
    const heroCreateAccountLink = document.getElementById("heroCreateAccountLink");
    if (heroCreateAccountLink) heroCreateAccountLink.style.display = "none";
  } else {
    // role === "guest": leave the Sign Up / Log In dropdowns as they are,
    // but still surface a way back to their order tracking if they have any
    addGuestTrackOrdersLink();
  }
}

applySessionAwareNav();