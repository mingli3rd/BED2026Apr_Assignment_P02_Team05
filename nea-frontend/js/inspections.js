const apiBaseUrl = "http://localhost:4000";

function gradeClass(grade) {
  return { A: "grade-a", B: "grade-b", C: "grade-c", D: "grade-d" }[grade] || "grade-d";
}

async function checkSession() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/nea/auth/me`, { method: "GET", credentials: "include" });
    if (response.status !== 200) {
      window.location.href = "login.html";
      return null;
    }
    const data = await response.json();
    document.getElementById("officerName").textContent = data.officer.email;
    return data.officer;
  } catch (error) {
    window.location.href = "login.html";
    return null;
  }
}

async function loadInspections() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/nea/inspections/mine`, { method: "GET", credentials: "include" });
    const inspections = await response.json();

    const table = document.getElementById("inspectionsTable");
    const tbody = document.getElementById("inspectionsTableBody");
    const emptyState = document.getElementById("emptyState");

    if (inspections.length === 0) {
      table.style.display = "none";
      emptyState.style.display = "block";
      return;
    }

    table.style.display = "table";
    emptyState.style.display = "none";

    tbody.innerHTML = inspections
      .map((insp) => {
        const isScheduled = insp.status === "scheduled";
        const displayDate = new Date(isScheduled ? insp.scheduled_date : insp.conducted_at)
          .toLocaleDateString("en-SG", { month: "short", day: "numeric", year: "numeric" });

        if (isScheduled) {
          return `
            <tr>
              <td>${insp.business_name}</td>
              <td class="muted">Scheduled</td>
              <td class="mono muted">—</td>
              <td class="mono muted">—</td>
              <td class="muted">—</td>
              <td class="mono muted">${displayDate}</td>
            </tr>
          `;
        }

        // Grades are now issued automatically the moment a result is
        // logged (see logInspectionResult on the backend), so a completed
        // inspection should always have issued_grade set. The "—" fallback
        // only covers old/pre-existing rows from before that change.
        const gradeCell = insp.issued_grade
          ? `<span class="grade-badge ${gradeClass(insp.issued_grade)}">${insp.issued_grade}</span>`
          : `<span class="muted">—</span>`;

        return `
          <tr>
            <td>${insp.business_name}</td>
            <td class="muted">Completed</td>
            <td class="mono">${insp.score}</td>
            <td>${gradeCell}</td>
            <td class="muted">${insp.remarks || "—"}</td>
            <td class="mono muted">${displayDate}</td>
          </tr>
        `;
      })
      .join("");

  } catch (error) {
    console.error("Error loading inspections:", error);
  }
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
  try {
    await fetch(`${apiBaseUrl}/api/nea/auth/logout`, { method: "POST", credentials: "include" });
  } catch (error) {
    console.error("Error logging out:", error);
  } finally {
    window.location.href = "login.html";
  }
});

(async function init() {
  const officer = await checkSession();
  if (officer) {
    loadInspections();
  }
})();
