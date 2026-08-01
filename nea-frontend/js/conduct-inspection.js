const apiBaseUrl = "http://localhost:4000";
let selectedInspectionId = null;

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
    console.error("checkSession() error:", error);
    window.location.href = "login.html";
    return null;
  }
}

async function loadUpcoming() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/nea/inspections/upcoming`, { method: "GET", credentials: "include" });
    const inspections = await response.json();

    const table = document.getElementById("upcomingTable");
    const tbody = document.getElementById("upcomingTableBody");
    const emptyState = document.getElementById("upcomingEmptyState");

    if (inspections.length === 0) {
      table.style.display = "none";
      emptyState.style.display = "block";
      return;
    }

    table.style.display = "table";
    emptyState.style.display = "none";

    tbody.innerHTML = inspections
      .map((insp) => {
        const date = new Date(insp.scheduled_date).toLocaleDateString("en-SG", { month: "short", day: "numeric", year: "numeric" });
        return `
          <tr>
            <td>${insp.business_name}</td>
            <td class="mono muted">${date}</td>
            <td><button class="btn btn-primary" data-id="${insp.id}" data-name="${insp.business_name}" style="padding:8px 14px; font-size:13px;">Conduct</button></td>
          </tr>
        `;
      })
      .join("");

    tbody.querySelectorAll("button[data-id]").forEach((btn) => {
      btn.addEventListener("click", () => selectInspection(btn.dataset.id, btn.dataset.name));
    });
  } catch (error) {
    console.error("Error loading upcoming inspections:", error);
  }
}

function selectInspection(id, stallName) {
  selectedInspectionId = id;
  document.getElementById("selectedStallName").textContent = stallName;
  document.getElementById("selectPanel").style.display = "none";
  document.getElementById("resultPanel").style.display = "block";
}

document.getElementById("cancelBtn").addEventListener("click", () => {
  selectedInspectionId = null;
  document.getElementById("resultPanel").style.display = "none";
  document.getElementById("selectPanel").style.display = "block";
  document.getElementById("resultForm").reset();
  document.getElementById("message").textContent = "";
});

document.getElementById("resultForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const score = parseInt(document.getElementById("scoreInput").value);
  const remarks = document.getElementById("remarksInput").value.trim();
  const messageDiv = document.getElementById("message");
  const submitBtn = document.getElementById("submitBtn");

  if (isNaN(score) || score < 0 || score > 100) {
    messageDiv.textContent = "Score must be a number between 0 and 100.";
    messageDiv.className = "form-message is-warning";
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";

  try {
    const response = await fetch(`${apiBaseUrl}/api/nea/inspections/${selectedInspectionId}/result`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ score, remarks }),
    });

    if (response.status === 200) {
      const data = await response.json();
      messageDiv.textContent = data.message;
      messageDiv.className = "form-message is-success";
      document.getElementById("resultForm").reset();

      // Back to the list after a moment, refreshed
      setTimeout(() => {
        selectedInspectionId = null;
        document.getElementById("resultPanel").style.display = "none";
        document.getElementById("selectPanel").style.display = "block";
        messageDiv.textContent = "";
        loadUpcoming();
      }, 1200);

    } else if (response.status === 400 || response.status === 403 || response.status === 404 || response.status === 409) {
      const errorBody = await response.json();
      messageDiv.textContent = errorBody.error;
      messageDiv.className = "form-message is-warning";

    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }

  } catch (error) {
    console.error("Error submitting inspection result:", error);
    messageDiv.textContent = "Something went wrong. Please try again.";
    messageDiv.className = "form-message is-error";

  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Result";
  }
});

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
    loadUpcoming();
  }
})();