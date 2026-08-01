const apiBaseUrl = "http://localhost:3000";
redirectIfVendor();

// Fetches a vendor's currently-enabled eco packaging options (public route,
// no auth). Returns [] if the vendor doesn't offer any — the picker just
// won't render for that group in that case.
async function fetchPackagingOptions(vendorId) {
  try {
    const response = await fetch(`${apiBaseUrl}/api/stalls/${vendorId}/packaging`);
    if (response.status !== 200) return [];
    return await response.json();
  } catch (error) {
    console.error(`Error loading packaging options for vendor ${vendorId}:`, error);
    return [];
  }
}

function renderPackagingPicker(vendorId, options) {
  // Standard packaging isn't a choice — the $0.30/item fee always applies
  // as the baseline takeaway cost, so it's shown as a fixed note rather
  // than a selectable option.
  const standardNote = `
    <div class="packaging-standard-note">Standard packaging fee ($0.30/item) applies to every order.</div>
  `;

  if (!options || options.length === 0) {
    return `
      <div class="packaging-picker" data-vendor-id="${vendorId}">
        <span class="packaging-picker-label">Packaging</span>
        ${standardNote}
      </div>
    `;
  }

  const currentChoice = getPackagingChoice(vendorId);

  // Eco options render as checkboxes rather than radios, but only one can
  // ever be checked at a time (enforced in the change handler below) —
  // when a stall offers multiple eco options, picking one clears the rest.
  const optionRows = options
    .map(
      (opt) => `
        <label class="packaging-option-row">
          <span>
            <input type="checkbox" class="eco-packaging-checkbox" data-vendor-id="${vendorId}" value="${opt.id}" ${String(currentChoice) === String(opt.id) ? "checked" : ""} />
            🌱 ${opt.description}
          </span>
          <span class="packaging-option-surcharge">+$${Number(opt.surcharge).toFixed(2)}/item</span>
        </label>
      `
    )
    .join("");

  return `
    <div class="packaging-picker" data-vendor-id="${vendorId}">
      <span class="packaging-picker-label">Packaging</span>
      ${standardNote}
      ${optionRows}
    </div>
  `;
}

function renderSpecialRequestField(vendorId) {
  const currentText = getSpecialRequest(vendorId);
  return `
    <div class="special-request-field" data-vendor-id="${vendorId}">
      <span class="packaging-picker-label">Special Requests (optional)</span>
      <textarea class="special-request-input" data-vendor-id="${vendorId}" maxlength="500" placeholder="e.g. No spring onion, less spicy...">${currentText}</textarea>
    </div>
  `;
}

async function renderCartPage() {
  const cart = getCart();
  const groupsContainer = document.getElementById("cartGroups");
  const emptyState = document.getElementById("cartEmptyState");
  const summaryPanel = document.getElementById("cartSummary");
  const multiVendorWarning = document.getElementById("multiVendorWarning");

  if (cart.length === 0) {
    groupsContainer.innerHTML = "";
    emptyState.style.display = "block";
    summaryPanel.style.display = "none";
    multiVendorWarning.style.display = "none";
    return;
  }

  emptyState.style.display = "none";
  summaryPanel.style.display = "block";

  const groups = getCartVendorGroups();
  const vendorIds = Object.keys(groups);
  multiVendorWarning.style.display = vendorIds.length > 1 ? "flex" : "none";

  // Fetch each vendor's packaging options in parallel before rendering,
  // so the picker is there on first paint instead of popping in late
  const packagingByVendor = {};
  await Promise.all(
    vendorIds.map(async (vendorId) => {
      packagingByVendor[vendorId] = await fetchPackagingOptions(vendorId);
    })
  );

  groupsContainer.innerHTML = vendorIds
    .map((vendorId) => {
      const group = groups[vendorId];
      const groupTotal = group.items.reduce((sum, item) => sum + getCartLineTotal(item), 0);

      return `
        <div class="dash-panel cart-vendor-group">
          <div class="dash-panel-header">
            <h2>${group.vendor_name}</h2>
            <span class="mono">$${groupTotal.toFixed(2)}</span>
          </div>

          <div class="cart-items-list">
            ${group.items
              .map((item) => {
                const addOnsText = (item.add_ons || []).map((a) => a.name).join(", ");
                return `
                  <div class="cart-line-item">
                    <img src="${getItemImage(item)}" alt="" class="cart-line-img" />
                    <div class="cart-line-info">
                      <span class="cart-line-name">${item.name}</span>
                      ${addOnsText ? `<span class="muted cart-line-addons">+ ${addOnsText}</span>` : ""}
                      <span class="mono muted">$${Number(item.price).toFixed(2)} each</span>
                    </div>
                    <div class="cart-line-controls">
                      <button class="qty-btn" data-index="${item.cartIndex}" data-delta="-1">−</button>
                      <span class="mono">${item.quantity}</span>
                      <button class="qty-btn" data-index="${item.cartIndex}" data-delta="1">+</button>
                      <span class="mono cart-line-total">$${getCartLineTotal(item).toFixed(2)}</span>
                      <button class="dash-link-btn dash-link-btn-danger" data-remove-index="${item.cartIndex}">Remove</button>
                    </div>
                  </div>
                `;
              })
              .join("")}
          </div>

          ${renderPackagingPicker(vendorId, packagingByVendor[vendorId])}
          ${renderSpecialRequestField(vendorId)}
        </div>
      `;
    })
    .join("");

  const grandTotal = cart.reduce((sum, item) => sum + getCartLineTotal(item), 0);
  document.getElementById("cartGrandTotal").textContent = `$${grandTotal.toFixed(2)}`;

  // Wire up quantity and remove buttons
  document.querySelectorAll(".qty-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = parseInt(btn.dataset.index);
      const delta = parseInt(btn.dataset.delta);
      const cart = getCart();
      const newQty = cart[index].quantity + delta;

      if (newQty < 1) {
        removeCartItemAt(index);
      } else {
        updateCartItemQuantity(index, newQty);
      }
      renderCartPage();
    });
  });

  document.querySelectorAll("[data-remove-index]").forEach((btn) => {
    btn.addEventListener("click", () => {
      removeCartItemAt(parseInt(btn.dataset.removeIndex));
      renderCartPage();
    });
  });

  // Wire up eco packaging checkboxes — checking one unchecks any other
  // eco option for that same vendor (only one can be active at a time),
  // and unchecking clears the choice entirely, falling back to standard.
  document.querySelectorAll(".packaging-picker").forEach((picker) => {
    const vendorId = picker.dataset.vendorId;
    const checkboxes = picker.querySelectorAll(".eco-packaging-checkbox");
    checkboxes.forEach((checkbox) => {
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          checkboxes.forEach((other) => {
            if (other !== checkbox) other.checked = false;
          });
          setPackagingChoice(vendorId, checkbox.value);
        } else {
          setPackagingChoice(vendorId, null);
        }
      });
    });
  });

  // Wire up special request textareas — saved as the customer types
  document.querySelectorAll(".special-request-input").forEach((textarea) => {
    textarea.addEventListener("input", () => {
      setSpecialRequest(textarea.dataset.vendorId, textarea.value);
    });
  });
}

renderCartPage();