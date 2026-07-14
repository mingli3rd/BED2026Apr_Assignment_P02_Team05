const apiBaseUrl = "http://localhost:3000";

let searchDebounceTimer = null;
let activeLocationFilter = "";

async function loadLocationFilter() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/hawker-centres`);
    const centres = await response.json();

    const locations = [...new Set(centres.map((c) => c.location))].sort();

    const options = [
      { value: "", label: "All Locations" },
      ...locations.map((loc) => ({ value: loc, label: loc })),
    ];

    createFilterDropdown("locationFilter", options, "All Locations", (value) => {
      activeLocationFilter = value;
      loadHawkerCentres();
    });
  } catch (error) {
    console.error("Error loading locations:", error);
  }
}

function renderHawkerCentreCards(centres) {
  const grid = document.getElementById("stallsGrid");
  const emptyState = document.getElementById("stallsEmptyState");
  const resultCount = document.getElementById("resultCount");

  resultCount.textContent = `${centres.length} hawker centre${centres.length === 1 ? "" : "s"} found`;

  if (centres.length === 0) {
    grid.style.display = "none";
    emptyState.style.display = "block";
    return;
  }

  grid.style.display = "grid";
  emptyState.style.display = "none";

  grid.innerHTML = centres
    .map(
      (centre) => `
        <a href="hawker-centre.html?id=${centre.id}" class="directory-card">
          <span class="stall-card-no">${centre.location}</span>
          <h3>${centre.name}</h3>
          <p class="mono muted">${centre.stall_count} stall${centre.stall_count === 1 ? "" : "s"} on our platform</p>
          <span class="directory-card-link">View Stalls →</span>
        </a>
      `
    )
    .join("");
}

async function loadHawkerCentres() {
  const search = document.getElementById("searchInput").value.trim();

  document.getElementById("stallsLoading").style.display = "block";

  try {
    const params = new URLSearchParams();
    if (search) params.append("search", search);
    if (activeLocationFilter) params.append("location", activeLocationFilter);

    const response = await fetch(`${apiBaseUrl}/api/hawker-centres/search?${params.toString()}`);
    const centres = await response.json();

    renderHawkerCentreCards(centres);
    document.getElementById("stallsLoading").style.display = "none";

  } catch (error) {
    console.error("Error loading hawker centres:", error);
    document.getElementById("stallsLoading").style.display = "none";
  }
}

// Debounce the search input so we're not firing a request on every keystroke
document.getElementById("searchInput").addEventListener("input", () => {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(loadHawkerCentres, 300);
});

loadLocationFilter();
loadHawkerCentres(); // shows ALL hawker centres immediately on first load, no filters applied