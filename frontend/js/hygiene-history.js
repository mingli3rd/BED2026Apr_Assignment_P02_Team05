const apiBaseUrl = "http://localhost:3000";

function gradeClass(grade) {
  return { A: "grade-a", B: "grade-b", C: "grade-c", D: "grade-d" }[grade] || "";
}

async function loadHygieneHistory() {
  try {
    // Confirm vendor session and get their own vendor id
    const sessionResponse = await fetch(`${apiBaseUrl}/api/auth/me`, { method: "GET", credentials: "include" });
    if (sessionResponse.status !== 200) {
      window.location.href = "vendor-login.html";
      return;
    }
    const sessionData = await sessionResponse.json();

    const response = await fetch(`${apiBaseUrl}/api/vendor/hygiene-history`, {
      method: "GET",
      credentials: "include",
    });

    if (response.status !== 200) {
      throw new Error(`Unexpected status: ${response.status}`);
    }

    const history = await response.json();

    const table = document.getElementById("gradesTable");
    const tbody = document.getElementById("gradesTableBody");
    const emptyState = document.getElementById("gradesEmptyState");

    if (history.length === 0) {
      table.style.display = "none";
      emptyState.style.display = "block";
    } else {
      table.style.display = "table";
      emptyState.style.display = "none";

      // Most recent grade (first row, since backend orders newest first) shown as the badge up top
      const currentBadge = document.getElementById("currentGradeBadge");
      currentBadge.textContent = history[0].grade;
      currentBadge.className = `grade-badge ${gradeClass(history[0].grade)}`;
      currentBadge.style.display = "inline-flex";

      tbody.innerHTML = history
        .map((entry) => {
          const issued = new Date(entry.valid_from).toLocaleDateString("en-SG", { year: "numeric", month: "short", day: "numeric" });
          const validUntil = new Date(entry.valid_to).toLocaleDateString("en-SG", { year: "numeric", month: "short", day: "numeric" });
          return `
            <tr>
              <td><span class="grade-badge ${gradeClass(entry.grade)}">${entry.grade}</span></td>
              <td class="mono">${entry.score ?? "—"}</td>
              <td class="mono muted">${issued}</td>
              <td class="mono muted">${validUntil}</td>
              <td class="muted">${entry.remarks || "—"}</td>
            </tr>
          `;
        })
        .join("");
    }

    document.getElementById("dashboardLoading").style.display = "none";
    document.getElementById("dashboardContent").style.display = "block";

  } catch (error) {
    console.error("Error loading hygiene history:", error);
    document.getElementById("dashboardLoading").style.display = "none";
    document.getElementById("dashboardError").textContent = "Could not load your hygiene grade history. The NEA service may be offline.";
    document.getElementById("dashboardError").style.display = "block";
  }
}

document.getElementById("logoutBtn").addEventListener("click", async () => {
  try {
    await fetch(`${apiBaseUrl}/api/auth/logout`, { method: "POST", credentials: "include" });
  } catch (error) {
    console.error("Error logging out:", error);
  } finally {
    window.location.href = "vendor-login.html";
  }
});

loadHygieneHistory();