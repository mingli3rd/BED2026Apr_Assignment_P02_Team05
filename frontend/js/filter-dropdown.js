// Builds and wires up a custom filter dropdown (replaces native <select>
// for full visual control). Call this once per dropdown on the page.
//
// options: array of { value, label } — value "" represents "All ..."
// onSelect: called with the selected value whenever the user picks an option
function createFilterDropdown(containerId, options, defaultLabel, onSelect) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="filter-dropdown" id="${containerId}Dropdown">
      <button type="button" class="filter-dropdown-toggle" id="${containerId}Toggle">
        <span id="${containerId}Label">${defaultLabel}</span>
        <span class="chevron">▾</span>
      </button>
      <div class="filter-dropdown-menu" id="${containerId}Menu"></div>
    </div>
  `;

  const dropdown = document.getElementById(`${containerId}Dropdown`);
  const toggle = document.getElementById(`${containerId}Toggle`);
  const menu = document.getElementById(`${containerId}Menu`);
  const label = document.getElementById(`${containerId}Label`);

  menu.innerHTML = options
    .map(
      (opt, index) =>
        `<button type="button" class="filter-dropdown-option ${index === 0 ? "is-active" : ""}" data-value="${opt.value}">${opt.label}</button>`
    )
    .join("");

  toggle.addEventListener("click", (event) => {
    event.stopPropagation();
    // Close any other open filter dropdown on the page first
    document.querySelectorAll(".filter-dropdown.is-open").forEach((d) => {
      if (d !== dropdown) d.classList.remove("is-open");
    });
    dropdown.classList.toggle("is-open");
  });

  menu.querySelectorAll(".filter-dropdown-option").forEach((optionEl) => {
    optionEl.addEventListener("click", () => {
      menu.querySelectorAll(".filter-dropdown-option").forEach((o) => o.classList.remove("is-active"));
      optionEl.classList.add("is-active");
      label.textContent = optionEl.textContent;
      dropdown.classList.remove("is-open");
      onSelect(optionEl.dataset.value);
    });
  });

  document.addEventListener("click", () => {
    dropdown.classList.remove("is-open");
  });
}