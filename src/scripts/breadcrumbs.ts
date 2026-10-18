export type BreadcrumbItem = {
  label: string;
  href: string;
};

export const renderBreadcrumbs = (id: string, items: BreadcrumbItem[]) => {
  const nav = document.querySelector<HTMLElement>(`[data-breadcrumb="${id}"]`);
  const list = nav?.querySelector<HTMLOListElement>("ol");
  if (!nav || !list || !items.length) return;

  list.replaceChildren(...items.map((item, index) => {
    const row = document.createElement("li");
    const link = document.createElement("a");
    link.href = item.href;
    link.textContent = item.label;
    if (index === items.length - 1) link.setAttribute("aria-current", "page");
    row.append(link);
    if (index < items.length - 1) {
      const separator = document.createElement("span");
      separator.setAttribute("aria-hidden", "true");
      separator.textContent = "/";
      row.append(separator);
    }
    return row;
  }));

  const parentItem = items.length > 1 ? items[items.length - 2] : items[0];
  const backLink = nav.querySelector<HTMLAnchorElement>("[data-breadcrumb-back]");
  const backLabel = backLink?.querySelector<HTMLElement>("[data-breadcrumb-back-label]");
  if (backLink && parentItem) {
    backLink.href = parentItem.href;
    if (backLabel) backLabel.textContent = `بازگشت به ${parentItem.label}`;
  }

  const schema = document.querySelector<HTMLScriptElement>(`script[data-breadcrumb-schema="${id}"]`);
  if (schema) {
    schema.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: items.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.label,
        item: new URL(item.href, location.origin).toString()
      }))
    });
  }
};
