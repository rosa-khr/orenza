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
  discountPercent?: number | string | null;
  discountSalePricePerKg?: number | string | null;
  imageUrl: string | null;
  showInBestSellers: boolean;
  showInDiscounts: boolean;
};

const money = new Intl.NumberFormat("fa-IR");
const percentFormat = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 });
const card = (product: RailProduct, kind: "best" | "discount") => {
  const article = document.createElement("article");
  article.className = "rail-product-card";
  const regularPrice = product.saleType === "packaged"
    ? Number(product.packagePrice || product.salePricePerKg || 0)
    : Number(product.pricePer250g || 0);
  const discountedUnitPrice = Number(product.discountSalePricePerKg || 0);
  const storedPercent = Number(product.discountPercent || 0);
  const discountedPrice = discountedUnitPrice > 0
    ? (product.saleType === "packaged" ? discountedUnitPrice : Math.round(discountedUnitPrice * 0.25))
    : storedPercent > 0 && storedPercent < 100
      ? Math.round(regularPrice * (1 - storedPercent / 100))
      : regularPrice;
  const discountPercent = storedPercent > 0
    ? storedPercent
    : regularPrice > discountedPrice
      ? Math.round(((regularPrice - discountedPrice) / regularPrice) * 100)
      : 0;
  const hasDiscount = product.showInDiscounts && regularPrice > discountedPrice && discountPercent > 0;
  const price = hasDiscount ? discountedPrice : regularPrice;
  const url = productDetailUrl(product);
  article.innerHTML = `
    <a class="rail-product-media" href="${url}" aria-label="مشاهده ${product.titleFa}">
      <i class="rail-product-highlight">${kind === "best" ? "پرفروش" : "شگفت‌انگیز"}</i>
      ${product.imageUrl
        ? `<img src="${product.imageUrl}" alt="${product.titleFa}" loading="lazy">`
        : `<img src="/images/orenza-bag-mockup-v3.webp" alt="بسته‌بندی ${product.titleFa}" loading="lazy">`}
    </a>
    <div class="rail-product-copy">
      <h3><a href="${url}">${product.titleFa}</a></h3>
      <footer>
        <div class="rail-product-price">
          <b>${money.format(price)} تومان</b>
          ${hasDiscount ? `<em class="rail-discount-line"><del>${money.format(regularPrice)}</del><strong>${percentFormat.format(discountPercent)}٪</strong></em>` : ""}
        </div>
      </footer>
    </div>`;
  return article;
};

const enableRailDrag = (viewport: HTMLElement) => {
  if (viewport.dataset.dragReady) return;
  viewport.dataset.dragReady = "true";
  let isDown = false;
  let didMove = false;
  let startX = 0;
  let scrollStart = 0;
  let resumeTimer = 0;
  let glideFrame = 0;
  let lastX = 0;
  let lastMoveAt = 0;
  let velocity = 0;
  const stopGlide = () => {
    window.cancelAnimationFrame(glideFrame);
    glideFrame = 0;
    viewport.classList.remove("is-gliding");
  };
  viewport.addEventListener("pointerdown", (event) => {
    if (event.pointerType !== "mouse") return;
    if (event.button !== 0) return;
    if ((event.target as HTMLElement).closest("button")) return;
    window.clearTimeout(resumeTimer);
    stopGlide();
    isDown = true;
    didMove = false;
    viewport.dataset.userDragging = "true";
    startX = event.clientX;
    scrollStart = viewport.scrollLeft;
    lastX = event.clientX;
    lastMoveAt = performance.now();
    velocity = 0;
    viewport.classList.add("is-dragging");
    viewport.setPointerCapture(event.pointerId);
  });
  viewport.addEventListener("pointermove", (event) => {
    if (!isDown) return;
    const delta = event.clientX - startX;
    if (Math.abs(delta) > 4) {
      didMove = true;
      event.preventDefault();
    }
    viewport.scrollLeft = scrollStart + delta;
    const now = performance.now();
    const elapsed = Math.max(1, now - lastMoveAt);
    velocity = ((event.clientX - lastX) / elapsed) * 16;
    lastX = event.clientX;
    lastMoveAt = now;
  });
  const endDrag = (event: PointerEvent) => {
    if (!isDown) return;
    isDown = false;
    resumeTimer = window.setTimeout(() => {
      viewport.dataset.userDragging = "false";
    }, 1200);
    viewport.classList.remove("is-dragging");
    if (viewport.hasPointerCapture(event.pointerId)) viewport.releasePointerCapture(event.pointerId);
    if (!didMove || matchMedia("(prefers-reduced-motion: reduce)").matches || Math.abs(velocity) < .35) return;
    viewport.classList.add("is-gliding");
    const glide = () => {
      const previous = viewport.scrollLeft;
      viewport.scrollLeft += velocity;
      velocity *= .92;
      if (Math.abs(velocity) < .2 || viewport.scrollLeft === previous) {
        stopGlide();
        return;
      }
      glideFrame = window.requestAnimationFrame(glide);
    };
    glideFrame = window.requestAnimationFrame(glide);
  };
  viewport.addEventListener("pointerup", endDrag);
  viewport.addEventListener("pointercancel", endDrag);
  viewport.addEventListener("click", (event) => {
    if (!didMove) return;
    event.preventDefault();
    event.stopPropagation();
    didMove = false;
  }, true);
};

const renderRail = (kind: "best" | "discount", products: RailProduct[]) => {
  const enabledKey = kind === "best" ? "homepageBestSellersEnabled" : "homepageDiscountsEnabled";
  if (document.documentElement.dataset[enabledKey] === "false") return;
  const root = document.querySelector<HTMLElement>(`[data-product-rail="${kind}"]`);
  const track = root?.querySelector<HTMLElement>("[data-product-rail-track]");
  const viewport = root?.querySelector<HTMLElement>(".product-rail-viewport");
  if (!root || !track || !viewport || !products.length) return;
  const allProductsUrl = kind === "best"
    ? "/products/?collection=best#all-products"
    : "/products/?collection=discount#all-products";
  const makeGroup = () => {
    const group = document.createElement("div");
    group.className = "product-rail-group";
    products.forEach((product) => group.append(card(product, kind)));
    const viewAll = document.createElement("a");
    viewAll.className = "rail-view-all-card";
    viewAll.href = allProductsUrl;
    viewAll.innerHTML = '<span aria-hidden="true">←</span><strong>مشاهده همه</strong>';
    group.append(viewAll);
    return group;
  };
  track.replaceChildren(makeGroup());
  enableRailDrag(viewport);
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
