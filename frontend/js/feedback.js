const apiBaseUrl = "http://localhost:3000";

async function checkSession() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/auth/me/patron`, { method: "GET", credentials: "include" });
    if (response.status !== 200) {
      document.getElementById("notLoggedInState").style.display = "block";
      return null;
    }
    document.getElementById("feedbackContent").style.display = "block";
    return true;
  } catch (error) {
    document.getElementById("notLoggedInState").style.display = "block";
    return null;
  }
}

// --- Orders grouped by stall, each with an expandable "Leave Feedback"
// form per order showing exactly what was ordered ---
async function loadOrders() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/patron/orders`, { method: "GET", credentials: "include" });
    const data = await response.json();
    const orders = data.orders || data; // handles either { orders: [...] } or a plain array

    const list = document.getElementById("ordersList");
    const emptyState = document.getElementById("noOrdersState");

    if (!orders || orders.length === 0) {
      list.innerHTML = "";
      emptyState.style.display = "block";
      return;
    }

    emptyState.style.display = "none";

    // Group orders by vendor_id, preserving each vendor's orders in their
    // original (newest-first) order within the group
    const groups = {};
    orders.forEach((order) => {
      if (!groups[order.vendor_id]) {
        groups[order.vendor_id] = {
          vendor_name: order.vendor_name,
          banner_image: order.banner_image,
          orders: [],
        };
      }
      groups[order.vendor_id].orders.push(order);
    });

    // Sort stalls alphabetically so the grouping itself is predictable
    const vendorIds = Object.keys(groups).sort((a, b) =>
      groups[a].vendor_name.localeCompare(groups[b].vendor_name)
    );

    let globalIndex = 0;

    list.innerHTML = vendorIds
      .map((vendorId) => {
        const group = groups[vendorId];

        const ordersHtml = group.orders
          .map((order) => {
            const date = new Date(order.created_at).toLocaleDateString("en-SG", { month: "short", day: "numeric", year: "numeric" });
            const index = globalIndex++;

            return `
              <div class="order-review-row">
                <div class="order-review-row-info">
                  ${order.items ? `<p style="margin: 0; font-size: 13.5px;">${order.items}</p>` : ""}
                  <p class="mono muted" style="margin: ${order.items ? "4px" : "0"} 0 0; font-size: 12px;">ORD-${order.order_id} · ${date} · $${Number(order.total_amount).toFixed(2)}</p>
                </div>
                <button type="button" class="btn btn-accent btn-small" data-toggle-review="${index}">Leave Feedback</button>
              </div>

              <form class="order-review-form" id="reviewForm-${index}" style="display:none;" data-vendor-id="${vendorId}" data-order-id="${order.order_id}">
                <div class="field">
                  <label>Rating</label>
                  <div class="star-rating" data-form-index="${index}">
                    <button type="button" class="star" data-value="1">★</button>
                    <button type="button" class="star" data-value="2">★</button>
                    <button type="button" class="star" data-value="3">★</button>
                    <button type="button" class="star" data-value="4">★</button>
                    <button type="button" class="star" data-value="5">★</button>
                  </div>
                  <input type="hidden" class="rating-input" value="" />
                </div>

                <div class="field">
                  <label>Comment <span class="field-optional">(optional)</span></label>
                  <textarea rows="3" class="comment-input" placeholder="How was this order?"></textarea>
                </div>

                <button type="submit" class="btn btn-primary btn-small">Submit Review</button>
                <p class="form-message review-message" role="status" aria-live="polite"></p>
              </form>
            `;
          })
          .join("");

        return `
          <div class="vendor-review-group">
            <div class="vendor-review-group-header">
              <img src="${group.banner_image ? "/uploads/" + group.banner_image : "images/stall-banner.svg"}" alt="" class="order-review-img" />
              <span class="vendor-review-name">${group.vendor_name}</span>
              <span class="mono muted vendor-review-count">${group.orders.length} order${group.orders.length === 1 ? "" : "s"}</span>
            </div>
            <div class="vendor-review-group-orders">
              ${ordersHtml}
            </div>
          </div>
        `;
      })
      .join("");

    wireUpReviewForms();

  } catch (error) {
    console.error("Error loading orders:", error);
  }
}

