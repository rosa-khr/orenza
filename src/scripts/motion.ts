export const initMotion = () => {
  const heroTransition = document.querySelector<HTMLElement>("[data-hero-transition]");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (heroTransition && !reducedMotion && window.matchMedia("(min-width: 700px)").matches) {
    let frame = 0;
    const updateHeroMotion = () => {
      frame = 0;
      const bounds = heroTransition.getBoundingClientRect();
      const distance = Math.max(0, -bounds.top);
      const scrollRange = Math.max(bounds.height - window.innerHeight, 1);
      const rawProgress = Math.min(1, distance / scrollRange);
      const progress = rawProgress * rawProgress * (3 - 2 * rawProgress);
      heroTransition.style.setProperty("--hero-layer-progress", progress.toFixed(3));
      heroTransition.classList.toggle("is-transition-complete", progress > 0.98);
    };
    const requestHeroUpdate = () => {
      if (frame) return;
      frame = requestAnimationFrame(updateHeroMotion);
    };

    updateHeroMotion();
    window.addEventListener("scroll", requestHeroUpdate, { passive: true });
    window.addEventListener("resize", requestHeroUpdate, { passive: true });
    window.addEventListener("pageshow", requestHeroUpdate);
    document.addEventListener("visibilitychange", requestHeroUpdate);
  }

  const footerTransition = document.querySelector<HTMLElement>("[data-footer-transition]");
  if (footerTransition && !reducedMotion && window.matchMedia("(min-width: 700px)").matches) {
    const preFooter = footerTransition.querySelector<HTMLElement>(".pre-footer");
    let frame = 0;
    const updateFooterMotion = () => {
      frame = 0;
      if (!preFooter) return;
      const bounds = footerTransition.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -bounds.top / Math.max(preFooter.offsetHeight, 1)));
      footerTransition.style.setProperty("--footer-layer-progress", progress.toFixed(3));
      footerTransition.classList.toggle("is-transition-complete", progress > 0.98);
    };
    const requestFooterUpdate = () => {
      if (frame) return;
      frame = requestAnimationFrame(updateFooterMotion);
    };

    updateFooterMotion();
    window.addEventListener("scroll", requestFooterUpdate, { passive: true });
    window.addEventListener("resize", requestFooterUpdate, { passive: true });
  }

  const items = [
    ...document.querySelectorAll<HTMLElement>(
      ".manifesto-copy, .manifesto-body, .atelier-header, .ritual-section > .eyebrow, .ritual-section > h2, .ritual-cards article, .contact-stage > div, .footer-main > *, .inner-hero > *, .story-content article, .contact-page-grid > a"
    )
  ];

  if (!items.length) return;

  if (reducedMotion || !("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-revealed"));
    return;
  }

  items.forEach((item, index) => {
    item.classList.add("reveal-ready");
    item.style.setProperty("--reveal-delay", `${Math.min(index % 3, 2) * 70}ms`);
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        (entry.target as HTMLElement).classList.add("is-revealed");
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.14, rootMargin: "0px 0px -7% 0px" }
  );

  items.forEach((item) => observer.observe(item));
};
