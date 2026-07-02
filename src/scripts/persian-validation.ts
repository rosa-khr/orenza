type FormControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

const controlLabel = (control: FormControl) =>
  control.closest("label")?.querySelector<HTMLElement>("span")?.textContent?.trim() || "این بخش";

export const validateControlFa = (control: FormControl) => {
  control.setCustomValidity("");
  if (control.validity.valid) return true;

  const label = controlLabel(control);
  let message = `لطفاً ${label} را بررسی کنید.`;
  if (control.validity.valueMissing) message = `لطفاً ${label} را وارد کنید.`;
  else if (control.validity.typeMismatch) message = `${label} با قالب درست وارد نشده است.`;
  else if (control.validity.tooShort) {
    const minimum = control instanceof HTMLSelectElement ? 1 : control.minLength;
    message = `${label} باید حداقل ${minimum} کاراکتر باشد.`;
  }
  else if (control.validity.tooLong) message = `${label} بیش از اندازه طولانی است.`;
  else if (control.validity.patternMismatch) {
    if (control.name === "phone" || control.hasAttribute("data-customer-phone")) {
      message = "شماره موبایل را به‌صورت ۱۱ رقمی و با ۰۹ وارد کنید.";
    } else if (control.name === "postalCode" || control.hasAttribute("data-customer-postal")) {
      message = "کد پستی باید دقیقاً ۱۰ رقم باشد.";
    } else if (control.name === "code") {
      message = "کد بازیابی را به‌صورت ۶ رقم وارد کنید.";
    }
  }
  control.setCustomValidity(message);
  return false;
};

export const validateFormFa = (form: HTMLFormElement) => {
  const controls = [...form.querySelectorAll<FormControl>("input, textarea, select")]
    .filter((control) => !control.disabled && control.type !== "hidden");
  controls.forEach((control) => control.setCustomValidity(""));
  const firstInvalid = controls.find((control) => !validateControlFa(control));
  if (!firstInvalid) return true;
  firstInvalid.reportValidity();
  firstInvalid.focus();
  return false;
};

export const enablePersianValidation = (root: ParentNode = document) => {
  root.querySelectorAll<FormControl>("input, textarea, select").forEach((control) => {
    control.addEventListener("input", () => control.setCustomValidity(""));
  });
};
