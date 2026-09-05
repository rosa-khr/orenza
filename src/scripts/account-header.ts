export const initAccountHeader = () => {
  if (document.documentElement.dataset.accountHeaderReady === "true") return;
  document.documentElement.dataset.accountHeaderReady = "true";

  const name = document.querySelector<HTMLElement>("[data-header-account-name]");
  const mobileName = document.querySelector<HTMLElement>("[data-mobile-account-name]");
  const mobileLogin = document.querySelector<HTMLAnchorElement>(".mobile-login-link");
  const mobileNav = document.querySelector<HTMLElement>("[data-mobile-nav]");
  const openMobileNav = document.querySelector<HTMLButtonElement>("[data-mobile-nav-open]");
  const closeMobileNavButtons = document.querySelectorAll<HTMLButtonElement>("[data-mobile-nav-close]");
  let lastFocusedElement: HTMLElement | null = null;

  const closeMobileAccordions = (except?: HTMLButtonElement) => {
    mobileNav?.querySelectorAll<HTMLButtonElement>("[data-mobile-accordion]").forEach((button) => {
      if (button === except) return;
      button.setAttribute("aria-expanded", "false");
      const panel = button.nextElementSibling;
      if (panel instanceof HTMLElement) panel.hidden = true;
    });
  };

  const openDrawer = () => {
    if (!mobileNav) return;
    lastFocusedElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    mobileNav.hidden = false;
    mobileNav.setAttribute("aria-hidden", "false");
    openMobileNav?.setAttribute("aria-expanded", "true");
    document.body.classList.add("mobile-nav-is-open");
    requestAnimationFrame(() => {
      mobileNav.classList.add("is-open");
      mobileNav.querySelector<HTMLButtonElement>("[data-mobile-nav-close]")?.focus();
    });
  };

  const closeDrawer = () => {
    if (!mobileNav) return;
    mobileNav.classList.remove("is-open");
    mobileNav.setAttribute("aria-hidden", "true");
    openMobileNav?.setAttribute("aria-expanded", "false");
    closeMobileAccordions();
    document.body.classList.remove("mobile-nav-is-open");
    window.setTimeout(() => {
      mobileNav.hidden = true;
      lastFocusedElement?.focus();
    }, 280);
  };

  openMobileNav?.addEventListener("click", openDrawer);
  closeMobileNavButtons.forEach((button) => button.addEventListener("click", closeDrawer));
  mobileNav?.addEventListener("click", (event) => {
    const link = (event.target as HTMLElement).closest("a[href]");
    if (link) {
      closeDrawer();
      return;
    }
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-mobile-accordion]");
    if (button) {
      const panel = button.nextElementSibling;
      if (!(panel instanceof HTMLElement)) return;
      const willOpen = button.getAttribute("aria-expanded") !== "true";
      closeMobileAccordions(button);
      button.setAttribute("aria-expanded", String(willOpen));
      panel.hidden = !willOpen;
    }
  });

  document.addEventListener("click", (event) => {
    const productToggle = (event.target as HTMLElement).closest<HTMLButtonElement>(".nav-products-toggle");
    if (!productToggle) return;
    const productMenu = productToggle.closest<HTMLElement>(".nav-products");
    const isOpen = productMenu?.classList.toggle("is-open") ?? false;
    document.querySelectorAll<HTMLElement>(".nav-products.is-open").forEach((menu) => {
      if (menu !== productMenu) {
        menu.classList.remove("is-open");
        menu.querySelector<HTMLButtonElement>(".nav-products-toggle")?.setAttribute("aria-expanded", "false");
      }
    });
    productToggle.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("pointerdown", (event) => {
    document.querySelectorAll<HTMLElement>(".nav-products.is-open").forEach((menu) => {
      if (menu.contains(event.target as Node)) return;
      menu.classList.remove("is-open");
      menu.querySelector<HTMLButtonElement>(".nav-products-toggle")?.setAttribute("aria-expanded", "false");
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closeDrawer();
    document.querySelectorAll<HTMLElement>(".nav-products.is-open").forEach((menu) => {
      menu.classList.remove("is-open");
      menu.querySelector<HTMLButtonElement>(".nav-products-toggle")?.setAttribute("aria-expanded", "false");
    });
  });

  if (!name && !mobileName) return;

  fetch("/api/v1/me", { credentials: "include" })
    .then(async (response) => {
      if (!response.ok) return null;
      return response.json();
    })
    .then((payload) => {
      if (!payload?.user) {
        if (name) name.textContent = "ورود";
        if (mobileName) mobileName.textContent = "حساب کاربری";
        if (mobileLogin) mobileLogin.hidden = false;
        return;
      }
      const displayName = String(payload?.user?.displayName || "").trim();
      const shortName = displayName ? displayName.split(/\s+/)[0] : "حساب من";
      if (name) name.textContent = shortName;
      if (mobileName) mobileName.textContent = displayName || "حساب کاربری شما";
      if (mobileLogin) mobileLogin.hidden = true;
    })
    .catch(() => {
      if (name) name.textContent = "ورود";
      if (mobileName) mobileName.textContent = "حساب کاربری";
      if (mobileLogin) mobileLogin.hidden = false;
    });
};
