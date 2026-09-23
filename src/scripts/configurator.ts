import { initAtelier } from "./atelier";
import { initAccountHeader } from "./account-header";
import { initCart } from "./cart";
import { initHeaderSearch } from "./header-search";
import { initHeaderScroll } from "./header-scroll";
import { initMotion } from "./motion";

initAccountHeader();
initCart();
initHeaderSearch();
initHeaderScroll();
initAtelier();
initMotion();

document.addEventListener("pointerdown", (event) => {
  document.querySelectorAll<HTMLElement>(".nav-products.is-open").forEach((menu) => {
    if (!menu.contains(event.target as Node)) menu.classList.remove("is-open");
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    document.querySelectorAll<HTMLElement>(".nav-products.is-open").forEach((menu) => menu.classList.remove("is-open"));
  }
});
