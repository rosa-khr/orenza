type MagazineArticle = {
  title: string;
  slug: string;
  summary: string;
  imageUrl: string | null;
  tags: string[];
  tagLinks?: { title: string; slug: string }[];
  createdAt: string;
  readingMinutes: number;
};

type MagazineCategory = {
  title: string;
  seoDescription?: string | null;
};

export {};

const root = document.querySelector<HTMLElement>("[data-coffee-magazine]");
const list = root?.querySelector<HTMLElement>("[data-coffee-magazine-list]");
const heading = root?.querySelector<HTMLElement>("[data-coffee-magazine-title]");
const description = root?.querySelector<HTMLElement>("[data-coffee-magazine-description]");
const persianNumber = new Intl.NumberFormat("fa-IR");
const persianDate = new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "long", year: "numeric" });

const articleUrl = (slug: string) => `/articles/${encodeURIComponent(slug)}/`;

const articleCard = (item: MagazineArticle) => {
  const article = document.createElement("article");
  article.className = "coffee-article-card";

  const mediaLink = document.createElement("a");
  mediaLink.className = "coffee-article-card__media";
  mediaLink.href = articleUrl(item.slug);
  mediaLink.setAttribute("aria-label", `مطالعه مقاله: ${item.title}`);

  const media = document.createElement("figure");
  const image = document.createElement("img");
  image.src = item.imageUrl || "/images/espresso-extraction-editorial-v2.webp";
  image.alt = item.imageUrl ? `تصویر شاخص مقاله ${item.title}` : "عصاره‌گیری قهوه اسپرسو";
  image.width = 560;
  image.height = 340;
  image.loading = "lazy";
  image.decoding = "async";
  media.append(image);
  mediaLink.append(media);

  const copy = document.createElement("div");
  copy.className = "coffee-article-card__copy";
  const meta = document.createElement("div");
  meta.className = "coffee-article-card__meta";
  const primaryTag = item.tagLinks?.[0];
  const topic = primaryTag ? document.createElement("a") : document.createElement("span");
  topic.textContent = primaryTag?.title || item.tags[0] || "دانستنی‌های قهوه";
  if (primaryTag && topic instanceof HTMLAnchorElement) topic.href = `/tags/${encodeURIComponent(primaryTag.slug)}/`;
  const time = document.createElement("time");
  time.dateTime = item.createdAt;
  time.textContent = persianDate.format(new Date(item.createdAt));
  const reading = document.createElement("span");
  reading.textContent = `${persianNumber.format(item.readingMinutes)} دقیقه مطالعه`;
  meta.append(topic, time, reading);

  const title = document.createElement("h3");
  const titleLink = document.createElement("a");
  titleLink.href = articleUrl(item.slug);
  titleLink.textContent = item.title;
  title.append(titleLink);
  const summary = document.createElement("p");
  summary.textContent = item.summary;
  summary.title = item.summary;
  const action = document.createElement("a");
  action.href = articleUrl(item.slug);
  action.className = "coffee-article-card__action";
  action.textContent = "مشاهده کامل مطلب ←";
  copy.append(meta, title, summary, action);
  article.append(mediaLink, copy);
  return article;
};

if (root && list) {
  Promise.all([
    fetch("/api/v1/categories/articles").then(async (response) => {
      const payload = await response.json() as { item?: MagazineCategory; error?: string };
      if (!response.ok || !payload.item) throw new Error(payload.error || "دسته‌بندی مجله فعال نیست.");
      return payload.item;
    }),
    fetch("/api/v1/articles?limit=3&page=1&latest=true").then(async (response) => {
      const payload = await response.json() as { items?: MagazineArticle[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "دریافت مقاله‌ها انجام نشد.");
      return payload.items || [];
    })
  ])
    .then(([category, items]) => {
      if (!items.length) {
        root.hidden = true;
        return;
      }
      if (heading) heading.textContent = category.title;
      if (description && category.seoDescription) description.textContent = category.seoDescription;
      list.replaceChildren(...items.map(articleCard));
    })
    .catch(() => {
      root.hidden = true;
    });
}
