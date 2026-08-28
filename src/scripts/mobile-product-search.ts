import { productDetailUrl } from "./product-url";

type SearchProduct = {
  id: string;
  titleFa: string;
  titleEn: string;
  description: string;
  imageUrl: string | null;
};

const form = document.querySelector<HTMLFormElement>("[data-mobile-product-search]");
const input = form?.querySelector<HTMLInputElement>("[data-mobile-product-search-input]");
const results = form?.querySelector<HTMLElement>("[data-mobile-product-search-results]");
let products: SearchProduct[] = [];
let loading: Promise<void> | null = null;

const normalize = (value: string) => value
  .normalize("NFKD")
  .replace(/[\u064B-\u065F\u0670]/g, "")
  .replace(/ي/g, "ی")
  .replace(/ك/g, "ک")
  .trim()
  .toLocaleLowerCase("fa");

const loadProducts = () => {
  if (loading) return loading;
  loading = fetch("/api/v1/products")
    .then(async (response) => {
      if (!response.ok) throw new Error();
      const payload = await response.json() as { items: SearchProduct[] };
      products = payload.items;
    })
    .catch(() => {
      products = [];
    });
  return loading;
};

const setExpanded = (expanded: boolean) => {
  if (!input || !results) return;
  input.setAttribute("aria-expanded", String(expanded));
  results.hidden = !expanded;
};

const render = async () => {
  if (!input || !results) return;
  const query = normalize(input.value);
  if (query.length < 2) {
    results.replaceChildren();
    setExpanded(false);
    return;
  }

  results.textContent = "در حال جست‌وجو…";
  results.classList.add("is-message");
  setExpanded(true);
  await loadProducts();

  const terms = query.split(/\s+/).filter(Boolean);
  const matches = products
    .map((product) => {
      const titleFa = normalize(product.titleFa);
      const titleEn = normalize(product.titleEn);
      const description = normalize(product.description || "");
      const searchableText = `${titleFa} ${titleEn} ${description}`;
      if (!terms.every((term) => searchableText.includes(term))) return null;

      let score = 0;
      if (titleFa === query || titleEn === query) score += 100;
      if (titleFa.startsWith(query) || titleEn.startsWith(query)) score += 60;
      if (titleFa.includes(query) || titleEn.includes(query)) score += 40;
      terms.forEach((term) => {
        if (titleFa.includes(term) || titleEn.includes(term)) score += 12;
        if (description.includes(term)) score += 3;
      });
      return { product, score };
    })
    .filter((item): item is { product: SearchProduct; score: number } => item !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((item) => item.product);

  results.replaceChildren();
  results.classList.remove("is-message");
  if (!matches.length) {
    results.textContent = "محصولی با این نام پیدا نشد.";
    results.classList.add("is-message");
    return;
  }

  matches.forEach((product) => {
    const link = document.createElement("a");
    link.href = productDetailUrl(product);
    const image = document.createElement("img");
    image.src = product.imageUrl || "/images/orenza-bag-mockup-v3.webp";
    image.alt = "";
    const copy = document.createElement("span");
    const title = document.createElement("b");
    const englishTitle = document.createElement("small");
    title.textContent = product.titleFa;
    englishTitle.textContent = product.titleEn;
    copy.append(title, englishTitle);
    link.append(image, copy);
    results.append(link);
  });
};

if (form && input && results) {
  input.addEventListener("focus", () => {
    void loadProducts();
    if (input.value.trim().length >= 2) void render();
  });
  input.addEventListener("input", () => void render());
  form.addEventListener("submit", (event) => {
    const firstResult = results.querySelector<HTMLAnchorElement>("a");
    if (!firstResult) return;
    event.preventDefault();
    location.href = firstResult.href;
  });
  document.addEventListener("click", (event) => {
    if (!form.contains(event.target as Node)) setExpanded(false);
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setExpanded(false);
  });
}
