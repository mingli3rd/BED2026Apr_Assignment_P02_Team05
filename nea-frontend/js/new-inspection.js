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
  console.log("checkSession() called");
  try {
    const response = await fetch(`${apiBaseUrl}/api/nea/auth/me`, { method: "GET", credentials: "include" });
    console.log("checkSession response status:", response.status);
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

async function loadVendors() {
  console.log("loadVendors() called");
  try {
    const response = await fetch(`${apiBaseUrl}/api/nea/vendors`, { method: "GET", credentials: "include" });
    console.log("loadVendors response status:", response.status);
    const vendors = await response.json();

    const select = document.getElementById("vendorSelect");
    select.innerHTML =
      `<option value="" disabled selected>Select a stall</option>` +
      vendors
        .map((v) => `<option value="${v.id}">${v.business_name} (${v.stall_number || "no stall #"}) — ${v.approval_status}</option>`)
        .join("");
  } catch (error) {
    console.error("loadVendors() error:", error);
  }
}

document.getElementById("scoreInput").addEventListener("input", (event) => {
  const score = parseInt(event.target.value);
  const preview = document.getElementById("gradePreview");

  if (isNaN(score) || score < 0 || score > 100) {
    preview.textContent = "—";
    preview.className = "score-preview";
    return;
  }

  const grade = scoreToGrade(score);
  preview.textContent = grade;
  preview.className = `score-preview ${gradeClass(grade)}`;
});

document.getElementById("inspectionForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const vendor_id = document.getElementById("vendorSelect").value;
  const score = parseInt(document.getElementById("scoreInput").value);
  const remarks = document.getElementById("remarksInput").value.trim();
  const messageDiv = document.getElementById("message");
  const submitBtn = document.getElementById("submitBtn");

  if (!vendor_id) {
    messageDiv.textContent = "Please select a stall.";
    messageDiv.className = "form-message is-warning";
    return;
  }

  if (isNaN(score) || score < 0 || score > 100) {
    messageDiv.textContent = "Score must be a number between 0 and 100.";
    messageDiv.className = "form-message is-warning";
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";

  try {
    const response = await fetch(`${apiBaseUrl}/api/nea/inspections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ vendor_id: parseInt(vendor_id), score, remarks }),
    });

    if (response.status === 201) {
      const data = await response.json();
      messageDiv.textContent = data.message;
      messageDiv.className = "form-message is-success";
      document.getElementById("inspectionForm").reset();
      document.getElementById("gradePreview").textContent = "—";
      document.getElementById("gradePreview").className = "score-preview";

    } else if (response.status === 400) {
      const errorBody = await response.json();
      messageDiv.textContent = errorBody.error;
      messageDiv.className = "form-message is-warning";

    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }

  } catch (error) {
    console.error("Error submitting inspection:", error);
    messageDiv.textContent = "Something went wrong. Please try again.";
    messageDiv.className = "form-message is-error";

  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Inspection";
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

console.log("new-inspection.js top-level code reached");

(async function init() {
  console.log("init() started");
  const officer = await checkSession();
  console.log("checkSession() returned:", officer);
  if (officer) {
    loadVendors();
  }
})();