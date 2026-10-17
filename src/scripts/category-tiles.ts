import { createCategoryIcon, type CategoryIconName } from "./category-icon";

export type CategoryTileItem = {
  id?: string;
  title: string;
  slug: string;
  imageUrl?: string | null;
  mobileImageUrl?: string | null;
  iconName?: CategoryIconName | null;
  children?: { id?: string; title: string; slug: string }[];
};

export const categoryHref = (slug: string) => `/category/${encodeURIComponent(slug)}/`;

export const renderCategoryTiles = (root: HTMLElement, items: CategoryTileItem[]) => {
  root.replaceChildren();
  items.forEach((item, index) => {
    const tile = document.createElement("a");
    tile.className = "category-index-tile";
    tile.href = categoryHref(item.slug);
    tile.style.setProperty("--category-tile-index", String(index));

    const selectedIcon = item.iconName ? createCategoryIcon(item.iconName) : null;
    const desktopBanner = item.imageUrl || item.mobileImageUrl || "";
    const mobileBanner = item.mobileImageUrl || item.imageUrl || "";
    if (selectedIcon) {
      tile.append(selectedIcon);
    } else if (desktopBanner) {
      const picture = document.createElement("picture");
      picture.className = "category-index-media";
      const source = document.createElement("source");
      source.media = "(max-width: 699px)";
      source.srcset = mobileBanner;
      const image = document.createElement("img");
      image.src = desktopBanner;
      image.alt = "";
      image.loading = "lazy";
      picture.append(source, image);
      tile.append(picture);
      tile.classList.add("has-category-banner");
    } else {
      const mark = document.createElement("span");
      mark.className = "category-index-mark";
      mark.textContent = item.title.trim().charAt(0) || "ا";
      tile.append(mark);
    }

    const copy = document.createElement("div");
    const title = document.createElement("strong");
    const description = document.createElement("small");
    title.textContent = item.title;
    const childNames = (item.children || []).map((child) => child.title);
    description.textContent = childNames.length ? childNames.join("، ") : "مشاهده محصولات این دسته";
    copy.append(title, description);
    tile.append(copy);
    root.append(tile);
  });
};
