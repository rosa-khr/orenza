export {};
import { enablePersianValidation, validateFormFa } from "./persian-validation";
import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

type User = { phone: string | null; email: string | null; displayName: string | null; hasPassword: boolean; passwordChangeRecommended: boolean };
type Address = {
  id: string; label: string; recipient_name: string; phone: string; province: string;
  city: string; postal_code: string; address_line: string; is_default: boolean;
};
type OrderStatus = "new" | "processing" | "ready" | "sent" | "completed" | "canceled";
type CustomerOrder = {
  id: string;
  orderNumber: string;
  customerAddress: string;
  customerProvince: string | null;
  customerCity: string | null;
  customerPostalCode: string | null;
  shippingMethod: "tipax" | "post" | "cargo" | "courier";
  totalAmount: number | string;
  discountAmount: number | string;
  taxAmount: number | string;
  finalAmount: number | string;
  paymentStatus: "pending" | "paid" | "rejected";
  paymentMethodTitle: string;
  orderStatus: OrderStatus;
  trackingCode: string | null;
  trackingProvider: "post" | "tipax" | "mahex" | "cargo" | "courier" | null;
  createdAt: string;
  updatedAt: string;
  items: {
    id: string;
    productTitle: string;
    weight: number;
    quantity: number;
    grindType: string;
    totalPrice: number | string;
  }[];
  history: { id: string; status: OrderStatus; createdAt: string }[];
};

