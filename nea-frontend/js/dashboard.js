const apiBaseUrl = "http://localhost:4000";

// Mirrors the backend's scoreToGrade logic — grade is purely a function of
// score, so it's safe/simple to compute here rather than requiring the
// API to join against HygieneGrades for display purposes.
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
    const response = await fetch(`${apiBaseUrl}/api/nea/auth/me`, {
      method: "GET",
      credentials: "include",
    });
    if (response.status !== 200) {
      window.location.href = "login.html";
      return null;
    }
    const data = await response.json();
    return data.officer;
  } catch (error) {
    window.location.href = "login.html";
    return null;
  }
}

function renderRecentTable(inspections) {
  const tbody = document.getElementById("recentTableBody");
  const table = document.getElementById("recentTable");
  const emptyState = document.getElementById("recentEmptyState");

  const recent = inspections.filter((insp) => insp.status === "completed").slice(0, 5);

  if (recent.length === 0) {
    table.style.display = "none";
    emptyState.style.display = "block";
    return;
  }

  table.style.display = "table";
  emptyState.style.display = "none";

  tbody.innerHTML = recent
    .map((insp) => {
      const grade = scoreToGrade(insp.score);
      const date = new Date(insp.conducted_at).toLocaleDateString("en-SG", { month: "short", day: "numeric", year: "numeric" });
      return `
        <tr>
          <td>${insp.business_name}</td>
          <td class="mono">${insp.score}</td>
          <td><span class="grade-badge ${gradeClass(grade)}">${grade}</span></td>
          <td class="mono muted">${date}</td>
        </tr>
      `;
    })
    .join("");
}

async function loadDashboard() {
  const officer = await checkSession();
  if (!officer) return;

  document.getElementById("officerName").textContent = officer.email;

  try {
    const response = await fetch(`${apiBaseUrl}/api/nea/inspections/mine`, {
      method: "GET",
      credentials: "include",
    });

    if (response.status !== 200) throw new Error(`Unexpected status: ${response.status}`);

    const inspections = await response.json();

    document.getElementById("welcomeHeading").textContent = `Welcome back, Officer.`;
    document.getElementById("totalInspections").textContent = inspections.length;

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    const weekCount = inspections.filter((i) => new Date(i.conducted_at) >= oneWeekAgo).length;
    document.getElementById("weekInspections").textContent = weekCount;

    const completedInspections = inspections.filter((i) => i.status === "completed");
    if (completedInspections.length > 0) {
      const avg = completedInspections.reduce((sum, i) => sum + i.score, 0) / completedInspections.length;
      document.getElementById("avgScore").textContent = avg.toFixed(1);
    }

    renderRecentTable(inspections);

    document.getElementById("loading").style.display = "none";
    document.getElementById("content").style.display = "block";

  } catch (error) {
    console.error("Error loading dashboard:", error);
    document.getElementById("loading").style.display = "none";
    document.getElementById("errorMessage").textContent = "Could not load dashboard data.";
    document.getElementById("errorMessage").style.display = "block";
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

loadDashboard();