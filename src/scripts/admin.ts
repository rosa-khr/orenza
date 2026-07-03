type ResourceField = {
  key: string;
  label: string;
  type: string;
  options?: { label: string; value: string }[];
  readonly?: boolean;
};

type ResourceConfig = {
  key: string;
  title: string;
  singular: string;
  fields: ResourceField[];
};

const faNumber = new Intl.NumberFormat("fa-IR");
const money = new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 });
const statusLabels: Record<string, string> = {
  true: "فعال",
  false: "غیرفعال",
  new: "جدید",
  processing: "در حال آماده‌سازی",
  sent: "ارسال‌شده",
  completed: "تکمیل‌شده",
  canceled: "لغوشده",
  pending: "در انتظار",
  paid: "پرداخت‌شده",
  rejected: "ردشده",
  bean: "دان",
  ground: "آسیاب‌شده",
  percent: "درصدی",
  fixed: "مبلغ ثابت",
  cardToCard: "کارت‌به‌کارت",
  bankGateway: "درگاه بانکی",
  zarinpal: "زرین‌پال"
};

const api = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const response = await fetch(path, {
    credentials: "include",
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) }
  });
  if (response.status === 401) {
    if (!location.pathname.startsWith("/admin/login")) {
      location.href = `/admin/login/?next=${encodeURIComponent(location.pathname + location.search)}`;
    }
    throw new Error("برای ادامه، با حساب مدیر وارد شوید.");
  }
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(payload?.error || "انجام درخواست ممکن نشد.");
  return payload as T;
};

const toast = (message: string, type: "success" | "error" = "success") => {
  const root = document.querySelector<HTMLElement>("[data-admin-toasts]");
  if (!root) return;
  const item = document.createElement("div");
  item.className = `admin-toast ${type}`;
  item.textContent = message;
  root.append(item);
  requestAnimationFrame(() => item.classList.add("show"));
  window.setTimeout(() => {
    item.classList.remove("show");
    window.setTimeout(() => item.remove(), 220);
  }, 3200);
};

const askConfirm = (title: string, message: string, acceptLabel = "تأیید") =>
  new Promise<boolean>((resolve) => {
    const layer = document.querySelector<HTMLElement>("[data-admin-confirm]");
    if (!layer) {
      resolve(window.confirm(message));
      return;
    }
    const titleElement = layer.querySelector<HTMLElement>("[data-confirm-title]");
    const messageElement = layer.querySelector<HTMLElement>("[data-confirm-message]");
    const accept = layer.querySelector<HTMLButtonElement>("[data-confirm-accept]")!;
    const cancelButtons = layer.querySelectorAll<HTMLButtonElement>("[data-confirm-cancel], [data-confirm-dismiss]");
    if (titleElement) titleElement.textContent = title;
    if (messageElement) messageElement.textContent = message;
    accept.textContent = acceptLabel;
    layer.hidden = false;
    requestAnimationFrame(() => layer.classList.add("show"));
    const finish = (result: boolean) => {
      layer.classList.remove("show");
      window.setTimeout(() => { layer.hidden = true; }, 180);
      accept.onclick = null;
      cancelButtons.forEach((button) => { button.onclick = null; });
      resolve(result);
    };
    accept.onclick = () => finish(true);
    cancelButtons.forEach((button) => { button.onclick = () => finish(false); });
    accept.focus();
  });