const api = async (path: string, options: RequestInit = {}) => {
  const response = await fetch(`/api/v1${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options
  });
  const payload = response.status === 204 ? null : await response.json();
  if (response.status === 401) {
    window.location.href = `/login/?next=${encodeURIComponent(location.pathname)}`;
    throw new Error("unauthorized");
  }
  if (!response.ok) throw new Error(payload?.error || "خطای ارتباط با سرور");
  return payload;
};

const profileForm = document.querySelector<HTMLFormElement>("[data-profile-form]");
const addressForm = document.querySelector<HTMLFormElement>("[data-address-form]");
const passwordForm = document.querySelector<HTMLFormElement>("[data-password-form]");
const addressList = document.querySelector<HTMLElement>("[data-address-list]");
const orderList = document.querySelector<HTMLElement>("[data-orders-list]");
const ordersLoading = document.querySelector<HTMLElement>("[data-orders-loading]");
const ordersEmpty = document.querySelector<HTMLElement>("[data-orders-empty]");
const ordersError = document.querySelector<HTMLElement>("[data-orders-error]");
const welcome = document.querySelector<HTMLElement>("[data-account-welcome]");
const accountTitle = document.querySelector<HTMLElement>("[data-account-title]");
const addresses = new Map<string, Address>();
let user: User;

const statusFor = (name: "profile" | "address" | "password") =>
  document.querySelector<HTMLElement>(`[data-${name}-status]`);
const setStatus = (name: "profile" | "address" | "password", message: string, error = false) => {
  const node = statusFor(name);
  if (node) {
    node.textContent = message;
    node.classList.toggle("is-error", error);
  }
};

const fillProfile = () => {
  const passwordNotice = document.querySelector<HTMLElement>("[data-password-notice]");
  if (passwordNotice) passwordNotice.hidden = !user.passwordChangeRecommended;
  if (!profileForm) return;
  (profileForm.elements.namedItem("displayName") as HTMLInputElement).value = user.displayName || "";
  (profileForm.elements.namedItem("phone") as HTMLInputElement).value = user.phone || "";
  (profileForm.elements.namedItem("email") as HTMLInputElement).value = user.email || "";
  const current = document.querySelector<HTMLElement>("[data-current-password]");
  if (current) current.hidden = !user.hasPassword;
  if (accountTitle && user.displayName) accountTitle.textContent = user.displayName;
  if (welcome) welcome.textContent = user.displayName ? "اطلاعات حساب کاربری شما" : "برای تکمیل حساب، مشخصات خود را وارد کنید.";
};

const renderAddresses = () => {
  if (!addressList) return;
  addressList.replaceChildren();
  if (!addresses.size) {
    const empty = document.createElement("p");
    empty.className = "address-empty";
    empty.textContent = "هنوز نشانی تحویلی ثبت نشده است.";
    addressList.append(empty);
    return;
  }
  addresses.forEach((address) => {
    const article = document.createElement("article");
    article.className = "address-card";
    const heading = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = address.label;
    const detail = document.createElement("p");
    detail.textContent = `${address.province}، ${address.city}، ${address.address_line}`;
    const meta = document.createElement("small");
    meta.textContent = `${address.recipient_name} · ${address.phone} · ${address.postal_code}`;
    heading.append(title);
    if (address.is_default) {
      const badge = document.createElement("span");
      badge.textContent = "پیش‌فرض";
      heading.append(badge);
    }
    const actions = document.createElement("div");
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "ویرایش";
    edit.dataset.editAddress = address.id;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.textContent = "حذف";
    remove.dataset.deleteAddress = address.id;
    actions.append(edit, remove);
    article.append(heading, detail, meta, actions);
    addressList.append(article);
  });
};

const orderStatusMeta: Record<OrderStatus, { label: string; detail: string }> = {
  new: { label: "ثبت سفارش", detail: "سفارش با موفقیت ثبت شده است." },
  processing: { label: "در حال آماده‌سازی", detail: "محصولات سفارش در حال آماده‌سازی هستند." },
  ready: { label: "آماده ارسال", detail: "سفارش آماده تحویل به شرکت حمل است." },
  sent: { label: "ارسال‌شده", detail: "سفارش به شرکت حمل تحویل داده شده است." },
  completed: { label: "تکمیل‌شده", detail: "فرآیند سفارش تکمیل شده است." },
  canceled: { label: "لغوشده", detail: "این سفارش لغو شده است." }
};
const orderStages: OrderStatus[] = ["new", "processing", "ready", "sent", "completed"];
const paymentStatusLabels = { pending: "در انتظار پرداخت", paid: "پرداخت‌شده", rejected: "پرداخت ردشده" } as const;
const money = new Intl.NumberFormat("fa-IR");
const persianDate = new Intl.DateTimeFormat("fa-IR", {
  year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit"
});

const createElement = <Tag extends keyof HTMLElementTagNameMap>(
  tag: Tag,
  className?: string,
  textContent?: string
) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (textContent !== undefined) element.textContent = textContent;
  return element;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : persianDate.format(date);
};

const renderOrders = (orders: CustomerOrder[]) => {
  if (!orderList) return;
  orderList.replaceChildren();
  ordersLoading?.setAttribute("hidden", "");
  if (!orders.length) {
    ordersEmpty?.removeAttribute("hidden");
    orderList.hidden = true;
    return;
  }
  ordersEmpty?.setAttribute("hidden", "");
  orderList.hidden = false;

  const requestedOrder = new URLSearchParams(location.search).get("order");
  orders.forEach((order, orderIndex) => {
    const card = createElement("details", "account-order-card");
    card.open = requestedOrder ? order.orderNumber === requestedOrder : orderIndex === 0;
    const summary = createElement("summary", "account-order-summary");
    const heading = createElement("div", "account-order-heading");
    heading.append(
      createElement("strong", "", `سفارش ${order.orderNumber}`),
      createElement("small", "", formatDate(order.createdAt))
    );
    const badges = createElement("div", "account-order-badges");
    const statusBadge = createElement("span", `is-${order.orderStatus}`, orderStatusMeta[order.orderStatus].label);
    const paymentBadge = createElement("span", `is-payment-${order.paymentStatus}`, paymentStatusLabels[order.paymentStatus]);
    badges.append(statusBadge, paymentBadge);
    const amount = createElement("b", "account-order-amount", `${money.format(Number(order.finalAmount || 0))} تومان`);
    summary.append(heading, badges, amount);

    const body = createElement("div", "account-order-body");
    const current = createElement("section", "account-order-current");
    current.append(
      createElement("small", "", "وضعیت فعلی"),
      createElement("strong", "", orderStatusMeta[order.orderStatus].label),
      createElement("p", "", orderStatusMeta[order.orderStatus].detail)
    );
    if (order.orderStatus === "sent") {
      const confirmDelivery = createElement("button", "account-order-confirm-delivery", "سفارش را تحویل گرفتم");
      confirmDelivery.type = "button";
      confirmDelivery.addEventListener("click", async () => {
        const decision = await Swal.fire({
          title: "تأیید تحویل سفارش",
          text: "آیا سفارش را تحویل گرفته‌اید؟ با تأیید شما، وضعیت سفارش تکمیل‌شده می‌شود.",
          icon: "question",
          showCancelButton: true,
          confirmButtonText: "بله، تحویل گرفتم",
          cancelButtonText: "انصراف",
          reverseButtons: true,
          buttonsStyling: false,
          customClass: { popup: "account-confirm-popup", confirmButton: "account-confirm-accept", cancelButton: "account-confirm-cancel", actions: "account-confirm-actions" },
          didOpen: (popup) => popup.setAttribute("dir", "rtl")
        });
        if (!decision.isConfirmed) return;
        confirmDelivery.disabled = true;
        confirmDelivery.textContent = "در حال ثبت تحویل...";
        try {
          await api(`/me/orders/${encodeURIComponent(order.id)}/confirm-delivery`, { method: "POST", body: "{}" });
          await loadOrders();
        } catch (error) {
          confirmDelivery.disabled = false;
          confirmDelivery.textContent = "سفارش را تحویل گرفتم";
          await Swal.fire({
            title: "ثبت تحویل انجام نشد",
            text: error instanceof Error ? error.message : "لطفاً دوباره تلاش کنید.",
            icon: "error",
            confirmButtonText: "متوجه شدم",
            buttonsStyling: false,
            customClass: { popup: "account-confirm-popup", confirmButton: "account-confirm-accept", actions: "account-confirm-actions" },
            didOpen: (popup) => popup.setAttribute("dir", "rtl")
          });
        }
      });
      current.append(confirmDelivery);
    }

    const progress = createElement("ol", `account-order-progress${order.orderStatus === "canceled" ? " is-canceled" : ""}`);
    const reached = new Set(order.history.map((entry) => entry.status));
    const currentStageIndex = orderStages.indexOf(order.orderStatus);
    orderStages.forEach((stage, stageIndex) => {
      const step = createElement("li");
      if (stage === order.orderStatus) step.classList.add("is-current");
      if (reached.has(stage) && stage !== order.orderStatus) step.classList.add("is-done");
      if (currentStageIndex > stageIndex) step.classList.add("is-done");
      step.append(
        createElement("i", "", money.format(stageIndex + 1)),
        createElement("span", "", orderStatusMeta[stage].label)
      );
      progress.append(step);
    });

    const tracking = createElement("section", "account-order-tracking");
    tracking.append(createElement("small", "", "کد رهگیری مرسوله"));
    if (order.trackingCode) {
      const trackingRow = createElement("div");
      const code = createElement("strong", "", order.trackingCode);
      code.dir = "ltr";
      const copy = createElement("button", "", "کپی کد");
      copy.type = "button";
      copy.addEventListener("click", async () => {
        try {
          await navigator.clipboard.writeText(order.trackingCode || "");
          copy.textContent = "کپی شد";
        } catch {
          copy.textContent = "کپی نشد";
        }
        window.setTimeout(() => { copy.textContent = "کپی کد"; }, 1400);
      });
      const trackingProvider = order.trackingProvider || (order.shippingMethod === "tipax" ? "tipax" : order.shippingMethod);
      const encodedCode = encodeURIComponent(order.trackingCode.trim());
      if (trackingProvider === "cargo" || trackingProvider === "courier") {
        trackingRow.append(code, copy, createElement("span", "account-order-tracking-link", trackingProvider === "courier" ? "ارسال با پیک" : "ارسال با باربری"));
      } else {
        const trackingLink = createElement("a", "account-order-tracking-link", "پیگیری مرسوله");
        trackingLink.href = trackingProvider === "mahex"
          ? "https://mahex.com/tracking"
          : trackingProvider === "tipax"
            ? `https://tipaxco.com/tracking?id=${encodedCode}`
            : `https://tracking.post.ir/?id=${encodedCode}`;
        trackingLink.target = "_blank";
        trackingLink.rel = "noopener noreferrer";
        trackingRow.append(code, copy, trackingLink);
      }
      tracking.append(trackingRow);
    } else {
      tracking.append(createElement(
        "p",
        "",
        order.shippingMethod === "cargo" || order.shippingMethod === "courier"
          ? `پس از تحویل سفارش به ${order.shippingMethod === "courier" ? "پیک" : "باربری"}، اطلاعات ارسال اینجا نمایش داده می‌شود.`
          : "پس از تحویل سفارش به شرکت حمل، کد رهگیری اینجا نمایش داده می‌شود."
      ));
    }

    const itemSection = createElement("section", "account-order-items");
    itemSection.append(createElement("h3", "", "اقلام سفارش"));
    order.items.forEach((item) => {
      const row = createElement("div");
      const copy = createElement("span");
      copy.append(
        createElement("strong", "", item.productTitle),
        createElement("small", "", `${money.format(item.weight)} گرم · ${money.format(item.quantity)} عدد${item.grindType ? ` · ${item.grindType}` : ""}`)
      );
      row.append(copy, createElement("b", "", `${money.format(Number(item.totalPrice || 0))} تومان`));
      itemSection.append(row);
    });

    const delivery = createElement("section", "account-order-delivery");
    delivery.append(
      createElement("h3", "", "تحویل و پرداخت"),
      createElement("p", "", `${order.shippingMethod === "courier" ? "پیک" : order.shippingMethod === "cargo" ? "باربری" : order.shippingMethod === "tipax" ? "ارسال پس‌کرایه" : "پست"} · ${order.paymentMethodTitle}`),
      createElement("address", "", [order.customerProvince, order.customerCity, order.customerAddress].filter(Boolean).join("، "))
    );
    const invoiceLink = createElement("a", "account-order-invoice", "دانلود فاکتور PDF");
    invoiceLink.href = `/api/v1/me/orders/${encodeURIComponent(order.id)}/invoice.pdf`;
    invoiceLink.setAttribute("download", `invoice-${order.orderNumber}.pdf`);
    delivery.append(invoiceLink);

    const history = createElement("section", "account-order-history");
    history.append(createElement("h3", "", "تاریخچه وضعیت"));
    const historyList = createElement("ol");
    order.history.forEach((entry) => {
      const row = createElement("li");
      row.append(
        createElement("i"),
        createElement("strong", "", orderStatusMeta[entry.status].label),
        createElement("time", "", formatDate(entry.createdAt))
      );
      historyList.append(row);
    });
    history.append(historyList);

    body.append(current, progress, tracking, itemSection, delivery, history);
    card.append(summary, body);
    orderList.append(card);
  });
};

