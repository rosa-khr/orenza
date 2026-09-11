import { ADD_TO_CART_EVENT, type CartItemInput } from "./order-types";
import { productDetailUrl, productSlug } from "./product-url";

type CategoryProduct = {
  id: string;
  titleFa: string;
  titleEn: string;
  description: string;
  blendType: string;
  categorySlug: string;
  roastType: "light" | "medium" | "mediumDark" | "dark";
  coffeeType: "bean" | "ground";
  saleType: "weighted" | "packaged";
  stockStatus: "inStock" | "outOfStock";
  packageWeightGrams: 250 | 500 | 1000;
  packagePrice: number | string;
  salePricePerKg: number | string;
  discountPercent?: number | string | null;
  discountSalePricePerKg?: number | string | null;
  pricePer250g: number | string;
  pricePer500g: number | string;
  pricePer1000g: number | string;
  imageUrl: string | null;
  showInDiscounts: boolean;
};

type CategoryInfo = {
  title: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  tags: { id: string; title: string; slug: string }[];
};

const renderTags = (container: HTMLElement | null, tags: CategoryInfo["tags"]) => {
  if (!container || !tags.length) return;
  tags.forEach((tag) => {
    const link = document.createElement("a");
    link.href = `/tags/${encodeURIComponent(tag.slug)}/`;
    link.textContent = `# ${tag.title}`;
    container.append(link);
  });
  container.closest<HTMLElement>("[data-category-tags]")?.removeAttribute("hidden");
};

