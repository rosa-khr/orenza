export {};

const card = document.querySelector<HTMLElement>("[data-auth-card]");
const form = document.querySelector<HTMLFormElement>("[data-auth-form]");
const status = document.querySelector<HTMLElement>("[data-auth-status]");
const nameField = document.querySelector<HTMLElement>("[data-name-field]");
const submit = document.querySelector<HTMLButtonElement>("[data-auth-submit]");
const googleButton = document.querySelector<HTMLButtonElement>("[data-google-login]");
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
  if (submit) submit.textContent = mode === "register" ? "ایجاد حساب و ادامه" : "ورود و ادامه";
  if (status) status.textContent = "";
};

modeButtons.forEach((button) => button.addEventListener("click", () => setMode(button.dataset.authMode as typeof mode)));

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!form.reportValidity()) return;
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
if (googleClientId && googleButton) {
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
    googleButton.disabled = false;
    googleButton.addEventListener("click", () => google?.accounts.id.prompt());
  };
  document.head.append(script);
}

api("/me").then(() => {
  window.location.href = "/account/profile/";
}).catch(() => undefined);