const loadOrders = async () => {
  if (!orderList) return;
  try {
    const payload = await api("/me/orders");
    renderOrders(payload.orders as CustomerOrder[]);
  } catch (error) {
    ordersLoading?.setAttribute("hidden", "");
    if (ordersError) {
      ordersError.textContent = error instanceof Error ? error.message : "دریافت سفارش‌ها انجام نشد.";
      ordersError.hidden = false;
    }
  }
};

const openAddressForm = (address?: Address) => {
  if (!addressForm) return;
  addressForm.hidden = false;
  addressForm.reset();
  (addressForm.elements.namedItem("id") as HTMLInputElement).value = address?.id || "";
  if (address) {
    (addressForm.elements.namedItem("label") as HTMLInputElement).value = address.label;
    (addressForm.elements.namedItem("recipientName") as HTMLInputElement).value = address.recipient_name;
    (addressForm.elements.namedItem("phone") as HTMLInputElement).value = address.phone;
    (addressForm.elements.namedItem("postalCode") as HTMLInputElement).value = address.postal_code;
    (addressForm.elements.namedItem("province") as HTMLInputElement).value = address.province;
    (addressForm.elements.namedItem("city") as HTMLInputElement).value = address.city;
    (addressForm.elements.namedItem("addressLine") as HTMLTextAreaElement).value = address.address_line;
    (addressForm.elements.namedItem("isDefault") as HTMLInputElement).checked = address.is_default;
  } else if (user) {
    (addressForm.elements.namedItem("recipientName") as HTMLInputElement).value = user.displayName || "";
    (addressForm.elements.namedItem("phone") as HTMLInputElement).value = user.phone || "";
  }
  addressForm.scrollIntoView({ behavior: "smooth", block: "center" });
};

profileForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!validateFormFa(profileForm)) return;
  const data = new FormData(profileForm);
  try {
    const payload = await api("/me", {
      method: "PATCH",
      body: JSON.stringify({ displayName: data.get("displayName"), phone: data.get("phone") || undefined })
    });
    user = payload.user;
    fillProfile();
    setStatus("profile", "تغییرات مشخصات با موفقیت ذخیره شد.");
    const next = new URLSearchParams(location.search).get("next");
    if (next?.startsWith("/")) window.location.href = next;
  } catch (error) {
    setStatus("profile", error instanceof Error ? error.message : "ذخیره انجام نشد.", true);
  }
});

document.querySelector("[data-new-address]")?.addEventListener("click", () => openAddressForm());
document.querySelector("[data-cancel-address]")?.addEventListener("click", () => {
  if (addressForm) addressForm.hidden = true;
});

addressForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!validateFormFa(addressForm)) return;
  const data = new FormData(addressForm);
  const id = String(data.get("id") || "");
  const body = {
    label: data.get("label"), recipientName: data.get("recipientName"), phone: data.get("phone"),
    postalCode: data.get("postalCode"), province: data.get("province"), city: data.get("city"),
    addressLine: data.get("addressLine"), isDefault: data.get("isDefault") === "on"
  };
  try {
    await api(`/me/addresses${id ? `/${id}` : ""}`, { method: id ? "PUT" : "POST", body: JSON.stringify(body) });
    await loadAddresses();
    addressForm.hidden = true;
    setStatus("address", "نشانی با موفقیت ذخیره شد.");
    const next = new URLSearchParams(location.search).get("next");
    if (next?.startsWith("/")) window.location.href = next;
  } catch (error) {
    setStatus("address", error instanceof Error ? error.message : "ذخیره نشانی انجام نشد.", true);
  }
});

