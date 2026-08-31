const picker = document.querySelector<HTMLElement>("[data-device-picker]");
const selection = picker?.querySelector<HTMLElement>("[data-device-picker-selection]");
const selectedLabel = picker?.querySelector<HTMLElement>("[data-device-picker-selected]");
const selectedGrind = picker?.querySelector<HTMLElement>("[data-device-picker-grind]");
const editButton = picker?.querySelector<HTMLButtonElement>("[data-device-picker-edit]");
const custom = picker?.querySelector<HTMLElement>("[data-device-picker-custom]");
const customInput = picker?.querySelector<HTMLInputElement>("[data-device-picker-custom-input]");
const customSubmit = picker?.querySelector<HTMLButtonElement>("[data-device-picker-custom-submit]");
const options = [...(picker?.querySelectorAll<HTMLButtonElement>("[data-device-picker-option]") || [])];
const otherOption = options.find((option) => option.dataset.deviceOther === "true");
let customDeviceValue = "";

if (picker) {
  const hideCustom = () => {
    if (custom) custom.hidden = true;
  };

  const showCustom = (value = "") => {
    if (!custom || !customInput) return;
    custom.hidden = false;
    customInput.value = value;
    customInput.focus();
    customInput.select();
  };

  const selectDevice = (option: HTMLButtonElement, customValue = "") => {
    const isOther = option.dataset.deviceOther === "true";
    const value = customValue || option.dataset.deviceValue || "";
    const choice = [...document.querySelectorAll<HTMLButtonElement>('[data-choice="device"]')]
      .find((button) => button.dataset.value === option.dataset.deviceValue || (isOther && button.dataset.en === "OTHER / CUSTOM"));
    if (!choice) return;
    choice.dataset.value = value;
    choice.click();
    if (selectedLabel) selectedLabel.textContent = value;
    if (selectedGrind) selectedGrind.textContent = `${choice.dataset.grindFa || ""} · ${choice.dataset.grindEn || ""}`;
    if (selection) selection.hidden = false;
    if (editButton) editButton.hidden = !isOther;
    customDeviceValue = isOther ? value : "";
    hideCustom();
    options.forEach((item) => item.setAttribute("aria-selected", String(item === option)));
  };

  const submitCustom = () => {
    const value = customInput?.value.trim();
    if (!value || !otherOption) return;
    selectDevice(otherOption, value);
  };

  options.forEach((option) => option.addEventListener("click", () => {
    if (option.dataset.deviceOther === "true") {
      showCustom(customDeviceValue);
      options.forEach((item) => item.setAttribute("aria-selected", String(item === option)));
      return;
    }
    selectDevice(option);
  }));

  editButton?.addEventListener("click", () => {
    showCustom(customDeviceValue);
  });

  customSubmit?.addEventListener("click", submitCustom);
  customInput?.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    submitCustom();
  });

  document.querySelector<HTMLButtonElement>("[data-restart]")?.addEventListener("click", () => {
    if (customInput) customInput.value = "";
    customDeviceValue = "";
    hideCustom();
    if (selection) selection.hidden = true;
    if (editButton) editButton.hidden = true;
    options.forEach((option) => option.setAttribute("aria-selected", "false"));
  });
}
