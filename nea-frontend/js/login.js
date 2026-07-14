const apiBaseUrl = "http://localhost:4000";

const loginForm = document.getElementById("loginForm");
const messageDiv = document.getElementById("message");
const submitBtn = document.getElementById("submitBtn");

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  submitBtn.disabled = true;
  submitBtn.textContent = "Logging in...";

  try {
    const response = await fetch(`${apiBaseUrl}/api/nea/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ email, password }),
    });

    if (response.status === 200) {
      window.location.href = "dashboard.html";

    } else if (response.status === 401) {
      const errorBody = await response.json();
      messageDiv.textContent = errorBody.error || "Invalid email or password.";
      messageDiv.className = "form-message is-warning";

    } else if (response.status === 400) {
      const errorBody = await response.json();
      messageDiv.textContent = errorBody.error;
      messageDiv.className = "form-message is-warning";

    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }

  } catch (error) {
    console.error("Error logging in:", error);
    messageDiv.textContent = "Something went wrong. Please try again.";
    messageDiv.className = "form-message is-error";

  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Log In";
  }
});