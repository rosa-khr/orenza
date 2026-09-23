export const initHeaderScroll = () => {
  const header = document.querySelector<HTMLElement>(".site-header");
  if (!header || header.dataset.scrollFeedbackReady === "true") return;
  header.dataset.scrollFeedbackReady = "true";

  let frame = 0;
  const update = () => {
    frame = 0;
    header.classList.toggle("is-page-scrolled", window.scrollY > 16);
  };
  const requestUpdate = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(update);
  };

  update();
  window.addEventListener("scroll", requestUpdate, { passive: true });
};