addressList?.addEventListener("click", async (event) => {
  const target = event.target as HTMLElement;
  const edit = target.closest<HTMLButtonElement>("[data-edit-address]");
  if (edit) return openAddressForm(addresses.get(edit.dataset.editAddress || ""));
  const remove = target.closest<HTMLButtonElement>("[data-delete-address]");
  if (!remove || !confirm("آیا از حذف این نشانی مطمئن هستید؟")) return;
  try {
    await api(`/me/addresses/${remove.dataset.deleteAddress}`, { method: "DELETE" });
    await loadAddresses();
  } catch (error) {
    setStatus("address", error instanceof Error ? error.message : "حذف انجام نشد.", true);
  }
});

passwordForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!validateFormFa(passwordForm)) return;
  const data = new FormData(passwordForm);
  if (data.get("newPassword") !== data.get("confirmPassword")) {
    return setStatus("password", "تکرار رمز با رمز جدید یکسان نیست.", true);
  }
  try {
    const payload = await api("/me/change-password", {
      method: "POST",
      body: JSON.stringify({ currentPassword: data.get("currentPassword") || undefined, newPassword: data.get("newPassword") })
    });
    passwordForm.reset();
    user.hasPassword = true;
    user.passwordChangeRecommended = false;
    fillProfile();
    setStatus("password", payload.message);
  } catch (error) {
    setStatus("password", error instanceof Error ? error.message : "تغییر رمز انجام نشد.", true);
  }
});

document.querySelector<HTMLButtonElement>("[data-logout]")?.addEventListener("click", async (event) => {
  const button = event.currentTarget as HTMLButtonElement;
  button.disabled = true;
  button.textContent = "در حال خروج...";
  try {
    await fetch("/api/v1/auth/logout", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    });
  } finally {
    window.location.replace("/login/");
  }
});

const loadAddresses = async () => {
  const payload = await api("/me/addresses");
  addresses.clear();
  payload.addresses.forEach((address: Address) => addresses.set(address.id, address));
  renderAddresses();
};

Promise.all([api("/me"), loadAddresses()])
  .then(([profile]) => {
    user = profile.user;
    fillProfile();
  })
  .catch(() => undefined);

void loadOrders();

enablePersianValidation();
