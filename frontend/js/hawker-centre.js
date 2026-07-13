const apiBaseUrl = "http://localhost:3000";

function getHawkerCentreIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function renderStallCards(stalls) {
  const grid = document.getElementById("stallsGrid");
  const emptyState = document.getElementById("stallsEmptyState");
  const resultCount = document.getElementById("resultCount");

  resultCount.textContent = `${stalls.length} stall${stalls.length === 1 ? "" : "s"} here`;

  if (stalls.length === 0) {
    grid.style.display = "none";
    emptyState.style.display = "block";
    return;
  }

  grid.style.display = "grid";
  emptyState.style.display = "none";

  grid.innerHTML = stalls
    .map(
      (stall) => `
        <a href="stall-menu.html?vendor_id=${stall.id}" class="directory-card">
          <img src="${stall.banner_image ? "/uploads/" + stall.banner_image : "images/stall-banner.svg"}" alt="" class="directory-card-img" />
          <span class="stall-card-no">Stall ${stall.stall_number || "—"}</span>
          <h3>${stall.business_name}</h3>
          <span class="directory-card-link">View Menu →</span>
        </a>
      `
    )
    .join("");
}

async function loadHawkerCentre() {
  const centreId = getHawkerCentreIdFromUrl();

  if (!centreId) {
    window.location.href = "stalls.html";
    return;
  }

  try {
    const response = await fetch(`${apiBaseUrl}/api/hawker-centres/${centreId}/stalls`);

    if (response.status === 200) {
      const data = await response.json();

      document.getElementById("centreLocation").textContent = data.centre.location;
      document.getElementById("centreName").textContent = data.centre.name;
      renderStallCards(data.stalls);

      document.getElementById("centreLoading").style.display = "none";
      document.getElementById("centreContent").style.display = "block";

    } else if (response.status === 404) {
      document.getElementById("centreLoading").style.display = "none";
      document.getElementById("centreError").textContent = "Hawker centre not found.";
      document.getElementById("centreError").style.display = "block";

    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }

  } catch (error) {
    console.error("Error loading hawker centre:", error);
    document.getElementById("centreLoading").style.display = "none";
    document.getElementById("centreError").textContent = "Could not load this hawker centre. Please try again.";
    document.getElementById("centreError").style.display = "block";
  }
}

loadHawkerCentre();