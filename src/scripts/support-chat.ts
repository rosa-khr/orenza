const chat = document.querySelector<HTMLElement>("[data-support-chat]");
const panel = chat?.querySelector<HTMLElement>("[data-support-chat-panel]");
const toggle = chat?.querySelector<HTMLButtonElement>("[data-support-chat-toggle]");
const closeButton = chat?.querySelector<HTMLButtonElement>("[data-support-chat-close]");

if (chat && panel && toggle) {
  const setOpen = (open: boolean) => {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    chat.classList.toggle("is-open", open);
  };

  toggle.addEventListener("click", () => setOpen(panel.hidden));
  closeButton?.addEventListener("click", () => setOpen(false));
  document.addEventListener("click", (event) => {
    if (!chat.contains(event.target as Node)) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });
}
