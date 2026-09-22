import { ADD_TO_CART_EVENT, type CartItemInput } from "./order-types";
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
  titleFa: string;
  titleEn: string;
  description: string;
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
const roastLabels = {
  light: "روشن",
  medium: "متوسط",
  mediumDark: "متوسط رو به تیره",
  dark: "تیره"
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
  return { item };
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
      setText("[data-product-detail-blend]", item.blendType);
      setText("[data-product-detail-roast]", roastLabels[item.roastType] || "—");
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
        item.relatedProducts.forEach((product) => {
          const article = document.createElement("article");
          const link = document.createElement("a");
          link.href = productDetailUrl(product);
          if (product.imageUrl) {
            const image = document.createElement("img");
            image.src = product.imageUrl;
            image.alt = product.titleFa;
            image.loading = "lazy";
            link.append(image);
          } else {
            const placeholder = document.createElement("span");
            placeholder.textContent = "ORENZA";
            link.append(placeholder);
          }
          const copy = document.createElement("div");
          const eyebrow = document.createElement("small");
          eyebrow.textContent = product.titleEn;
          const title = document.createElement("h3");
          title.textContent = product.titleFa;
          const description = document.createElement("p");
          description.textContent = product.description;
          copy.append(eyebrow, title, description);
          article.append(link, copy);
          relatedRoot.append(article);
        });
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
      let selectedWeight: 250 | 500 | 1000 =
        item.saleType === "packaged" ? item.packageWeightGrams : 250;
      const productPrice = (weight: 250 | 500 | 1000) =>
        priceInfo(weight).final;
      const regularPrice = (weight: 250 | 500 | 1000) =>
        item.saleType === "packaged"
          ? Number(item.packagePrice || item.salePricePerKg || 0)
          : Math.round(Number(item.salePricePerKg || 0) * weight / 1000);
      const discountPrice = (weight: 250 | 500 | 1000) => {
        const unitDiscount = Number(item.discountSalePricePerKg || 0);
        if (unitDiscount > 0) return item.saleType === "packaged" ? unitDiscount : Math.round(unitDiscount * weight / 1000);
        const percent = Number(item.discountPercent || 0);
        return percent > 0 && percent < 100 ? Math.round(regularPrice(weight) * (1 - percent / 100)) : regularPrice(weight);
      };
      const priceInfo = (weight: 250 | 500 | 1000) => {
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
      const renderPrice = (weight: 250 | 500 | 1000) => {
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
        current.textContent = `${weightLabels[weight]} · ${money.format(info.final)} تومان`;
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
      weights.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
        if (item.saleType === "packaged") {
          button.hidden = Number(button.dataset.weight) !== selectedWeight;
        }
        button.addEventListener("click", () => {
          selectedWeight = Number(button.dataset.weight) as 250 | 500 | 1000;
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
            blend: item.blendType,
            roast: roastLabels[item.roastType],
            grind: item.coffeeType === "ground" ? "پودر آماده" : "دان کامل",
            weight: weightLabels[selectedWeight],
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