const enhanceDropdowns = (root: ParentNode = document) => {
  if (!document.body.dataset.dropdownOutsideReady) {
    document.body.dataset.dropdownOutsideReady = "true";
    document.addEventListener("pointerdown", (event) => {
      if ((event.target as HTMLElement).closest(".admin-dropdown")) return;
      document.querySelectorAll<HTMLElement>(".admin-dropdown-panel").forEach((panel) => { panel.hidden = true; });
      document.querySelectorAll(".admin-dropdown.open").forEach((dropdown) => dropdown.classList.remove("open"));
    });
  }
  root.querySelectorAll<HTMLSelectElement>("select:not([data-dropdown-ready])").forEach((select) => {
    select.dataset.dropdownReady = "true";
    select.classList.add("admin-native-select");
    const dropdown = document.createElement("div");
    dropdown.className = "admin-dropdown";
    dropdown.innerHTML = `
      <button class="admin-dropdown-control" type="button">
        <span></span>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </button>
      <div class="admin-dropdown-panel" hidden>
        <label><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="1.5"/><path d="m16 16 4 4" stroke="currentColor" stroke-width="1.5"/></svg><input type="search" placeholder="جستجو..." /></label>
        <div></div>
      </div>`;
    select.insertAdjacentElement("afterend", dropdown);
    const control = dropdown.querySelector<HTMLButtonElement>(".admin-dropdown-control")!;
    const value = control.querySelector<HTMLElement>("span")!;
    const panel = dropdown.querySelector<HTMLElement>(".admin-dropdown-panel")!;
    const search = panel.querySelector<HTMLInputElement>("input")!;
    const optionsRoot = panel.querySelector<HTMLElement>(":scope > div")!;
    const syncLabel = () => {
      value.textContent = select.selectedOptions[0]?.textContent || "انتخاب کنید";
      value.classList.toggle("placeholder", !select.value);
    };
    const render = () => {
      const query = search.value.trim().toLowerCase();
      optionsRoot.replaceChildren();
      [...select.options].filter((option) =>
        !query || (option.textContent || "").toLowerCase().includes(query)
      ).forEach((option) => {
        const button = document.createElement("button");
        button.type = "button";
        button.classList.toggle("selected", option.value === select.value);
        button.innerHTML = `<span>${option.textContent}</span>${option.value === select.value ? "<b>✓</b>" : ""}`;
        button.addEventListener("click", () => {
          select.value = option.value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
          syncLabel();
          panel.hidden = true;
          dropdown.classList.remove("open");
        });
        optionsRoot.append(button);
      });
    };
    control.addEventListener("click", () => {
      const willOpen = panel.hidden;
      document.querySelectorAll<HTMLElement>(".admin-dropdown-panel").forEach((item) => { item.hidden = true; });
      document.querySelectorAll(".admin-dropdown.open").forEach((item) => item.classList.remove("open"));
      panel.hidden = !willOpen;
      dropdown.classList.toggle("open", willOpen);
      if (willOpen) { search.value = ""; render(); search.focus(); }
    });
    search.addEventListener("input", render);
    select.addEventListener("change", syncLabel);
    syncLabel();
  });
};

const normalizeNumber = (value: string) =>
  value.replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)));

const persianDateParts = (date: Date) => {
  const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
    year: "numeric", month: "2-digit", day: "2-digit"
  }).formatToParts(date);
  const read = (type: string) => Number(normalizeNumber(parts.find((part) => part.type === type)?.value || "0"));
  return { year: read("year"), month: read("month"), day: read("day") };
};

const formatPersianDate = (date: Date) => {
  const { year, month, day } = persianDateParts(date);
  return `${year}/${String(month).padStart(2, "0")}/${String(day).padStart(2, "0")}`;
};

