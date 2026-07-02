export {};

type User = { phone: string | null; email: string | null; displayName: string | null; hasPassword: boolean };
type Address = {
  id: string; label: string; recipient_name: string; phone: string; province: string;
  city: string; postal_code: string; address_line: string; is_default: boolean;
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
  if (!profileForm.reportValidity()) return;
  const data = new FormData(profileForm);
  try {
    const payload = await api("/me", {
      method: "PATCH",
      body: JSON.stringify({ displayName: data.get("displayName"), phone: data.get("phone") || undefined })
    });
    user = payload.user;
    fillProfile();
    setStatus("profile", "تغییرات مشخصات با موفقیت ذخیره شد.");
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
  if (!addressForm.reportValidity()) return;
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
  if (!passwordForm.reportValidity()) return;
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
    fillProfile();
    setStatus("password", payload.message);
  } catch (error) {
    setStatus("password", error instanceof Error ? error.message : "تغییر رمز انجام نشد.", true);
  }
});

document.querySelector("[data-logout]")?.addEventListener("click", async () => {
  await api("/auth/logout", { method: "POST" });
  window.location.href = "/";
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
