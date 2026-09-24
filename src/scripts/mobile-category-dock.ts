export {};

const root = document.querySelector<HTMLElement>(".mobile-home-top");
const links = root?.querySelector<HTMLElement>("[data-mobile-quick-links]");
const spacer = root?.querySelector<HTMLElement>(".mobile-quick-links-spacer");

if (root && links && spacer && root.dataset.categoryDockReady !== "true") {
  root.dataset.categoryDockReady = "true";
  let frame = 0;
  let threshold = 0;
  const mobileViewport = window.matchMedia("(max-width: 699px)");

  const measure = () => {
    if (links.classList.contains("is-mobile-category-dock")) return;
    root.style.setProperty("--mobile-category-space", `${links.offsetHeight}px`);
    threshold = links.getBoundingClientRect().top + window.scrollY + Math.max(54, links.offsetHeight);
  };

  const setDocked = (docked: boolean) => {
    if (docked) {
      root.classList.add("is-category-compact");
      links.classList.add("is-mobile-category-dock");
      if (links.parentElement !== document.body) document.body.append(links);
      return;
    }
    root.classList.remove("is-category-compact");
    links.classList.remove("is-mobile-category-dock");
    if (links.parentElement !== root) root.insertBefore(links, spacer);
  };

  const update = () => {
    frame = 0;
    if (!mobileViewport.matches) {
      setDocked(false);
      measure();
      return;
    }
    setDocked(window.scrollY > threshold);
  };

  const requestUpdate = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(update);
  };

  measure();
  update();
  window.addEventListener("scroll", requestUpdate, { passive: true });
  window.addEventListener("resize", () => {
    if (!mobileViewport.matches) setDocked(false);
    measure();
    requestUpdate();
  }, { passive: true });
  window.visualViewport?.addEventListener("resize", requestUpdate, { passive: true });
}
