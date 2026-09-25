import {
  ADD_TO_CART_EVENT,
  CART_UPDATED_EVENT,
  CHANGE_CART_QUANTITY_EVENT,
  cartSelectionKey,
  type CartItem,
  type CartItemInput,
  type CartQuantityChange
} from "./order-types";
import { productDetailUrl, productSlug } from "./product-url";

type ProductDetail = {
  id: string;
  slug?: string | null;
  titleFa: string;
  titleEn: string;
  description: string;
  productContent: string | null;
  imageUrl: string | null;
  productImageUrls?: string[];
  blendType: string | null;
  productType?: "coffee" | "herbalTea" | "instantDrink" | "food" | "other";
  categorySlug: string;
  roastType: "light" | "medium" | "mediumDark" | "dark" | null;
  coffeeType: "bean" | "ground" | null;
  saleType: "weighted" | "packaged";
  stockStatus: "inStock" | "outOfStock";
  packageWeightGrams: number;
  availableWeightsGrams?: number[];
  packagePrice: number | string;
  salePricePerKg: number | string;
  discountPercent?: number | string | null;
  discountSalePricePerKg?: number | string | null;
  canonicalUrl?: string | null;
  robotsIndex?: boolean;
  robotsFollow?: boolean;
  pricePer250g: number | string;
  pricePer500g: number | string;
  pricePer1000g: number | string;
  tags: { id: string; title: string; slug: string }[];
  relatedProducts: RelatedProduct[];
  showInDiscounts: boolean;
};

type RelatedProduct = {
  id: string;
  slug?: string | null;
  titleFa: string;
  titleEn: string;
  description: string;
  productType?: "coffee" | "herbalTea" | "instantDrink" | "food" | "other";
  blendType: string | null;
  roastType: "light" | "medium" | "mediumDark" | "dark" | null;
  coffeeType: "bean" | "ground" | null;
  saleType: "weighted" | "packaged";
  stockStatus: "inStock" | "outOfStock";
  packageWeightGrams: number;
  availableWeightsGrams?: number[];
  packagePrice: number | string;
  salePricePerKg: number | string;
  discountPercent?: number | string | null;
  discountSalePricePerKg?: number | string | null;
  productImageUrls?: string[];
  showInDiscounts: boolean;
  categorySlug: string;
  imageUrl: string | null;
};

const root = document.querySelector<HTMLElement>("[data-product-detail]");
const id = new URLSearchParams(location.search).get("id");
const pathSlug = decodeURIComponent(location.pathname.split("/").filter(Boolean).at(-1) || "");
const money = new Intl.NumberFormat("fa-IR");
const percentFormat = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 });
const weightLabels: Record<250 | 500 | 1000, string> = {
  250: "۲۵۰ گرم",
  500: "۵۰۰ گرم",
  1000: "۱ کیلوگرم"
};
const weightLabel = (weight: number) => weightLabels[weight as 250 | 500 | 1000] || `${money.format(weight)} گرم`;
const roastLabels = {
  light: "روشن",
  medium: "متوسط",
  mediumDark: "متوسط رو به تیره",
  dark: "تیره"
};
const cartIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3h2l2.4 10.2a2 2 0 0 0 2 1.5h7.8a2 2 0 0 0 1.9-1.4L21 7H6.2M10 19.5h.01M18 19.5h.01" /></svg>`;

