const patronRegisterForm = document.getElementById("patronRegisterForm");
const messageDiv = document.getElementById("message");
const submitBtn = document.getElementById("submitBtn");
const patronStatus = document.getElementById("patronStatus");
const apiBaseUrl = "http://localhost:3000";

patronRegisterForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = document.getElementById("name").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (!name || !email || !password || !confirmPassword) {
    messageDiv.textContent = "Name, email, and password are required.";
    messageDiv.className = "form-message is-warning";
    return;
  }

  if (password !== confirmPassword) {
    messageDiv.textContent = "Passwords do not match.";
    messageDiv.className = "form-message is-warning";
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Creating account...";

  try {
    const response = await fetch(`${apiBaseUrl}/api/auth/patron/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        phone,
        password,
        confirm_password: confirmPassword,
      }),
    });

    if (response.status === 201) {
      const newPatron = await response.json();
      messageDiv.textContent = `Welcome, ${newPatron.name}! Your account has been created.`;
      messageDiv.className = "form-message is-success";
      patronStatus.textContent = "REGISTERED";

      patronRegisterForm.reset();

    } else if (response.status === 409) {
      const errorBody = await response.json();
      messageDiv.textContent = errorBody.error || "This email is already registered.";
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
    console.error("Error registering patron:", error);
    messageDiv.textContent = `Failed to register: ${error.message}`;
    messageDiv.className = "form-message is-error";

  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Create Account";
  }
});