type HeaderSearchItem = {
  type: "product" | "article" | "tag" | "category";
  label: string;
  title: string;
  subtitle: string | null;
  href: string;
  imageUrl: string | null;
};

const fallbackMarks: Record<HeaderSearchItem["type"], string> = {
  product: "ق",
  article: "م",
  tag: "#",
  category: "د"
};

const defaultItems: HeaderSearchItem[] = [
  {
    type: "category",
    label: "دسته‌بندی",
    title: "قهوه‌های اورنزا",
    subtitle: "عربیکا، روبوستا و ترکیب‌های پیشنهادی",
    href: "/products/coffee-blends/",
    imageUrl: null
  },
  {
    type: "category",
    label: "دسته‌بندی",
    title: "نوشیدنی‌های پودری",
    subtitle: "ماچا، ماسالا، هات‌چاکلت و نوشیدنی‌های کافه‌ای",
    href: "/products/cafe-drinks/",
    imageUrl: null
  },
  {
    type: "category",
    label: "دسته‌بندی",
    title: "دمنوش‌ها",
    subtitle: "ترکیب‌های گیاهی برای روزهای آرام‌تر",
    href: "/products/herbal-tea/",
    imageUrl: null
  }
];

const normalize = (value: string) => value
  .replace(/ي/g, "ی")
  .replace(/ك/g, "ک")
  .trim();

export const initHeaderSearch = () => {
  const root = document.querySelector<HTMLElement>("[data-header-search]");
  const toggle = root?.querySelector<HTMLButtonElement>("[data-header-search-toggle]");
  const panel = root?.querySelector<HTMLFormElement>("[data-header-search-panel]");
  const input = root?.querySelector<HTMLInputElement>("[data-header-search-input]");
  const clear = root?.querySelector<HTMLButtonElement>("[data-header-search-clear]");
  const results = root?.querySelector<HTMLElement>("[data-header-search-results]");
  if (!root || !toggle || !panel || !input || !clear || !results) return;

  let timer = 0;
  let controller: AbortController | null = null;
  let popularItems: HeaderSearchItem[] | null = null;

  const renderItems = (items: HeaderSearchItem[], suggestions = false) => {
    results.replaceChildren();
    results.classList.remove("is-message");
    results.classList.toggle("is-suggestions", suggestions);
    if (suggestions) {
      const heading = document.createElement("p");
      heading.className = "header-search-results-title";
      heading.textContent = "جستجوهای پرطرفدار";
      results.append(heading);
    }
    if (!items.length) {
      if (suggestions) {
        const empty = document.createElement("p");
        empty.className = "header-search-empty";
        empty.textContent = "هنوز موردی برای نمایش انتخاب نشده است.";
        results.append(empty);
        results.hidden = false;
        return;
      }
      setMessage("نتیجه‌ای پیدا نشد.");
      return;
    }
    items.forEach((item) => {
      const link = document.createElement("a");
      link.href = item.href;
      link.dataset.searchType = item.type;
      const visual = item.imageUrl ? document.createElement("img") : document.createElement("small");
      if (item.imageUrl) {
        (visual as HTMLImageElement).src = item.imageUrl;
        (visual as HTMLImageElement).alt = "";
        (visual as HTMLImageElement).loading = "lazy";
      } else {
        visual.textContent = suggestions ? "⌕" : fallbackMarks[item.type];
        visual.title = item.label;
        visual.setAttribute("aria-label", item.label);
      }
      const copy = document.createElement("span");
      const title = document.createElement("b");
      const subtitle = document.createElement("em");
      title.textContent = item.title;
      subtitle.textContent = item.subtitle || item.href;
      copy.append(title, subtitle);
      link.append(visual, copy);
      results.append(link);
    });
    results.hidden = false;
  };

  const renderPopular = () => {
    renderItems(popularItems ?? defaultItems, true);
  };

  const loadPopular = async () => {
    renderItems(defaultItems, true);
    try {
      const response = await fetch(`/api/v1/search/popular?ts=${Date.now()}`, {
        cache: "no-store",
        headers: { Accept: "application/json" }
      });
      if (!response.ok) throw new Error();
      const payload = await response.json() as { items?: HeaderSearchItem[] };
      popularItems = payload.items || [];
      if (!normalize(input.value)) renderPopular();
    } catch {
      popularItems = defaultItems;
    }
  };

  const setOpen = (open: boolean) => {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    root.classList.toggle("is-open", open);
    if (open) {
      window.setTimeout(() => input.focus(), 30);
      if (!normalize(input.value)) void loadPopular();
    }
  };

  const setMessage = (message: string) => {
    results.replaceChildren();
    results.textContent = message;
    results.classList.add("is-message");
    results.classList.remove("is-suggestions");
    results.hidden = false;
  };

  const search = () => {
    const query = normalize(input.value);
    window.clearTimeout(timer);
    controller?.abort();
    clear.hidden = query.length === 0;
    if (query.length < 2) {
      void loadPopular();
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
  input.addEventListener("focus", () => {
    if (!normalize(input.value)) void loadPopular();
  });
  clear.addEventListener("click", () => {
    input.value = "";
    clear.hidden = true;
    void loadPopular();
    input.focus();
  });
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
