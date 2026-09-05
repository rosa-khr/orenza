import {
  AllCommunityModule,
  ModuleRegistry,
  createGrid,
  type ColDef,
  type GridApi,
  type ICellRendererParams
} from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-material.css";
import Tagify from "@yaireo/tagify";
import "@yaireo/tagify/dist/tagify.css";
import { productSlug } from "./product-url";
import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { TableKit } from "@tiptap/extension-table";
import { NodeSelection } from "@tiptap/pm/state";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

ModuleRegistry.registerModules([AllCommunityModule]);

type ResourceField = {
  key: string;
  label: string;
  type: string;
  maxLength?: number;
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
  ready: "آماده ارسال",
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
  zarinpal: "زرین‌پال",
  tipax: "تیپاکس",
  post: "پست",
  collect: "پس‌کرایه",
  weightVolume: "وزن و حجم",
  weighted: "فروش وزنی",
  packaged: "فروش بسته‌ای",
  inStock: "موجود",
  outOfStock: "ناموجود",
  customer: "کاربر فروشگاه",
  admin: "مدیر"
};

const bankLogoCodes: Record<string, string> = {
  "ملی ایران": "bmi",
  "ملت": "mellat",
  "تجارت": "tejarat",
  "صادرات ایران": "bsi",
  "سپه": "sepah",
  "کشاورزی": "bki",
  "مسکن": "maskan",
  "رفاه کارگران": "rb",
  "پاسارگاد": "bpi",
  "پارسیان": "parsian",
  "سامان": "sb",
  "اقتصاد نوین": "en",
  "شهر": "shahr",
  "آینده": "ba",
  "دی": "day",
  "کارآفرین": "kar",
  "خاورمیانه": "me",
  "گردشگری": "tourism",
  "ایران‌زمین": "iz",
  "رسالت": "resalat"
};

const createBankLogo = (code: string, label: string) => {
  const logo = document.createElement("i");
  logo.className = `admin-bank-logo bank-${code}`;
  logo.setAttribute("role", "img");
  logo.setAttribute("aria-label", `لوگوی ${label}`);
  return logo;
};

const api = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const headers = options.body instanceof FormData
    ? options.headers
    : { "Content-Type": "application/json", ...(options.headers || {}) };
  const response = await fetch(path, {
    credentials: "include",
    ...options,
    headers
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

const initSeoCounters = (root: ParentNode = document) => {
  root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("[data-seo-counter-limit]").forEach((control) => {
    const limit = Number(control.dataset.seoCounterLimit || control.maxLength);
    if (!Number.isFinite(limit) || limit <= 0) return;
    const field = control.closest<HTMLElement>(".admin-field");
    const counter = field?.querySelector<HTMLElement>(".admin-seo-counter");
    if (!counter || counter.dataset.seoCounterReady === "true") return;
    counter.dataset.seoCounterReady = "true";
    const render = () => {
      const count = control.value.length;
      const over = Math.max(0, count - limit);
      counter.textContent = over
        ? `${faNumber.format(over)} کاراکتر اضافه`
        : `${faNumber.format(count)} از ${faNumber.format(limit)} کاراکتر`;
      counter.classList.toggle("is-warning", count >= Math.floor(limit * 0.9) && count <= limit);
      counter.classList.toggle("is-over", count > limit);
    };
    control.addEventListener("input", render);
    control.addEventListener("change", render);
    render();
  });
};

const adminSwal = Swal.mixin({
  buttonsStyling: false,
  reverseButtons: true,
  confirmButtonText: "تأیید",
  cancelButtonText: "انصراف",
  customClass: {
    popup: "admin-swal",
    title: "admin-swal-title",
    htmlContainer: "admin-swal-content",
    input: "admin-swal-input",
    actions: "admin-swal-actions",
    confirmButton: "admin-swal-confirm",
    cancelButton: "admin-swal-cancel"
  },
  didOpen: (popup) => popup.setAttribute("dir", "rtl")
});

const askConfirm = async (title: string, message: string, acceptLabel = "تأیید") => {
  const result = await adminSwal.fire({
    title,
    text: message,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: acceptLabel
  });
  return result.isConfirmed;
};

const openUserPasswordReset = (userId: string, userName: string) => {
  const layer = document.querySelector<HTMLElement>("[data-admin-password-reset]");
  const form = layer?.querySelector<HTMLFormElement>("[data-password-reset-form]");
  if (!layer || !form) return;
  const idInput = form.elements.namedItem("userId") as HTMLInputElement;
  const passwordInput = form.elements.namedItem("newPassword") as HTMLInputElement;
  const confirmInput = form.elements.namedItem("confirmPassword") as HTMLInputElement;
  const error = form.querySelector<HTMLElement>("[data-password-reset-error]");
  const userLabel = form.querySelector<HTMLElement>("[data-password-reset-user]");
  const close = () => {
    layer.classList.remove("show");
    window.setTimeout(() => { layer.hidden = true; }, 180);
    form.reset();
    if (error) error.textContent = "";
  };
  form.reset();
  idInput.value = userId;
  if (userLabel) userLabel.textContent = userName || "کاربر انتخاب‌شده";
  if (error) error.textContent = "";
  layer.hidden = false;
  requestAnimationFrame(() => layer.classList.add("show"));
  passwordInput.focus();
  layer.querySelectorAll<HTMLElement>("[data-password-reset-cancel], [data-password-reset-dismiss]")
    .forEach((button) => { button.onclick = close; });
  form.onsubmit = async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    if (passwordInput.value !== confirmInput.value) {
      if (error) error.textContent = "تکرار رمز با رمز عبور جدید یکسان نیست.";
      return;
    }
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    submit.disabled = true;
    try {
      const result = await api<{ message: string }>(`/api/v1/admin/users/${userId}/reset-password`, {
        method: "POST",
        body: JSON.stringify({ newPassword: passwordInput.value })
      });
      close();
      toast(result.message);
    } catch (reason) {
      if (error) error.textContent = reason instanceof Error ? reason.message : "تغییر رمز انجام نشد.";
    } finally {
      submit.disabled = false;
    }
  };
};

const openUserRoleAssignment = async (
  userId: string,
  userName: string,
  currentRoleId: string | null
) => {
  const layer = document.querySelector<HTMLElement>("[data-admin-role-assignment]");
  const form = layer?.querySelector<HTMLFormElement>("[data-role-assignment-form]");
  if (!layer || !form) return;
  const roleSelect = form.elements.namedItem("roleId") as HTMLSelectElement;
  const idInput = form.elements.namedItem("userId") as HTMLInputElement;
  const error = form.querySelector<HTMLElement>("[data-role-assignment-error]");
  const userLabel = form.querySelector<HTMLElement>("[data-role-assignment-user]");
  const close = () => {
    layer.classList.remove("show");
    window.setTimeout(() => { layer.hidden = true; }, 180);
    if (error) error.textContent = "";
  };
  idInput.value = userId;
  if (userLabel) userLabel.textContent = userName || "کاربر انتخاب‌شده";
  roleSelect.innerHTML = '<option value="">بدون دسترسی به پنل</option>';
  if (error) error.textContent = "";
  layer.hidden = false;
  requestAnimationFrame(() => layer.classList.add("show"));
  try {
    const result = await api<{ roles: { id: string; title: string }[] }>("/api/v1/admin/assignable-roles");
    result.roles.forEach((role) => roleSelect.add(new Option(role.title, role.id)));
    roleSelect.value = currentRoleId || "";
    roleSelect.dispatchEvent(new Event("change", { bubbles: true }));
    enhanceDropdowns(form);
  } catch (reason) {
    if (error) error.textContent = reason instanceof Error ? reason.message : "دریافت نقش‌ها انجام نشد.";
  }
  layer.querySelectorAll<HTMLElement>("[data-role-assignment-cancel], [data-role-assignment-dismiss]")
    .forEach((button) => { button.onclick = close; });
  form.onsubmit = async (event) => {
    event.preventDefault();
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    submit.disabled = true;
    try {
      const result = await api<{ message: string }>(`/api/v1/admin/users/${userId}/assign-role`, {
        method: "POST",
        body: JSON.stringify({ roleId: roleSelect.value || null })
      });
      close();
      toast(result.message);
      window.setTimeout(() => location.reload(), 450);
    } catch (reason) {
      if (error) error.textContent = reason instanceof Error ? reason.message : "ثبت نقش انجام نشد.";
    } finally {
      submit.disabled = false;
    }
  };
};

const enhanceDropdowns = (root: ParentNode = document) => {
  if (!document.body.dataset.dropdownOutsideReady) {
    document.body.dataset.dropdownOutsideReady = "true";
    document.addEventListener("pointerdown", (event) => {
      if ((event.target as HTMLElement).closest(".admin-dropdown")) return;
      document.querySelectorAll<HTMLElement>(".admin-dropdown-panel").forEach((panel) => { panel.hidden = true; });
      document.querySelectorAll(".admin-dropdown.open").forEach((dropdown) => dropdown.classList.remove("open"));
    });
  }
  root.querySelectorAll<HTMLSelectElement>("select:not([multiple]):not([data-dropdown-ready]):not([data-rich-format])").forEach((select) => {
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
    const syncDisabled = () => {
      control.disabled = select.disabled;
      dropdown.classList.toggle("disabled", select.disabled);
      if (select.disabled) {
        panel.hidden = true;
        dropdown.classList.remove("open");
      }
    };
    const syncLabel = () => {
      const selected = select.selectedOptions[0];
      value.replaceChildren();
      const label = document.createElement("span");
      label.textContent = selected?.textContent || "انتخاب کنید";
      const bankCode = selected?.dataset.bankCode;
      if (bankCode) value.append(createBankLogo(bankCode, selected?.textContent || ""));
      value.append(label);
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
        const optionLabel = document.createElement("span");
        optionLabel.className = "admin-dropdown-option-label";
        if (option.dataset.bankCode) {
          optionLabel.append(createBankLogo(option.dataset.bankCode, option.textContent || ""));
        }
        const optionText = document.createElement("span");
        optionText.textContent = option.textContent;
        optionLabel.append(optionText);
        button.append(optionLabel);
        if (option.value === select.value) {
          const check = document.createElement("b");
          check.textContent = "✓";
          button.append(check);
        }
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
      if (select.disabled) return;
      const willOpen = panel.hidden;
      document.querySelectorAll<HTMLElement>(".admin-dropdown-panel").forEach((item) => { item.hidden = true; });
      document.querySelectorAll(".admin-dropdown.open").forEach((item) => item.classList.remove("open"));
      panel.hidden = !willOpen;
      dropdown.classList.toggle("open", willOpen);
      if (willOpen) { search.value = ""; render(); search.focus(); }
    });
    search.addEventListener("input", render);
    select.addEventListener("change", syncLabel);
    new MutationObserver(syncDisabled).observe(select, {
      attributes: true,
      attributeFilter: ["disabled"]
    });
    syncLabel();
    syncDisabled();
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
  document.querySelectorAll<HTMLElement>("[data-admin-logout]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        await fetch("/api/v1/auth/logout", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: "{}"
        });
      } finally {
        location.replace("/admin/login/");
      }
    });
  });
  if (!app) return;
  try {
    const { user } = await api<{ user: { displayName: string | null; role: string } }>("/api/v1/me");
    if (user.role !== "admin") {
      location.replace("/admin/login/?reason=access");
      return;
    }
    const access = await api<{ permissions: string[]; role: { title: string } | null }>("/api/v1/admin/access");
    document.querySelectorAll<HTMLElement>("[data-admin-user]").forEach((label) => {
      label.textContent = user.displayName || "مدیر اورنزا";
    });
    document.querySelectorAll<HTMLElement>("[data-admin-role]").forEach((label) => {
      label.textContent = access.role?.title || "پنل مدیریت";
    });
    const allowed = new Set(access.permissions);
    document.querySelectorAll<HTMLElement>("[data-admin-permission]").forEach((item) => {
      const permission = item.dataset.adminPermission || "";
      if (!allowed.has(permission)) item.remove();
    });
    document.querySelectorAll<HTMLDetailsElement>(".admin-nav-group").forEach((group) => {
      if (!group.querySelector("a")) group.remove();
    });
    enhanceDropdowns(document);
    const segments = location.pathname.split("/").filter(Boolean);
    const requiredPermission = segments.length <= 1
      ? "dashboard"
      : segments[1] === "profile"
        ? null
        : segments[1] === "service-scripts"
          ? "site-settings"
          : segments[1] === "content-templates"
            ? "content-generator"
          : segments[1];
    if (requiredPermission && !allowed.has(requiredPermission)) {
      const first = access.permissions[0];
      location.replace(first === "dashboard" || !first ? "/admin/" : `/admin/${first}/list/`);
    }
  } catch (error) {
    toast(error instanceof Error ? error.message : "دسترسی مدیریت تأیید نشد.", "error");
  }
};

