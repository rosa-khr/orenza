import { ADD_TO_CART_EVENT, type CartItemInput } from "./order-types";

type CategoryProduct = {
  id: string;
  titleFa: string;
  titleEn: string;
  description: string;
  blendType: string;
  roastType: "light" | "medium" | "mediumDark" | "dark";
  coffeeType: "bean" | "ground";
  saleType: "weighted" | "packaged";
  stockStatus: "inStock" | "outOfStock";
  packageWeightGrams: 250 | 500 | 1000;
  packagePrice: number | string;
  salePricePerKg: number | string;
  pricePer250g: number | string;
  pricePer500g: number | string;
  pricePer1000g: number | string;
};

const root = document.querySelector<HTMLElement>("[data-category-products]");
const list = root?.querySelector<HTMLElement>("[data-category-product-list]");
if (root && list) {
  const money = new Intl.NumberFormat("fa-IR");
  fetch(`/api/v1/products?category=${encodeURIComponent(root.dataset.category || "")}`)
    .then(async (response) => {
      if (!response.ok) throw new Error();
      return response.json() as Promise<{ items: CategoryProduct[] }>;
    })
    .then(({ items }) => {
      list.replaceChildren();
      const isPowderCategory = root.dataset.category === "cafe-drinks";
      items.forEach((product) => {
        const article = document.createElement("article");
        const eyebrow = document.createElement("span");
        const title = document.createElement("h3");
        const description = document.createElement("p");
        const footer = document.createElement("div");
        const blend = document.createElement("small");
        const price = document.createElement("strong");
        eyebrow.textContent = product.titleEn;
        title.textContent = product.titleFa;
        description.textContent = product.description;
        blend.textContent = product.blendType;
        article.classList.add("category-purchasable");
        if (product.stockStatus === "outOfStock") {
          article.classList.add("is-out-of-stock");
          const unavailable = document.createElement("span");
          unavailable.className = "category-stock-label";
          unavailable.textContent = "ناموجود";
          price.textContent = "فعلاً امکان سفارش این محصول نیست";
          footer.append(blend, price, unavailable);
          article.append(eyebrow, title, description, footer);
          list.append(article);
          return;
        }
        let selectedWeight: 250 | 500 | 1000 = product.saleType === "packaged"
          ? product.packageWeightGrams
          : 250;
        const weightLabels: Record<250 | 500 | 1000, string> = {
          250: "۲۵۰ گرم",
          500: "۵۰۰ گرم",
          1000: "۱ کیلوگرم"
        };
        const roastLabels = {
          light: "روشن",
          medium: "متوسط",
          mediumDark: "متوسط رو به تیره",
          dark: "تیره"
        };
        const productPrice = (weight: 250 | 500 | 1000) =>
          product.saleType === "packaged"
            ? Number(product.packagePrice || product.salePricePerKg || 0)
            : Number(product[`pricePer${weight}g` as keyof CategoryProduct] || 0);
        const controls = document.createElement("div");
        controls.className = "category-buy-controls";
        const weights = document.createElement("div");
        weights.className = "category-weight-options";
        weights.setAttribute("aria-label", `انتخاب وزن ${product.titleFa}`);
        const actionButton = document.createElement("button");
        actionButton.className = "category-add-cart";
        actionButton.type = "button";

        const addPackagedToCart = () => {
          const unitPrice = productPrice(selectedWeight);
          const item: CartItemInput = {
            productId: product.id,
            productTitle: product.titleFa,
            blend: product.blendType,
            roast: roastLabels[product.roastType] || "بدون رُست",
            grind: product.coffeeType === "ground" ? "پودر آماده" : "دان کامل",
            weight: weightLabels[selectedWeight],
            weightGrams: selectedWeight,
            quantity: 1,
            unitPrice,
            totalPrice: unitPrice
          };
          document.dispatchEvent(new CustomEvent(ADD_TO_CART_EVENT, { detail: item }));
          actionButton.textContent = "به سبد اضافه شد ✓";
        };

        if (product.saleType === "weighted") {
          ([250, 500, 1000] as const).forEach((weight) => {
            const button = document.createElement("button");
            button.type = "button";
            button.dataset.weight = String(weight);
            button.textContent = weightLabels[weight];
            button.addEventListener("click", () => {
              selectedWeight = weight;
              actionButton.textContent = isPowderCategory ? "افزودن به سبد" : "ادامه و انتخاب رُست";
              update();
            });
            weights.append(button);
          });
          const update = () => {
            price.textContent = `${weightLabels[selectedWeight]} · ${money.format(productPrice(selectedWeight))} تومان`;
            weights.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
              const selected = Number(button.dataset.weight) === selectedWeight;
              button.classList.toggle("is-selected", selected);
              button.setAttribute("aria-pressed", String(selected));
            });
          };
          actionButton.textContent = isPowderCategory ? "افزودن به سبد" : "ادامه و انتخاب رُست";
          actionButton.addEventListener("click", () => {
            if (isPowderCategory) addPackagedToCart();
            else location.href = `/order/?product=${encodeURIComponent(product.id)}&weight=${selectedWeight}`;
          });
          controls.append(weights, actionButton);
          update();
        } else {
          const packageLabel = document.createElement("span");
          packageLabel.className = "category-package-label";
          packageLabel.textContent = `بسته ${weightLabels[selectedWeight]}`;
          price.textContent = `${money.format(productPrice(selectedWeight))} تومان`;
          actionButton.textContent = "افزودن بسته به سبد";
          actionButton.addEventListener("click", addPackagedToCart);
          controls.append(packageLabel, actionButton);
        }
        footer.append(blend, price, controls);
        article.append(eyebrow, title, description, footer);
        list.append(article);
      });
      if (!items.length) list.innerHTML = "<p>محصول فعالی در این مجموعه وجود ندارد.</p>";
    })
    .catch(() => { list.innerHTML = "<p>دریافت محصولات ممکن نشد؛ کمی بعد دوباره تلاش کنید.</p>"; });
}
