import { renderCategoryTiles, type CategoryTileItem } from "./category-tiles";

const root = document.querySelector<HTMLElement>("[data-categories-tile-grid]");

if (root) {
  void fetch("/api/v1/categories/navigation", { cache: "no-store", headers: { Accept: "application/json" } })
    .then(async (response) => {
      if (!response.ok) throw new Error();
      return response.json() as Promise<{ items: CategoryTileItem[] }>;
    })
    .then(({ items }) => {
      renderCategoryTiles(root, items);
      if (!items.length) root.innerHTML = "<p>دسته‌بندی فعالی برای نمایش وجود ندارد.</p>";
    })
    .catch(() => {
      root.innerHTML = "<p>دریافت دسته‌بندی‌ها ممکن نشد؛ کمی بعد دوباره تلاش کنید.</p>";
    });
}
