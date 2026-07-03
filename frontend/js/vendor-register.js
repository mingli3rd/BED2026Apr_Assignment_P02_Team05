const vendorRegisterForm = document.getElementById("vendorRegisterForm");
const messageDiv = document.getElementById("message");
const submitBtn = document.getElementById("submitBtn");
const permitStatus = document.getElementById("permitStatus");
const apiBaseUrl = "http://localhost:3000";

vendorRegisterForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const business_name = document.getElementById("businessName").value.trim();
  const email = document.getElementById("email").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const hawker_centre_id = document.getElementById("hawkerCentreId").value;
  const stall_number = document.getElementById("stallNumber").value.trim();
  const password = document.getElementById("password").value;

  if (!business_name || !email || !phone || !hawker_centre_id || !stall_number || !password) {
    messageDiv.textContent = "All fields are required.";
    messageDiv.className = "form-message is-warning";
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Registering...";

  try {
    const response = await fetch(`${apiBaseUrl}/api/auth/vendor/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        business_name,
        email,
        phone,
        password,
        hawker_centre_id: parseInt(hawker_centre_id),
        stall_number,
      }),
    });

    if (response.status === 201) {
      const newVendor = await response.json();
      messageDiv.textContent = `"${newVendor.business_name}" registered successfully! Your permit is pending approval.`;
      messageDiv.className = "form-message is-success";
      permitStatus.textContent = "SUBMITTED";

      vendorRegisterForm.reset();

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
    console.error("Error registering vendor:", error);
    messageDiv.textContent = `Failed to register: ${error.message}`;
    messageDiv.className = "form-message is-error";

  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Register Stall";
  }
});