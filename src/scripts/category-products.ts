type CategoryProduct = {
  titleFa: string;
  titleEn: string;
  description: string;
  blendType: string;
  pricePer100g: number | string;
};

const root = document.querySelector<HTMLElement>("[data-category-products]");
const list = root?.querySelector<HTMLElement>("[data-category-product-list]");
if (root && list) {
  const money = new Intl.NumberFormat("fa-IR");
  fetch(`/api/v1/products?category=${encodeURIComponent(root.dataset.category || "")}`)
    .then(async (response) => {
      if (!response.ok) throw new Error();
      return response.json() as Promise<{ items: CategoryProduct[] }>;
    })
    .then(({ items }) => {
      list.replaceChildren();
      items.forEach((product) => {
        const article = document.createElement("article");
        const eyebrow = document.createElement("span");
        const title = document.createElement("h3");
        const description = document.createElement("p");
        const footer = document.createElement("div");
        const blend = document.createElement("small");
        const price = document.createElement("strong");
        const link = document.createElement("a");
        eyebrow.textContent = product.titleEn;
        title.textContent = product.titleFa;
        description.textContent = product.description;
        blend.textContent = product.blendType;
        price.textContent = `از ${money.format(Number(product.pricePer100g))} تومان`;
        link.href = "/order/";
        link.textContent = "انتخاب این محصول";
        footer.append(blend, price, link);
        article.append(eyebrow, title, description, footer);
        list.append(article);
      });
      if (!items.length) list.innerHTML = "<p>محصول فعالی در این مجموعه وجود ندارد.</p>";
    })
    .catch(() => { list.innerHTML = "<p>دریافت محصولات ممکن نشد؛ کمی بعد دوباره تلاش کنید.</p>"; });
}
