const apiBaseUrl = "http://localhost:4000";

function scoreToGrade(score) {
  if (score >= 90) return "A";
  if (score >= 75) return "B";
  if (score >= 60) return "C";
  return "D";
}

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
        const grade = scoreToGrade(insp.score);
        const date = new Date(insp.inspection_date).toLocaleDateString("en-SG", { month: "short", day: "numeric", year: "numeric" });
        return `
          <tr>
            <td>${insp.business_name}</td>
            <td class="mono">${insp.score}</td>
            <td><span class="grade-badge ${gradeClass(grade)}">${grade}</span></td>
            <td class="muted">${insp.remarks || "—"}</td>
            <td class="mono muted">${date}</td>
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