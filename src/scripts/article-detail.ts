type ArticleSummary = {
  title: string;
  slug: string;
  summary: string;
  imageUrl: string | null;
  tags: string[];
  tagLinks?: { title: string; slug: string }[];
  createdAt: string;
  updatedAt: string;
  readingMinutes: number;
};

type ArticleDetail = ArticleSummary & {
  content: string;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  robotsIndex: boolean;
  robotsFollow: boolean;
  relatedArticles: ArticleSummary[];
};

export {};

const root = document.querySelector<HTMLElement>("[data-article-detail]");
const slug = decodeURIComponent(location.pathname.split("/").filter(Boolean).at(-1) || "");
const dateFormat = new Intl.DateTimeFormat("fa-IR", { day: "numeric", month: "long", year: "numeric" });
const numberFormat = new Intl.NumberFormat("fa-IR");
const fallbackArticleImage = "/images/espresso-extraction-editorial-v2.webp";

const addImageFallback = (image: HTMLImageElement, container?: HTMLElement | null) => {
  image.addEventListener("error", () => {
    if (image.dataset.fallbackApplied === "true") {
      if (container) container.hidden = true;
      return;
    }
    image.dataset.fallbackApplied = "true";
    image.src = fallbackArticleImage;
    image.alt = "عصاره‌گیری قهوه اسپرسو";
  });
};

const setMeta = (selector: string, value: string) =>
  document.querySelector<HTMLElement>(selector)?.setAttribute("content", value);

const headingId = (value: string, index: number) => {
  const normalized = value.trim().toLowerCase()
    .replace(/[\u200c\s]+/g, "-")
    .replace(/[^a-z0-9\u0600-\u06ff-]/g, "")
    .replace(/^-+|-+$/g, "");
  return normalized || `section-${index + 1}`;
};

const renderRelatedCard = (item: ArticleSummary) => {
  const article = document.createElement("article");
  const link = document.createElement("a");
  link.href = `/articles/${encodeURIComponent(item.slug)}/`;
  const image = document.createElement("img");
  image.src = item.imageUrl || fallbackArticleImage;
  image.alt = item.imageUrl ? `تصویر شاخص مقاله ${item.title}` : "عصاره‌گیری قهوه اسپرسو";
  image.width = 420;
  image.height = 250;
  image.loading = "lazy";
  image.decoding = "async";
  addImageFallback(image, article);
  const copy = document.createElement("div");
  const topic = document.createElement("span");
  topic.textContent = item.tags[0] || "دانستنی‌های قهوه";
  const title = document.createElement("h3");
  title.textContent = item.title;
  const description = document.createElement("p");
  description.textContent = item.summary;
  copy.append(topic, title, description);
  link.append(image, copy);
  article.append(link);
  return article;
};