const root = document.querySelector<HTMLElement>("[data-category-products]");
const list = root?.querySelector<HTMLElement>("[data-category-product-list]");
if (root && list) {
  const money = new Intl.NumberFormat("fa-IR");
  const percentFormat = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 });
  const directCartCategories = new Set(["cafe-drinks", "herbal-tea"]);
  const categorySlug = root.dataset.category || "";
  if (categorySlug) {
    fetch(`/api/v1/categories/${encodeURIComponent(categorySlug)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json() as Promise<{ item: CategoryInfo }>;
      })
      .then(({ item }) => {
        const content = document.querySelector<HTMLElement>("[data-category-content]");
        if (content && item.description?.trim()) {
          content.innerHTML = item.description.trim();
          content.hidden = false;
        }
        renderTags(document.querySelector<HTMLElement>("[data-category-tag-list]"), item.tags || []);
        if (!item.imageUrl) return;
        const hero = document.querySelector<HTMLElement>(`[data-category-hero][data-category-slug="${item.slug}"]`);
        const banner = hero?.querySelector<HTMLImageElement>("[data-category-hero-banner]");
        if (!hero || !banner) return;
        banner.src = item.imageUrl;
        banner.alt = `بنر ${item.title}`;
        banner.hidden = false;
        hero.classList.add("has-category-banner");
      })
      .catch(() => {
        // The category keeps its default editorial background when no banner is available.
      });
  }
  fetch(`/api/v1/products?category=${encodeURIComponent(root.dataset.category || "")}`)
    .then(async (response) => {
      if (!response.ok) throw new Error();
      return response.json() as Promise<{ items: CategoryProduct[] }>;
    })
    .then(({ items }) => {
      list.replaceChildren();
      items.forEach((product) => {
        const isPowderCategory =
          directCartCategories.has(root.dataset.category || "") || directCartCategories.has(product.categorySlug);
        const article = document.createElement("article");
        const eyebrow = document.createElement("span");
        const title = document.createElement("h3");
        const titleLink = document.createElement("a");
        const description = document.createElement("p");
        const footer = document.createElement("div");
        const blend = document.createElement("small");
        const price = document.createElement("strong");
        price.className = "category-product-price";
        const detailUrl = productDetailUrl(product);
        const media = document.createElement("a");
        const detailLink = document.createElement("a");
        media.className = "category-product-media";
        media.href = detailUrl;
        media.setAttribute("aria-label", `مشاهده ${product.titleFa}`);
        if (product.imageUrl) {
          const image = document.createElement("img");
          image.src = product.imageUrl;
          image.alt = product.titleFa;
          image.loading = "lazy";
          media.append(image);
        } else {
          const placeholder = document.createElement("span");
          placeholder.textContent = "ORENZA";
          media.append(placeholder);
        }
        eyebrow.textContent = product.titleEn;
        titleLink.href = detailUrl;
        titleLink.textContent = product.titleFa;
        title.append(titleLink);
        description.textContent = product.description;
        blend.textContent = product.blendType;
        detailLink.className = "category-product-detail-link";
        detailLink.href = detailUrl;
        detailLink.textContent = "مشاهده جزئیات محصول";
        article.classList.add("category-purchasable");
        if (product.stockStatus === "outOfStock") {
          article.classList.add("is-out-of-stock");
          const unavailable = document.createElement("span");
          unavailable.className = "category-stock-label";
          unavailable.textContent = "ناموجود";
          price.textContent = "فعلاً امکان سفارش این محصول نیست";
          footer.append(blend, price, unavailable, detailLink);
          article.append(media, eyebrow, title, description, footer);
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
        const regularPrice = (weight: 250 | 500 | 1000) =>
          product.saleType === "packaged"
            ? Number(product.packagePrice || product.salePricePerKg || 0)
            : Math.round(Number(product.salePricePerKg || 0) * weight / 1000);
        const discountPrice = (weight: 250 | 500 | 1000) => {
          const unitDiscount = Number(product.discountSalePricePerKg || 0);
          if (unitDiscount > 0) return product.saleType === "packaged" ? unitDiscount : Math.round(unitDiscount * weight / 1000);
          const percent = Number(product.discountPercent || 0);
          return percent > 0 && percent < 100 ? Math.round(regularPrice(weight) * (1 - percent / 100)) : regularPrice(weight);
        };
        const priceInfo = (weight: 250 | 500 | 1000) => {
          const regular = regularPrice(weight);
          const discounted = discountPrice(weight);
          const savedPercent = Number(product.discountPercent || 0);
          const percent = savedPercent > 0
            ? savedPercent
            : regular > discounted
              ? Math.round(((regular - discounted) / regular) * 100)
              : 0;
          return {
            regular,
            final: product.showInDiscounts && discounted > 0 && discounted < regular ? discounted : regular,
            percent
          };
        };
        const productPrice = (weight: 250 | 500 | 1000) => priceInfo(weight).final;
        const renderPrice = (weight: 250 | 500 | 1000, includeWeight: boolean) => {
          const info = priceInfo(weight);
          const hasDiscount = product.showInDiscounts && info.final < info.regular && info.percent > 0;
          price.classList.toggle("has-category-discount", hasDiscount);
          price.replaceChildren();
          if (hasDiscount) {
            const line = document.createElement("span");
            line.className = "category-discount-line";
            const oldPrice = document.createElement("del");
            oldPrice.textContent = `${money.format(info.regular)} تومان`;
            const badge = document.createElement("em");
            badge.textContent = `${percentFormat.format(info.percent)}٪`;
            line.append(oldPrice, badge);
            price.append(line);
          }
          const current = document.createElement("b");
          current.textContent = `${includeWeight ? `${weightLabels[weight]} · ` : ""}${money.format(info.final)} تومان`;
          price.append(current);
        };
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
            renderPrice(selectedWeight, true);
            weights.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
              const selected = Number(button.dataset.weight) === selectedWeight;
              button.classList.toggle("is-selected", selected);
              button.setAttribute("aria-pressed", String(selected));
            });
          };
          actionButton.textContent = isPowderCategory ? "افزودن به سبد" : "ادامه و انتخاب رُست";
          actionButton.addEventListener("click", () => {
            if (isPowderCategory) addPackagedToCart();
            else location.href = `/order/?product=${encodeURIComponent(productSlug(product.titleEn))}&weight=${selectedWeight}`;
          });
          controls.append(weights, actionButton);
          update();
        } else {
          const packageLabel = document.createElement("span");
          packageLabel.className = "category-package-label";
          packageLabel.textContent = `بسته ${weightLabels[selectedWeight]}`;
          renderPrice(selectedWeight, false);
          actionButton.textContent = "افزودن بسته به سبد";
          actionButton.addEventListener("click", addPackagedToCart);
          controls.append(packageLabel, actionButton);
        }
        footer.append(blend, price, controls, detailLink);
        article.append(media, eyebrow, title, description, footer);
        list.append(article);
      });
      if (!items.length) list.innerHTML = "<p>محصول فعالی در این مجموعه وجود ندارد.</p>";
    })
    .catch(() => { list.innerHTML = "<p>دریافت محصولات ممکن نشد؛ کمی بعد دوباره تلاش کنید.</p>"; });
}
