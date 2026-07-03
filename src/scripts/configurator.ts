import { initAtelier } from "./atelier";
import { initAccountHeader } from "./account-header";
import { initCart } from "./cart";
import { initMotion } from "./motion";

initCart();
initAtelier();
initMotion();
initAccountHeader();

document.addEventListener("pointerdown", (event) => {
  document.querySelectorAll<HTMLDetailsElement>(".nav-products[open]").forEach((menu) => {
    if (!menu.contains(event.target as Node)) menu.removeAttribute("open");
  });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    document.querySelectorAll<HTMLDetailsElement>(".nav-products[open]").forEach((menu) => menu.removeAttribute("open"));
  }
});
