import { ADD_TO_CART_EVENT, type CartItemInput } from "./order-types";
import { productDetailUrl } from "./product-url";

type RailProduct = {
  id: string;
  titleFa: string;
  titleEn: string;
  description: string;
  blendType: string;
  roastType: "light" | "medium" | "mediumDark" | "dark";
  coffeeType: "bean" | "ground";
  saleType: "weighted" | "packaged";
  packageWeightGrams: 250 | 500 | 1000;
  stockStatus: "inStock" | "outOfStock";
  packagePrice: number | string;
  salePricePerKg: number | string;
  pricePer250g: number | string;
  imageUrl: string | null;
  showInBestSellers: boolean;
  showInDiscounts: boolean;
};

const money = new Intl.NumberFormat("fa-IR");
const weights = { 250: "۲۵۰ گرم", 500: "۵۰۰ گرم", 1000: "۱ کیلوگرم" } as const;
const roastLabels = { light: "روشن", medium: "متوسط", mediumDark: "متوسط رو به تیره", dark: "تیره" };
const cartIcon = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 3h2l2.4 10.2a2 2 0 0 0 2 1.5h7.8a2 2 0 0 0 1.9-1.4L21 7H6.2M10 19.5h.01M18 19.5h.01" />
  </svg>`;

const card = (product: RailProduct, offer: boolean) => {
  const article = document.createElement("article");
  article.className = "rail-product-card";
  const weight = product.saleType === "packaged" ? product.packageWeightGrams : 250;
  const price = product.saleType === "packaged"
    ? Number(product.packagePrice || product.salePricePerKg || 0)
    : Number(product.pricePer250g || 0);
  const url = productDetailUrl(product);
  article.innerHTML = `
    <a class="rail-product-media" href="${url}" aria-label="مشاهده ${product.titleFa}">
      ${product.imageUrl
        ? `<img src="${product.imageUrl}" alt="${product.titleFa}" loading="lazy">`
        : `<img src="/images/orenza-bag-mockup-v3.webp" alt="بسته‌بندی ${product.titleFa}" loading="lazy">`}
      ${offer ? '<i>پیشنهاد ویژه</i>' : '<i>پرفروش</i>'}
    </a>
    <div class="rail-product-copy">
      <small>${product.titleEn}</small>
      <h3><a href="${url}">${product.titleFa}</a></h3>
      <p>${product.blendType}</p>
      <footer>
        <div><b>${money.format(price)} تومان</b><span>${weights[weight]}</span></div>
        <button class="rail-cart-button" type="button"
          aria-label="${product.stockStatus === "outOfStock" ? "محصول ناموجود است" : `افزودن ${product.titleFa} به سبد خرید`}"
          title="${product.stockStatus === "outOfStock" ? "ناموجود" : "افزودن به سبد خرید"}"
          ${product.stockStatus === "outOfStock" ? "disabled" : ""}>
          ${product.stockStatus === "outOfStock" ? '<span class="rail-cart-unavailable">ناموجود</span>' : cartIcon}
        </button>
      </footer>
    </div>`;
  article.querySelector("button")?.addEventListener("click", (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    const item: CartItemInput = {
      productId: product.id,
      productTitle: product.titleFa,
      blend: product.blendType,
      roast: roastLabels[product.roastType],
      grind: product.coffeeType === "ground" ? "پودر آماده" : "دان کامل",
      weight: weights[weight],
      weightGrams: weight,
      quantity: 1,
      unitPrice: price,
      totalPrice: price
    };
    document.dispatchEvent(new CustomEvent(ADD_TO_CART_EVENT, { detail: item }));
    button.classList.add("is-added");
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>';
    button.setAttribute("aria-label", `${product.titleFa} به سبد خرید اضافه شد`);
    window.setTimeout(() => {
      button.classList.remove("is-added");
      button.innerHTML = cartIcon;
      button.setAttribute("aria-label", `افزودن ${product.titleFa} به سبد خرید`);
    }, 1600);
  });
  return article;
};

const renderRail = (kind: "best" | "discount", products: RailProduct[]) => {
  const root = document.querySelector<HTMLElement>(`[data-product-rail="${kind}"]`);
  const track = root?.querySelector<HTMLElement>("[data-product-rail-track]");
  if (!root || !track || !products.length) return;
  const loopProducts = Array.from({ length: Math.max(products.length, 5) }, (_, index) => products[index % products.length]);
  const makeGroup = () => {
    const group = document.createElement("div");
    group.className = "product-rail-group";
    loopProducts.forEach((product) => group.append(card(product, kind === "discount")));
    return group;
  };
  track.replaceChildren(makeGroup(), makeGroup());
  root.hidden = false;
};

void fetch("/api/v1/products")
  .then(async (response) => {
    if (!response.ok) throw new Error();
    return response.json() as Promise<{ items: RailProduct[] }>;
  })
  .then(({ items }) => {
    renderRail("best", items.filter((item) => item.showInBestSellers));
    renderRail("discount", items.filter((item) => item.showInDiscounts));
  })
  .catch(() => undefined);