if (root && slug && slug !== "detail") {
  fetch(`/api/v1/articles/${encodeURIComponent(slug)}`)
    .then(async (response) => {
      const payload = await response.json() as { item?: ArticleDetail; error?: string };
      if (!response.ok || !payload.item) throw new Error(payload.error || "مقاله پیدا نشد.");
      return payload.item;
    })
    .then((item) => {
      const pageUrl = new URL(`/articles/${encodeURIComponent(item.slug)}/`, location.origin);
      const canonicalUrl = item.canonicalUrl ? new URL(item.canonicalUrl, location.origin) : pageUrl;
      const title = item.seoTitle || item.title;
      const description = item.seoDescription || item.summary;
      const fullTitle = `${title} | اورنزا`;
      const imageUrl = new URL(item.imageUrl || fallbackArticleImage, location.origin).toString();
      const robots = `${item.robotsIndex === false ? "noindex" : "index"}, ${item.robotsFollow === false ? "nofollow" : "follow"}${item.robotsIndex === false ? "" : ", max-image-preview:large"}`;

      document.title = fullTitle;
      setMeta('meta[name="description"]', description);
      setMeta('meta[name="robots"]', robots);
      setMeta('meta[property="og:title"]', fullTitle);
      setMeta('meta[property="og:description"]', description);
      setMeta('meta[property="og:url"]', pageUrl.toString());
      setMeta('meta[property="og:image"]', imageUrl);
      setMeta('meta[property="og:image:alt"]', `تصویر شاخص مقاله ${item.title}`);
      setMeta('meta[name="twitter:title"]', fullTitle);
      setMeta('meta[name="twitter:description"]', description);
      setMeta('meta[name="twitter:image"]', imageUrl);
      document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute("href", canonicalUrl.toString());
      document.querySelectorAll<HTMLLinkElement>('link[rel="alternate"]').forEach((link) => link.href = canonicalUrl.toString());

      const pageTitle = root.querySelector<HTMLElement>("[data-article-title]");
      const summary = root.querySelector<HTMLElement>("[data-article-summary]");
      const breadcrumb = root.querySelector<HTMLElement>("[data-article-breadcrumb]");
      const category = root.querySelector<HTMLElement>("[data-article-category]");
      const date = root.querySelector<HTMLTimeElement>("[data-article-date]");
      const reading = root.querySelector<HTMLElement>("[data-article-reading]");
      if (pageTitle) pageTitle.textContent = item.title;
      if (summary) summary.textContent = item.summary;
      if (breadcrumb) breadcrumb.textContent = item.title;
      if (category) category.textContent = item.tags[0] || "دانستنی‌های قهوه";
      if (date) {
        date.dateTime = item.createdAt;
        date.textContent = dateFormat.format(new Date(item.createdAt));
      }
      if (reading) reading.textContent = `${numberFormat.format(item.readingMinutes)} دقیقه مطالعه`;

      const media = root.querySelector<HTMLElement>("[data-article-media]");
      const image = root.querySelector<HTMLImageElement>("[data-article-image]");
      if (media && image) {
        addImageFallback(image, media);
        image.src = imageUrl;
        image.alt = item.imageUrl ? `تصویر شاخص مقاله ${item.title}` : "عصاره‌گیری قهوه اسپرسو";
        media.hidden = false;
      }

      const body = root.querySelector<HTMLElement>("[data-article-content]");
      const toc = root.querySelector<HTMLElement>("[data-article-toc]");
      const tocList = root.querySelector<HTMLOListElement>("[data-article-toc-list]");
      if (body) {
        body.innerHTML = item.content;
        body.querySelectorAll("h1").forEach((heading) => {
          const replacement = document.createElement("h2");
          replacement.innerHTML = heading.innerHTML;
          for (const attribute of heading.attributes) replacement.setAttribute(attribute.name, attribute.value);
          heading.replaceWith(replacement);
        });
        const headings = [...body.querySelectorAll<HTMLHeadingElement>("h2, h3")];
        const usedIds = new Set<string>();
        headings.forEach((heading, index) => {
          const base = headingId(heading.textContent || "", index);
          let id = base;
          let suffix = 2;
          while (usedIds.has(id)) id = `${base}-${suffix++}`;
          usedIds.add(id);
          heading.id = id;
          if (heading.tagName === "H2" && tocList) {
            const li = document.createElement("li");
            const link = document.createElement("a");
            link.href = `#${encodeURIComponent(id)}`;
            link.textContent = heading.textContent || "بخش مقاله";
            li.append(link);
            tocList.append(li);
          }
        });
        if (toc && tocList?.childElementCount) toc.hidden = false;
      }

      const tags = root.querySelector<HTMLElement>("[data-article-tags]");
      if (tags && item.tags.length) {
        item.tags.forEach((tag) => {
          const tagLink = item.tagLinks?.find((candidate) => candidate.title === tag);
          const element = tagLink ? document.createElement("a") : document.createElement("span");
          element.textContent = `# ${tag}`;
          if (tagLink && element instanceof HTMLAnchorElement) {
            element.href = `/tags/${encodeURIComponent(tagLink.slug)}/`;
          }
          tags.append(element);
        });
        tags.hidden = false;
      }

      const related = root.querySelector<HTMLElement>("[data-related-articles]");
      const relatedList = root.querySelector<HTMLElement>("[data-related-articles-list]");
      if (related && relatedList && item.relatedArticles.length) {
        relatedList.append(...item.relatedArticles.map(renderRelatedCard));
        related.hidden = false;
      }

      const schema = document.createElement("script");
      schema.type = "application/ld+json";
      schema.dataset.articleSchema = "";
      schema.textContent = JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "BlogPosting",
            "@id": `${pageUrl}#article`,
            headline: item.title,
            description,
            image: [imageUrl],
            datePublished: item.createdAt,
            dateModified: item.updatedAt,
            inLanguage: "fa-IR",
            mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl.toString() },
            author: { "@type": "Organization", name: "تحریریه اورنزا", url: location.origin },
            publisher: {
              "@type": "Organization",
              name: "قهوه اورنزا",
              url: location.origin,
              logo: { "@type": "ImageObject", url: new URL("/images/orenza-logo.png", location.origin).toString() }
            },
            articleSection: item.tags[0] || "دانستنی‌های قهوه",
            keywords: item.tags.join(", ")
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "خانه", item: new URL("/", location.origin).toString() },
              { "@type": "ListItem", position: 2, name: "مجله قهوه", item: new URL("/articles/", location.origin).toString() },
              { "@type": "ListItem", position: 3, name: item.title, item: pageUrl.toString() }
            ]
          }
        ]
      });
      document.head.append(schema);
    })
    .catch((reason) => {
      const title = root.querySelector<HTMLElement>("[data-article-title]");
      const summary = root.querySelector<HTMLElement>("[data-article-summary]");
      const error = root.querySelector<HTMLElement>("[data-article-error]");
      if (title) title.textContent = "مقاله پیدا نشد";
      if (summary) summary.textContent = "این مطلب حذف شده یا هنوز منتشر نشده است.";
      if (error) {
        error.textContent = reason instanceof Error ? reason.message : "دریافت مقاله انجام نشد.";
        error.hidden = false;
      }
      setMeta('meta[name="robots"]', "noindex, nofollow");
    });
}
