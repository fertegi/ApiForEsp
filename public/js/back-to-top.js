const button = document.createElement("button");
button.type = "button";
button.className = "back-to-top";
button.setAttribute("aria-label", "Zurück nach oben");
button.hidden = true;

button.innerHTML = `
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor"
        stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 19V5M5 12l7-7 7 7" />
    </svg>`;
document.body.appendChild(button);

const updateVisibility = () => {
  button.hidden = window.scrollY <= 200;
};

window.addEventListener("scroll", updateVisibility, { passive: true });
button.addEventListener("click", () => {
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
  window.scrollTo({ top: 0, behavior });
});

updateVisibility();