const initLogin = () => {
  const form = document.querySelector<HTMLFormElement>("[data-admin-login]");
  if (!form) return;
  void fetch("/api/v1/me", { credentials: "include" })
    .then(async (response) => response.ok ? response.json() : null)
    .then((payload) => {
      if (payload?.user?.role === "admin") {
        const next = new URLSearchParams(location.search).get("next");
        location.replace(next?.startsWith("/admin/") ? next : "/admin/");
      }
    })
    .catch(() => undefined);
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
  if (["createdAt", "updatedAt", "lastLoginAt"].includes(field.key)) {
    return new Date(String(value)).toLocaleString("fa-IR-u-ca-persian", {
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"
    });
  }
  if (field.type === "number") return money.format(Number(value));
  if (field.type === "date") return new Date(String(value)).toLocaleDateString("fa-IR");
  return String(value);
};

export const persianGridLocale: Record<string, string> = {
  page: "صفحه",
  more: "بیشتر",
  to: "تا",
  of: "از",
  next: "بعدی",
  last: "آخرین",
  first: "اولین",
  previous: "قبلی",
  loadingOoo: "در حال بارگذاری…",
  selectAll: "انتخاب همه",
  searchOoo: "جستجو…",
  blanks: "خالی",
  filterOoo: "فیلتر…",
  equals: "برابر",
  notEqual: "نامساوی",
  contains: "شامل",
  notContains: "شامل نباشد",
  startsWith: "شروع با",
  endsWith: "پایان با",
  lessThan: "کمتر از",
  greaterThan: "بیشتر از",
  lessThanOrEqual: "کمتر یا مساوی",
  greaterThanOrEqual: "بیشتر یا مساوی",
  inRange: "در بازه",
  andCondition: "و",
  orCondition: "یا",
  applyFilter: "اعمال",
  resetFilter: "بازنشانی",
  clearFilter: "پاک‌کردن",
  cancelFilter: "لغو",
  noRowsToShow: "رکوردی برای نمایش وجود ندارد",
  pinColumn: "سنجاق‌کردن ستون",
  autosizeThiscolumn: "اندازه خودکار ستون",
  autosizeAllColumns: "اندازه خودکار همه ستون‌ها",
  resetColumns: "بازنشانی ستون‌ها",
  sortAscending: "مرتب‌سازی صعودی",
  sortDescending: "مرتب‌سازی نزولی",
  sortUnSort: "حذف مرتب‌سازی"
};

const gridIcons = {
  eye: '<svg viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/></svg>',
  pencil: '<svg viewBox="0 0 24 24"><path d="m4 20 4.2-1 10.6-10.6-3.2-3.2L5 15.8 4 20Z"/><path d="m13.8 7 3.2 3.2"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m5 5v5m4-5v5"/></svg>',
  invoice: '<svg viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6"/></svg>',
  approve: '<svg viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>',
  ready: '<svg viewBox="0 0 24 24"><path d="M4 7h16v11H4z"/><path d="M8 7V4h8v3M8 13l2.5 2.5L16 10"/></svg>',
  truck: '<svg viewBox="0 0 24 24"><path d="M3 6h11v11H3zM14 10h4l3 3v4h-7z"/><circle cx="7" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></svg>',
  cancel: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m9 9 6 6m0-6-6 6"/></svg>',
  key: '<svg viewBox="0 0 24 24"><circle cx="8" cy="15" r="4"/><path d="m11 12 8-8m-3 3 3 3m-6 0 3 3"/></svg>',
  role: '<svg viewBox="0 0 24 24"><path d="M12 3 5 6v5c0 4.6 2.8 8 7 10 4.2-2 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
  external: '<svg viewBox="0 0 24 24"><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h6"/></svg>'
};

const fetchAllAdminRows = async (resource: string) => {
  const rows: Record<string, unknown>[] = [];
  let page = 1;
  let total = 0;
  do {
    const payload = await api<{ items: Record<string, unknown>[]; total: number }>(
      `/api/v1/admin/${resource}?page=${page}&pageSize=100`
    );
    rows.push(...payload.items);
    total = payload.total;
    page += 1;
  } while (rows.length < total);
  return rows;
};

const initList = (root: HTMLElement, config: ResourceConfig) => {
  const gridElement = root.querySelector<HTMLElement>("[data-admin-grid]");
  const countElement = root.querySelector<HTMLElement>("[data-admin-grid-count]");
  if (!gridElement) return;

  const storageKey = `orenza.admin.grid.${config.key}`;
  let gridApi: GridApi<Record<string, unknown>>;

  const refreshCount = () => {
    if (!countElement || !gridApi) return;
    countElement.textContent = `${faNumber.format(gridApi.getDisplayedRowCount())} رکورد`;
  };

  const saveGridState = () => {
    if (!gridApi) return;
    sessionStorage.setItem(storageKey, JSON.stringify({
      columnState: gridApi.getColumnState(),
      filterModel: gridApi.getFilterModel()
    }));
  };

  const loadRows = async () => {
    gridApi.setGridOption("loading", true);
    try {
      const items = await fetchAllAdminRows(config.key);
      gridApi.setGridOption("rowData", items);
      refreshCount();
    } catch (error) {
      gridApi.setGridOption("rowData", []);
      toast(error instanceof Error ? error.message : "خطا در دریافت اطلاعات", "error");
    } finally {
      gridApi.setGridOption("loading", false);
    }
  };

  const deleteRow = async (id: string) => {
    const accepted = await askConfirm(
      "حذف رکورد",
      "این عملیات قابل بازگشت نیست. از حذف این رکورد مطمئن هستید؟",
      "بله، حذف شود"
    );
    if (!accepted) return;
    try {
      await api(`/api/v1/admin/${config.key}/${id}`, { method: "DELETE" });
      toast("رکورد با موفقیت حذف شد.");
      await loadRows();
    } catch (error) {
      toast(error instanceof Error ? error.message : "حذف انجام نشد.", "error");
    }
  };

  const changeOrderStatus = async (row: Record<string, unknown>, action: "approve" | "cancel") => {
    const accepted = await askConfirm(
      action === "approve" ? "تأیید سفارش" : "لغو سفارش",
      action === "approve"
        ? "پس از تأیید، سفارش وارد مرحله آماده‌سازی می‌شود. ادامه می‌دهید؟"
        : "سفارش لغو شود؟ این تغییر در وضعیت سفارش ثبت خواهد شد.",
      action === "approve" ? "تأیید و شروع آماده‌سازی" : "لغو سفارش"
    );
    if (!accepted) return;
    try {
      await api(`/api/v1/admin/orders/${row.id}`, {
        method: "PUT",
        body: JSON.stringify({
          orderStatus: action === "approve" ? "processing" : "canceled",
          // تأیید سفارش یعنی فیش پرداخت هم توسط ادمین تأیید شده است.
          paymentStatus: action === "approve" ? "paid" : row.paymentStatus || "pending",
          adminNote: action === "cancel" ? "سفارش توسط مدیر لغو شد." : null
        })
      });
      toast(action === "approve" ? "سفارش تأیید شد." : "سفارش لغو شد.");
      await loadRows();
    } catch (error) {
      toast(error instanceof Error ? error.message : "تغییر وضعیت انجام نشد.", "error");
    }
  };

  const changeFulfillmentStatus = async (
    row: Record<string, unknown>,
    action: "ready" | "sent"
  ) => {
    const isReadyAction = action === "ready";
    const accepted = await askConfirm(
      isReadyAction ? "ثبت آماده ارسال" : "ثبت ارسال سفارش",
      isReadyAction
        ? "آماده‌سازی این سفارش تکمیل شده و سفارش وارد صف ارسال شود؟"
        : "ارسال این سفارش به مشتری ثبت شود؟",
      isReadyAction ? "بله، آماده ارسال است" : "بله، ارسال شد"
    );
    if (!accepted) return;
    try {
      await api(`/api/v1/admin/orders/${row.id}/fulfillment-transition`, {
        method: "POST",
        body: JSON.stringify({ action })
      });
      toast(isReadyAction ? "سفارش آماده ارسال شد." : "ارسال سفارش ثبت شد.");
      await loadRows();
    } catch (error) {
      toast(error instanceof Error ? error.message : "تغییر مرحله سفارش انجام نشد.", "error");
    }
  };

  const actionRenderer = ({ data }: ICellRendererParams<Record<string, unknown>>) => {
    const row = data;
    const actions = document.createElement("div");
    actions.className = "admin-row-actions";
    if (!row?.id) return actions;
    const id = String(row.id);
    const link = (href: string, label: string, icon: string, newTab = false) => {
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.title = label;
      anchor.setAttribute("aria-label", label);
      anchor.innerHTML = icon;
      if (newTab) { anchor.target = "_blank"; anchor.rel = "noopener noreferrer"; }
      return anchor;
    };
    const button = (label: string, icon: string, onClick: () => void, showLabel = false) => {
      const element = document.createElement("button");
      element.type = "button";
      element.title = label;
      element.setAttribute("aria-label", label);
      element.innerHTML = showLabel ? `${icon}<span>${label}</span>` : icon;
      if (showLabel) element.classList.add("admin-row-action-labeled");
      element.addEventListener("click", onClick);
      return element;
    };
    actions.append(
      link(`/admin/${config.key}/view/?id=${id}`, "مشاهده", gridIcons.eye),
      link(`/admin/${config.key}/edit/?id=${id}`, "ویرایش", gridIcons.pencil)
    );
    const publicUrl = (() => {
      if (config.key === "products" && row.titleEn) return `/products/${encodeURIComponent(productSlug(String(row.titleEn)))}/`;
      if (config.key === "tags" && row.slug) return `/tags/${encodeURIComponent(String(row.slug))}/`;
      if (config.key === "categories" && row.slug) {
        const slug = String(row.slug);
        if (slug === "products") return "/products/";
        if (slug === "wholesale") return "/wholesale/";
        if (slug === "about-orenza") return "/about/";
        return `/products/${encodeURIComponent(slug)}/`;
      }
      return null;
    })();
    if (publicUrl) actions.append(link(publicUrl, "مشاهده در سایت", gridIcons.external, true));
    const isPendingOrder = config.key === "orders" && row.orderStatus === "new" && row.paymentStatus === "pending";
    const isPreparingOrder = config.key === "orders" && row.orderStatus === "processing";
    const isReadyOrder = config.key === "orders" && row.orderStatus === "ready";
    if (config.key === "orders") {
      actions.append(link(`/admin/orders/invoice/?id=${id}`, "مشاهده و چاپ فاکتور", gridIcons.invoice));
    }
    if (config.key === "users") {
      const userName = [row.firstName, row.lastName].filter(Boolean).join(" ") || String(row.phone || row.email || "کاربر");
      actions.append(
        button("تعیین نقش پنل", gridIcons.role, () =>
          void openUserRoleAssignment(id, userName, row.adminRoleId ? String(row.adminRoleId) : null)
        ),
        button("تغییر رمز عبور", gridIcons.key, () => openUserPasswordReset(id, userName))
      );
    }
    if (isPendingOrder) {
      actions.append(
        button("تأیید سفارش", gridIcons.approve, () => void changeOrderStatus(row, "approve")),
        button("لغو سفارش", gridIcons.cancel, () => void changeOrderStatus(row, "cancel"))
      );
    }
    if (isPreparingOrder) {
      actions.append(
        button("آماده ارسال", gridIcons.ready, () => void changeFulfillmentStatus(row, "ready"), true)
      );
    }
    if (isReadyOrder) {
      actions.append(
        button("ثبت ارسال سفارش", gridIcons.truck, () => void changeFulfillmentStatus(row, "sent"))
      );
    }
    if (config.key !== "users" && (config.key !== "orders" || isPendingOrder)) {
      actions.append(button("حذف", gridIcons.trash, () => void deleteRow(id)));
    }
    return actions;
  };

  const columns: ColDef<Record<string, unknown>>[] = [
    {
      headerName: "ردیف",
      valueGetter: ({ node }) => (node?.rowIndex ?? 0) + 1,
      valueFormatter: ({ value }) => faNumber.format(Number(value)),
      width: 78,
      minWidth: 78,
      maxWidth: 78,
      filter: false,
      sortable: false,
      pinned: "right"
    },
    ...config.fields.map((field): ColDef<Record<string, unknown>> => {
      const isStatus = [
        "isActive", "isPublished", "orderStatus", "paymentStatus", "saleType", "stockStatus",
        "role", "hasPassword", "isSystem"
      ].includes(field.key);
      return {
        headerName: field.label,
        field: field.key,
        minWidth: isStatus ? 120 : field.type === "number" ? 145 : 150,
        width: isStatus ? 130 : undefined,
        maxWidth: isStatus ? 150 : undefined,
        flex: isStatus ? undefined : field.type === "textarea" ? 1.5 : 1,
        cellClass: isStatus ? "admin-status-cell" : undefined,
        headerClass: isStatus ? "admin-status-header" : undefined,
        filter: field.type === "number" ? "agNumberColumnFilter" : "agTextColumnFilter",
        filterValueGetter: ({ data }) => displayValue(data?.[field.key], field),
        valueFormatter: ({ value }) => displayValue(value, field),
        cellRenderer: isStatus
          ? ({ value }: ICellRendererParams<Record<string, unknown>>) => {
              const badge = document.createElement("span");
              badge.className = `admin-badge admin-status status-${String(value)}`;
              badge.textContent = displayValue(value, field);
              return badge;
            }
          : undefined
      };
    }),
    {
      headerName: "عملیات",
      field: "id",
      pinned: "left",
      width: config.key === "orders" ? 250 : config.key === "users" ? 205 : ["products", "categories", "tags"].includes(config.key) ? 165 : 132,
      minWidth: config.key === "orders" ? 250 : config.key === "users" ? 205 : ["products", "categories", "tags"].includes(config.key) ? 165 : 132,
      maxWidth: config.key === "orders" ? 250 : config.key === "users" ? 205 : ["products", "categories", "tags"].includes(config.key) ? 165 : 132,
      filter: false,
      sortable: false,
      cellRenderer: actionRenderer
    }
  ];

  gridApi = createGrid<Record<string, unknown>>(gridElement, {
    theme: "legacy",
    columnDefs: columns,
    rowData: [],
    animateRows: true,
    enableRtl: true,
    localeText: persianGridLocale,
    rowHeight: 56,
    headerHeight: 52,
    pagination: true,
    paginationPageSize: 15,
    paginationPageSizeSelector: [15, 25, 50, 100],
    suppressCellFocus: true,
    defaultColDef: {
      resizable: true,
      sortable: true,
      filter: true,
      floatingFilter: false,
      suppressHeaderMenuButton: false,
      filterParams: {
        buttons: ["reset"],
        debounceMs: 250
      }
    },
    onGridReady: ({ api: readyApi }) => {
      const savedState = sessionStorage.getItem(storageKey);
      if (savedState) {
        try {
          const state = JSON.parse(savedState) as {
            columnState?: ReturnType<GridApi["getColumnState"]>;
            filterModel?: ReturnType<GridApi["getFilterModel"]>;
          };
          if (state.columnState?.length) readyApi.applyColumnState({ state: state.columnState, applyOrder: true });
          if (state.filterModel) readyApi.setFilterModel(state.filterModel);
        } catch {
          sessionStorage.removeItem(storageKey);
        }
      }
      void loadRows();
    },
    onFilterChanged: () => {
      refreshCount();
      saveGridState();
    },
    onSortChanged: saveGridState,
    onColumnMoved: saveGridState,
    onColumnPinned: saveGridState,
    onColumnVisible: saveGridState,
    onColumnResized: ({ finished }) => {
      if (finished) saveGridState();
    }
  });
};

