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

async function loadProfile() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/patron/profile`, { method: "GET", credentials: "include" });
    const data = await response.json();

    document.getElementById("nameInput").value = data.patron.name;
    document.getElementById("emailInput").value = data.patron.email;
    document.getElementById("phoneInput").value = data.patron.phone || "";

    const memberSince = new Date(data.patron.created_at).toLocaleDateString("en-SG", {
      year: "numeric", month: "long", day: "numeric",
    });
    document.getElementById("memberSince").textContent = memberSince;

    document.getElementById("dashboardLoading").style.display = "none";
    document.getElementById("dashboardContent").style.display = "block";

  } catch (error) {
    console.error("Error loading profile:", error);
    document.getElementById("dashboardLoading").style.display = "none";
    document.getElementById("dashboardError").textContent = "Could not load your profile.";
    document.getElementById("dashboardError").style.display = "block";
  }
}

document.getElementById("profileForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = document.getElementById("nameInput").value.trim();
  const phone = document.getElementById("phoneInput").value.trim();
  const messageDiv = document.getElementById("formMessage");
  const saveBtn = document.getElementById("saveProfileBtn");

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  try {
    const response = await fetch(`${apiBaseUrl}/api/patron/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, phone }),
    });

    if (response.status === 200) {
      messageDiv.textContent = "Profile updated successfully.";
      messageDiv.className = "form-message is-success";

    } else if (response.status === 400) {
      const errorBody = await response.json();
      messageDiv.textContent = errorBody.error;
      messageDiv.className = "form-message is-warning";

    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }

  } catch (error) {
    console.error("Error saving profile:", error);
    messageDiv.textContent = "Something went wrong. Please try again.";
    messageDiv.className = "form-message is-error";

  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Changes";
  }
});

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
    loadProfile();
  }
})();
