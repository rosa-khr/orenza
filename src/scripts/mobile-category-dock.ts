export {};

const root = document.querySelector<HTMLElement>(".mobile-home-top");
const links = root?.querySelector<HTMLElement>("[data-mobile-quick-links]");

if (root && links && root.dataset.categoryDockReady !== "true") {
  root.dataset.categoryDockReady = "true";
  let frame = 0;
  let threshold = links.offsetTop + Math.max(54, links.offsetHeight);

  const measure = () => {
    if (root.classList.contains("is-category-compact")) return;
    root.style.setProperty("--mobile-category-space", `${links.offsetHeight}px`);
    threshold = links.offsetTop + Math.max(54, links.offsetHeight);
  };

  const update = () => {
    frame = 0;
    root.classList.toggle("is-category-compact", window.scrollY > threshold);
  };

  const requestUpdate = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(update);
  };

  measure();
  update();
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", () => {
    measure();
    requestUpdate();
  }, { passive: true });
}
