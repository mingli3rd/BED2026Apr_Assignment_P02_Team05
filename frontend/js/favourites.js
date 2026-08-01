const apiBaseUrl = "http://localhost:3000";

async function checkSession() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/auth/me/patron`, { method: "GET", credentials: "include" });
    if (response.status !== 200) {
      window.location.href = "patron-login.html";
      return null;
    }
    return true;
  } catch (error) {
    window.location.href = "patron-login.html";
    return null;
  }
}

function gradeClass(grade) {
  return { A: "grade-a", B: "grade-b", C: "grade-c", D: "grade-d" }[grade] || "";
}

async function loadFavourites() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/patron/favourites`, { method: "GET", credentials: "include" });
    const favourites = await response.json();

    const grid = document.getElementById("favouritesGrid");
    const emptyState = document.getElementById("emptyState");

    if (favourites.length === 0) {
      grid.innerHTML = "";
      emptyState.style.display = "block";
    } else {
      emptyState.style.display = "none";
      grid.innerHTML = favourites
        .map((stall) => {
          const ratingText = stall.review_count > 0
            ? `★ ${Number(stall.avg_rating).toFixed(1)} (${stall.review_count})`
            : "No reviews yet";

          const imageSrc = stall.banner_image
            ? "/uploads/" + stall.banner_image
            : stall.hawker_centre_cover_image
            ? "images/hawker-centres/" + stall.hawker_centre_cover_image
            : "images/stall-banner.svg";

          return `
            <div class="directory-card-wrapper">
              <a href="stall-menu.html?vendor_id=${stall.id}" class="directory-card">
                <img src="${imageSrc}" alt="" class="directory-card-img" />
                <span class="stall-card-no">Stall ${stall.stall_number || "—"}</span>
                <h3>${stall.business_name}</h3>
                <p class="mono muted" style="font-size:12.5px; margin: 4px 0 0;">${ratingText}</p>
                <span class="directory-card-link">View Menu →</span>
              </a>
              <button type="button" class="like-btn is-liked" data-vendor-id="${stall.id}" aria-label="Remove from favourites">♥</button>
            </div>
          `;
        })
        .join("");

      document.querySelectorAll(".like-btn").forEach((btn) => {
        btn.addEventListener("click", async (event) => {
          event.preventDefault();
          const vendorId = btn.dataset.vendorId;
          await fetch(`${apiBaseUrl}/api/patron/favourites/${vendorId}`, {
            method: "DELETE",
            credentials: "include",
          });
          loadFavourites(); // reload so the removed stall disappears from the grid
        });
      });
    }

    document.getElementById("dashboardLoading").style.display = "none";
    document.getElementById("dashboardContent").style.display = "block";

  } catch (error) {
    console.error("Error loading favourites:", error);
    document.getElementById("dashboardLoading").style.display = "none";
    document.getElementById("dashboardError").textContent = "Could not load your favourites.";
    document.getElementById("dashboardError").style.display = "block";
  }
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
  try {
    await fetch(`${apiBaseUrl}/api/auth/logout`, { method: "POST", credentials: "include" });
  } catch (error) {
    console.error("Error logging out:", error);
  } finally {
    window.location.href = "patron-login.html";
  }
});

(async function init() {
  const loggedIn = await checkSession();
  if (loggedIn) {
    loadFavourites();
  }
})();
