// Mobile nav toggle for the directory board
const menuToggle = document.getElementById("menuToggle");
const boardNav = document.querySelector(".board-nav");

if (menuToggle && boardNav) {
  menuToggle.addEventListener("click", () => {
    const isOpen = boardNav.classList.toggle("is-open");
    menuToggle.setAttribute("aria-expanded", isOpen);
  });
}

// Signature element: queue ticket number ticks up periodically
// to suggest live order activity across the platform.
const ticketNumber = document.getElementById("ticketNumber");

if (ticketNumber && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
  let current = 27;
  setInterval(() => {
    current += 1;
    ticketNumber.textContent = "A" + String(current).padStart(3, "0");
  }, 4000);
}