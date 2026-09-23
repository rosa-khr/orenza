type ArticleSummary = {
  title: string;
  slug: string;
  summary: string;
  imageUrl: string | null;
  tags: string[];
  tagLinks?: { title: string; slug: string }[];
  createdAt: string;
  readingMinutes: number;
};

export {};

const root = document.querySelector<HTMLElement>("[data-articles-page]");
const list = root?.querySelector<HTMLElement>("[data-articles-list]");
const more = root?.querySelector<HTMLButtonElement>("[data-articles-more]");
const dateFormat = new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "long", year: "numeric" });
const numberFormat = new Intl.NumberFormat("fa-IR");
let page = 1;
const pageSize = 9;
let total = 0;
const loadedItems: ArticleSummary[] = [];

const card = (item: ArticleSummary) => {
  const article = document.createElement("article");
  article.className = "articles-list-card";
  const articleHref = `/articles/${encodeURIComponent(item.slug)}/`;
  const mediaLink = document.createElement("a");
  mediaLink.className = "articles-list-card__media";
  mediaLink.href = articleHref;
  mediaLink.setAttribute("aria-label", `مطالعه مقاله: ${item.title}`);
  const image = document.createElement("img");
  image.src = item.imageUrl || "/images/espresso-extraction-editorial-v2.webp";
  image.alt = item.imageUrl ? `تصویر شاخص مقاله ${item.title}` : "عصاره‌گیری قهوه اسپرسو";
  image.width = 560;
  image.height = 340;
  image.loading = "lazy";
  image.decoding = "async";
  mediaLink.append(image);
  const copy = document.createElement("div");
  const meta = document.createElement("div");
  meta.className = "articles-list-card__meta";
  const primaryTag = item.tagLinks?.[0];
  const topic = primaryTag ? document.createElement("a") : document.createElement("span");
  topic.textContent = primaryTag?.title || item.tags[0] || "دانستنی‌های قهوه";
  if (primaryTag && topic instanceof HTMLAnchorElement) topic.href = `/tags/${encodeURIComponent(primaryTag.slug)}/`;
  const date = document.createElement("time");
  date.dateTime = item.createdAt;
  date.textContent = dateFormat.format(new Date(item.createdAt));
  const reading = document.createElement("span");
  reading.textContent = `${numberFormat.format(item.readingMinutes)} دقیقه`;
  meta.append(topic, date, reading);
  const title = document.createElement("h3");
  const titleLink = document.createElement("a");
  titleLink.href = articleHref;
  titleLink.textContent = item.title;
  title.append(titleLink);
  const summary = document.createElement("p");
  summary.textContent = item.summary;
  summary.title = item.summary;
  const action = document.createElement("a");
  action.href = articleHref;
  action.className = "articles-list-card__action";
  action.textContent = "مشاهده کامل مطلب ←";
  copy.append(meta, title, summary, action);
  article.append(mediaLink, copy);
  return article;
};

const appendItemListSchema = (items: ArticleSummary[]) => {
  document.querySelector("[data-articles-schema]")?.remove();
  const script = document.createElement("script");
  script.type = "application/ld+json";
  script.dataset.articlesSchema = "";
  script.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "مجله قهوه اورنزا",
    url: new URL("/articles/", location.origin).toString(),
    inLanguage: "fa-IR",
    mainEntity: {
      "@type": "ItemList",
      itemListElement: items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: new URL(`/articles/${encodeURIComponent(item.slug)}/`, location.origin).toString(),
        name: item.title
      }))
    }
  });
  document.head.append(script);
};

const load = async () => {
  if (!list || !more) return;
  more.disabled = true;
  const response = await fetch(`/api/v1/articles?limit=${pageSize}&page=${page}`);
  const payload = await response.json() as { items?: ArticleSummary[]; total?: number; error?: string };
  if (!response.ok) throw new Error(payload.error || "دریافت مقاله‌ها انجام نشد.");
  const items = payload.items || [];
  total = Number(payload.total || 0);
  if (page === 1) {
    list.replaceChildren();
    loadedItems.length = 0;
  }
  loadedItems.push(...items);
  list.append(...items.map(card));
  appendItemListSchema(loadedItems);
  page += 1;
  more.hidden = list.childElementCount >= total;
  more.disabled = false;
};

if (root && list && more) {
  load().catch((reason) => {
    const status = root.querySelector<HTMLElement>("[data-articles-status]");
    if (status) status.textContent = reason instanceof Error ? reason.message : "دریافت مقاله‌ها انجام نشد.";
  });
  more.addEventListener("click", () => void load());
}