function wireUpReviewForms() {
  // Toggle each order's review form open/closed
  document.querySelectorAll("[data-toggle-review]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const form = document.getElementById(`reviewForm-${btn.dataset.toggleReview}`);
      const isOpen = form.style.display !== "none";
      form.style.display = isOpen ? "none" : "block";
      btn.textContent = isOpen ? "Leave Feedback" : "Cancel";
      btn.classList.toggle("btn-accent", isOpen);
      btn.classList.toggle("btn-ghost", !isOpen);
    });
  });

  // Star ratings, scoped per form
  document.querySelectorAll(".star-rating").forEach((ratingGroup) => {
    const stars = ratingGroup.querySelectorAll(".star");
    const hiddenInput = ratingGroup.parentElement.querySelector(".rating-input");

    stars.forEach((star) => {
      star.addEventListener("click", () => {
        hiddenInput.value = star.dataset.value;
        highlightStars(stars, parseInt(star.dataset.value));
      });
      star.addEventListener("mouseenter", () => highlightStars(stars, parseInt(star.dataset.value)));
    });

    ratingGroup.addEventListener("mouseleave", () => {
      highlightStars(stars, parseInt(hiddenInput.value) || 0);
    });
  });

  // Submit handlers
  document.querySelectorAll(".order-review-form").forEach((form) => {
    form.addEventListener("submit", (event) => handleReviewSubmit(event, form));
  });
}

function highlightStars(stars, count) {
  stars.forEach((s) => s.classList.toggle("is-filled", parseInt(s.dataset.value) <= count));
}

async function handleReviewSubmit(event, form) {
  event.preventDefault();

  const vendorId = form.dataset.vendorId;
  const rating = form.querySelector(".rating-input").value;
  const comment = form.querySelector(".comment-input").value.trim();
  const messageEl = form.querySelector(".review-message");
  const submitBtn = form.querySelector('button[type="submit"]');

  if (!rating) {
    messageEl.textContent = "Please select a star rating.";
    messageEl.className = "form-message review-message is-warning";
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = "Submitting...";

  try {
    const response = await fetch(`${apiBaseUrl}/api/patron/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ vendor_id: parseInt(vendorId), rating: parseInt(rating), comment }),
    });

    if (response.status === 201) {
      const data = await response.json();
      messageEl.textContent = data.message;
      messageEl.className = "form-message review-message is-success";
      loadMyFeedback();

    } else if (response.status === 400) {
      const errorBody = await response.json();
      messageEl.textContent = errorBody.error;
      messageEl.className = "form-message review-message is-warning";

    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }

  } catch (error) {
    console.error("Error submitting feedback:", error);
    messageEl.textContent = "Something went wrong. Please try again.";
    messageEl.className = "form-message review-message is-error";

  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Submit Review";
  }
}

// --- Past feedback list ---
async function loadMyFeedback() {
  try {
    const response = await fetch(`${apiBaseUrl}/api/patron/feedback/mine`, { method: "GET", credentials: "include" });
    const feedback = await response.json();

    const list = document.getElementById("myFeedbackList");
    const emptyState = document.getElementById("myFeedbackEmptyState");

    if (feedback.length === 0) {
      list.innerHTML = "";
      emptyState.style.display = "block";
      return;
    }

    emptyState.style.display = "none";
    list.innerHTML = feedback
      .map(
        (fb) => `
          <div class="dash-list-item dash-list-item-stacked" style="border-bottom: 1px solid var(--line); padding: 14px 0;">
            <span style="display:flex; justify-content:space-between; width:100%;">
              <strong>${fb.business_name}</strong>
              <span class="mono" style="color: var(--mustard);">${"★".repeat(fb.rating)}${"☆".repeat(5 - fb.rating)}</span>
            </span>
            ${fb.comment ? `<span class="muted">${fb.comment}</span>` : ""}
          </div>
        `
      )
      .join("");

  } catch (error) {
    console.error("Error loading feedback history:", error);
  }
}

(async function init() {
  const loggedIn = await checkSession();
  if (loggedIn) {
    loadOrders();
    loadMyFeedback();
  }
})();