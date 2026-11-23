// Match the first purchasable weight and discount calculation shown on the page.
export const productOfferData = (product: Record<string, unknown>) => {
  const packaged = product.saleType === "packaged";
  const weights = Array.isArray(product.availableWeightsGrams) ? product.availableWeightsGrams : [250, 500, 1000];
  const weight = packaged ? Number(product.packageWeightGrams || 250)
    : weights.map(Number).filter((value) => Number.isInteger(value) && value > 0).sort((a, b) => a - b)[0] || 250;
  const regular = packaged ? Number(product.packagePrice || product.salePricePerKg || 0)
    : Math.round(Number(product.salePricePerKg || 0) * weight / 1000);
  const discountedUnit = Number(product.discountSalePricePerKg || 0);
  const percent = Number(product.discountPercent || 0);
  const discounted = discountedUnit > 0
    ? packaged ? discountedUnit : Math.round(discountedUnit * weight / 1000)
    : percent > 0 && percent < 100 ? Math.round(regular * (1 - percent / 100)) : regular;
  const price = product.showInDiscounts && discounted > 0 && discounted < regular ? discounted : regular;
  return { weight, regular, price };
};

export const createProductSchema = (canonicalUrl: string, product: Record<string, unknown>) => {
  const origin = new URL(canonicalUrl).origin;
  const { weight, regular, price } = productOfferData(product);
  const images = [product.imageUrl, ...(Array.isArray(product.productImageUrls) ? product.productImageUrls : [])]
    .filter((image): image is string => typeof image === "string" && Boolean(image.trim()))
    .flatMap((image) => {
      try { const url = new URL(image, origin); return ["http:", "https:"].includes(url.protocol) ? [url.toString()] : []; }
      catch { return []; }
    });
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${canonicalUrl}#product`,
    name: String(product.titleFa),
    description: String(product.description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim(),
    url: canonicalUrl,
    mainEntityOfPage: { "@id": `${canonicalUrl}#webpage` },
    ...(product.id ? { sku: String(product.id) } : {}),
    ...(images.length ? { image: [...new Set(images)] } : {}),
    ...(product.categoryTitle ? { category: String(product.categoryTitle) } : {}),
    weight: { "@type": "QuantitativeValue", value: weight, unitCode: "GRM" },
    ...(Number.isFinite(price) && price > 0 ? { offers: {
      "@type": "Offer",
      url: canonicalUrl,
      // Store prices are in toman; structured data uses the ISO currency IRR.
      price: Math.round(price * 10),
      priceCurrency: "IRR",
      availability: `https://schema.org/${product.stockStatus === "outOfStock" ? "OutOfStock" : "InStock"}`,
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@type": "Organization", name: "قهوه اورنزا", url: `${origin}/` },
      ...(price < regular ? { priceSpecification: {
        "@type": "UnitPriceSpecification", priceType: "https://schema.org/StrikethroughPrice",
        price: Math.round(regular * 10), priceCurrency: "IRR"
      } } : {})
    } } : {})
  };
};
