export {};
import { enablePersianValidation, validateFormFa } from "./persian-validation";

const card = document.querySelector<HTMLElement>("[data-auth-card]");
const form = document.querySelector<HTMLFormElement>("[data-auth-form]");
const status = document.querySelector<HTMLElement>("[data-auth-status]");
const nameField = document.querySelector<HTMLElement>("[data-name-field]");
const submit = document.querySelector<HTMLButtonElement>("[data-auth-submit]");
const googleContainer = document.querySelector<HTMLElement>("[data-google-login]");
const googleUnconfigured = document.querySelector<HTMLButtonElement>("[data-google-unconfigured]");
const googleArea = document.querySelector<HTMLElement>("[data-auth-google]");
const resetPanel = document.querySelector<HTMLElement>("[data-reset-panel]");
const resetRequest = document.querySelector<HTMLFormElement>("[data-reset-request]");
const resetConfirm = document.querySelector<HTMLFormElement>("[data-reset-confirm]");
const showReset = document.querySelector<HTMLButtonElement>("[data-show-reset]");
const hideReset = document.querySelector<HTMLButtonElement>("[data-hide-reset]");
const modeButtons = document.querySelectorAll<HTMLButtonElement>("[data-auth-mode]");
let mode: "login" | "register" = "login";

const api = async (path: string, options: RequestInit = {}) => {
  const response = await fetch(`/api/v1${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options
  });
  const payload = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(payload?.error || "خطای ارتباط با سرور");
  return payload;
};

const setMode = (next: "login" | "register") => {
  mode = next;
  modeButtons.forEach((button) => {
    const active = button.dataset.authMode === mode;
    button.setAttribute("aria-selected", String(active));
  });
  if (nameField) nameField.hidden = mode !== "register";
  const nameInput = form?.elements.namedItem("displayName") as HTMLInputElement | null;
  if (nameInput) nameInput.required = mode === "register";
  const password = form?.elements.namedItem("password") as HTMLInputElement | null;
  if (password) password.autocomplete = mode === "register" ? "new-password" : "current-password";
  if (showReset) showReset.hidden = mode !== "login";
  if (submit) submit.textContent = mode === "register" ? "ایجاد حساب و ادامه" : "ورود و ادامه";
  if (status) status.textContent = "";
};

modeButtons.forEach((button) => button.addEventListener("click", () => setMode(button.dataset.authMode as typeof mode)));

const toggleReset = (open: boolean) => {
  if (resetPanel) resetPanel.hidden = !open;
  if (form) form.hidden = open;
  document.querySelector<HTMLElement>(".auth-mode")?.toggleAttribute("hidden", open);
  if (googleArea) googleArea.hidden = open;
  if (status) status.textContent = "";
  if (open) {
    if (resetRequest) resetRequest.hidden = false;
    if (resetConfirm) resetConfirm.hidden = true;
    const sourcePhone = form?.elements.namedItem("phone") as HTMLInputElement | null;
    const resetPhone = resetRequest?.elements.namedItem("phone") as HTMLInputElement | null;
    if (resetPhone && sourcePhone?.value) resetPhone.value = sourcePhone.value;
    resetPhone?.focus();
  }
};

showReset?.addEventListener("click", () => toggleReset(true));
hideReset?.addEventListener("click", () => toggleReset(false));

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!validateFormFa(form)) return;
  const data = new FormData(form);
  if (submit) submit.disabled = true;
  if (status) status.textContent = "در حال بررسی اطلاعات...";
  try {
    const body: Record<string, string> = {
      phone: String(data.get("phone") || ""),
      password: String(data.get("password") || "")
    };
    if (mode === "register") body.displayName = String(data.get("displayName") || "");
    await api(`/auth/${mode}`, { method: "POST", body: JSON.stringify(body) });
    window.location.href = new URLSearchParams(location.search).get("next") || "/account/profile/";
  } catch (error) {
    if (status) status.textContent = error instanceof Error ? error.message : "ورود انجام نشد.";
  } finally {
    if (submit) submit.disabled = false;
  }
});

const googleClientId = card?.dataset.googleClientId || "";
if (googleClientId && googleContainer) {
  const script = document.createElement("script");
  script.src = "https://accounts.google.com/gsi/client";
  script.async = true;
  script.onload = () => {
    const google = (window as typeof window & { google?: any }).google;
    google?.accounts.id.initialize({
      client_id: googleClientId,
      callback: async ({ credential }: { credential: string }) => {
        try {
          await api("/auth/google", { method: "POST", body: JSON.stringify({ credential }) });
          window.location.href = "/account/profile/";
        } catch (error) {
          if (status) status.textContent = error instanceof Error ? error.message : "ورود گوگل انجام نشد.";
        }
      }
    });
    google?.accounts.id.renderButton(googleContainer, {
      type: "standard",
      theme: "outline",
      size: "large",
      text: "continue_with",
      shape: "rectangular",
      width: Math.min(360, googleContainer.clientWidth || 360),
      locale: "fa"
    });
  };
  document.head.append(script);
}

googleUnconfigured?.addEventListener("click", () => {
  if (status) status.textContent = "ورود گوگل پس از ثبت شناسه امن سایت فعال می‌شود.";
});

resetRequest?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!validateFormFa(resetRequest)) return;
  const phone = String(new FormData(resetRequest).get("phone") || "");
  const button = resetRequest.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (button) button.disabled = true;
  if (status) status.textContent = "در حال ارسال کد بازیابی...";
  try {
    const payload = await api("/auth/password-reset/request", {
      method: "POST",
      body: JSON.stringify({ phone })
    });
    resetRequest.hidden = true;
    if (resetConfirm) resetConfirm.hidden = false;
    resetConfirm?.querySelector<HTMLInputElement>('input[name="code"]')?.focus();
    resetConfirm?.setAttribute("data-phone", phone);
    if (status) status.textContent = payload.debugCode
      ? `کد محیط آزمایشی: ${payload.debugCode}`
      : "اگر این شماره ثبت شده باشد، کد بازیابی تا چند لحظه دیگر می‌رسد.";
  } catch (error) {
    if (status) status.textContent = error instanceof Error ? error.message : "ارسال کد انجام نشد.";
  } finally {
    if (button) button.disabled = false;
  }
});

resetConfirm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!validateFormFa(resetConfirm)) return;
  const data = new FormData(resetConfirm);
  if (data.get("newPassword") !== data.get("confirmPassword")) {
    if (status) status.textContent = "تکرار رمز عبور با رمز تازه یکسان نیست.";
    resetConfirm.querySelector<HTMLInputElement>('input[name="confirmPassword"]')?.focus();
    return;
  }
  const button = resetConfirm.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (button) button.disabled = true;
  if (status) status.textContent = "در حال ثبت رمز عبور تازه...";
  try {
    const payload = await api("/auth/password-reset/confirm", {
      method: "POST",
      body: JSON.stringify({
        phone: resetConfirm.dataset.phone || "",
        code: String(data.get("code") || ""),
        newPassword: String(data.get("newPassword") || "")
      })
    });
    resetConfirm.reset();
    resetConfirm.hidden = true;
    if (resetRequest) resetRequest.hidden = false;
    toggleReset(false);
    if (status) status.textContent = payload.message;
  } catch (error) {
    if (status) status.textContent = error instanceof Error ? error.message : "تغییر رمز انجام نشد.";
  } finally {
    if (button) button.disabled = false;
  }
});

api("/me").then(() => {
  window.location.href = "/account/profile/";
}).catch(() => undefined);

enablePersianValidation();