const parseNumericInput = (value: unknown) => {
  const normalized = String(value ?? "")
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/[٬,\s]/g, "");
  return normalized === "" ? null : Number(normalized);
};

const formatMoneyInput = (input: HTMLInputElement) => {
  const numericValue = parseNumericInput(input.value);
  input.value = numericValue == null || !Number.isFinite(numericValue)
    ? ""
    : new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(numericValue);
};

const initMoneyInputs = (form: HTMLFormElement) => {
  form.querySelectorAll<HTMLInputElement>("input[data-money-input]").forEach((input) => {
    input.addEventListener("input", () => {
      const cursorAtEnd = input.selectionStart === input.value.length;
      formatMoneyInput(input);
      if (cursorAtEnd) input.setSelectionRange(input.value.length, input.value.length);
    });
    input.addEventListener("blur", () => formatMoneyInput(input));
  });
};

const setFormValue = (form: HTMLFormElement, key: string, value: unknown) => {
  if (key === "permissions") {
    const selected = new Set(Array.isArray(value) ? value.map(String) : []);
    form.querySelectorAll<HTMLInputElement>('input[name="permissions"]').forEach((input) => {
      input.checked = selected.has(input.value);
    });
    return;
  }
  const input = form.elements.namedItem(key) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
  if (!input) return;
  if (input instanceof HTMLSelectElement && input.multiple) {
    const selected = new Set(Array.isArray(value) ? value.map(String) : []);
    [...input.options].forEach((option) => { option.selected = selected.has(option.value); });
    const tagInput = form.querySelector<HTMLInputElement>(`input[data-tagify-field="${input.name}"]`) as (HTMLInputElement & { _tagify?: Tagify }) | null;
    if (tagInput?._tagify) {
      tagInput._tagify.removeAllTags();
      tagInput._tagify.addTags([...input.options]
        .filter((option) => selected.has(option.value))
        .map((option) => ({ value: option.textContent || option.value, id: option.value })));
    }
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return;
  }
  let normalizedValue = "";
  if ((input.type === "date" || input.dataset.persianReady) && value) {
    normalizedValue = String(value).slice(0, 10);
  }
  else if (Array.isArray(value)) normalizedValue = value.join(", ");
  else normalizedValue = value === null || value === undefined ? "" : String(value);

  if (input instanceof HTMLSelectElement && normalizedValue &&
      ![...input.options].some((option) => option.value === normalizedValue)) {
    input.add(new Option(statusLabels[normalizedValue] || normalizedValue, normalizedValue));
  }
  input.value = normalizedValue;
  if (input instanceof HTMLInputElement && input.dataset.moneyInput) formatMoneyInput(input);
  const richEditor = form.querySelector<HTMLElement>(`[data-rich-text-editor="${key}"]`) as (HTMLElement & { _tiptap?: Editor }) | null;
  if (richEditor?._tiptap) richEditor._tiptap.commands.setContent(sanitizeEditorHtml(normalizedValue), { emitUpdate: true });
  else if (richEditor) richEditor.innerHTML = sanitizeEditorHtml(normalizedValue);
  input.dispatchEvent(new Event("change", { bubbles: true }));
};

const richTextTags = new Set([
  "P", "BR", "STRONG", "B", "EM", "I", "U", "H2", "H3", "UL", "OL", "LI", "A", "BLOCKQUOTE",
  "FIGURE", "FIGCAPTION", "IMG", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD"
]);

