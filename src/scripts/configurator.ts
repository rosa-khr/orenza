type SelectionKey = "blend" | "roast" | "grind" | "device" | "weight";

const builder = document.querySelector<HTMLElement>("[data-builder]");

if (builder) {
  const state: Partial<Record<SelectionKey, string>> = {};
  let currentStep = 1;
  let maxStep = 1;

  const steps = [...builder.querySelectorAll<HTMLElement>("[data-step]")];
  const jumpButtons = [...builder.querySelectorAll<HTMLButtonElement>("[data-step-jump]")];
  const nextButton = builder.querySelector<HTMLButtonElement>("[data-next]")!;
  const backButton = builder.querySelector<HTMLButtonElement>("[data-back]")!;
  const progressLine = builder.querySelector<HTMLElement>("[data-progress-line]")!;
  const devicePicker = builder.querySelector<HTMLElement>("[data-device-picker]")!;
  const deviceResult = builder.querySelector<HTMLElement>("[data-device-result]")!;

  const stepIsComplete = (step: number) => {
    if (step === 1) return Boolean(state.blend);
    if (step === 2) return Boolean(state.roast);
    if (step === 3) return state.grind === "دان کامل" || Boolean(state.grind && state.device);
    if (step === 4) return Boolean(state.weight);
    return true;
  };

  const render = () => {
    steps.forEach((step) => step.classList.toggle("is-active", Number(step.dataset.step) === currentStep));
    jumpButtons.forEach((button) => {
      const step = Number(button.dataset.stepJump);
      button.classList.toggle("is-active", step === currentStep);
      button.classList.toggle("is-complete", step < currentStep || (step < maxStep && stepIsComplete(step)));
      button.disabled = step > maxStep;
    });

    progressLine.style.width = `${((currentStep - 1) / 4) * 100}%`;
    backButton.hidden = currentStep === 1 || currentStep === 5;
    nextButton.hidden = currentStep === 5;
    nextButton.disabled = !stepIsComplete(currentStep);
    nextButton.innerHTML = currentStep === 4 ? "دیدن نتیجه <span>←</span>" : "ادامه <span>←</span>";
  };

  const updatePreview = () => {
    const blend = document.querySelector<HTMLElement>("[data-preview-blend]");
    const roast = document.querySelector<HTMLElement>("[data-preview-roast]");
    const weight = document.querySelector<HTMLElement>("[data-preview-weight]");
    if (blend) blend.textContent = state.blend || "ترکیبت را انتخاب کن";
    if (roast) roast.textContent = state.roast ? `رست ${state.roast}` : "FRESH ROAST";
    if (weight) weight.textContent = state.weight || "250 g";

    (Object.keys(state) as SelectionKey[]).forEach((key) => {
      const result = document.querySelector<HTMLElement>(`[data-result="${key}"]`);
      if (result) result.textContent = state[key] || "—";
    });
    deviceResult.hidden = !state.device;
  };

  builder.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    const choice = target.closest<HTMLButtonElement>("[data-choice]");
    if (choice) {
      const key = choice.dataset.choice as SelectionKey;
      const value = choice.dataset.value!;

      builder.querySelectorAll(`[data-choice="${key}"]`).forEach((item) => item.classList.remove("is-selected"));
      choice.classList.add("is-selected");
      state[key] = value;

      if (key === "grind") {
        const isGround = value === "آسیاب‌شده";
        devicePicker.hidden = !isGround;
        if (!isGround) {
          delete state.device;
          builder.querySelectorAll('[data-choice="device"]').forEach((item) => item.classList.remove("is-selected"));
        }
      }

      updatePreview();
      render();
    }

    const jump = target.closest<HTMLButtonElement>("[data-step-jump]");
    if (jump && !jump.disabled) {
      currentStep = Number(jump.dataset.stepJump);
      render();
    }
  });

  nextButton.addEventListener("click", () => {
    if (!stepIsComplete(currentStep) || currentStep >= 5) return;
    currentStep += 1;
    maxStep = Math.max(maxStep, currentStep);
    render();
    builder.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  backButton.addEventListener("click", () => {
    if (currentStep <= 1) return;
    currentStep -= 1;
    render();
  });

  builder.querySelector<HTMLButtonElement>("[data-restart]")?.addEventListener("click", () => {
    (Object.keys(state) as SelectionKey[]).forEach((key) => delete state[key]);
    builder.querySelectorAll(".is-selected").forEach((item) => item.classList.remove("is-selected"));
    devicePicker.hidden = true;
    currentStep = 1;
    maxStep = 1;
    updatePreview();
    render();
  });

  render();
}
