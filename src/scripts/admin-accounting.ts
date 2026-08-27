const form = document.querySelector<HTMLFormElement>("[data-accounting-form]");
const purchase = form?.elements.namedItem("purchase") as HTMLInputElement | null;
const markup = form?.elements.namedItem("markup") as HTMLInputElement | null;
const sale = document.querySelector<HTMLElement>("[data-accounting-sale]");
const profit = document.querySelector<HTMLElement>("[data-accounting-profit]");
const money = new Intl.NumberFormat("fa-IR");

const numberValue = (value: string) => Number(value.replace(/[٬,\s]/g, "").replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit))) || 0);
const render = () => {
  const purchaseValue = numberValue(purchase?.value || "");
  const markupValue = Number(markup?.value || 0);
  const saleValue = Math.round(purchaseValue * (1 + markupValue / 100));
  if (sale) sale.textContent = saleValue ? money.format(saleValue) : "—";
  if (profit) profit.textContent = purchaseValue && saleValue ? money.format(saleValue - purchaseValue) : "—";
};

purchase?.addEventListener("input", render);
markup?.addEventListener("input", render);
purchase?.addEventListener("blur", () => { if (purchase.value) purchase.value = money.format(numberValue(purchase.value)); });
render();
