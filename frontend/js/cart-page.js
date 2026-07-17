redirectIfVendor();
function renderCartPage() {
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
}

renderCartPage();