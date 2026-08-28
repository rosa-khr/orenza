const picker = document.querySelector<HTMLElement>("[data-device-picker]");
const input = picker?.querySelector<HTMLInputElement>("[data-device-picker-input]");
const results = picker?.querySelector<HTMLElement>("[data-device-picker-results]");
const empty = picker?.querySelector<HTMLElement>("[data-device-picker-empty]");
const count = picker?.querySelector<HTMLElement>("[data-device-picker-count]");
const selection = picker?.querySelector<HTMLElement>("[data-device-picker-selection]");
const selectedLabel = picker?.querySelector<HTMLElement>("[data-device-picker-selected]");
const selectedGrind = picker?.querySelector<HTMLElement>("[data-device-picker-grind]");
const options = [...(picker?.querySelectorAll<HTMLButtonElement>("[data-device-picker-option]") || [])];

const normalize = (value: string) => value
  .normalize("NFKD")
  .replace(/[\u064B-\u065F\u0670]/g, "")
  .replace(/ي/g, "ی")
  .replace(/ك/g, "ک")
  .trim()
  .toLocaleLowerCase("fa");

if (picker && input && results && empty) {
  const filter = () => {
    const terms = normalize(input.value).split(/\s+/).filter(Boolean);
    let visibleCount = 0;
    options.forEach((option) => {
      const searchable = normalize(option.dataset.deviceSearch || "");
      const visible = terms.every((term) => searchable.includes(term));
      option.hidden = !visible;
      if (visible) visibleCount += 1;
    });
    empty.hidden = visibleCount > 0;
    if (count) count.textContent = `${visibleCount.toLocaleString("fa-IR")} گزینه`;
  };

  options.forEach((option) => option.addEventListener("click", () => {
    const value = option.dataset.deviceValue || "";
    const choice = [...document.querySelectorAll<HTMLButtonElement>('[data-choice="device"]')]
      .find((button) => button.dataset.value === value);
    if (!choice) return;
    choice.click();
    input.value = value;
    if (selectedLabel) selectedLabel.textContent = value;
    if (selectedGrind) selectedGrind.textContent = `${choice.dataset.grindFa || ""} · ${choice.dataset.grindEn || ""}`;
    if (selection) selection.hidden = false;
    options.forEach((item) => item.setAttribute("aria-selected", String(item === option)));
  }));

  input.addEventListener("input", filter);
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      const firstVisible = options.find((option) => !option.hidden);
      if (firstVisible) {
        event.preventDefault();
        firstVisible.click();
      }
    }
  });
  document.querySelector<HTMLButtonElement>("[data-restart]")?.addEventListener("click", () => {
    input.value = "";
    if (selection) selection.hidden = true;
    options.forEach((option) => {
      option.hidden = false;
      option.setAttribute("aria-selected", "false");
    });
    if (count) count.textContent = `${options.length.toLocaleString("fa-IR")} گزینه`;
  });
}
