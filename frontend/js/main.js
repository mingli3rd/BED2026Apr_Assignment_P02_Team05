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
  "queue.html",
]);

function getCurrentPageName() {
  const path = window.location.pathname;
  return path.substring(path.lastIndexOf("/") + 1) || "index.html";
}

async function getCurrentSessionRole() {
  try {
    const response = await fetch(`${navApiBaseUrl}/api/auth/session`, {
      method: "GET",
      credentials: "include",
    });
    const data = await response.json();
    if (data.role === "vendor" || data.role === "patron") {
      return { role: data.role, user: data.user };
    }
  } catch (error) {
    console.error("Session check failed:", error);
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


const NAV_QUEUE_GUEST_STORAGE_KEY = "hawkerhub_queue_guest_id"; // must match stall-menu.js's key exactly — kept as a differently-named constant here since classic <script> files share one global scope, and stall-menu.js already declares its own QUEUE_GUEST_KEY with this same value
let queueNavPollTimer = null;

function getStoredQueueGuestId() {
  return localStorage.getItem(NAV_QUEUE_GUEST_STORAGE_KEY);
}

function renderQueueNavList(entries, patronId, guestId) {
  const listEl = document.getElementById("queueNavList");
  if (!listEl) return;

  if (entries.length === 0) {
    listEl.innerHTML = `<p style="padding:14px 12px; font-size:13px; color:var(--muted); margin:0;">You're not in any queues right now.</p>`;
    return;
  }

  listEl.innerHTML = entries
    .map((entry) => {
      const statusText = entry.status === "called" ? "It's your turn!" : `${entry.people_ahead} ahead of you`;
      return `
        <div class="queue-nav-entry" data-vendor-id="${entry.vendor_id}" style="padding:10px 12px; border-bottom:1px solid var(--line); cursor:pointer;">
          <div style="display:flex; justify-content:space-between; align-items:baseline; gap:8px;">
            <strong style="font-size:13.5px;">${entry.vendor_name}</strong>
            <span class="mono" style="font-size:12px; color:var(--mustard);">#${entry.queue_number}</span>
          </div>
          <div style="font-size:12px; color:var(--muted); margin-top:2px;">${statusText} · Now serving #${entry.now_serving ?? "--"}</div>
          <button type="button" class="dash-link-btn dash-link-btn-danger" data-leave-entry="${entry.id}" style="margin-top:6px; font-size:11.5px;">Leave Queue</button>
        </div>
      `;
    })
    .join("");

  // Clicking anywhere on a ticket (besides the Leave Queue button) jumps to
  // that stall's page. The button's own click handler below calls
  // stopPropagation, so leaving the queue never accidentally triggers this.
  listEl.querySelectorAll(".queue-nav-entry").forEach((entryEl) => {
    entryEl.addEventListener("click", () => {
      window.location.href = `stall-menu.html?vendor_id=${entryEl.dataset.vendorId}`;
    });
  });

  listEl.querySelectorAll("[data-leave-entry]").forEach((btn) => {
    btn.addEventListener("click", async (event) => {
      event.stopPropagation();
      const body = patronId ? { patron_id: patronId } : { guest_identifier: guestId };
      try {
        await fetch(`${navApiBaseUrl}/api/queue/${btn.dataset.leaveEntry}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        refreshQueueNavWidget(patronId, guestId);
      } catch (error) {
        console.error("Error leaving queue:", error);
      }
    });
  });
}

async function refreshQueueNavWidget(patronId, guestId) {
  if (!patronId && !guestId) return;
  const widget = document.getElementById("queueNavWidget");
  if (!widget) return;

  const params = patronId ? `patron_id=${patronId}` : `guest_identifier=${guestId}`;
  try {
    const response = await fetch(`${navApiBaseUrl}/api/queue/mine-all?${params}`);
    if (response.status !== 200) return;
    const entries = await response.json();

    const countEl = document.getElementById("queueNavCount");
    widget.style.display = entries.length === 0 ? "none" : "inline-flex";
    if (countEl) countEl.textContent = entries.length;

    renderQueueNavList(entries, patronId, guestId);
  } catch (error) {
    console.error("Error checking queue tickets:", error);
  }
}

// Injects the "My Queue" dropdown into the nav for guests and patrons.
// Hidden entirely until we know there's at least one active ticket to show.
function addQueueNavWidget(role, patronId) {
  if (!boardAuth || role === "vendor") return; // vendors don't queue at their own stall

  const guestId = role === "guest" ? getStoredQueueGuestId() : null;
  if (!patronId && !guestId) return; // never joined a queue on this browser/account — nothing to check yet

  if (document.getElementById("queueNavWidget")) return; // already injected

  const widget = document.createElement("div");
  widget.className = "auth-dropdown";
  widget.id = "queueNavWidget";
  widget.style.display = "none";
  widget.innerHTML = `
    <button type="button" class="auth-dropdown-toggle">
      🔔 My Queue
      <span id="queueNavCount" style="background:var(--stool-red); color:var(--chalk); font-family:var(--font-mono); font-size:10px; font-weight:700; border-radius:100px; padding:1px 6px;">0</span>
      <span class="chevron">▾</span>
    </button>
    <div class="auth-dropdown-menu" id="queueNavList" style="min-width:250px; max-height:320px; overflow-y:auto; padding:0;"></div>
  `;

  const cartIcon = document.getElementById("cartIconLink");
  if (cartIcon) {
    boardAuth.insertBefore(widget, cartIcon);
  } else {
    boardAuth.appendChild(widget);
  }

  // Reuses the exact same open/close pattern as the Sign Up / Log In
  // dropdowns above (including the document-wide "click outside closes it"
  // handler already registered at the top of this file).
  widget.querySelector(".auth-dropdown-toggle").addEventListener("click", (event) => {
    event.stopPropagation();
    const wasOpen = widget.classList.contains("is-open");
    document.querySelectorAll(".auth-dropdown.is-open").forEach((d) => d.classList.remove("is-open"));
    if (!wasOpen) widget.classList.add("is-open");
  });

  refreshQueueNavWidget(patronId, guestId);
  if (queueNavPollTimer) clearInterval(queueNavPollTimer);
  queueNavPollTimer = setInterval(() => refreshQueueNavWidget(patronId, guestId), 10000);
}

async function applySessionAwareNav() {
  const { role, user } = await getCurrentSessionRole();

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

  addQueueNavWidget(role, role === "patron" ? user?.id : null);
}

applySessionAwareNav();
