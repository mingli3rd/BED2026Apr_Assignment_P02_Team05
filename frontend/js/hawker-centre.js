const apiBaseUrl = "http://localhost:3000";
const neaApiBaseUrl = "http://localhost:4000";
redirectIfVendor();

let allStalls = []; // full unfiltered list, with grades merged in
let activeGradeFilter = "";

function getHawkerCentreIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id");
}

function gradeClass(grade) {
  return { A: "grade-a", B: "grade-b", C: "grade-c", D: "grade-d" }[grade] || "";
}

// Fetches every approved vendor's current hygiene grade from the NEA
// service (a separate, public, no-auth endpoint on its own port), then
// merges each stall's grade into its object by vendor_id
async function loadHygieneGrades() {
  try {
    const response = await fetch(`${neaApiBaseUrl}/api/nea/public/hygiene-grades`);
    if (response.status !== 200) return [];
    return await response.json();
  } catch (error) {
    // If the NEA service is unreachable, degrade gracefully — stalls just
    // show without a grade badge rather than breaking the whole page
    console.error("Error loading hygiene grades (NEA service may be offline):", error);
    return [];
  }
}

function applyGradeFilter() {
  const filtered = activeGradeFilter
    ? allStalls.filter((stall) => stall.grade === activeGradeFilter)
    : allStalls;
  renderStallCards(filtered);
}

createFilterDropdown(
  "gradeFilter",
  [
    { value: "", label: "All Hygiene Grades" },
    { value: "A", label: "Grade A" },
    { value: "B", label: "Grade B" },
    { value: "C", label: "Grade C" },
    { value: "D", label: "Grade D" },
  ],
  "All Hygiene Grades",
  (value) => {
    activeGradeFilter = value;
    applyGradeFilter();
  }
);

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
          <div class="directory-card-title-row">
            <span class="stall-card-no">Stall ${stall.stall_number || "—"}</span>
            ${stall.grade ? `<span class="grade-badge ${gradeClass(stall.grade)}">${stall.grade}</span>` : ""}
          </div>
          <h3>${stall.business_name}</h3>
          <span class="directory-card-link">Order Now →</span>
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
    const [stallsResponse, grades] = await Promise.all([
      fetch(`${apiBaseUrl}/api/hawker-centres/${centreId}/stalls`),
      loadHygieneGrades(),
    ]);

    if (stallsResponse.status === 200) {
      const data = await stallsResponse.json();

      // Merge each stall's current grade in by vendor_id
      const gradeMap = {};
      grades.forEach((g) => {
        if (g.grade) gradeMap[g.vendor_id] = g.grade;
      });
      allStalls = data.stalls.map((stall) => ({
        ...stall,
        grade: gradeMap[stall.id] || null,
      }));

      document.getElementById("centreLocation").textContent = data.centre.location;
      document.getElementById("centreName").textContent = data.centre.name;
      renderStallCards(allStalls);

      document.getElementById("centreLoading").style.display = "none";
      document.getElementById("centreContent").style.display = "block";

    } else if (stallsResponse.status === 404) {
      document.getElementById("centreLoading").style.display = "none";
      document.getElementById("centreError").textContent = "Hawker centre not found.";
      document.getElementById("centreError").style.display = "block";

    } else {
      throw new Error(`Unexpected status: ${stallsResponse.status}`);
    }

  } catch (error) {
    console.error("Error loading hawker centre:", error);
    document.getElementById("centreLoading").style.display = "none";
    document.getElementById("centreError").textContent = "Could not load this hawker centre. Please try again.";
    document.getElementById("centreError").style.display = "block";
  }
}

loadHawkerCentre();