const enhancePersianDates = (root: ParentNode = document) => {
  root.querySelectorAll<HTMLInputElement>('input[type="date"]:not([data-persian-ready])').forEach((hiddenInput) => {
    hiddenInput.dataset.persianReady = "true";
    hiddenInput.type = "hidden";
    const picker = document.createElement("div");
    picker.className = "admin-persian-date";
    picker.innerHTML = `
      <button type="button"><span>انتخاب تاریخ</span><b>تقویم</b></button>
      <div class="admin-persian-calendar" hidden>
        <header><button type="button" data-month-prev>‹</button><strong></strong><button type="button" data-month-next>›</button></header>
        <div class="weekdays"><i>ش</i><i>ی</i><i>د</i><i>س</i><i>چ</i><i>پ</i><i>ج</i></div>
        <div class="days"></div>
        <footer><button type="button" data-date-today>امروز</button></footer>
      </div>`;
    hiddenInput.insertAdjacentElement("afterend", picker);
    const trigger = picker.querySelector<HTMLButtonElement>(":scope > button")!;
    const label = trigger.querySelector<HTMLElement>("span")!;
    const calendar = picker.querySelector<HTMLElement>(".admin-persian-calendar")!;
    const heading = calendar.querySelector<HTMLElement>("header strong")!;
    const daysRoot = calendar.querySelector<HTMLElement>(".days")!;
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const dates: Date[] = [];
    for (let offset = -730; offset <= 1460; offset += 1) {
      const date = new Date(today);
      date.setDate(today.getDate() + offset);
      dates.push(date);
    }
    const monthKeys = [...new Set(dates.map((date) => {
      const part = persianDateParts(date);
      return `${part.year}-${part.month}`;
    }))];
    const selectedDate = () => hiddenInput.value ? new Date(`${hiddenInput.value}T12:00:00`) : today;
    let monthIndex = monthKeys.indexOf((() => {
      const part = persianDateParts(selectedDate());
      return `${part.year}-${part.month}`;
    })());
    const renderMonth = () => {
      const key = monthKeys[Math.max(0, Math.min(monthKeys.length - 1, monthIndex))]!;
      const [year, month] = key.split("-").map(Number);
      heading.textContent = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric", month: "long" })
        .format(dates.find((date) => {
          const part = persianDateParts(date);
          return part.year === year && part.month === month;
        }) || today);
      const monthDates = dates.filter((date) => {
        const part = persianDateParts(date);
        return part.year === year && part.month === month;
      });
      daysRoot.replaceChildren();
      const firstOffset = monthDates[0] ? (monthDates[0].getDay() + 1) % 7 : 0;
      for (let index = 0; index < firstOffset; index += 1) daysRoot.append(document.createElement("i"));
      monthDates.forEach((date) => {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = new Intl.NumberFormat("fa-IR").format(persianDateParts(date).day);
        const iso = date.toISOString().slice(0, 10);
        button.classList.toggle("selected", iso === hiddenInput.value);
        button.addEventListener("click", () => {
          hiddenInput.value = iso;
          hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
          calendar.hidden = true;
        });
        daysRoot.append(button);
      });
    };
    const sync = () => {
      label.textContent = hiddenInput.value ? formatPersianDate(selectedDate()) : "انتخاب تاریخ";
      const part = persianDateParts(selectedDate());
      monthIndex = monthKeys.indexOf(`${part.year}-${part.month}`);
      renderMonth();
    };
    trigger.addEventListener("click", () => { calendar.hidden = !calendar.hidden; if (!calendar.hidden) renderMonth(); });
    calendar.querySelector("[data-month-prev]")?.addEventListener("click", () => { monthIndex = Math.max(0, monthIndex - 1); renderMonth(); });
    calendar.querySelector("[data-month-next]")?.addEventListener("click", () => { monthIndex = Math.min(monthKeys.length - 1, monthIndex + 1); renderMonth(); });
    calendar.querySelector("[data-date-today]")?.addEventListener("click", () => {
      hiddenInput.value = today.toISOString().slice(0, 10);
      hiddenInput.dispatchEvent(new Event("change", { bubbles: true }));
      calendar.hidden = true;
    });
    hiddenInput.addEventListener("change", sync);
    sync();
  });
};

const initChrome = async () => {
  const app = document.querySelector<HTMLElement>("[data-admin-app]");
  document.querySelector("[data-admin-menu-open]")?.addEventListener("click", () => app?.classList.add("menu-open"));
  document.querySelectorAll("[data-admin-menu-close]").forEach((button) =>
    button.addEventListener("click", () => app?.classList.remove("menu-open"))
  );
  document.querySelector("[data-admin-logout]")?.addEventListener("click", async () => {
    await api("/api/v1/auth/logout", { method: "POST" });
    location.href = "/admin/login/";
  });
  if (!app) return;
  try {
    const { user } = await api<{ user: { displayName: string | null; role: string } }>("/api/v1/me");
    if (user.role !== "admin") throw new Error("این حساب دسترسی مدیریت ندارد.");
    const label = document.querySelector<HTMLElement>("[data-admin-user]");
    if (label) label.textContent = user.displayName || "مدیر اورنزا";
  } catch (error) {
    toast(error instanceof Error ? error.message : "دسترسی مدیریت تأیید نشد.", "error");
  }
};

const initLogin = () => {
  const form = document.querySelector<HTMLFormElement>("[data-admin-login]");
  if (!form) return;
  const error = form.querySelector<HTMLElement>("[data-login-error]");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      if (error) error.textContent = "شماره موبایل و رمز عبور را کامل وارد کنید.";
      form.reportValidity();
      return;
    }
    const button = form.querySelector<HTMLButtonElement>("button[type=submit]")!;
    const data = new FormData(form);
    button.disabled = true;
    button.textContent = "در حال ورود…";
    try {
      const result = await api<{ user: { role: string } }>("/api/v1/auth/admin-login", {
        method: "POST",
        body: JSON.stringify({
          username: String(data.get("username") || "").trim(),
          password: String(data.get("password") || "")
        })
      });
      if (result.user.role !== "admin") {
        await api("/api/v1/auth/logout", { method: "POST" });
        throw new Error("این حساب دسترسی مدیریت ندارد.");
      }
      const next = new URLSearchParams(location.search).get("next");
      location.href = next?.startsWith("/admin/") ? next : "/admin/";
    } catch (reason) {
      if (error) error.textContent = reason instanceof Error ? reason.message : "ورود انجام نشد.";
      button.disabled = false;
      button.textContent = "ورود به پنل";
    }
  });
};

