import { productDetailUrl } from "./product-url";

type TagLink = { id: string; title: string; slug: string };
type TaggedProduct = {
  id: string;
  titleFa: string;
  titleEn: string;
  description: string;
  imageUrl: string | null;
  categorySlug: string;
};
type TaggedArticle = {
  title: string;
  slug: string;
  summary: string;
  imageUrl: string | null;
  createdAt: string;
  readingMinutes: number;
};
type TagDetail = TagLink & {
  imageUrl?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  canonicalUrl?: string | null;
  robotsIndex?: boolean;
  robotsFollow?: boolean;
  content: string | null;
  products: TaggedProduct[];
  articles: TaggedArticle[];
  relatedTags: TagLink[];
};

const root = document.querySelector<HTMLElement>("[data-tag-detail]");
const slug = decodeURIComponent(location.pathname.split("/").filter(Boolean).at(-1) || "");

const renderTagLinks = (container: HTMLElement, tags: TagLink[]) => {
  tags.forEach((tag) => {
    const link = document.createElement("a");
    link.href = `/tags/${encodeURIComponent(tag.slug)}/`;
    link.textContent = `# ${tag.title}`;
    container.append(link);
  });
};

if (root && slug && slug !== "detail") {
  fetch(`/api/v1/tags/${encodeURIComponent(slug)}`)
    .then(async (response) => {
      const payload = await response.json() as { item?: TagDetail; error?: string };
      if (!response.ok || !payload.item) throw new Error(payload.error || "برچسب پیدا نشد.");
      return payload.item;
    })
    .then((item) => {
      const pageTitle = item.seoTitle || item.title;
      document.title = `${pageTitle} | اورنزا`;
      const canonicalUrl = new URL(item.canonicalUrl || `/tags/${encodeURIComponent(item.slug)}/`, location.origin).toString();
      const summary = item.seoDescription || `محصولات و مطالب مرتبط با ${item.title} در فروشگاه اورنزا`;
      const robots = `${item.robotsIndex === false ? "noindex" : "index"}, ${item.robotsFollow === false ? "nofollow" : "follow"}${item.robotsIndex === false ? "" : ", max-image-preview:large"}`;
      document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute("href", canonicalUrl);
      document.querySelector<HTMLMetaElement>('meta[name="robots"]')?.setAttribute("content", robots);
      document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute("content", summary);
      document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.setAttribute("content", `${pageTitle} | اورنزا`);
      document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.setAttribute("content", summary);
      document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.setAttribute("content", canonicalUrl);
      document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]')?.setAttribute("content", `${pageTitle} | اورنزا`);
      document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]')?.setAttribute("content", summary);
      if (item.imageUrl) {
        const socialImage = new URL(item.imageUrl, location.origin).toString();
        document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.setAttribute("content", socialImage);
        document.querySelector<HTMLMetaElement>('meta[name="twitter:image"]')?.setAttribute("content", socialImage);
      }
      root.querySelector<HTMLElement>("[data-tag-title]")!.textContent = item.title;
      const content = root.querySelector<HTMLElement>("[data-tag-content]");
      if (content && item.content?.trim()) {
        content.innerHTML = item.content;
        content.hidden = false;
      }
      const articlesSection = root.querySelector<HTMLElement>("[data-tag-articles]");
      const articlesRoot = root.querySelector<HTMLElement>("[data-tag-article-list]");
      if (articlesSection && articlesRoot && item.articles.length) {
        item.articles.forEach((relatedArticle) => {
          const article = document.createElement("article");
          const link = document.createElement("a");
          link.href = `/articles/${encodeURIComponent(relatedArticle.slug)}/`;
          const image = document.createElement("img");
          image.src = relatedArticle.imageUrl || "/images/espresso-extraction-editorial-v2.webp";
          image.alt = `تصویر مقاله ${relatedArticle.title}`;
          image.loading = "lazy";
          const copy = document.createElement("div");
          const title = document.createElement("h3");
          title.textContent = relatedArticle.title;
          const summary = document.createElement("p");
          summary.textContent = relatedArticle.summary;
          copy.append(title, summary);
          link.append(image, copy);
          article.append(link);
          articlesRoot.append(article);
        });
        articlesSection.hidden = false;
      }
      const productsSection = root.querySelector<HTMLElement>("[data-tag-products]");
      const productsRoot = root.querySelector<HTMLElement>("[data-tag-product-list]");
      if (productsSection && productsRoot && item.products.length) {
        item.products.forEach((product) => {
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
          productsRoot.append(article);
        });
        productsSection.hidden = false;
      }
      const tagsSection = root.querySelector<HTMLElement>("[data-related-tags]");
      const tagsRoot = root.querySelector<HTMLElement>("[data-related-tag-list]");
      if (tagsSection && tagsRoot && item.relatedTags.length) {
        renderTagLinks(tagsRoot, item.relatedTags);
        tagsSection.hidden = false;
      }
    })
    .catch((reason) => {
      root.querySelector<HTMLElement>("[data-tag-title]")!.textContent = "برچسب پیدا نشد";
      const error = root.querySelector<HTMLElement>("[data-tag-error]");
      if (error) {
        error.textContent = reason instanceof Error ? reason.message : "دریافت برچسب انجام نشد.";
        error.hidden = false;
      }
    });
}
