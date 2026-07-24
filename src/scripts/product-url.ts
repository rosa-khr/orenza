type ProductUrlSource = {
  titleEn: string;
};

export const productSlug = (titleEn: string) =>
  titleEn
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "orenza-product";

export const productDetailUrl = (product: ProductUrlSource) =>
  `/products/${encodeURIComponent(productSlug(product.titleEn))}/`;