const readConfig = (root: HTMLElement) => {
  const node = root.querySelector<HTMLScriptElement>("[data-resource-config]");
  return node ? (JSON.parse(node.textContent || "{}") as ResourceConfig) : null;
};

const displayValue = (value: unknown, field: ResourceField) => {
  if (value === null || value === undefined || value === "") return "—";
  const option = field.options?.find((item) => String(item.value) === String(value));
  if (option) return option.label;
  if (statusLabels[String(value)]) return statusLabels[String(value)];
  if (field.type === "number") return money.format(Number(value));
  if (field.type === "date") return new Date(String(value)).toLocaleDateString("fa-IR");
  return String(value);
};

const initList = (root: HTMLElement, config: ResourceConfig) => {
  const rows = root.querySelector<HTMLTableSectionElement>("[data-admin-rows]")!;
  const total = root.querySelector<HTMLElement>("[data-admin-total]")!;
  const pageLabel = root.querySelector<HTMLElement>("[data-admin-page]")!;
  const search = root.querySelector<HTMLInputElement>("[data-admin-search]");
  const filters = [...root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-admin-filter]")];
  let page = 1;
  let totalPages = 1;
  let timer = 0;
  enhanceDropdowns(root);
  enhancePersianDates(root);

  const load = async () => {
    rows.innerHTML = `<tr><td colspan="${config.fields.length + 2}"><div class="admin-loading">در حال دریافت اطلاعات…</div></td></tr>`;
    const params = new URLSearchParams({ page: String(page), pageSize: "15" });
    if (search?.value.trim()) params.set("search", search.value.trim());
    filters.forEach((input) => input.value && params.set(input.dataset.adminFilter || "", input.value));
    try {
      const payload = await api<{ items: Record<string, unknown>[]; total: number; page: number; pageSize: number }>(
        `/api/v1/admin/${config.key}?${params}`
      );
      totalPages = Math.max(1, Math.ceil(payload.total / payload.pageSize));
      page = payload.page;
      pageLabel.textContent = faNumber.format(page);
      total.textContent = `${faNumber.format(payload.total)} رکورد`;
      rows.replaceChildren();
      if (!payload.items.length) {
        rows.innerHTML = `<tr><td colspan="${config.fields.length + 2}"><div class="admin-empty">رکوردی پیدا نشد.</div></td></tr>`;
        return;
      }
      payload.items.forEach((item, index) => {
        const tr = document.createElement("tr");
        const indexCell = document.createElement("td");
        indexCell.textContent = faNumber.format((page - 1) * payload.pageSize + index + 1);
        tr.append(indexCell);
        config.fields.forEach((field) => {
          const td = document.createElement("td");
          const value = item[field.key];
          td.textContent = displayValue(value, field);
          if (["isActive", "isPublished", "orderStatus", "paymentStatus"].includes(field.key)) {
            td.innerHTML = `<span class="admin-badge admin-status status-${String(value)}">${td.textContent}</span>`;
          }
          tr.append(td);
        });
        const actions = document.createElement("td");
        actions.className = "admin-row-actions";
        const icon = {
          eye: '<svg viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>',
          pencil: '<svg viewBox="0 0 24 24"><path d="m4 20 4.2-1 10.6-10.6-3.2-3.2L5 15.8 4 20Z"/><path d="m13.8 7 3.2 3.2"/></svg>',
          trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m5 5v5m4-5v5"/></svg>',
          invoice: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/></svg>',
          approve: '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>',
          cancel: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/></svg>'
        };
        const isPendingOrder = config.key === "orders" && item.orderStatus === "new" && item.paymentStatus === "pending";
        actions.innerHTML = `
          <a href="/admin/${config.key}/view/?id=${item.id}" aria-label="مشاهده" title="مشاهده">${icon.eye}</a>
          <a href="/admin/${config.key}/edit/?id=${item.id}" aria-label="ویرایش" title="ویرایش">${icon.pencil}</a>
          ${config.key === "orders" ? `<a href="/admin/orders/invoice/?id=${item.id}" aria-label="فاکتور" title="مشاهده و چاپ فاکتور">${icon.invoice}</a>` : ""}
          ${isPendingOrder ? `<button type="button" data-order-action="approve" data-id="${item.id}" data-payment="${item.paymentStatus}" aria-label="تأیید سفارش" title="تأیید سفارش">${icon.approve}</button>` : ""}
          ${isPendingOrder ? `<button type="button" data-order-action="cancel" data-id="${item.id}" data-payment="${item.paymentStatus}" aria-label="لغو سفارش" title="لغو سفارش">${icon.cancel}</button>` : ""}
          ${config.key !== "orders" || isPendingOrder ? `<button type="button" data-delete="${item.id}" aria-label="حذف" title="حذف">${icon.trash}</button>` : ""}`;
        tr.append(actions);
        rows.append(tr);
      });
    } catch (error) {
      rows.innerHTML = `<tr><td colspan="${config.fields.length + 2}"><div class="admin-empty">${error instanceof Error ? error.message : "خطا در دریافت اطلاعات"}</div></td></tr>`;
    }
  };

  rows.addEventListener("click", async (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-delete]");
    if (button) {
      const accepted = await askConfirm("حذف رکورد", "این عملیات قابل بازگشت نیست. از حذف این رکورد مطمئن هستید؟", "بله، حذف شود");
      if (!accepted) return;
      try {
        await api(`/api/v1/admin/${config.key}/${button.dataset.delete}`, { method: "DELETE" });
        toast("رکورد با موفقیت حذف شد.");
        await load();
      } catch (error) {
        toast(error instanceof Error ? error.message : "حذف انجام نشد.", "error");
      }
      return;
    }
    const orderAction = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-order-action]");
    if (!orderAction) return;
    const action = orderAction.dataset.orderAction;
    const accepted = await askConfirm(
      action === "approve" ? "تأیید سفارش" : "لغو سفارش",
      action === "approve"
        ? "پس از تأیید، سفارش وارد مرحله آماده‌سازی می‌شود. ادامه می‌دهید؟"
        : "سفارش لغو شود؟ این تغییر در وضعیت سفارش ثبت خواهد شد.",
      action === "approve" ? "تأیید و شروع آماده‌سازی" : "لغو سفارش"
    );
    if (!accepted) return;
    try {
      await api(`/api/v1/admin/orders/${orderAction.dataset.id}`, {
        method: "PUT",
        body: JSON.stringify({
          orderStatus: action === "approve" ? "processing" : "canceled",
          paymentStatus: orderAction.dataset.payment || "pending",
          adminNote: action === "cancel" ? "سفارش توسط مدیر لغو شد." : null
        })
      });
      toast(action === "approve" ? "سفارش تأیید شد." : "سفارش لغو شد.");
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "تغییر وضعیت انجام نشد.", "error");
    }
  });
  search?.addEventListener("input", () => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => { page = 1; void load(); }, 350);
  });
  filters.forEach((input) => input.addEventListener("change", () => { page = 1; void load(); }));
  root.querySelector("[data-admin-prev]")?.addEventListener("click", () => {
    if (page > 1) { page -= 1; void load(); }
  });
  root.querySelector("[data-admin-next]")?.addEventListener("click", () => {
    if (page < totalPages) { page += 1; void load(); }
  });
  void load();
};

