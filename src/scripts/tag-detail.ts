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
type TagDetail = TagLink & {
  content: string | null;
  products: TaggedProduct[];
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
      document.title = `${item.title} | اورنزا`;
      const canonicalUrl = new URL(`/tags/${encodeURIComponent(item.slug)}/`, location.origin).toString();
      const summary = `محصولات و مطالب مرتبط با ${item.title} در فروشگاه اورنزا`;
      document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute("href", canonicalUrl);
      document.querySelector<HTMLMetaElement>('meta[name="description"]')?.setAttribute("content", summary);
      document.querySelector<HTMLMetaElement>('meta[property="og:title"]')?.setAttribute("content", `${item.title} | اورنزا`);
      document.querySelector<HTMLMetaElement>('meta[property="og:description"]')?.setAttribute("content", summary);
      document.querySelector<HTMLMetaElement>('meta[property="og:url"]')?.setAttribute("content", canonicalUrl);
      document.querySelector<HTMLMetaElement>('meta[name="twitter:title"]')?.setAttribute("content", `${item.title} | اورنزا`);
      document.querySelector<HTMLMetaElement>('meta[name="twitter:description"]')?.setAttribute("content", summary);
      root.querySelector<HTMLElement>("[data-tag-title]")!.textContent = item.title;
      const content = root.querySelector<HTMLElement>("[data-tag-content]");
      if (content && item.content?.trim()) {
        content.innerHTML = item.content;
        content.hidden = false;
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
