export const initMotion = () => {
  const items = [
    ...document.querySelectorAll<HTMLElement>(
      ".manifesto-copy, .manifesto-body, .atelier-header, .ritual-section > .eyebrow, .ritual-section > h2, .ritual-cards article, .contact-stage > div, .footer-main > *, .inner-hero > *, .story-content article, .contact-page-grid > a"
    )
  ];

  if (!items.length) return;

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
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