const setFormValue = (form: HTMLFormElement, key: string, value: unknown) => {
  const input = form.elements.namedItem(key) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
  if (!input) return;
  if ((input.type === "date" || input.dataset.persianReady) && value) {
    input.value = String(value).slice(0, 10);
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }
  else if (Array.isArray(value)) input.value = value.join(", ");
  else input.value = value === null || value === undefined ? "" : String(value);
};

const loadLookups = async (form: HTMLFormElement) => {
  const category = form.querySelector<HTMLSelectElement>('[data-dynamic-options="categoryId"]');
  if (!category) return;
  try {
    const payload = await api<{ items: { id: string; title: string }[] }>("/api/v1/admin/categories?pageSize=100");
    payload.items.forEach((item) => category.add(new Option(item.title, item.id)));
  } catch {
    // The server-side validation still protects invalid category values.
  }
};

type AdminPaymentCard = {
  id: string;
  paymentMethodId: string;
  cardNumber: string;
  shebaNumber: string;
  accountNumber: string;
  accountOwner: string;
  bankName: string;
  isActive: boolean;
};

const initPaymentCards = (form: HTMLFormElement, paymentMethodId: string, readonly: boolean) => {
  const section = form.querySelector<HTMLElement>("[data-payment-cards]");
  const list = form.querySelector<HTMLElement>("[data-card-list]");
  const editor = form.querySelector<HTMLElement>("[data-card-editor]");
  if (!section || !list) return;
  section.hidden = false;
  const input = (name: string) =>
    form.querySelector<HTMLInputElement | HTMLSelectElement>(`[data-card-input="${name}"]`);
  const resetEditor = () => {
    ["id", "cardNumber", "shebaNumber", "accountNumber", "accountOwner", "bankName"].forEach((name) => {
      const control = input(name);
      if (control) {
        control.value = "";
        control.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    const active = input("isActive");
    if (active) {
      active.value = "true";
      active.dispatchEvent(new Event("change", { bubbles: true }));
    }
  };
  const openEditor = (card?: AdminPaymentCard) => {
    if (!editor) return;
    resetEditor();
    if (card) {
      Object.entries(card).forEach(([key, value]) => {
        const control = input(key);
        if (control) {
          control.value = String(value);
          control.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
    }
    editor.hidden = false;
    input("cardNumber")?.focus();
  };
  const load = async () => {
    list.innerHTML = '<p class="admin-loading">در حال دریافت کارت‌ها…</p>';
    try {
      const payload = await api<{ items: AdminPaymentCard[] }>(
        `/api/v1/admin/payment-cards?pageSize=100&paymentMethodId=${paymentMethodId}`
      );
      list.replaceChildren();
      if (!payload.items.length) {
        list.innerHTML = "<p class=\"admin-empty\">هنوز کارتی ثبت نشده است.</p>";
        return;
      }
      payload.items.forEach((card) => {
        const article = document.createElement("article");
        article.innerHTML = `
          <div><span>${card.bankName}</span><strong dir="ltr">${card.cardNumber.replace(/(\d{4})(?=\d)/g, "$1 ")}</strong></div>
          <div><small>شبا</small><b dir="ltr">IR${card.shebaNumber}</b></div>
          <div><small>حساب</small><b dir="ltr">${card.accountNumber}</b></div>
          <div><small>صاحب حساب</small><b>${card.accountOwner}</b></div>
          <span class="admin-badge admin-status status-${card.isActive}">${card.isActive ? "فعال" : "غیرفعال"}</span>
          ${readonly ? "" : `<footer><button type="button" data-card-edit="${card.id}">ویرایش</button><button type="button" data-card-delete="${card.id}">حذف</button></footer>`}`;
        article.querySelector("[data-card-edit]")?.addEventListener("click", () => openEditor(card));
        article.querySelector("[data-card-delete]")?.addEventListener("click", async () => {
          const accepted = await askConfirm("حذف کارت", "این کارت از روش کارت‌به‌کارت حذف شود؟", "حذف کارت");
          if (!accepted) return;
          try {
            await api(`/api/v1/admin/payment-cards/${card.id}`, { method: "DELETE" });
            toast("کارت حذف شد.");
            await load();
          } catch (error) {
            toast(error instanceof Error ? error.message : "حذف کارت انجام نشد.", "error");
          }
        });
        list.append(article);
      });
    } catch (error) {
      list.innerHTML = `<p class="admin-empty">${error instanceof Error ? error.message : "دریافت کارت‌ها انجام نشد."}</p>`;
    }
  };
  form.querySelector("[data-card-add]")?.addEventListener("click", () => openEditor());
  form.querySelector("[data-card-editor-cancel]")?.addEventListener("click", () => {
    if (editor) editor.hidden = true;
    resetEditor();
  });
  form.querySelector("[data-card-save]")?.addEventListener("click", async () => {
    const body = {
      paymentMethodId,
      cardNumber: input("cardNumber")?.value.trim(),
      shebaNumber: input("shebaNumber")?.value.trim(),
      accountNumber: input("accountNumber")?.value.trim(),
      accountOwner: input("accountOwner")?.value.trim(),
      bankName: input("bankName")?.value,
      isActive: input("isActive")?.value === "true"
    };
    if (!body.cardNumber || !body.shebaNumber || !body.accountNumber || !body.accountOwner || !body.bankName) {
      toast("همه اطلاعات کارت، شبا و حساب را کامل کنید.", "error");
      return;
    }
    const id = input("id")?.value;
    try {
      await api(`/api/v1/admin/payment-cards${id ? `/${id}` : ""}`, {
        method: id ? "PUT" : "POST",
        body: JSON.stringify(body)
      });
      toast("اطلاعات کارت ذخیره شد.");
      if (editor) editor.hidden = true;
      resetEditor();
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : "ذخیره کارت انجام نشد.", "error");
    }
  });
  void load();
};

const initForm = async (form: HTMLFormElement, config: ResourceConfig, mode: string) => {
  await loadLookups(form);
  enhanceDropdowns(form);
  enhancePersianDates(form);
  const updateProductProfit = () => {
    if (config.key !== "products") return;
    const purchase = form.elements.namedItem("purchasePricePerKg") as HTMLInputElement | null;
    const sale = form.elements.namedItem("salePricePerKg") as HTMLInputElement | null;
    const profit = form.elements.namedItem("profitPerKg") as HTMLInputElement | null;
    const purchaseValue = Number(purchase?.value || 0);
    const saleValue = Number(sale?.value || 0);
    if (profit) profit.value = String(saleValue - purchaseValue);
    const breakdown = form.querySelector<HTMLElement>("[data-price-breakdown] > div");
    if (breakdown) {
      breakdown.innerHTML = [100, 250, 500, 1000].map((grams) => {
        const ratio = grams / 1000;
        return `<article>
          <strong>${faNumber.format(grams)} گرم</strong>
          <span>خرید <b>${money.format(Math.round(purchaseValue * ratio))}</b></span>
          <span>فروش <b>${money.format(Math.round(saleValue * ratio))}</b></span>
          <span>سود <b>${money.format(Math.round((saleValue - purchaseValue) * ratio))}</b></span>
        </article>`;
      }).join("");
    }
  };
  if (config.key === "products") {
    (form.elements.namedItem("purchasePricePerKg") as HTMLInputElement | null)?.addEventListener("input", updateProductProfit);
    (form.elements.namedItem("salePricePerKg") as HTMLInputElement | null)?.addEventListener("input", updateProductProfit);
    updateProductProfit();
  }
  const id = new URLSearchParams(location.search).get("id");
  const loading = form.querySelector<HTMLElement>("[data-admin-form-loading]");
  if (mode !== "add") {
    if (!id) {
      toast("شناسه رکورد در آدرس وجود ندارد.", "error");
      return;
    }
    if (loading) loading.hidden = false;
    try {
      const { item } = await api<{ item: Record<string, unknown> }>(`/api/v1/admin/${config.key}/${id}`);
      config.fields.forEach((field) => setFormValue(form, field.key, item[field.key]));
      updateProductProfit();
      if (config.key === "orders") renderOrderItems(form, item.items);
      if (config.key === "payment-methods") {
        const merchant = (form.elements.namedItem("merchantId") as HTMLElement | null)?.closest<HTMLElement>(".admin-field");
        if (merchant) merchant.hidden = item.type === "cardToCard";
        if (item.type === "cardToCard") initPaymentCards(form, id, mode === "view");
      }
    } catch (error) {
      toast(error instanceof Error ? error.message : "دریافت رکورد انجام نشد.", "error");
    } finally {
      if (loading) loading.hidden = true;
    }
  }
  if (mode === "view") return;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    form.querySelectorAll("[data-field-error]").forEach((node) => { node.textContent = ""; });
    if (!form.checkValidity()) {
      form.reportValidity();
      toast("لطفاً فیلدهای ضروری را کامل و صحیح وارد کنید.", "error");
      return;
    }
    const data = new FormData(form);
    const body: Record<string, unknown> = {};
    config.fields.forEach((field) => {
      if (field.readonly) return;
      const raw = data.get(field.key);
      if (field.type === "number") body[field.key] = raw === "" ? null : Number(raw);
      else if (field.key === "isActive" || field.key === "isPublished") body[field.key] = raw === "true";
      else if (field.key === "tags") body[field.key] = String(raw || "").split(",").map((tag) => tag.trim()).filter(Boolean);
      else body[field.key] = raw === "" ? null : raw;
    });
    const button = form.querySelector<HTMLButtonElement>("[data-admin-submit]")!;
    button.disabled = true;
    button.textContent = "در حال ذخیره…";
    try {
      await api(`/api/v1/admin/${config.key}${mode === "edit" ? `/${id}` : ""}`, {
        method: mode === "edit" ? "PUT" : "POST",
        body: JSON.stringify(body)
      });
      toast(`${config.singular} با موفقیت ذخیره شد.`);
      window.setTimeout(() => { location.href = `/admin/${config.key}/list/`; }, 500);
    } catch (error) {
      const message = error instanceof Error ? error.message : "ذخیره انجام نشد.";
      toast(message, "error");
      button.disabled = false;
      button.textContent = "ذخیره تغییرات";
    }
  });
};

const renderOrderItems = (form: HTMLFormElement, items: unknown) => {
  const root = form.querySelector<HTMLElement>("[data-order-items]");
  if (!root || !Array.isArray(items)) return;
  root.hidden = false;
  root.innerHTML = `<h2>اقلام سفارش</h2>${items.map((item: Record<string, unknown>) => `
    <article>
      <strong>${item.productTitle || "قهوه اورنزا"}</strong>
      <span>${item.weight} · ${item.quantity} عدد · ${item.grindType || "دان"}</span>
      <b>${money.format(Number(item.totalPrice || 0))} تومان</b>
    </article>`).join("")}`;
};

const initResource = () => {
  const root = document.querySelector<HTMLElement>("[data-admin-resource]");
  if (!root) return;
  const config = readConfig(root);
  if (!config) return;
  const mode = root.dataset.mode || "list";
  if (mode === "list") initList(root, config);
  else void initForm(root as HTMLFormElement, config, mode);
};

const initDashboard = async () => {
  if (!document.querySelector("[data-admin-dashboard]")) return;
  try {
    const { stats } = await api<{ stats: Record<string, number> }>("/api/v1/admin/dashboard");
    Object.entries(stats).forEach(([key, value]) => {
      const element = document.querySelector<HTMLElement>(`[data-stat="${key}"]`);
      if (element) element.textContent = faNumber.format(value);
    });
  } catch (error) {
    toast(error instanceof Error ? error.message : "آمار داشبورد دریافت نشد.", "error");
  }
};

const initInvoice = async () => {
  const root = document.querySelector<HTMLElement>("[data-admin-invoice]");
  if (!root) return;
  const id = new URLSearchParams(location.search).get("id");
  if (!id) { toast("شناسه سفارش وجود ندارد.", "error"); return; }
  try {
    const { item } = await api<{ item: Record<string, unknown> & { items?: Record<string, unknown>[] } }>(
      `/api/v1/admin/orders/${id}`
    );
    const set = (selector: string, value: string) => {
      const element = root.querySelector<HTMLElement>(selector);
      if (element) element.textContent = value;
    };
    set("[data-invoice-number]", String(item.orderNumber || "—"));
    set("[data-invoice-date]", item.createdAt ? new Date(String(item.createdAt)).toLocaleDateString("fa-IR-u-ca-persian") : "—");
    set("[data-invoice-customer]", String(item.customerName || "—"));
    set("[data-invoice-phone]", String(item.customerPhone || "—"));
    set("[data-invoice-address]", String(item.customerAddress || "—"));
    set("[data-invoice-total]", `${money.format(Number(item.totalAmount || 0))} تومان`);
    set("[data-invoice-discount]", `${money.format(Number(item.discountAmount || 0))} تومان`);
    set("[data-invoice-final]", `${money.format(Number(item.finalAmount || 0))} تومان`);
    const rows = root.querySelector<HTMLTableSectionElement>("[data-invoice-items]");
    if (rows) rows.innerHTML = (item.items || []).map((orderItem) => `
      <tr>
        <td>${orderItem.productTitle || "قهوه اورنزا"}</td>
        <td>${faNumber.format(Number(orderItem.weight || 0))} گرم</td>
        <td>${faNumber.format(Number(orderItem.quantity || 0))}</td>
        <td>${orderItem.grindType || "دان"}</td>
        <td>${money.format(Number(orderItem.unitPrice || 0))}</td>
        <td>${money.format(Number(orderItem.totalPrice || 0))}</td>
      </tr>`).join("");
  } catch (error) {
    toast(error instanceof Error ? error.message : "فاکتور دریافت نشد.", "error");
  }
  document.querySelector("[data-print-invoice]")?.addEventListener("click", () => window.print());
};

initLogin();
void initChrome();
initResource();
void initDashboard();
void initInvoice();
