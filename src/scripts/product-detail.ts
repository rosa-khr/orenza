import { ADD_TO_CART_EVENT, type CartItemInput } from "./order-types";
import { productDetailUrl, productSlug } from "./product-url";

type ProductDetail = {
  id: string;
  titleFa: string;
  titleEn: string;
  description: string;
  productContent: string | null;
  imageUrl: string | null;
  blendType: string;
  categorySlug: string;
  roastType: "light" | "medium" | "mediumDark" | "dark";
  coffeeType: "bean" | "ground";
  saleType: "weighted" | "packaged";
  stockStatus: "inStock" | "outOfStock";
  packageWeightGrams: 250 | 500 | 1000;
  packagePrice: number | string;
  pricePer250g: number | string;
  pricePer500g: number | string;
  pricePer1000g: number | string;
  tags: { id: string; title: string; slug: string }[];
  relatedProducts: RelatedProduct[];
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
  const item = (payload.items || []).find((product) => productSlug(product.titleEn) === pathSlug);
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
      document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]')?.setAttribute("content", `${item.titleFa} | اورنزا`);
      document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]')?.setAttribute("content", item.description);
      document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute("href", productUrl);
      setText("[data-product-detail-en]", item.titleEn);
      setText("[data-product-detail-title]", item.titleFa);
      setText("[data-product-detail-description]", item.description);
      setText("[data-product-detail-blend]", item.blendType);
      setText("[data-product-detail-roast]", roastLabels[item.roastType] || "—");
      setText("[data-product-detail-stock]", item.stockStatus === "inStock" ? "موجود و قابل سفارش" : "ناموجود");

      const image = root.querySelector<HTMLImageElement>("[data-product-detail-image]");
      const imagePlaceholder = root.querySelector<HTMLElement>("[data-product-detail-image-placeholder]");
      if (image && item.imageUrl) {
        image.src = item.imageUrl;
        image.alt = item.titleFa;
        image.hidden = false;
        if (imagePlaceholder) imagePlaceholder.hidden = true;
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
        const categoryTitle = item.categorySlug === "coffee-blends"
          ? "مشاهده همه قهوه‌های ترکیبی"
          : "مشاهده همه نوشیدنی‌های کافه‌ای";
        const categoryDescription = item.categorySlug === "coffee-blends"
          ? "مقایسه درصد عربیکا و روبوستا و انتخاب ترکیب مناسب"
          : "انتخاب چای ماسالا، ماچا، هات چاکلت و کاپوچینو";
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
          createLink(`/products/${item.categorySlug}/`, categoryTitle, categoryDescription),
          createLink(
            item.categorySlug === "coffee-blends"
              ? `/order/?product=${encodeURIComponent(productSlug(item.titleEn))}`
              : "/products/cafe-drinks/",
            item.categorySlug === "coffee-blends" ? "ساخت سفارش قهوه اختصاصی" : "خرید نوشیدنی‌های کافه‌ای",
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
        item.saleType === "packaged"
          ? Number(item.packagePrice || 0)
          : Number(item[`pricePer${weight}g` as keyof ProductDetail] || 0);
      const update = () => {
        setText(
          "[data-product-detail-price]",
          `${weightLabels[selectedWeight]} · ${money.format(productPrice(selectedWeight))} تومان`
        );
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
        const directCart = item.saleType === "packaged" || item.categorySlug === "cafe-drinks";
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
