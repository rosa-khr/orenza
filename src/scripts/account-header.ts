export const initAccountHeader = () => {
  const name = document.querySelector<HTMLElement>("[data-header-account-name]");
  if (!name) return;

  fetch("/api/v1/me", { credentials: "include" })
    .then(async (response) => {
      if (!response.ok) return null;
      return response.json();
    })
    .then((payload) => {
      if (!payload?.user) {
        name.textContent = "ورود";
        return;
      }
      const displayName = String(payload?.user?.displayName || "").trim();
      name.textContent = displayName ? displayName.split(/\s+/)[0] : "حساب من";
    })
    .catch(() => {
      name.textContent = "ورود";
    });
};
