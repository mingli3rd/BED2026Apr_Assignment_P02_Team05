// Mobile nav toggle for the directory board
const menuToggle = document.getElementById("menuToggle");
const boardNav = document.querySelector(".board-nav");

if (menuToggle && boardNav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = boardNav.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", isOpen);
  });
}

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

// Check whether the visitor is currently logged in as a vendor, and if so,
// swap the "Vendor Login" nav/footer links to point to the dashboard instead.
// Runs on every page that includes main.js, so it stays consistent site-wide
// without needing to duplicate this logic into each HTML file.
async function checkVendorSession() {
  try {
    const response = await fetch("http://localhost:3000/api/auth/me", {
      method: "GET",
      credentials: "include",
    });

    if (response.status !== 200) {
      return; // not logged in — leave nav as-is
    }

    // Find every link that currently points to vendor-login.html
    // (nav links and footer links both use this href) and repurpose them
    const loginLinks = document.querySelectorAll('a[href="vendor-login.html"]');

    loginLinks.forEach((link) => {
      link.href = "vendor-dashboard.html";

      // Preserve the numbered stall-no span if this is a nav link, only
      // replace the trailing text label
      const stallNo = link.querySelector(".stall-no");
      if (stallNo) {
        link.innerHTML = "";
        link.appendChild(stallNo);
        link.append("Dashboard");
      } else {
        link.textContent = "Dashboard";
      }
    });

    // A logged-in vendor has no reason to see sign-up links — hide them
    // from the nav and footer entirely, on every page.
    const signupLinks = document.querySelectorAll(
      'a[href="vendor-register.html"], a[href="patron-register.html"]'
    );
    signupLinks.forEach((link) => {
      link.style.display = "none";
    });

    // On the homepage specifically, the dual sign-up CTA band no longer
    // makes sense either — swap it for a "go to your dashboard" prompt.
    const ctaBand = document.getElementById("ctaBand");
    if (ctaBand) {
      ctaBand.innerHTML = `
        <div class="cta-band-inner" style="text-align: center;">
          <h2>Welcome back!</h2>
          <p>Head to your dashboard to manage orders, menu items, and check your stall's performance.</p>
          <a href="vendor-dashboard.html" class="btn btn-primary">Go to Dashboard</a>
        </div>
      `;
    }
  } catch (error) {
    // Fails silently — if the server's unreachable, just leave the nav
    // showing "Vendor Login" as the safe default
    console.error("Session check failed:", error);
  }
}

checkVendorSession();