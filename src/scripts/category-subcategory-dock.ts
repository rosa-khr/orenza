export const initCategorySubcategoryDock = () => {
  const root = document.querySelector<HTMLElement>("[data-category-children]");
  const links = root?.querySelector<HTMLElement>("[data-category-child-list]");
  if (!root || !links || root.dataset.subcategoryDockReady === "true") return;

  root.dataset.subcategoryDockReady = "true";
  const spacer = document.createElement("div");
  spacer.className = "category-subcategory-spacer";
  spacer.setAttribute("aria-hidden", "true");
  links.after(spacer);

  let frame = 0;
  let threshold = 0;
  const mobileViewport = window.matchMedia("(max-width: 699px)");

  const measure = () => {
    if (links.classList.contains("is-category-subcategory-dock")) return;
    root.style.setProperty("--category-subcategory-space", `${links.offsetHeight}px`);
    threshold = links.getBoundingClientRect().top + window.scrollY + Math.max(48, links.offsetHeight);
  };

  const setDocked = (docked: boolean) => {
    if (docked) {
      root.classList.add("is-subcategory-compact");
      links.classList.add("is-category-subcategory-dock");
      if (links.parentElement !== document.body) document.body.append(links);
      return;
    }
    root.classList.remove("is-subcategory-compact");
    links.classList.remove("is-category-subcategory-dock");
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
};