const safeEditorHref = (value: string) => {
  const href = value.trim();
  if (/^https?:\/\//i.test(href) || /^(mailto:|tel:)/i.test(href)) return href;
  if ((href.startsWith("/") && !href.startsWith("//")) || href.startsWith("#")) return href;
  return "";
};
const safeEditorImageSrc = (value: string) => {
  const src = value.trim();
  if (/^https:\/\//i.test(src)) return src;
  if (/^\/api\/v1\/product-images\/[0-9a-f-]+\.(?:jpg|png|webp)$/i.test(src)) return src;
  return "";
};

const sanitizeEditorHtml = (value: string) => {
  if (!value.trim()) return "";
  const template = document.createElement("template");
  template.innerHTML = value;
  [...template.content.querySelectorAll<HTMLElement>("*")].forEach((node) => {
    if (["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "SVG", "MATH"].includes(node.tagName)) {
      node.remove();
      return;
    }
    if (node.tagName === "DIV") {
      const paragraph = document.createElement("p");
      paragraph.append(...node.childNodes);
      node.replaceWith(paragraph);
      return;
    }
    if (!richTextTags.has(node.tagName)) {
      node.replaceWith(...node.childNodes);
      return;
    }
    const href = node.tagName === "A" ? safeEditorHref(node.getAttribute("href") || "") : "";
    const imageSrc = node.tagName === "IMG" ? safeEditorImageSrc(node.getAttribute("src") || "") : "";
    const imageAlt = node.tagName === "IMG" ? (node.getAttribute("alt") || "").slice(0, 240) : "";
    const imageWidth = node.tagName === "IMG" && /^\d{2,4}$/.test(node.getAttribute("width") || "") ? node.getAttribute("width") || "" : "";
    const imageHeight = node.tagName === "IMG" && /^\d{2,4}$/.test(node.getAttribute("height") || "") ? node.getAttribute("height") || "" : "";
    const textAlign = ["P", "H2", "H3", "BLOCKQUOTE", "TH", "TD"].includes(node.tagName) && ["right", "center", "left"].includes(node.style.textAlign)
      ? node.style.textAlign
      : "";
    [...node.attributes].forEach((attribute) => node.removeAttribute(attribute.name));
    if (node.tagName === "A") {
      if (!href) {
        node.replaceWith(...node.childNodes);
        return;
      }
      node.setAttribute("href", href);
      if (/^https?:\/\//i.test(href)) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    }
    if (node.tagName === "IMG") {
      if (!imageSrc) { node.remove(); return; }
      node.setAttribute("src", imageSrc);
      node.setAttribute("alt", imageAlt);
      node.setAttribute("loading", "lazy");
      if (imageWidth) node.setAttribute("width", imageWidth);
      if (imageHeight) node.setAttribute("height", imageHeight);
    }
    if (textAlign) node.style.textAlign = textAlign;
  });
  return template.innerHTML.trim();
};

const tabularTextToHtml = (value: string) => {
  const lines = value.replace(/\r/g, "").split("\n");
  while (lines.at(-1) === "") lines.pop();
  const rows = lines
    .map((line) => line.split("\t"))
    .filter((cells) => cells.length > 1);
  const looksTabular = rows.length >= 2
    ? rows.every((cells) => cells.length > 1 && cells.some((cell) => cell.trim()))
    : rows.length === 1 && rows[0].length >= 3 && rows[0].filter((cell) => cell.trim()).length >= 2;
  if (!looksTabular) return "";
  const table = document.createElement("table");
  const body = document.createElement("tbody");
  rows.slice(0, 200).forEach((cells) => {
    const row = document.createElement("tr");
    cells.slice(0, 50).forEach((value) => {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    });
    body.append(row);
  });
  table.append(body);
  return table.outerHTML;
};

const isContentTable = (table: HTMLTableElement) => {
  const rows = [...table.rows]
    .map((row) => [...row.cells].map((cell) => cell.textContent?.trim() || ""))
    .filter((cells) => cells.some(Boolean));
  if (rows.length >= 2) return rows.every((cells) => cells.length > 1);
  return rows.length === 1 && rows[0].length >= 3 && rows[0].filter(Boolean).length >= 2;
};

export const initRichTextEditors = (form: HTMLFormElement) => {
  form.querySelectorAll<HTMLElement>("[data-rich-text]").forEach((root) => {
    const editorElement = root.querySelector<HTMLElement>("[data-rich-text-editor]") as (HTMLElement & { _tiptap?: Editor }) | null;
    const input = root.querySelector<HTMLTextAreaElement>("[data-rich-text-input]");
    if (!editorElement || !input) return;
    const editable = editorElement.getAttribute("contenteditable") !== "false";
    editorElement.removeAttribute("contenteditable");
    const sync = (instance: Editor) => {
      const clean = sanitizeEditorHtml(instance.getHTML());
      input.value = clean;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    };
    const tiptap = new Editor({
      element: editorElement,
      editable,
      extensions: [
        StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: true, linkOnPaste: true } }),
        Image.configure({ inline: true, allowBase64: false, resize: false }),
        TextAlign.configure({ types: ["heading", "paragraph", "blockquote"], alignments: ["right", "center", "left"] }),
        TableKit.configure({ table: { resizable: true, lastColumnResizable: true } })
      ],
      content: sanitizeEditorHtml(input.value || editorElement.innerHTML),
      editorProps: {
        attributes: { class: "tiptap ProseMirror", dir: "rtl" },
        handleClickOn: (view, _pos, node, nodePos, event) => {
          if (node.type.name !== "image") return false;
          event.preventDefault();
          event.stopPropagation();
          view.dispatch(view.state.tr.setSelection(NodeSelection.create(view.state.doc, nodePos)));
          view.focus();
          return true;
        },
        handlePaste: (_view, event) => {
          const clipboard = event.clipboardData;
          if (!clipboard) return false;
          const clipboardHtml = clipboard.getData("text/html");
          if (/<table\b/i.test(clipboardHtml)) {
            const template = document.createElement("template");
            template.innerHTML = clipboardHtml;
            const tables = [...template.content.querySelectorAll("table")]
              .filter((table): table is HTMLTableElement => table instanceof HTMLTableElement && isContentTable(table))
              .map((table) => table.outerHTML)
              .join("<p></p>");
            const cleanTables = sanitizeEditorHtml(tables);
            if (cleanTables) {
              tiptap.commands.insertContent(cleanTables);
              toast("جدول از حافظه موقت درج شد.");
              return true;
            }
          }
          const tableHtml = tabularTextToHtml(clipboard.getData("text/plain"));
          if (!tableHtml) return false;
          tiptap.commands.insertContent(tableHtml);
          toast("اطلاعات کپی‌شده به جدول تبدیل شد.");
          return true;
        }
      },
      onUpdate: ({ editor }) => sync(editor),
      onCreate: ({ editor }) => sync(editor),
      onSelectionUpdate: ({ editor }) => updateToolbar(editor)
    });
    editorElement._tiptap = tiptap;

    function updateToolbar(instance: Editor) {
      root.querySelectorAll<HTMLButtonElement>("[data-rich-command]").forEach((button) => {
        const command = button.dataset.richCommand; const value = button.dataset.richValue;
        const active = command === "bold" ? instance.isActive("bold")
          : command === "italic" ? instance.isActive("italic")
            : command === "underline" ? instance.isActive("underline")
              : command === "formatBlock" && value ? instance.isActive(value)
                : command === "createLink" ? instance.isActive("link")
                  : command === "insertUnorderedList" ? instance.isActive("bulletList")
                    : command === "insertOrderedList" ? instance.isActive("orderedList")
                  : command?.startsWith("justify") ? instance.isActive({ textAlign: command.replace("justify", "").toLowerCase() })
                    : false;
        button.classList.toggle("is-active", active);
      });
      const format = root.querySelector<HTMLSelectElement>("[data-rich-format]");
      if (format) {
        format.value = instance.isActive("heading", { level: 2 }) ? "h2"
          : instance.isActive("heading", { level: 3 }) ? "h3"
            : instance.isActive("blockquote") ? "blockquote" : "p";
      }
      root.querySelectorAll<HTMLButtonElement>("[data-rich-table-command]").forEach((button) => {
        button.disabled = !editable || !instance.isActive("table");
      });
    }

    root.querySelectorAll<HTMLButtonElement>("[data-rich-command]").forEach((button) => {
      button.addEventListener("click", async () => {
        const command = button.dataset.richCommand || "";
        const chain = tiptap.chain().focus();
        if (command === "createLink") {
          const result = await adminSwal.fire({
            title: "افزودن لینک",
            text: "نشانی صفحه داخلی یا لینک کامل را وارد کنید.",
            input: "text",
            inputValue: tiptap.getAttributes("link").href || "",
            inputPlaceholder: "https://example.com یا /products/",
            showCancelButton: true,
            confirmButtonText: "ثبت لینک",
            inputValidator: (value) => {
              const entered = value.trim();
              if (!entered) return "نشانی لینک را وارد کنید.";
              const candidate = /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(entered) ? entered : `https://${entered}`;
              return safeEditorHref(candidate) ? undefined : "نشانی لینک معتبر نیست.";
            }
          });
          if (!result.isConfirmed || !result.value) return;
          const entered = String(result.value);
          const candidate = /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(entered.trim())
            ? entered.trim()
            : `https://${entered.trim()}`;
          const href = safeEditorHref(candidate);
          if (!href) { toast("نشانی لینک معتبر نیست.", "error"); return; }
          chain.extendMarkRange("link").setLink({ href }).run();
        } else if (command === "unlink") chain.unsetLink().run();
        else if (command === "formatBlock" && button.dataset.richValue === "p") chain.setParagraph().run();
        else if (command === "formatBlock" && button.dataset.richValue === "h2") chain.toggleHeading({ level: 2 }).run();
        else if (command === "formatBlock" && button.dataset.richValue === "h3") chain.toggleHeading({ level: 3 }).run();
        else if (command === "formatBlock" && button.dataset.richValue === "blockquote") chain.toggleBlockquote().run();
        else if (command === "bold") chain.toggleBold().run();
        else if (command === "italic") chain.toggleItalic().run();
        else if (command === "underline") chain.toggleUnderline().run();
        else if (command === "insertUnorderedList") chain.toggleBulletList().run();
        else if (command === "insertOrderedList") chain.toggleOrderedList().run();
        else if (command === "justifyRight") chain.setTextAlign("right").run();
        else if (command === "justifyCenter") chain.setTextAlign("center").run();
        else if (command === "justifyLeft") chain.setTextAlign("left").run();
        else if (command === "undo") chain.undo().run();
        else if (command === "redo") chain.redo().run();
        else if (command === "removeFormat") chain.unsetAllMarks().clearNodes().run();
        updateToolbar(tiptap);
      });
    });
    root.querySelector<HTMLSelectElement>("[data-rich-format]")?.addEventListener("change", (event) => {
      const value = (event.currentTarget as HTMLSelectElement).value;
      const chain = tiptap.chain().focus();
      if (value === "h2") chain.setHeading({ level: 2 }).run();
      else if (value === "h3") chain.setHeading({ level: 3 }).run();
      else if (value === "blockquote") chain.setBlockquote().run();
      else chain.setParagraph().run();
      updateToolbar(tiptap);
    });
    const imageButton = root.querySelector<HTMLButtonElement>("[data-rich-insert-image]");
    const imageInput = root.querySelector<HTMLInputElement>("[data-rich-image-input]");
    imageButton?.addEventListener("click", () => imageInput?.click());
    imageInput?.addEventListener("change", async () => {
      const file = imageInput.files?.[0]; if (!file) return;
      if (file.size > 5 * 1024 * 1024) { toast("حجم تصویر نباید بیشتر از ۵ مگابایت باشد.", "error"); imageInput.value = ""; return; }
      imageButton!.disabled = true;
      try {
        const body = new FormData(); body.append("image", file);
        const response = await fetch("/api/v1/admin/content-images", { method: "POST", credentials: "include", body });
        const payload = await response.json() as { url?: string; error?: string };
        if (!response.ok || !payload.url) throw new Error(payload.error || "بارگذاری تصویر انجام نشد.");
        const suggestedAlt = file.name.replace(/\.[^.]+$/, "");
        const imageDialog = await adminSwal.fire<{ alt: string; href: string }>({
          title: "درج تصویر در محتوا",
          html: `<p class="admin-swal-help">توضیح تصویر را وارد کنید و در صورت نیاز، لینک مقصد را هم مشخص کنید.</p>
          <div class="admin-swal-fields is-stacked">
            <label><span>متن جایگزین تصویر (Alt)</span><input class="swal2-input" data-image-alt type="text" placeholder="مثلاً بسته‌بندی قهوه روبوستا"></label>
            <label><span>لینک تصویر <small>اختیاری</small></span><input class="swal2-input" data-image-link type="text" placeholder="https://example.com یا /products/"></label>
          </div>`,
          showCancelButton: true,
          confirmButtonText: "درج تصویر",
          focusConfirm: false,
          didOpen: (popup) => {
            popup.setAttribute("dir", "rtl");
            const altInput = popup.querySelector<HTMLInputElement>("[data-image-alt]");
            if (altInput) { altInput.value = suggestedAlt; altInput.focus(); altInput.select(); }
          },
          preConfirm: () => {
            const popup = Swal.getPopup();
            const alt = popup?.querySelector<HTMLInputElement>("[data-image-alt]")?.value.trim() || "";
            const enteredLink = popup?.querySelector<HTMLInputElement>("[data-image-link]")?.value.trim() || "";
            if (!enteredLink) return { alt, href: "" };
            const candidate = /^(https?:\/\/|mailto:|tel:|\/|#)/i.test(enteredLink) ? enteredLink : `https://${enteredLink}`;
            const href = safeEditorHref(candidate);
            if (!href) {
              Swal.showValidationMessage("لینک تصویر معتبر نیست.");
              return false;
            }
            return { alt, href };
          }
        });
        if (!imageDialog.isConfirmed || !imageDialog.value) return;
        const alt = imageDialog.value.alt.replace(/[<>&\"]/g, "").slice(0, 240);
        const imageContent = {
          type: "image",
          attrs: { src: payload.url, alt },
          marks: imageDialog.value.href ? [{ type: "link", attrs: { href: imageDialog.value.href } }] : []
        };
        tiptap.chain().focus().insertContent(imageContent).run();
      } catch (error) { toast(error instanceof Error ? error.message : "بارگذاری تصویر انجام نشد.", "error"); }
      finally { imageButton!.disabled = false; imageInput.value = ""; }
    });
    root.querySelector<HTMLButtonElement>("[data-rich-insert-table]")?.addEventListener("click", async () => {
      const result = await adminSwal.fire<{ rows: number; columns: number }>({
        title: "درج جدول",
        html: `<p class="admin-swal-help">اندازه اولیه جدول را مشخص کنید؛ بعداً می‌توانید ردیف و ستون اضافه یا حذف کنید.</p>
        <div class="admin-swal-fields">
          <label><span>تعداد ردیف‌ها</span><input class="swal2-input" data-table-rows type="number" min="1" max="20" value="3"></label>
          <label><span>تعداد ستون‌ها</span><input class="swal2-input" data-table-columns type="number" min="1" max="10" value="3"></label>
        </div>`,
        showCancelButton: true,
        confirmButtonText: "ساخت جدول",
        focusConfirm: false,
        preConfirm: () => {
          const popup = Swal.getPopup();
          const rows = Number(popup?.querySelector<HTMLInputElement>("[data-table-rows]")?.value);
          const columns = Number(popup?.querySelector<HTMLInputElement>("[data-table-columns]")?.value);
          if (!Number.isInteger(rows) || rows < 1 || rows > 20 || !Number.isInteger(columns) || columns < 1 || columns > 10) {
            Swal.showValidationMessage("ردیف باید بین ۱ تا ۲۰ و ستون بین ۱ تا ۱۰ باشد.");
            return false;
          }
          return { rows, columns };
        }
      });
      if (!result.isConfirmed || !result.value) return;
      const { rows, columns } = result.value;
      tiptap.chain().focus().insertTable({ rows, cols: columns, withHeaderRow: true }).run();
      root.querySelector<HTMLDetailsElement>(".admin-editor-table-menu")?.removeAttribute("open");
    });
    root.querySelectorAll<HTMLButtonElement>("[data-rich-table-command]").forEach((button) => {
      button.addEventListener("click", () => {
        const chain = tiptap.chain().focus();
        const command = button.dataset.richTableCommand;
        if (command === "addRowAfter") chain.addRowAfter().run();
        else if (command === "addColumnAfter") chain.addColumnAfter().run();
        else if (command === "deleteRow") chain.deleteRow().run();
        else if (command === "deleteColumn") chain.deleteColumn().run();
        else if (command === "deleteTable") chain.deleteTable().run();
        button.closest("details")?.removeAttribute("open");
      });
    });
    updateToolbar(tiptap);
  });
};

const loadLookups = async (form: HTMLFormElement) => {
  const category = form.querySelector<HTMLSelectElement>('[data-dynamic-options="categoryId"]');
  const tags = form.querySelector<HTMLSelectElement>('[data-dynamic-options="tagIds"]');
  const relatedProducts = form.querySelector<HTMLSelectElement>('[data-dynamic-options="relatedProductIds"]');
  const currentId = new URLSearchParams(location.search).get("id");
  await Promise.all([
    category ? api<{ items: { id: string; title: string }[] }>("/api/v1/admin/categories?pageSize=100")
      .then((payload) => payload.items.forEach((item) => category.add(new Option(item.title, item.id)))) : Promise.resolve(),
    tags ? api<{ items: { id: string; title: string }[] }>("/api/v1/admin/tags?pageSize=100")
      .then((payload) => payload.items.forEach((item) => tags.add(new Option(item.title, item.id)))) : Promise.resolve(),
    relatedProducts ? api<{ items: { id: string; titleFa: string; titleEn: string }[] }>("/api/v1/admin/products?pageSize=100")
      .then((payload) => payload.items.filter((item) => item.id !== currentId).forEach((item) => {
        relatedProducts.add(new Option(`${item.titleFa} — ${item.titleEn}`, item.id));
      })) : Promise.resolve()
  ]).catch(() => undefined);
};

const initMultiSelects = (form: HTMLFormElement) => {
  form.querySelectorAll<HTMLSelectElement>("select[multiple]").forEach((select) => {
    const tagInput = form.querySelector<HTMLInputElement>(`input[data-tagify-field="${select.name}"]`);
    if (tagInput) {
      const whitelist = [...select.options].map((option) => ({ value: option.textContent || option.value, id: option.value }));
      const tagify = new Tagify(tagInput, {
        whitelist,
        enforceWhitelist: true,
        skipInvalid: true,
        editTags: false,
        dropdown: { enabled: 0, closeOnSelect: false, maxItems: 12 }
      });
      tagify.on("change", () => {
        const selected = new Set(tagify.value.map((item) => String((item as { id?: string }).id || item.value)));
        [...select.options].forEach((option) => { option.selected = selected.has(option.value); });
        select.dispatchEvent(new Event("change", { bubbles: true }));
      });
      (tagInput as HTMLInputElement & { _tagify?: Tagify })._tagify = tagify;
    }
    select.addEventListener("mousedown", (event) => {
      const option = (event.target as HTMLElement).closest("option") as HTMLOptionElement | null;
      if (!option || select.disabled) return;
      event.preventDefault();
      option.selected = !option.selected;
      select.focus();
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
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
        const bankCode = bankLogoCodes[card.bankName] || "bmi";
        article.innerHTML = `
          <header class="admin-bank-card-head">
            <span class="admin-bank-identity"><i class="admin-bank-logo bank-${bankCode}" role="img" aria-label="لوگوی بانک ${card.bankName}"></i><b>بانک ${card.bankName}</b></span>
            <span class="admin-badge admin-status status-${card.isActive}">${card.isActive ? "فعال" : "غیرفعال"}</span>
          </header>
          <div class="admin-bank-card-number"><small>شماره کارت</small><strong dir="ltr">${card.cardNumber.replace(/(\d{4})(?=\d)/g, "$1 ")}</strong></div>
          <div><small>شبا</small><b dir="ltr">IR${card.shebaNumber}</b></div>
          <div><small>حساب</small><b dir="ltr">${card.accountNumber}</b></div>
          <div><small>صاحب حساب</small><b>${card.accountOwner}</b></div>
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

const initCatalogImageUpload = (form: HTMLFormElement, resource: "products" | "categories") => {
  const root = form.querySelector<HTMLElement>("[data-catalog-image-upload]");
  const urlInput = form.elements.namedItem("imageUrl") as HTMLInputElement | null;
  const fileInput = root?.querySelector<HTMLInputElement>("[data-catalog-image-input]");
  const preview = root?.querySelector<HTMLImageElement>("[data-catalog-image-preview]");
  const placeholder = root?.querySelector<HTMLElement>("[data-catalog-image-placeholder]");
  const imageLabel = resource === "categories" ? "بنر دسته‌بندی" : "تصویر محصول";
  const render = () => {
    const url = urlInput?.value.trim() || "";
    if (preview) {
      preview.hidden = !url;
      if (url) preview.src = url;
      else preview.removeAttribute("src");
    }
    if (placeholder) placeholder.hidden = Boolean(url);
  };
  urlInput?.addEventListener("input", render);
  fileInput?.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      fileInput.value = "";
      toast(`حجم ${imageLabel} نباید بیشتر از ۵ مگابایت باشد.`, "error");
      return;
    }
    const body = new FormData();
    body.append("image", file);
    fileInput.disabled = true;
    try {
      const endpoint = resource === "categories" ? "category-images" : "product-images";
      const result = await api<{ url: string }>(`/api/v1/admin/${endpoint}`, {
        method: "POST",
        body
      });
      if (urlInput) urlInput.value = result.url;
      render();
      toast(`${imageLabel} بارگذاری شد؛ برای ثبت نهایی، تغییرات را ذخیره کنید.`);
    } catch (error) {
      toast(error instanceof Error ? error.message : `بارگذاری ${imageLabel} انجام نشد.`, "error");
    } finally {
      fileInput.disabled = false;
      fileInput.value = "";
    }
  });
  render();
  return render;
};

const initForm = async (form: HTMLFormElement, config: ResourceConfig, mode: string) => {
  initRichTextEditors(form);
  initMoneyInputs(form);
  await loadLookups(form);
  initMultiSelects(form);
  enhanceDropdowns(form);
  enhancePersianDates(form);
  initSeoCounters(form);
  const refreshCatalogImage = config.key === "products" || config.key === "categories"
    ? initCatalogImageUpload(form, config.key)
    : undefined;
  const updateProductProfit = (source: "purchase" | "sale" | "markup" | "refresh" = "refresh") => {
    if (config.key !== "products") return;
    const saleType = form.elements.namedItem("saleType") as HTMLSelectElement | null;
    const packageWeight = form.elements.namedItem("packageWeightGrams") as HTMLSelectElement | null;
    const purchase = form.elements.namedItem("purchasePricePerKg") as HTMLInputElement | null;
    const markup = form.elements.namedItem("markupPercent") as HTMLInputElement | null;
    const sale = form.elements.namedItem("salePricePerKg") as HTMLInputElement | null;
    const profit = form.elements.namedItem("profitPerKg") as HTMLInputElement | null;
    const purchaseValue = parseNumericInput(purchase?.value) || 0;
    const saleValue = parseNumericInput(sale?.value) || 0;
    let markupValue = parseNumericInput(markup?.value) || 0;
    if (source === "purchase" || source === "markup") {
      const nextSale = Math.round(purchaseValue * (1 + markupValue / 100));
      if (sale) sale.value = nextSale ? String(nextSale) : "";
    } else if (source === "sale" && purchaseValue > 0) {
      markupValue = ((saleValue - purchaseValue) / purchaseValue) * 100;
      if (markup) markup.value = Number.isFinite(markupValue) ? markupValue.toFixed(2) : "";
    } else if (source === "refresh" && markup && purchaseValue > 0 && saleValue > 0) {
      markupValue = ((saleValue - purchaseValue) / purchaseValue) * 100;
      markup.value = Number.isFinite(markupValue) ? markupValue.toFixed(2) : "";
    }
    const currentSaleValue = parseNumericInput(sale?.value) || 0;
    const isPackaged = saleType?.value === "packaged";
    const packageField = form.querySelector<HTMLElement>('[data-admin-field="packageWeightGrams"]');
    if (packageField) packageField.hidden = !isPackaged;
    if (profit) profit.value = String(currentSaleValue - purchaseValue);
    const breakdown = form.querySelector<HTMLElement>("[data-price-breakdown] > div");
    if (breakdown) {
      const weights = isPackaged ? [Number(packageWeight?.value || 250)] : [250, 500, 1000];
      breakdown.innerHTML = weights.map((grams) => {
        const ratio = grams / 1000;
        const purchaseAmount = isPackaged ? purchaseValue : Math.round(purchaseValue * ratio);
        const saleAmount = isPackaged ? currentSaleValue : Math.round(currentSaleValue * ratio);
        return `<article>
          <strong>${isPackaged ? "بسته " : ""}${faNumber.format(grams)} گرم</strong>
          <span>خرید <b>${money.format(purchaseAmount)}</b></span>
          <span>فروش <b>${money.format(saleAmount)}</b></span>
          <span>سود <b>${money.format(saleAmount - purchaseAmount)}</b></span>
        </article>`;
      }).join("");
    }
  };
  if (config.key === "products") {
    const saleType = form.elements.namedItem("saleType") as HTMLSelectElement | null;
    const packageWeight = form.elements.namedItem("packageWeightGrams") as HTMLSelectElement | null;
    const stockStatus = form.elements.namedItem("stockStatus") as HTMLSelectElement | null;
    if (mode === "add") {
      if (saleType && !saleType.value) {
        saleType.value = "weighted";
        saleType.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (packageWeight && !packageWeight.value) {
        packageWeight.value = "250";
        packageWeight.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (stockStatus && !stockStatus.value) {
        stockStatus.value = "inStock";
        stockStatus.dispatchEvent(new Event("change", { bubbles: true }));
      }
    }
    saleType?.addEventListener("change", () => updateProductProfit("refresh"));
    packageWeight?.addEventListener("change", () => updateProductProfit("refresh"));
    (form.elements.namedItem("purchasePricePerKg") as HTMLInputElement | null)?.addEventListener("input", () => updateProductProfit("purchase"));
    (form.elements.namedItem("markupPercent") as HTMLInputElement | null)?.addEventListener("input", () => updateProductProfit("markup"));
    (form.elements.namedItem("salePricePerKg") as HTMLInputElement | null)?.addEventListener("input", () => updateProductProfit("sale"));
    updateProductProfit();
  }
  const id = new URLSearchParams(location.search).get("id");
  if (config.key === "users" && id) {
    form.querySelector("[data-user-password-reset]")?.addEventListener("click", () => {
      const firstName = (form.elements.namedItem("firstName") as HTMLInputElement | null)?.value || "";
      const lastName = (form.elements.namedItem("lastName") as HTMLInputElement | null)?.value || "";
      openUserPasswordReset(id, `${firstName} ${lastName}`.trim());
    });
  }
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
      initSeoCounters(form);
      refreshCatalogImage?.();
      updateProductProfit();
      if (config.key === "orders") {
        renderOrderItems(form, item.items);
        initPaymentReview(form, id, item);
        initOrderWorkflow(form, id, item);
      }
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
      if (field.type === "permissions") body[field.key] = data.getAll(field.key).map(String);
      else if (field.type === "multiselect") body[field.key] = data.getAll(field.key).map(String);
      else if (field.type === "number" || field.key === "packageWeightGrams") body[field.key] = raw === "" ? null : parseNumericInput(raw);
      else if (["isActive", "isPublished", "showInBestSellers", "showInDiscounts"].includes(field.key)) body[field.key] = raw === "true";
      else if (field.key === "tags") body[field.key] = String(raw || "").split(",").map((tag) => tag.trim()).filter(Boolean);
      else body[field.key] = raw === "" ? null : raw;
    });
    if (config.key === "roles" && !(body.permissions as string[] | undefined)?.length) {
      toast("حداقل یک دسترسی برای نقش انتخاب کنید.", "error");
      return;
    }
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

const initPaymentReview = (
  form: HTMLFormElement,
  orderId: string,
  item: Record<string, unknown>
) => {
  const root = form.querySelector<HTMLElement>("[data-payment-review]");
  const receiptUrl = String(item.paymentReceiptUrl || "");
  const reference = String(item.paymentRefId || "");
  if (!root || !receiptUrl || !reference) return;
  root.hidden = false;
  const link = root.querySelector<HTMLAnchorElement>("[data-payment-receipt]");
  const image = root.querySelector<HTMLImageElement>("[data-payment-receipt-image]");
  if (link) link.href = receiptUrl;
  if (image) image.src = receiptUrl;

  const decide = async (decision: "approve" | "reject") => {
    const label = decision === "approve" ? "تأیید" : "رد";
    if (!await askConfirm(`${label} پرداخت`, `آیا از ${label} پرداخت با کد پیگیری ${reference} مطمئن هستید؟`, label)) return;
    const approve = root.querySelector<HTMLButtonElement>("[data-payment-approve]");
    const reject = root.querySelector<HTMLButtonElement>("[data-payment-reject]");
    if (approve) approve.disabled = true;
    if (reject) reject.disabled = true;
    try {
      const adminNote = (form.elements.namedItem("adminNote") as HTMLTextAreaElement | null)?.value.trim() || null;
      await api(`/api/v1/admin/orders/${orderId}/payment-decision`, {
        method: "POST",
        body: JSON.stringify({ decision, adminNote })
      });
      toast(`پرداخت سفارش ${label} شد.`);
      window.setTimeout(() => location.reload(), 450);
    } catch (error) {
      toast(error instanceof Error ? error.message : "بررسی پرداخت انجام نشد.", "error");
      if (approve) approve.disabled = false;
      if (reject) reject.disabled = false;
    }
  };
  root.querySelector("[data-payment-approve]")?.addEventListener("click", () => { void decide("approve"); });
  root.querySelector("[data-payment-reject]")?.addEventListener("click", () => { void decide("reject"); });
  if (item.paymentStatus !== "pending") {
    root.querySelectorAll<HTMLButtonElement>("footer button").forEach((button) => { button.disabled = true; });
  }
};

const initOrderWorkflow = (
  form: HTMLFormElement,
  orderId: string,
  item: Record<string, unknown>
) => {
  const root = form.querySelector<HTMLElement>("[data-order-workflow]");
  if (!root) return;
  root.hidden = false;
  const status = String(item.orderStatus || "new");
  const state = root.querySelector<HTMLElement>("[data-order-workflow-state]");
  const readyButton = root.querySelector<HTMLButtonElement>("[data-order-mark-ready]");
  const sentButton = root.querySelector<HTMLButtonElement>("[data-order-mark-sent]");
  const stages = ["processing", "ready", "sent"];
  const currentIndex = stages.indexOf(status);

  root.querySelectorAll<HTMLElement>("[data-workflow-stage]").forEach((stage, index) => {
    stage.classList.toggle("done", currentIndex > index);
    stage.classList.toggle("current", currentIndex === index);
  });

  if (state) {
    if (status === "processing") {
      state.textContent = "سفارش در حال آماده‌سازی است.";
    } else if (status === "ready") {
      state.textContent = "سفارش آماده است و در صف ارسال قرار دارد.";
    } else if (status === "sent") {
      state.textContent = "ارسال سفارش به مشتری ثبت شده است.";
    } else if (status === "completed") {
      state.textContent = "فرآیند این سفارش تکمیل شده است.";
    } else if (status === "canceled") {
      state.textContent = "این سفارش لغو شده است.";
    }
  }
  if (readyButton) readyButton.hidden = status !== "processing";
  if (sentButton) sentButton.hidden = status !== "ready";

  const transition = async (action: "ready" | "sent") => {
    const isReadyAction = action === "ready";
    const accepted = await askConfirm(
      isReadyAction ? "ثبت آماده ارسال" : "ثبت ارسال سفارش",
      isReadyAction
        ? "آماده‌سازی این سفارش تکمیل شده و سفارش وارد صف ارسال شود؟"
        : "ارسال این سفارش به مشتری ثبت شود؟",
      isReadyAction ? "بله، آماده ارسال است" : "بله، ارسال شد"
    );
    if (!accepted) return;
    if (readyButton) readyButton.disabled = true;
    if (sentButton) sentButton.disabled = true;
    try {
      await api(`/api/v1/admin/orders/${orderId}/fulfillment-transition`, {
        method: "POST",
        body: JSON.stringify({ action })
      });
      toast(isReadyAction ? "سفارش آماده ارسال شد." : "ارسال سفارش ثبت شد.");
      window.setTimeout(() => location.reload(), 350);
    } catch (error) {
      toast(error instanceof Error ? error.message : "تغییر مرحله سفارش انجام نشد.", "error");
      if (readyButton) readyButton.disabled = false;
      if (sentButton) sentButton.disabled = false;
    }
  };

  readyButton?.addEventListener("click", () => { void transition("ready"); });
  sentButton?.addEventListener("click", () => { void transition("sent"); });
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
    const { stats, orderStatuses } = await api<{
      stats: Record<string, number>;
      orderStatuses: Record<string, number>;
    }>("/api/v1/admin/dashboard");
    Object.entries(stats).forEach(([key, value]) => {
      const element = document.querySelector<HTMLElement>(`[data-stat="${key}"]`);
      if (element) element.textContent = element.hasAttribute("data-money-stat") ? money.format(value) : faNumber.format(value);
    });
    const statusKeys = ["new", "processing", "ready", "sent", "completed", "canceled"];
    const colors: Record<string, string> = {
      new: "#c9994e",
      processing: "#d9b15f",
      ready: "#293b32",
      sent: "#293b32",
      completed: "#293b32",
      canceled: "#b72d3a"
    };
    const total = statusKeys.reduce((sum, key) => sum + Number(orderStatuses[key] || 0), 0);
    const totalElement = document.querySelector<HTMLElement>("[data-order-status-total]");
    if (totalElement) totalElement.textContent = faNumber.format(total);
    statusKeys.forEach((key) => {
      const row = document.querySelector<HTMLElement>(`[data-order-status-row="${key}"]`);
      const value = Number(orderStatuses[key] || 0);
      const count = row?.querySelector<HTMLElement>("strong");
      if (count) count.textContent = faNumber.format(value);
    });
    const chart = document.querySelector<HTMLElement>("[data-order-status-chart]");
    if (chart) {
      if (!total) {
        chart.style.background = "#e8dfd2";
      } else {
        let position = 0;
        const segments = statusKeys.map((key) => {
          const start = position;
          position += (Number(orderStatuses[key] || 0) / total) * 100;
          return `${colors[key]} ${start}% ${position}%`;
        });
        chart.style.background = `conic-gradient(${segments.join(",")})`;
      }
    }
  } catch (error) {
    toast(error instanceof Error ? error.message : "آمار داشبورد دریافت نشد.", "error");
  }
};

const initAdminProfile = async () => {
  const root = document.querySelector<HTMLElement>("[data-admin-profile]");
  if (!root) return;
  const profileForm = root.querySelector<HTMLFormElement>("[data-admin-profile-form]")!;
  const passwordForm = root.querySelector<HTMLFormElement>("[data-admin-profile-password]")!;
  try {
    const { user } = await api<{
      user: {
        firstName: string | null;
        lastName: string | null;
        username: string | null;
        email: string | null;
        phone: string | null;
        role: string;
        panelRoleTitle: string | null;
      }
    }>("/api/v1/admin/profile");
    const set = (name: string, value: string | null) => {
      const input = profileForm.elements.namedItem(name) as HTMLInputElement | null;
      if (input) input.value = value || "";
    };
    set("firstName", user.firstName);
    set("lastName", user.lastName);
    set("username", user.username);
    set("email", user.email);
    set("phone", user.phone);
    set("role", user.panelRoleTitle || (user.role === "admin" ? "مدیر" : "کاربر فروشگاه"));
  } catch (error) {
    toast(error instanceof Error ? error.message : "دریافت پروفایل مدیریت انجام نشد.", "error");
  }

  profileForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!profileForm.checkValidity()) {
      profileForm.reportValidity();
      return;
    }
    const data = new FormData(profileForm);
    const submit = profileForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    submit.disabled = true;
    try {
      const { user } = await api<{ user: { displayName: string } }>("/api/v1/admin/profile", {
        method: "PATCH",
        body: JSON.stringify({
          firstName: data.get("firstName"),
          lastName: data.get("lastName")
        })
      });
      const label = document.querySelector<HTMLElement>("[data-admin-user]");
      if (label) label.textContent = user.displayName;
      toast("مشخصات مدیریت ذخیره شد.");
    } catch (error) {
      toast(error instanceof Error ? error.message : "ذخیره مشخصات انجام نشد.", "error");
    } finally {
      submit.disabled = false;
    }
  });

  passwordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!passwordForm.checkValidity()) {
      passwordForm.reportValidity();
      return;
    }
    const data = new FormData(passwordForm);
    if (data.get("newPassword") !== data.get("confirmPassword")) {
      toast("تکرار رمز با رمز عبور جدید یکسان نیست.", "error");
      return;
    }
    const submit = passwordForm.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    submit.disabled = true;
    try {
      const result = await api<{ message: string }>("/api/v1/admin/profile/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: data.get("currentPassword"),
          newPassword: data.get("newPassword")
        })
      });
      passwordForm.reset();
      toast(result.message);
    } catch (error) {
      toast(error instanceof Error ? error.message : "تغییر رمز عبور انجام نشد.", "error");
    } finally {
      submit.disabled = false;
    }
  });
};

type SiteSettingsPayload = {
  brandName: string;
  brandNameEn: string;
  brandTagline: string;
  supportPhone: string;
  supportEmail: string;
  whatsappUrl: string;
  baleUrl: string;
  instagramUrl: string;
  websiteUrl: string;
  address: string | null;
  footerHeading: string;
  footerDescription: string;
  footerCopyright: string;
  logoUrl: string | null;
  faviconUrl: string;
  homepageSeoTitle: string;
  homepageSeoDescription: string;
  homepageSeoKeywords: string[];
  homepageOgImageUrl: string;
  homepageHeroEyebrow: string;
  homepageHeroTitle: string;
  homepageHeroTitleAccent: string;
  homepageHeroDescription: string;
  homepageHeroPrimaryLabel: string;
  homepageHeroPrimaryHref: string;
  homepageHeroSecondaryLabel: string;
  homepageHeroSecondaryHref: string;
  homepageHeroBenefits: string[];
  homepageHeroBenefitItems?: HomepageHeroBenefitItem[];
  homepageBannerDesktopUrl: string | null;
  homepageBannerMobileUrl: string | null;
  homepageBannerRows: HomepageBannerRow[];
  homepageBestSellersEnabled: boolean;
  homepageDiscountsEnabled: boolean;
  homepageBestSellersTitle: string;
  homepageBestSellersColor: string;
  homepageBestSellersTextColor: string;
  homepageBestSellersBadgeLabel: string;
  homepageBestSellersBadgeColor: string;
  homepageBestSellersIconColor: string;
  homepageDiscountsTitle: string;
  homepageDiscountsColor: string;
  homepageDiscountsCountdownEnabled: boolean;
  homepageDiscountsExpiresAt: string | null;
  homepageDiscountsTextColor: string;
  homepageDiscountsBadgeLabel: string;
  homepageDiscountsBadgeColor: string;
  homepageDiscountsIconColor: string;
  themeSurfaceColor: string;
  themeFooterColor: string;
  themeSupportColor: string;
  themeHeaderIconColor: string;
  searchIndexingEnabled: boolean;
  invoiceNationalId: string;
  invoiceSignatureUrl: string | null;
  contentAiModel: string;
  contentAiApiKey: string;
  contentAiKeyConfigured: boolean;
  contentAiInstructions: string;
  contentAiDefaultAudience: string;
  contentAiDefaultTone: string;
  contentAiDefaultLength: "short" | "medium" | "long";
  contentAiDefaultLanguage: "fa" | "en";
};

type HomepageBannerRowId = "aboveDiscount" | "aboveBest";
type HomepageBannerItem = {
  id: string;
  imageUrl: string;
  alt: string;
  href: string;
  seoTitle: string;
  seoDescription: string;
  geoSummary: string;
  ieoIntent: string;
  isActive: boolean;
};
type HomepageBannerRow = {
  id: HomepageBannerRowId;
  title: string;
  columns: number;
  isActive: boolean;
  items: HomepageBannerItem[];
};

type HomepageHeroBenefitIcon =
  | "send"
  | "cart"
  | "coffee"
  | "grind"
  | "bean"
  | "store"
  | "home"
  | "grid"
  | "bell"
  | "user"
  | "search"
  | "phone";

type HomepageHeroBenefitItem = {
  text: string;
  icon: HomepageHeroBenefitIcon;
};

const defaultHomepageBannerRows = (): HomepageBannerRow[] => [
  { id: "aboveDiscount", title: "بالای شگفت‌انگیزها", columns: 3, isActive: false, items: [] },
  { id: "aboveBest", title: "بالای پرطرفدارها", columns: 3, isActive: false, items: [] }
];

const maxHomepageBannerItems = (columns: number) =>
  Math.min(4, Math.max(1, Number(columns) || 3));

const toDatetimeLocalValue = (value: string | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return offsetDate.toISOString().slice(0, 16);
};

const fromDatetimeLocalValue = (value: string) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const initSiteSettings = async () => {
  const form = document.querySelector<HTMLFormElement>("[data-admin-site-settings]");
  if (!form) return;
  const state = form.querySelector<HTMLElement>("[data-site-settings-state]");
  const input = (name: string) =>
    form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement;
  const settingsButtons = Array.from(form.querySelectorAll<HTMLButtonElement>("[data-settings-group-target]"));
  const settingsSections = Array.from(form.querySelectorAll<HTMLElement>("[data-settings-group]"));
  const settingsGroups = new Set(settingsButtons.map((button) => button.dataset.settingsGroupTarget || ""));
  const showSettingsGroup = (group: string, updateHash = false) => {
    const nextGroup = settingsGroups.has(group) ? group : "general";
    settingsButtons.forEach((button) => {
      const isActive = button.dataset.settingsGroupTarget === nextGroup;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    });
    settingsSections.forEach((section) => {
      section.hidden = section.dataset.settingsGroup !== nextGroup;
    });
    if (updateHash) {
      history.replaceState(null, "", `#settings-${nextGroup}`);
    }
  };
  const signatureInput = form.querySelector<HTMLInputElement>("[data-invoice-signature-input]");
  const signaturePreview = form.querySelector<HTMLImageElement>("[data-invoice-signature-preview]");
  const signaturePlaceholder = form.querySelector<HTMLElement>("[data-invoice-signature-placeholder]");
  const signatureRemove = form.querySelector<HTMLButtonElement>("[data-invoice-signature-remove]");
  const bannerUrls: Record<"desktop" | "mobile", string | null> = { desktop: null, mobile: null };
  const defaultBenefitIcons: HomepageHeroBenefitIcon[] = ["send", "cart", "coffee", "grind", "bean"];
  const bannerRows = new Map<HomepageBannerRowId, HomepageBannerRow>(
    defaultHomepageBannerRows().map((row) => [row.id, row])
  );
  let isRenderingBannerRows = false;
  settingsButtons.forEach((button) => {
    button.addEventListener("click", () => showSettingsGroup(button.dataset.settingsGroupTarget || "general", true));
  });
  window.addEventListener("hashchange", () => {
    showSettingsGroup(window.location.hash.replace("#settings-", ""));
  });
  showSettingsGroup(window.location.hash.replace("#settings-", ""));
  const showSignature = (url: string | null) => {
    if (signaturePreview) {
      signaturePreview.hidden = !url;
      if (url) signaturePreview.src = `${url}?v=${Date.now()}`;
      else signaturePreview.removeAttribute("src");
    }
    if (signaturePlaceholder) signaturePlaceholder.hidden = Boolean(url);
    if (signatureRemove) signatureRemove.hidden = !url;
  };
  const showBanner = (kind: "desktop" | "mobile", url: string | null) => {
    bannerUrls[kind] = url;
    const setting = form.querySelector<HTMLElement>(`[data-homepage-banner-setting="${kind}"]`);
    const preview = setting?.querySelector<HTMLImageElement>("[data-homepage-banner-preview]");
    const placeholder = setting?.querySelector<HTMLElement>("[data-homepage-banner-placeholder]");
    const remove = setting?.querySelector<HTMLButtonElement>("[data-homepage-banner-remove]");
    if (preview) {
      preview.hidden = !url;
      if (url) preview.src = `${url}?v=${Date.now()}`;
      else preview.removeAttribute("src");
    }
    if (placeholder) placeholder.hidden = Boolean(url);
    if (remove) remove.hidden = !url;
  };
  const benefitRows = Array.from(form.querySelectorAll<HTMLElement>("[data-hero-benefit-item]"));
  const renderBenefitRows = (items: HomepageHeroBenefitItem[] = [], fallbackTexts: string[] = []) => {
    benefitRows.forEach((row, index) => {
      const icon = row.querySelector<HTMLSelectElement>("[data-hero-benefit-icon]");
      const text = row.querySelector<HTMLInputElement>("[data-hero-benefit-text]");
      const item = items[index];
      if (icon) icon.value = item?.icon || defaultBenefitIcons[index] || "coffee";
      if (text) text.value = item?.text || fallbackTexts[index] || "";
    });
  };
  const collectBenefitRows = () => benefitRows
    .map((row, index) => {
      const icon = row.querySelector<HTMLSelectElement>("[data-hero-benefit-icon]");
      const text = row.querySelector<HTMLInputElement>("[data-hero-benefit-text]");
      return {
        text: text?.value.trim() || "",
        icon: (icon?.value || defaultBenefitIcons[index] || "coffee") as HomepageHeroBenefitIcon
      };
    })
    .filter((item) => item.text)
    .slice(0, 5);
  const itemTemplate = form.querySelector<HTMLTemplateElement>("[data-home-banner-item-template]");
  const renderBannerRows = () => {
    isRenderingBannerRows = true;
    form.querySelectorAll<HTMLElement>("[data-home-banner-row-editor]").forEach((editor) => {
      const rowId = editor.dataset.homeBannerRowEditor as HomepageBannerRowId;
      const row = bannerRows.get(rowId);
      if (!row || !itemTemplate) return;
      const active = editor.querySelector<HTMLInputElement>("[data-home-banner-row-active]");
      const columns = editor.querySelector<HTMLSelectElement>("[data-home-banner-row-columns]");
      const addButton = editor.querySelector<HTMLButtonElement>("[data-home-banner-add-item]");
      const itemsRoot = editor.querySelector<HTMLElement>("[data-home-banner-items]");
      if (active) active.checked = row.isActive;
      if (columns) {
        columns.value = String(row.columns);
        columns.dispatchEvent(new Event("change", { bubbles: true }));
      }
      if (addButton) {
        const maxItems = maxHomepageBannerItems(row.columns);
        addButton.disabled = row.items.length >= maxItems;
        addButton.title = addButton.disabled ? `سقف این ردیف ${maxItems} بنر است.` : "";
      }
      if (!itemsRoot) return;
      itemsRoot.replaceChildren();
      row.items.forEach((item) => {
        const fragment = itemTemplate.content.cloneNode(true) as DocumentFragment;
        const element = fragment.querySelector<HTMLElement>("[data-home-banner-item]");
        if (!element) return;
        element.dataset.bannerId = item.id;
        const preview = element.querySelector<HTMLImageElement>("[data-home-banner-item-preview]");
        const placeholder = element.querySelector<HTMLElement>("[data-home-banner-item-placeholder]");
        const itemActive = element.querySelector<HTMLInputElement>("[data-home-banner-item-active]");
        const alt = element.querySelector<HTMLInputElement>("[data-home-banner-item-alt]");
        const href = element.querySelector<HTMLInputElement>("[data-home-banner-item-href]");
        const seoTitle = element.querySelector<HTMLInputElement>("[data-home-banner-item-seo-title]");
        const seoDescription = element.querySelector<HTMLTextAreaElement>("[data-home-banner-item-seo-description]");
        const geoSummary = element.querySelector<HTMLTextAreaElement>("[data-home-banner-item-geo-summary]");
        const ieoIntent = element.querySelector<HTMLInputElement>("[data-home-banner-item-ieo-intent]");
        const fileInput = element.querySelector<HTMLInputElement>("[data-home-banner-item-input]");
        const removeItem = element.querySelector<HTMLButtonElement>("[data-home-banner-remove-item]");
        if (preview) {
          preview.hidden = !item.imageUrl;
          if (item.imageUrl) preview.src = `${item.imageUrl}?v=${Date.now()}`;
          else preview.removeAttribute("src");
        }
        if (placeholder) placeholder.hidden = Boolean(item.imageUrl);
        if (itemActive) itemActive.checked = item.isActive;
        if (alt) alt.value = item.alt || "";
        if (href) href.value = item.href || "";
        if (seoTitle) seoTitle.value = item.seoTitle || "";
        if (seoDescription) seoDescription.value = item.seoDescription || "";
        if (geoSummary) geoSummary.value = item.geoSummary || "";
        if (ieoIntent) ieoIntent.value = item.ieoIntent || "";
        itemActive?.addEventListener("change", () => { item.isActive = itemActive.checked; });
        alt?.addEventListener("input", () => { item.alt = alt.value; });
        href?.addEventListener("input", () => { item.href = href.value; });
        seoTitle?.addEventListener("input", () => { item.seoTitle = seoTitle.value; });
        seoDescription?.addEventListener("input", () => { item.seoDescription = seoDescription.value; });
        geoSummary?.addEventListener("input", () => { item.geoSummary = geoSummary.value; });
        ieoIntent?.addEventListener("input", () => { item.ieoIntent = ieoIntent.value; });
        initSeoCounters(element);
        fileInput?.addEventListener("change", async () => {
          const file = fileInput.files?.[0];
          if (!file) return;
          if (file.size > 5 * 1024 * 1024) {
            fileInput.value = "";
            toast("حجم بنر نباید بیشتر از ۵ مگابایت باشد.", "error");
            return;
          }
          const body = new FormData();
          body.append("banner", file);
          fileInput.disabled = true;
          if (state) state.textContent = "در حال بارگذاری تصویر بنر ردیفی…";
          try {
            const result = await api<{ url: string }>("/api/v1/admin/site-settings/homepage-banner/row", { method: "POST", body });
            item.imageUrl = result.url;
            renderBannerRows();
            toast("تصویر بنر بارگذاری شد.");
            if (state) state.textContent = "برای ثبت چینش جدید، تنظیمات را ذخیره کنید.";
          } catch (error) {
            toast(error instanceof Error ? error.message : "بارگذاری بنر انجام نشد.", "error");
          } finally {
            fileInput.disabled = false;
            fileInput.value = "";
          }
        });
        removeItem?.addEventListener("click", async () => {
          if (!await askConfirm("حذف بنر", "این بنر از ردیف حذف شود؟", "حذف")) return;
          row.items = row.items.filter((candidate) => candidate.id !== item.id);
          renderBannerRows();
        });
        element.addEventListener("dragstart", (event) => {
          event.dataTransfer?.setData("text/plain", item.id);
          element.classList.add("is-dragging");
        });
        element.addEventListener("dragend", () => element.classList.remove("is-dragging"));
        element.addEventListener("dragover", (event) => event.preventDefault());
        element.addEventListener("drop", (event) => {
          event.preventDefault();
          const draggedId = event.dataTransfer?.getData("text/plain");
          if (!draggedId || draggedId === item.id) return;
          const from = row.items.findIndex((candidate) => candidate.id === draggedId);
          const to = row.items.findIndex((candidate) => candidate.id === item.id);
          if (from < 0 || to < 0) return;
          const [moved] = row.items.splice(from, 1);
          row.items.splice(to, 0, moved);
          renderBannerRows();
        });
        itemsRoot.append(element);
      });
    });
    isRenderingBannerRows = false;
  };
  const collectBannerRows = () => [...bannerRows.values()].map((row) => ({
    ...row,
    columns: maxHomepageBannerItems(row.columns),
    items: row.items
      .filter((item) => item.imageUrl)
      .slice(0, maxHomepageBannerItems(row.columns))
  }));
  form.querySelectorAll<HTMLElement>("[data-home-banner-row-editor]").forEach((editor) => {
    const rowId = editor.dataset.homeBannerRowEditor as HomepageBannerRowId;
    editor.querySelector<HTMLInputElement>("[data-home-banner-row-active]")?.addEventListener("change", (event) => {
      const row = bannerRows.get(rowId);
      if (row) row.isActive = (event.currentTarget as HTMLInputElement).checked;
    });
    editor.querySelector<HTMLSelectElement>("[data-home-banner-row-columns]")?.addEventListener("change", (event) => {
      const row = bannerRows.get(rowId);
      const select = event.currentTarget as HTMLSelectElement;
      if (isRenderingBannerRows) return;
      if (!row) return;
      const nextColumns = Number(select.value);
      if (row.items.length > nextColumns) {
        row.items = row.items.slice(0, nextColumns);
        toast(`تعداد بنرهای این ردیف به ${nextColumns} عدد محدود شد.`);
      }
      row.columns = nextColumns;
      if (state) state.textContent = "برای اعمال تغییر تعداد بنرها در سایت، ذخیره تنظیمات را بزنید.";
      renderBannerRows();
    });
    editor.querySelector<HTMLButtonElement>("[data-home-banner-add-item]")?.addEventListener("click", () => {
      const row = bannerRows.get(rowId);
      if (!row) return;
      const maxItems = maxHomepageBannerItems(row.columns);
      if (row.items.length >= maxItems) {
        toast(`برای این ردیف حداکثر ${maxItems} بنر می‌توانید ثبت کنید.`, "error");
        return;
      }
      row.items.push({
        id: crypto.randomUUID(),
        imageUrl: "",
        alt: "",
        href: "",
        seoTitle: "",
        seoDescription: "",
        geoSummary: "",
        ieoIntent: "",
        isActive: true
      });
      renderBannerRows();
    });
  });
  try {
    const { item } = await api<{ item: SiteSettingsPayload }>("/api/v1/admin/site-settings");
    Object.entries(item).forEach(([key, value]) => {
      const field = form.elements.namedItem(key) as HTMLInputElement | HTMLTextAreaElement | null;
      if (!field) return;
      if (field instanceof HTMLInputElement && field.type === "checkbox") {
        field.checked = Boolean(value);
      } else if (key === "homepageDiscountsExpiresAt" && field instanceof HTMLInputElement) {
        field.value = toDatetimeLocalValue(typeof value === "string" ? value : null);
      } else if (key === "homepageHeroBenefits" && Array.isArray(value)) {
        field.value = value.join("\n");
      } else {
        field.value = Array.isArray(value) ? value.join("، ") : value === null ? "" : String(value);
      }
    });
    if (!input("homepageBestSellersTitle").value) input("homepageBestSellersTitle").value = "پرفروش‌ترین‌ها";
    if (!input("homepageBestSellersColor").value) input("homepageBestSellersColor").value = "#173f30";
    if (!input("homepageBestSellersTextColor").value) input("homepageBestSellersTextColor").value = "#ffffff";
    if (!input("homepageBestSellersBadgeLabel").value) input("homepageBestSellersBadgeLabel").value = "پرفروش";
    if (!input("homepageBestSellersBadgeColor").value) input("homepageBestSellersBadgeColor").value = "#293b32";
    if (!input("homepageBestSellersIconColor").value) input("homepageBestSellersIconColor").value = "#293b32";
    if (!input("homepageDiscountsTitle").value) input("homepageDiscountsTitle").value = "شگفت‌انگیزها";
    if (!input("homepageDiscountsColor").value) input("homepageDiscountsColor").value = "#e53154";
    if (!input("homepageDiscountsTextColor").value) input("homepageDiscountsTextColor").value = "#ffffff";
    if (!input("homepageDiscountsBadgeLabel").value) input("homepageDiscountsBadgeLabel").value = "پیشنهاد ویژه";
    if (!input("homepageDiscountsBadgeColor").value) input("homepageDiscountsBadgeColor").value = "#b72d3a";
    if (!input("homepageDiscountsIconColor").value) input("homepageDiscountsIconColor").value = "#b72d3a";
    if (!input("themeSurfaceColor").value) input("themeSurfaceColor").value = "#faf9f6";
    if (!input("themeFooterColor").value) input("themeFooterColor").value = "#211d19";
    if (!input("themeSupportColor").value) input("themeSupportColor").value = "#173f33";
    if (!input("themeHeaderIconColor").value) input("themeHeaderIconColor").value = "#2d5644";
    initSeoCounters(form);
    showSignature(item.invoiceSignatureUrl);
    showBanner("desktop", item.homepageBannerDesktopUrl);
    showBanner("mobile", item.homepageBannerMobileUrl);
    renderBenefitRows(item.homepageHeroBenefitItems, item.homepageHeroBenefits);
    const incomingRows = Array.isArray(item.homepageBannerRows) ? item.homepageBannerRows : [];
    defaultHomepageBannerRows().forEach((fallback) => {
      const incoming = incomingRows.find((row) => row.id === fallback.id);
      bannerRows.set(fallback.id, {
        ...fallback,
        ...incoming,
        id: fallback.id,
        title: fallback.title,
        columns: maxHomepageBannerItems(Number(incoming?.columns ?? fallback.columns)),
        isActive: Boolean(incoming?.isActive),
        items: Array.isArray(incoming?.items)
          ? incoming.items.slice(0, maxHomepageBannerItems(Number(incoming?.columns ?? fallback.columns)))
          : []
      });
    });
    renderBannerRows();
    const aiKeyState = form.querySelector<HTMLElement>("[data-ai-key-state]");
    if (aiKeyState) aiKeyState.textContent = item.contentAiKeyConfigured ? "کلید فعلی ثبت شده است؛ برای تغییر، کلید جدید وارد کنید." : "هنوز کلیدی ثبت نشده است.";
    if (state) state.textContent = "تنظیمات آماده و قابل ویرایش است.";
  } catch (error) {
    if (state) state.textContent = "دریافت تنظیمات انجام نشد.";
    toast(error instanceof Error ? error.message : "دریافت تنظیمات انجام نشد.", "error");
  }
  signatureInput?.addEventListener("change", async () => {
    const file = signatureInput.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      signatureInput.value = "";
      toast("حجم تصویر امضا نباید بیشتر از ۵ مگابایت باشد.", "error");
      return;
    }
    const body = new FormData();
    body.append("signature", file);
    signatureInput.disabled = true;
    if (state) state.textContent = "در حال بارگذاری امضا…";
    try {
      const result = await api<{ url: string }>("/api/v1/admin/site-settings/invoice-signature", {
        method: "POST",
        body
      });
      showSignature(result.url);
      toast("امضای فروشنده بارگذاری شد.");
      if (state) state.textContent = "امضای جدید روی فاکتورها قرار گرفت.";
    } catch (error) {
      toast(error instanceof Error ? error.message : "بارگذاری امضا انجام نشد.", "error");
      if (state) state.textContent = "بارگذاری امضا انجام نشد.";
    } finally {
      signatureInput.disabled = false;
      signatureInput.value = "";
    }
  });
  (['desktop', 'mobile'] as const).forEach((kind) => {
    const setting = form.querySelector<HTMLElement>(`[data-homepage-banner-setting="${kind}"]`);
    const bannerInput = setting?.querySelector<HTMLInputElement>("[data-homepage-banner-input]");
    const bannerRemove = setting?.querySelector<HTMLButtonElement>("[data-homepage-banner-remove]");
    bannerInput?.addEventListener("change", async () => {
      const file = bannerInput.files?.[0];
      if (!file) return;
      if (file.size > 5 * 1024 * 1024) {
        bannerInput.value = "";
        toast("حجم بنر نباید بیشتر از ۵ مگابایت باشد.", "error");
        return;
      }
      const body = new FormData();
      body.append("banner", file);
      bannerInput.disabled = true;
      if (state) state.textContent = `در حال بارگذاری بنر ${kind === "desktop" ? "دسکتاپ" : "موبایل"}…`;
      try {
        const result = await api<{ url: string }>(`/api/v1/admin/site-settings/homepage-banner/${kind}`, { method: "POST", body });
        showBanner(kind, result.url);
        toast(`بنر ${kind === "desktop" ? "دسکتاپ" : "موبایل"} بارگذاری شد.`);
      } catch (error) {
        toast(error instanceof Error ? error.message : "بارگذاری بنر انجام نشد.", "error");
      } finally {
        bannerInput.disabled = false;
        bannerInput.value = "";
      }
    });
    bannerRemove?.addEventListener("click", async () => {
      if (!await askConfirm("حذف بنر", `بنر ${kind === "desktop" ? "دسکتاپ" : "موبایل"} حذف شود؟`, "حذف بنر")) return;
      bannerRemove.disabled = true;
      try {
        await api(`/api/v1/admin/site-settings/homepage-banner/${kind}`, { method: "DELETE" });
        showBanner(kind, null);
        toast("بنر حذف شد.");
      } catch (error) {
        toast(error instanceof Error ? error.message : "حذف بنر انجام نشد.", "error");
      } finally {
        bannerRemove.disabled = false;
      }
    });
  });
  signatureRemove?.addEventListener("click", async () => {
    if (!await askConfirm("حذف امضا", "تصویر امضای فروشنده از فاکتورها حذف شود؟", "حذف امضا")) return;
    signatureRemove.disabled = true;
    try {
      await api("/api/v1/admin/site-settings/invoice-signature", { method: "DELETE" });
      showSignature(null);
      toast("تصویر امضا حذف شد.");
    } catch (error) {
      toast(error instanceof Error ? error.message : "حذف امضا انجام نشد.", "error");
    } finally {
      signatureRemove.disabled = false;
    }
  });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    submit.disabled = true;
    if (state) state.textContent = "در حال ذخیره…";
    try {
      await api("/api/v1/admin/site-settings", {
        method: "PUT",
        body: JSON.stringify({
          brandName: input("brandName").value,
          brandNameEn: input("brandNameEn").value,
          brandTagline: input("brandTagline").value,
          supportPhone: input("supportPhone").value,
          supportEmail: input("supportEmail").value,
          whatsappUrl: input("whatsappUrl").value,
          baleUrl: input("baleUrl").value,
          instagramUrl: input("instagramUrl").value,
          websiteUrl: input("websiteUrl").value,
          address: input("address").value || null,
          footerHeading: input("footerHeading").value,
          footerDescription: input("footerDescription").value,
          footerCopyright: input("footerCopyright").value,
          logoUrl: input("logoUrl").value || null,
          faviconUrl: input("faviconUrl").value,
          homepageSeoTitle: input("homepageSeoTitle").value,
          homepageSeoDescription: input("homepageSeoDescription").value,
          homepageSeoKeywords: input("homepageSeoKeywords").value
            .split(/[,،]/)
            .map((keyword) => keyword.trim())
            .filter(Boolean),
          homepageOgImageUrl: input("homepageOgImageUrl").value,
          homepageHeroEyebrow: input("homepageHeroEyebrow").value,
          homepageHeroTitle: input("homepageHeroTitle").value,
          homepageHeroTitleAccent: input("homepageHeroTitleAccent").value,
          homepageHeroDescription: input("homepageHeroDescription").value,
          homepageHeroPrimaryLabel: input("homepageHeroPrimaryLabel").value,
          homepageHeroPrimaryHref: input("homepageHeroPrimaryHref").value,
          homepageHeroSecondaryLabel: input("homepageHeroSecondaryLabel").value,
          homepageHeroSecondaryHref: input("homepageHeroSecondaryHref").value,
          homepageHeroBenefits: collectBenefitRows().map((item) => item.text),
          homepageHeroBenefitItems: collectBenefitRows(),
          homepageBannerDesktopUrl: bannerUrls.desktop,
          homepageBannerMobileUrl: bannerUrls.mobile,
          homepageBannerRows: collectBannerRows(),
          homepageBestSellersEnabled: (input("homepageBestSellersEnabled") as HTMLInputElement).checked,
          homepageDiscountsEnabled: (input("homepageDiscountsEnabled") as HTMLInputElement).checked,
          homepageBestSellersTitle: input("homepageBestSellersTitle").value,
          homepageBestSellersColor: input("homepageBestSellersColor").value,
          homepageBestSellersTextColor: input("homepageBestSellersTextColor").value,
          homepageBestSellersBadgeLabel: input("homepageBestSellersBadgeLabel").value,
          homepageBestSellersBadgeColor: input("homepageBestSellersBadgeColor").value,
          homepageBestSellersIconColor: input("homepageBestSellersIconColor").value,
          homepageDiscountsTitle: input("homepageDiscountsTitle").value,
          homepageDiscountsColor: input("homepageDiscountsColor").value,
          homepageDiscountsCountdownEnabled: (input("homepageDiscountsCountdownEnabled") as HTMLInputElement).checked,
          homepageDiscountsExpiresAt: fromDatetimeLocalValue(input("homepageDiscountsExpiresAt").value),
          homepageDiscountsTextColor: input("homepageDiscountsTextColor").value,
          homepageDiscountsBadgeLabel: input("homepageDiscountsBadgeLabel").value,
          homepageDiscountsBadgeColor: input("homepageDiscountsBadgeColor").value,
          homepageDiscountsIconColor: input("homepageDiscountsIconColor").value,
          themeSurfaceColor: input("themeSurfaceColor").value,
          themeFooterColor: input("themeFooterColor").value,
          themeSupportColor: input("themeSupportColor").value,
          themeHeaderIconColor: input("themeHeaderIconColor").value,
          searchIndexingEnabled: (input("searchIndexingEnabled") as HTMLInputElement).checked,
          invoiceNationalId: input("invoiceNationalId").value,
          contentAiApiKey: input("contentAiApiKey").value,
          contentAiModel: input("contentAiModel").value,
          contentAiInstructions: input("contentAiInstructions").value,
          contentAiDefaultAudience: input("contentAiDefaultAudience").value,
          contentAiDefaultTone: input("contentAiDefaultTone").value,
          contentAiDefaultLength: input("contentAiDefaultLength").value,
          contentAiDefaultLanguage: input("contentAiDefaultLanguage").value
        })
      });
      if (state) state.textContent = "آخرین تغییرات ذخیره شد.";
      toast("تنظیمات سایت ذخیره شد.");
    } catch (error) {
      if (state) state.textContent = "ذخیره تنظیمات انجام نشد.";
      toast(error instanceof Error ? error.message : "ذخیره تنظیمات انجام نشد.", "error");
    } finally {
      submit.disabled = false;
    }
  });
};

const initInvoice = async () => {
  const root = document.querySelector<HTMLElement>("[data-admin-invoice]");
  if (!root) return;
  const id = new URLSearchParams(location.search).get("id");
  if (!id) { toast("شناسه سفارش وجود ندارد.", "error"); return; }
  try {
    const [{ item }, { item: settings }] = await Promise.all([
      api<{ item: Record<string, unknown> & { items?: Record<string, unknown>[] } }>(
        `/api/v1/admin/orders/${id}`
      ),
      api<{ item: Record<string, unknown> }>("/api/v1/admin/invoice-settings")
    ]);
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
    set("[data-invoice-tax]", `${money.format(Number(item.taxAmount || 0))} تومان`);
    set("[data-invoice-final]", `${money.format(Number(item.finalAmount || 0))} تومان`);
    set("[data-invoice-seller-name]", String(settings.brandName || "اورنزا"));
    set("[data-invoice-signature-name]", String(settings.brandName || "اورنزا"));
    set("[data-invoice-brand-en]", String(settings.brandNameEn || "ORENZA"));
    set("[data-invoice-national-id]", String(settings.invoiceNationalId || "۰۰۲۱۴۱۱۴۱۷"));
    set("[data-invoice-seller-phone]", String(settings.supportPhone || "—"));
    set("[data-invoice-footer-phone]", String(settings.supportPhone || "—"));
    set("[data-invoice-seller-email]", String(settings.supportEmail || "—"));
    set("[data-invoice-footer-email]", String(settings.supportEmail || "—"));
    set("[data-invoice-seller-address]", String(settings.address || "—"));
    const phoneLink = root.querySelector<HTMLAnchorElement>("[data-invoice-footer-phone-link]");
    const emailLink = root.querySelector<HTMLAnchorElement>("[data-invoice-footer-email-link]");
    const instagramLink = root.querySelector<HTMLAnchorElement>("[data-invoice-footer-instagram]");
    const websiteLink = root.querySelector<HTMLAnchorElement>("[data-invoice-footer-website]");
    if (phoneLink) phoneLink.href = `tel:${String(settings.supportPhone || "").replace(/\s/g, "")}`;
    if (emailLink) emailLink.href = `mailto:${String(settings.supportEmail || "")}`;
    if (instagramLink) instagramLink.href = String(settings.instagramUrl || "https://instagram.com/orenza.ir");
    if (websiteLink) {
      const websiteUrl = String(settings.websiteUrl || "https://orenza.ir");
      websiteLink.href = websiteUrl;
      const label = websiteLink.querySelector("span");
      if (label) label.textContent = websiteUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
    }
    const signature = root.querySelector<HTMLImageElement>("[data-invoice-signature]");
    const signatureEmpty = root.querySelector<HTMLElement>("[data-invoice-signature-empty]");
    if (signature && settings.invoiceSignatureUrl) {
      signature.src = String(settings.invoiceSignatureUrl);
      signature.hidden = false;
      if (signatureEmpty) signatureEmpty.hidden = true;
    }
    const rows = root.querySelector<HTMLTableSectionElement>("[data-invoice-items]");
    if (rows) rows.innerHTML = (item.items || []).map((orderItem, index) => `
      <tr>
        <td>${faNumber.format(index + 1)}</td>
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
void initAdminProfile();
void initSiteSettings();
void initInvoice();
