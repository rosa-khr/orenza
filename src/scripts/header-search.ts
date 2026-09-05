type HeaderSearchItem = {
  type: "product" | "article" | "tag" | "category";
  label: string;
  title: string;
  subtitle: string | null;
  href: string;
  imageUrl: string | null;
};

const normalize = (value: string) => value
  .replace(/ي/g, "ی")
  .replace(/ك/g, "ک")
  .trim();

export const initHeaderSearch = () => {
  const root = document.querySelector<HTMLElement>("[data-header-search]");
  const toggle = root?.querySelector<HTMLButtonElement>("[data-header-search-toggle]");
  const panel = root?.querySelector<HTMLFormElement>("[data-header-search-panel]");
  const input = root?.querySelector<HTMLInputElement>("[data-header-search-input]");
  const results = root?.querySelector<HTMLElement>("[data-header-search-results]");
  if (!root || !toggle || !panel || !input || !results) return;

  let timer = 0;
  let controller: AbortController | null = null;

  const setOpen = (open: boolean) => {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    root.classList.toggle("is-open", open);
    if (open) window.setTimeout(() => input.focus(), 30);
  };

  const setMessage = (message: string) => {
    results.replaceChildren();
    results.textContent = message;
    results.classList.add("is-message");
    results.hidden = false;
  };

  const renderItems = (items: HeaderSearchItem[]) => {
    results.replaceChildren();
    results.classList.remove("is-message");
    if (!items.length) {
      setMessage("نتیجه‌ای پیدا نشد.");
      return;
    }
    items.forEach((item) => {
      const link = document.createElement("a");
      link.href = item.href;
      const badge = document.createElement("small");
      badge.textContent = item.label;
      const copy = document.createElement("span");
      const title = document.createElement("b");
      const subtitle = document.createElement("em");
      title.textContent = item.title;
      subtitle.textContent = item.subtitle || item.href;
      copy.append(title, subtitle);
      link.append(badge, copy);
      results.append(link);
    });
    results.hidden = false;
  };

  const search = () => {
    const query = normalize(input.value);
    window.clearTimeout(timer);
    controller?.abort();
    if (query.length < 2) {
      results.hidden = true;
      results.replaceChildren();
      return;
    }
    setMessage("در حال جست‌وجو…");
    timer = window.setTimeout(() => {
      controller = new AbortController();
      fetch(`/api/v1/search?q=${encodeURIComponent(query)}`, {
        headers: { Accept: "application/json" },
        signal: controller.signal
      })
        .then(async (response) => {
          if (!response.ok) throw new Error();
          return response.json() as Promise<{ items: HeaderSearchItem[] }>;
        })
        .then((payload) => renderItems(payload.items || []))
        .catch((error) => {
          if ((error as Error).name === "AbortError") return;
          setMessage("جست‌وجو فعلاً در دسترس نیست.");
        });
    }, 180);
  };

  toggle.addEventListener("click", () => setOpen(panel.hidden));
  input.addEventListener("input", search);
  panel.addEventListener("submit", (event) => {
    const firstResult = results.querySelector<HTMLAnchorElement>("a");
    if (!firstResult) return;
    event.preventDefault();
    location.href = firstResult.href;
  });
  document.addEventListener("pointerdown", (event) => {
    if (!root.contains(event.target as Node)) setOpen(false);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });
};