const readCart = (): CartItem[] => {
  try {
    const items = JSON.parse(localStorage.getItem("orenza-cart") || "[]");
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
};

const syncRelatedCartControls = (items: CartItem[] = readCart()) => {
  document.querySelectorAll<HTMLElement>(".related-products .rail-cart-control").forEach((control) => {
    const quantity = items
      .filter((item) => encodeURIComponent(cartSelectionKey(item)) === control.dataset.cartKey)
      .reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const add = control.querySelector<HTMLButtonElement>(".rail-cart-button");
    const stepper = control.querySelector<HTMLElement>(".rail-cart-stepper");
    const output = control.querySelector<HTMLOutputElement>("output");
    if (add) add.hidden = quantity > 0;
    if (stepper) stepper.hidden = quantity <= 0;
    if (output) output.value = money.format(quantity);
    control.closest("footer")?.classList.toggle("has-cart-quantity", quantity > 0);
  });
};

const renderRelatedProductCard = (product: RelatedProduct) => {
  const article = document.createElement("article");
  article.className = "related-product-card rail-product-card";
  const firstWeight = product.saleType === "packaged"
    ? Number(product.packageWeightGrams || 250)
    : [...new Set((product.availableWeightsGrams || [250]).map(Number).filter((weight) => Number.isInteger(weight) && weight > 0))].sort((a, b) => a - b)[0] || 250;
  const regularPrice = product.saleType === "packaged"
    ? Number(product.packagePrice || product.salePricePerKg || 0)
    : Math.round(Number(product.salePricePerKg || 0) * firstWeight / 1000);
  const discountedUnitPrice = Number(product.discountSalePricePerKg || 0);
  const storedPercent = Number(product.discountPercent || 0);
  const discountedPrice = discountedUnitPrice > 0
    ? (product.saleType === "packaged" ? discountedUnitPrice : Math.round(discountedUnitPrice * firstWeight / 1000))
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
  const grind = product.productType === "coffee" ? (product.coffeeType === "ground" ? "پودر آماده" : "دان کامل") : "آماده مصرف";
  const selection = {
    productId: product.id,
    blend: product.blendType || "محصول اورنزا",
    roast: product.roastType ? roastLabels[product.roastType] : "بدون رُست",
    grind,
    weightGrams: firstWeight
  };
  const cartKey = encodeURIComponent(cartSelectionKey({ ...selection, delta: 1 }));
  const url = productDetailUrl(product);
  const productImageUrl = product.imageUrl
    || product.productImageUrls?.find((imageUrl) => Boolean(imageUrl?.trim()));
  const productVisual = productImageUrl
    ? `<img src="${productImageUrl}" alt="${product.titleFa}" loading="lazy">`
    : '<span class="rail-product-placeholder" aria-hidden="true">ORENZA</span>';

  article.innerHTML = `
    <a class="rail-product-media" href="${url}" aria-label="مشاهده ${product.titleFa}">
      <i class="rail-product-highlight">مرتبط</i>
      ${productVisual}
    </a>
    <div class="rail-product-copy">
      <h3><a href="${url}">${product.titleFa}</a></h3>
      <footer>
        <div class="rail-product-price">
          ${hasDiscount ? `<em class="rail-discount-line"><del>${money.format(regularPrice)}</del><strong>${percentFormat.format(discountPercent)}٪</strong></em>` : ""}
          <b>${money.format(price)} تومان</b>
        </div>
        <div class="rail-cart-control" data-cart-key="${cartKey}">
          <button class="rail-cart-button" type="button"
            aria-label="${product.stockStatus === "outOfStock" ? "محصول ناموجود است" : `افزودن ${product.titleFa} به سبد خرید`}"
            title="${product.stockStatus === "outOfStock" ? "ناموجود" : "افزودن به سبد خرید"}"
            ${product.stockStatus === "outOfStock" ? "disabled" : ""}>
            ${product.stockStatus === "outOfStock" ? '<span class="rail-cart-unavailable">ناموجود</span>' : cartIcon}
          </button>
          <div class="rail-cart-stepper" aria-label="تعداد ${product.titleFa}" hidden>
            <button type="button" data-related-increase aria-label="افزایش تعداد ${product.titleFa}">+</button>
            <output aria-live="polite">۱</output>
            <button type="button" data-related-decrease aria-label="کاهش تعداد ${product.titleFa}">−</button>
          </div>
        </div>
      </footer>
    </div>`;

  const image = article.querySelector<HTMLImageElement>(".rail-product-media img");
  image?.addEventListener("error", () => {
    const placeholder = document.createElement("span");
    placeholder.className = "rail-product-placeholder";
    placeholder.textContent = "ORENZA";
    placeholder.setAttribute("aria-hidden", "true");
    image.replaceWith(placeholder);
  });
  article.querySelector<HTMLButtonElement>(".rail-cart-button")?.addEventListener("click", () => {
    const item: CartItemInput = {
      ...selection,
      productTitle: product.titleFa,
      weight: weightLabel(firstWeight),
      quantity: 1,
      unitPrice: price,
      totalPrice: price
    };
    document.dispatchEvent(new CustomEvent(ADD_TO_CART_EVENT, { detail: item }));
  });
  const dispatchQuantityChange = (delta: CartQuantityChange["delta"]) => {
    const detail: CartQuantityChange = {
      ...selection,
      delta
    };
    document.dispatchEvent(new CustomEvent(CHANGE_CART_QUANTITY_EVENT, { detail }));
  };
  article.querySelector<HTMLButtonElement>("[data-related-increase]")?.addEventListener("click", () => dispatchQuantityChange(1));
  article.querySelector<HTMLButtonElement>("[data-related-decrease]")?.addEventListener("click", () => dispatchQuantityChange(-1));
  return article;
};

const setText = (selector: string, value: string) => {
  const element = root?.querySelector<HTMLElement>(selector);
  if (element) element.textContent = value;
};

const loadProduct = async () => {
  if (id) {
    const response = await fetch(`/api/v1/products/${encodeURIComponent(id)}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error || "محصول پیدا نشد.");
    return payload as { item: ProductDetail };
  }
  if (!pathSlug || pathSlug === "detail") throw new Error("محصول مشخص نشده است.");
  const response = await fetch("/api/v1/products");
  const payload = await response.json() as { items?: ProductDetail[]; error?: string };
  if (!response.ok) throw new Error(payload.error || "محصول پیدا نشد.");
  const item = (payload.items || []).find((product) => (product.slug || productSlug(product.titleEn)) === pathSlug);
  if (!item) throw new Error("محصول پیدا نشد.");
  const detailResponse = await fetch(`/api/v1/products/${encodeURIComponent(item.id)}`);
  if (!detailResponse.ok) return { item };
  return detailResponse.json() as Promise<{ item: ProductDetail }>;
};

if (root && (id || (pathSlug && pathSlug !== "detail"))) {
  loadProduct()
    .then(({ item }) => {
      document.title = `${item.titleFa} | اورنزا`;
      const readablePath = productDetailUrl(item);
      const productUrl = new URL(readablePath, location.origin).toString();
      if (location.pathname !== readablePath) {
        history.replaceState(null, "", readablePath);
      }
      document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute("content", item.description);
      document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.setAttribute("content", `${item.titleFa} | اورنزا`);
      document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.setAttribute("content", item.description);
      document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.setAttribute("content", productUrl);
      const canonicalUrl = item.canonicalUrl ? new URL(item.canonicalUrl, location.origin).toString() : productUrl;
      const robots = `${item.robotsIndex === false ? "noindex" : "index"}, ${item.robotsFollow === false ? "nofollow" : "follow"}${item.robotsIndex === false ? "" : ", max-image-preview:large"}`;
      document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.setAttribute("content", robots);
      document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]')?.setAttribute("content", `${item.titleFa} | اورنزا`);
      document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]')?.setAttribute("content", item.description);
      document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute("href", canonicalUrl);
      setText("[data-product-detail-en]", item.titleEn);
      setText("[data-product-detail-title]", item.titleFa);
      setText("[data-product-detail-description]", item.description);
      setText("[data-product-detail-blend]", item.blendType || "محصول اورنزا");
      setText("[data-product-detail-roast]", item.roastType ? roastLabels[item.roastType] : "—");
      setText("[data-product-detail-stock]", item.stockStatus === "inStock" ? "موجود و قابل سفارش" : "ناموجود");
      const directCartCategories = new Set(["cafe-drinks", "herbal-tea"]);
      const isDirectCartCategory = directCartCategories.has(item.categorySlug);
      const roastSpec = root.querySelector<HTMLElement>("[data-product-detail-roast-spec]");
      const preparation = root.querySelector<HTMLElement>("[data-product-detail-preparation]");
      if (roastSpec) roastSpec.hidden = isDirectCartCategory;
      if (preparation && isDirectCartCategory) preparation.lastChild!.textContent = " آماده‌سازی سریع و بسته‌بندی‌شده";

      const image = root.querySelector<HTMLImageElement>("[data-product-detail-image]");
      const imagePlaceholder = root.querySelector<HTMLElement>("[data-product-detail-image-placeholder]");
      const galleryRoot = root.querySelector<HTMLElement>("[data-product-detail-gallery]");
      const lightbox = root.querySelector<HTMLElement>("[data-product-image-lightbox]");
      const lightboxImage = root.querySelector<HTMLImageElement>("[data-product-lightbox-image]");
      const lightboxThumbs = root.querySelector<HTMLElement>("[data-product-lightbox-thumbs]");
      const lightboxPrev = root.querySelector<HTMLButtonElement>("[data-product-lightbox-prev]");
      const lightboxNext = root.querySelector<HTMLButtonElement>("[data-product-lightbox-next]");
      const lightboxClose = root.querySelector<HTMLButtonElement>("[data-product-lightbox-close]");
      const galleryImages = [...new Set([...(item.productImageUrls || []), item.imageUrl].filter(Boolean) as string[])];
      let selectedImageIndex = 0;
      const setProductImage = (imageUrl: string, index: number) => {
        if (!image) return;
        selectedImageIndex = index;
        image.src = imageUrl;
        image.alt = item.titleFa;
        image.hidden = false;
        if (imagePlaceholder) imagePlaceholder.hidden = true;
        galleryRoot?.querySelectorAll<HTMLButtonElement>("button").forEach((button, buttonIndex) => {
          const selected = buttonIndex === index;
          button.classList.toggle("is-selected", selected);
          button.setAttribute("aria-pressed", String(selected));
        });
      };
      const renderLightbox = () => {
        if (!lightboxImage || !galleryImages.length) return;
        const imageUrl = galleryImages[selectedImageIndex] || galleryImages[0]!;
        lightboxImage.src = imageUrl;
        lightboxImage.alt = item.titleFa;
        lightboxThumbs?.querySelectorAll<HTMLButtonElement>("button").forEach((button, buttonIndex) => {
          const selected = buttonIndex === selectedImageIndex;
          button.classList.toggle("is-selected", selected);
          button.setAttribute("aria-pressed", String(selected));
        });
      };
      const openLightbox = (index = selectedImageIndex) => {
        if (!lightbox || !galleryImages.length) return;
        selectedImageIndex = index;
        renderLightbox();
        lightbox.hidden = false;
        document.body.classList.add("product-lightbox-open");
      };
      const closeLightbox = () => {
        if (!lightbox) return;
        lightbox.hidden = true;
        document.body.classList.remove("product-lightbox-open");
      };
      const moveLightbox = (direction: 1 | -1) => {
        if (!galleryImages.length) return;
        selectedImageIndex = (selectedImageIndex + direction + galleryImages.length) % galleryImages.length;
        setProductImage(galleryImages[selectedImageIndex]!, selectedImageIndex);
        renderLightbox();
      };
      if (galleryImages.length) {
        setProductImage(galleryImages[0]!, 0);
        image?.addEventListener("click", () => openLightbox(selectedImageIndex));
        image?.setAttribute("role", "button");
        image?.setAttribute("tabindex", "0");
        image?.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            openLightbox(selectedImageIndex);
          }
        });
      }
      if (galleryRoot && galleryImages.length > 1) {
        galleryRoot.replaceChildren();
        galleryImages.forEach((imageUrl, index) => {
          const button = document.createElement("button");
          button.type = "button";
          button.setAttribute("aria-label", `نمایش تصویر ${index + 1} ${item.titleFa}`);
          button.setAttribute("aria-pressed", index === 0 ? "true" : "false");
          if (index === 0) button.classList.add("is-selected");
          const thumb = document.createElement("img");
          thumb.src = imageUrl;
          thumb.alt = "";
          thumb.loading = "lazy";
          button.append(thumb);
          button.addEventListener("click", () => setProductImage(imageUrl, index));
          button.addEventListener("dblclick", () => openLightbox(index));
          galleryRoot.append(button);
        });
        galleryRoot.hidden = false;
      }
      if (lightbox && lightboxImage && galleryImages.length) {
        lightboxThumbs?.replaceChildren();
        galleryImages.forEach((imageUrl, index) => {
          const button = document.createElement("button");
          button.type = "button";
          button.setAttribute("aria-label", `نمایش تصویر ${index + 1} در اندازه بزرگ`);
          button.setAttribute("aria-pressed", index === selectedImageIndex ? "true" : "false");
          if (index === selectedImageIndex) button.classList.add("is-selected");
          const thumb = document.createElement("img");
          thumb.src = imageUrl;
          thumb.alt = "";
          thumb.loading = "lazy";
          button.append(thumb);
          button.addEventListener("click", () => {
            selectedImageIndex = index;
            setProductImage(imageUrl, index);
            renderLightbox();
          });
          lightboxThumbs?.append(button);
        });
        lightboxClose?.addEventListener("click", closeLightbox);
        lightboxPrev?.addEventListener("click", () => moveLightbox(-1));
        lightboxNext?.addEventListener("click", () => moveLightbox(1));
        lightbox.addEventListener("click", (event) => {
          if (event.target === lightbox) closeLightbox();
        });
        document.addEventListener("keydown", (event) => {
          if (lightbox.hidden) return;
          if (event.key === "Escape") closeLightbox();
          if (event.key === "ArrowRight") moveLightbox(1);
          if (event.key === "ArrowLeft") moveLightbox(-1);
        });
      }

      const contentSection = root.querySelector<HTMLElement>("[data-product-detail-content-section]");
      const contentRoot = root.querySelector<HTMLElement>("[data-product-detail-content]");
      setText("[data-product-detail-content-title]", `راهنمای خرید ${item.titleFa}`);
      const productContent = String(item.productContent || "").trim();
      if (contentSection && contentRoot && productContent) {
        contentRoot.innerHTML = productContent;
        contentSection.hidden = false;
      }

      const tagsSection = root.querySelector<HTMLElement>("[data-product-detail-tags]");
      const tagsRoot = root.querySelector<HTMLElement>("[data-product-detail-tag-list]");
      if (tagsSection && tagsRoot && item.tags?.length) {
        item.tags.forEach((tag) => {
          const link = document.createElement("a");
          link.href = `/tags/${encodeURIComponent(tag.slug)}/`;
          link.textContent = `# ${tag.title}`;
          tagsRoot.append(link);
        });
        tagsSection.hidden = false;
      }

      const relatedSection = root.querySelector<HTMLElement>("[data-related-products]");
      const relatedRoot = root.querySelector<HTMLElement>("[data-related-product-list]");
      if (relatedSection && relatedRoot && item.relatedProducts?.length) {
        const relatedAll = relatedSection.querySelector<HTMLAnchorElement>("[data-related-products-all]");
        const allProductsUrl = `/products/?relatedTo=${encodeURIComponent(item.id)}#all-products`;
        if (relatedAll) relatedAll.href = allProductsUrl;
        const viewAll = document.createElement("a");
        viewAll.className = "rail-view-all-card";
        viewAll.href = allProductsUrl;
        viewAll.setAttribute("aria-label", `مشاهده همه محصولات مرتبط با ${item.titleFa}`);
        viewAll.innerHTML = '<span aria-hidden="true">←</span><strong>مشاهده همه</strong>';
        relatedRoot.replaceChildren(...item.relatedProducts.map(renderRelatedProductCard), viewAll);
        syncRelatedCartControls();
        relatedSection.hidden = false;
      }

      const internalLinks = root.querySelector<HTMLElement>("[data-product-detail-links]");
      const internalLinkGrid = root.querySelector<HTMLElement>("[data-product-detail-link-grid]");
      if (internalLinks && internalLinkGrid) {
        const categoryMeta: Record<string, { title: string; description: string; label: string; href: string }> = {
          "coffee-blends": {
            title: "مشاهده همه قهوه‌ها",
            description: "مقایسه درصد عربیکا و روبوستا و انتخاب ترکیب مناسب",
            label: "ساخت سفارش قهوه اختصاصی",
            href: `/order/?product=${encodeURIComponent(productSlug(item.titleEn))}`
          },
          "cafe-drinks": {
            title: "مشاهده همه نوشیدنی‌های پودری",
            description: "انتخاب چای ماسالا، ماچا، هات چاکلت و کاپوچینو",
            label: "خرید نوشیدنی‌های پودری",
            href: "/category/cafe-drinks/"
          },
          "herbal-tea": {
            title: "مشاهده همه دمنوش‌ها",
            description: "انتخاب ترکیب‌های گیاهی و خوش‌عطر",
            label: "خرید دمنوش",
            href: "/category/herbal-tea/"
          }
        };
        const meta = categoryMeta[item.categorySlug] || categoryMeta["coffee-blends"];
        const createLink = (href: string, title: string, description: string) => {
          const link = document.createElement("a");
          link.href = href;
          const strong = document.createElement("strong");
          strong.textContent = title;
          const small = document.createElement("small");
          small.textContent = description;
          link.append(strong, small);
          return link;
        };

        internalLinkGrid.append(
          createLink(`/category/${item.categorySlug}/`, meta.title, meta.description),
          createLink(
            meta.href,
            meta.label,
            item.categorySlug === "coffee-blends"
              ? "انتخاب وزن، رُست و آسیاب متناسب با دستگاه شما"
              : "مقایسه طعم‌ها، وزن‌ها و قیمت محصولات آماده"
          )
        );
        internalLinks.hidden = false;

      }

      const purchase = root.querySelector<HTMLElement>("[data-product-detail-purchase]");
      const weights = root.querySelector<HTMLElement>("[data-product-detail-weights]");
      const action = root.querySelector<HTMLButtonElement>("[data-product-detail-action]");
      const actionLabel = action?.querySelector<HTMLElement>("span");
      if (!purchase || !weights || !action) return;
      purchase.hidden = false;
      const availableWeights = item.saleType === "packaged"
        ? [item.packageWeightGrams]
        : [...new Set((item.availableWeightsGrams || [250, 500, 1000]).map(Number).filter((weight) => Number.isInteger(weight) && weight > 0))].sort((a, b) => a - b);
      let selectedWeight: number = availableWeights[0] || item.packageWeightGrams || 250;
      const productPrice = (weight: number) =>
        priceInfo(weight).final;
      const regularPrice = (weight: number) =>
        item.saleType === "packaged"
          ? Number(item.packagePrice || item.salePricePerKg || 0)
          : Math.round(Number(item.salePricePerKg || 0) * weight / 1000);
      const discountPrice = (weight: number) => {
        const unitDiscount = Number(item.discountSalePricePerKg || 0);
        if (unitDiscount > 0) return item.saleType === "packaged" ? unitDiscount : Math.round(unitDiscount * weight / 1000);
        const percent = Number(item.discountPercent || 0);
        return percent > 0 && percent < 100 ? Math.round(regularPrice(weight) * (1 - percent / 100)) : regularPrice(weight);
      };
      const priceInfo = (weight: number) => {
        const regular = regularPrice(weight);
        const discounted = discountPrice(weight);
        const savedPercent = Number(item.discountPercent || 0);
        const percent = savedPercent > 0
          ? savedPercent
          : regular > discounted
            ? Math.round(((regular - discounted) / regular) * 100)
            : 0;
        return {
          regular,
          final: item.showInDiscounts && discounted > 0 && discounted < regular ? discounted : regular,
          percent
        };
      };
      const renderPrice = (weight: number) => {
        const priceRoot = root.querySelector<HTMLElement>("[data-product-detail-price]");
        if (!priceRoot) return;
        const info = priceInfo(weight);
        const hasDiscount = item.showInDiscounts && info.final < info.regular && info.percent > 0;
        priceRoot.classList.toggle("has-product-detail-discount", hasDiscount);
        priceRoot.replaceChildren();
        if (hasDiscount) {
          const line = document.createElement("span");
          line.className = "product-detail-discount-line";
          const oldPrice = document.createElement("del");
          oldPrice.textContent = `${money.format(info.regular)} تومان`;
          const badge = document.createElement("em");
          badge.textContent = `${percentFormat.format(info.percent)}٪`;
          line.append(oldPrice, badge);
          priceRoot.append(line);
        }
        const current = document.createElement("b");
        current.textContent = `${weightLabel(weight)} · ${money.format(info.final)} تومان`;
        priceRoot.append(current);
      };
      const update = () => {
        renderPrice(selectedWeight);
        weights.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
          const selected = Number(button.dataset.weight) === selectedWeight;
          button.classList.toggle("is-selected", selected);
          button.setAttribute("aria-pressed", String(selected));
        });
      };
      weights.replaceChildren();
      availableWeights.forEach((weight) => {
        const option = document.createElement("button");
        option.type = "button";
        option.dataset.weight = String(weight);
        option.textContent = weightLabel(weight);
        weights.append(option);
      });
      weights.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
        button.addEventListener("click", () => {
          selectedWeight = Number(button.dataset.weight);
          update();
        });
      });

      if (item.stockStatus === "outOfStock") {
        action.disabled = true;
        if (actionLabel) actionLabel.textContent = "این محصول فعلاً ناموجود است";
      } else {
        const directCart = item.saleType === "packaged" || isDirectCartCategory;
        if (actionLabel) actionLabel.textContent = directCart ? "افزودن به سبد خرید" : "ادامه و انتخاب رُست";
        action.addEventListener("click", () => {
          if (!directCart) {
            location.href = `/order/?product=${encodeURIComponent(productSlug(item.titleEn))}&weight=${selectedWeight}`;
            return;
          }
          const unitPrice = productPrice(selectedWeight);
          const cartItem: CartItemInput = {
            productId: item.id,
            productTitle: item.titleFa,
            blend: item.blendType || "محصول اورنزا",
            roast: item.roastType ? roastLabels[item.roastType] : "بدون رُست",
            grind: item.productType === "coffee" ? (item.coffeeType === "ground" ? "پودر آماده" : "دان کامل") : "آماده مصرف",
            weight: weightLabel(selectedWeight),
            weightGrams: selectedWeight,
            quantity: 1,
            unitPrice,
            totalPrice: unitPrice
          };
          document.dispatchEvent(new CustomEvent(ADD_TO_CART_EVENT, { detail: cartItem }));
          if (actionLabel) actionLabel.textContent = "به سبد خرید اضافه شد ✓";
        });
      }
      update();
    })
    .catch((error) => {
      setText("[data-product-detail-title]", "محصول پیدا نشد");
      setText("[data-product-detail-description]", "ممکن است محصول حذف یا غیرفعال شده باشد.");
      const errorElement = root.querySelector<HTMLElement>("[data-product-detail-error]");
      if (errorElement) {
        errorElement.hidden = false;
        errorElement.textContent = error instanceof Error ? error.message : "دریافت محصول انجام نشد.";
      }
    });
} else if (root) {
  setText("[data-product-detail-title]", "محصول مشخص نشده است");
  setText("[data-product-detail-description]", "از صفحه محصولات، محصول موردنظر را انتخاب کنید.");
}

document.addEventListener(CART_UPDATED_EVENT, (event) => {
  syncRelatedCartControls((event as CustomEvent<{ items: CartItem[] }>).detail.items);
});
