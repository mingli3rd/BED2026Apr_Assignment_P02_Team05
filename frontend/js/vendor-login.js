const vendorLoginForm = document.getElementById("vendorLoginForm");
const messageDiv = document.getElementById("message");
const submitBtn = document.getElementById("submitBtn");
const loginStatus = document.getElementById("loginStatus");
const apiBaseUrl = "http://localhost:3000";

vendorLoginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;
  const rememberMe = document.getElementById("rememberMe").checked;

  if (!email || !password) {
    messageDiv.textContent = "Email and password are required.";
    messageDiv.className = "form-message is-warning";
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Logging in...";

  try {
    const response = await fetch(`${apiBaseUrl}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      // "credentials: include" is required so the browser stores and
      // sends the HTTP-only cookie set by the server
      credentials: "include",
      body: JSON.stringify({
        email,
        password,
        remember_me: rememberMe,
        expected_role: "vendor",
      }),
    });

    if (response.status === 200) {
      const data = await response.json();
      messageDiv.textContent = `Welcome back, ${data.vendor.business_name}! Redirecting...`;
      messageDiv.className = "form-message is-success";
      loginStatus.textContent = "UNLOCKED";

      setTimeout(() => {
        window.location.href = "vendor-dashboard.html";
      }, 900);

    } else if (response.status === 401) {
      const errorBody = await response.json();
      messageDiv.textContent = errorBody.error || "Invalid email or password.";
      messageDiv.className = "form-message is-warning";

    } else if (response.status === 403) {
      const errorBody = await response.json();
      messageDiv.textContent = errorBody.error || "Access denied.";
      messageDiv.className = "form-message is-warning";

    } else if (response.status === 400) {
      const errorBody = await response.json();
      messageDiv.textContent = `Validation error: ${errorBody.error}`;
      messageDiv.className = "form-message is-warning";

    } else if (response.status === 500) {
      messageDiv.textContent = "Server error. Please try again later.";
      messageDiv.className = "form-message is-error";

    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }

  } catch (error) {
    console.error("Error logging in:", error);
    messageDiv.textContent = `Failed to log in: ${error.message}`;
    messageDiv.className = "form-message is-error";

  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Log In";
  }
});