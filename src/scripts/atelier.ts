import { ADD_TO_CART_EVENT, type CartItemInput, type SelectionKey } from "./order-types";

export const initAtelier = () => {
  const builder = document.querySelector<HTMLElement>("[data-builder]");
  if (!builder) return;

  const state: Partial<Record<SelectionKey, string>> = {};
  const sections = new Map(
    [...builder.querySelectorAll<HTMLElement>("[data-config-section]")].map((section) => [
      section.dataset.configSection!,
      section
    ])
  );

  const processDisplay = builder.querySelector<HTMLElement>("[data-process-display]")!;
  const processEyebrow = builder.querySelector<HTMLElement>("[data-process-eyebrow]")!;
  const processTitle = builder.querySelector<HTMLElement>("[data-process-title]")!;
  const processNote = builder.querySelector<HTMLElement>("[data-process-note]")!;
  const grindReadout = builder.querySelector<HTMLElement>("[data-grind-readout]")!;
  const grindFa = builder.querySelector<HTMLElement>("[data-grind-fa]")!;
  const grindEn = builder.querySelector<HTMLElement>("[data-grind-en]")!;
  const grindScale = builder.querySelector<HTMLElement>("[data-grind-scale]")!;
  const deviceResult = builder.querySelector<HTMLElement>("[data-device-result]")!;
  const grindResult = builder.querySelector<HTMLElement>("[data-grind-result]")!;
  const addCartButton = builder.querySelector<HTMLButtonElement>("[data-add-cart]")!;
  const progressItems = [...document.querySelectorAll<HTMLElement>("[data-progress-step]")];
  let animationTimer = 0;

  const unlock = (name: string) => {
    const section = sections.get(name);
    if (!section || section.classList.contains("is-ready")) return;
    section.classList.remove("is-locked");
    section.classList.add("is-ready");
    section.setAttribute("aria-disabled", "false");
  };

  const lock = (name: string) => {
    const section = sections.get(name);
    if (!section) return;
    section.classList.add("is-locked");
    section.classList.remove("is-ready");
    section.setAttribute("aria-disabled", "true");
  };

  const playProcess = (mode: "roast" | "grind", duration = 1500) => {
    window.clearTimeout(animationTimer);
    processDisplay.dataset.mode = mode;
    processDisplay.classList.remove("is-running");
    requestAnimationFrame(() => processDisplay.classList.add("is-running"));
    animationTimer = window.setTimeout(() => processDisplay.classList.remove("is-running"), duration);
  };

  const updateResults = () => {
    (Object.keys(state) as SelectionKey[]).forEach((key) => {
      const result = builder.querySelector<HTMLElement>(`[data-result="${key}"]`);
      if (result) result.textContent = state[key] || "—";
    });
    deviceResult.hidden = !state.device;
    grindResult.hidden = !state.grindSize;
    const previewWeight = builder.querySelector<HTMLElement>("[data-preview-weight]");
    if (previewWeight) previewWeight.textContent = state.weight || "250 g";
  };

  const updateProgress = () => {
    const grindIsComplete = Boolean(state.grind && (state.grind === "دان کامل" || state.device));
    const completed: Record<string, boolean> = {
      blend: Boolean(state.blend),
      roast: Boolean(state.roast),
      grind: grindIsComplete,
      weight: Boolean(state.weight),
      summary: false
    };
    const active = !state.blend
      ? "blend"
      : !state.roast
        ? "roast"
        : !grindIsComplete
          ? "grind"
          : !state.weight
            ? "weight"
            : "summary";

    progressItems.forEach((item) => {
      const step = item.dataset.progressStep || "";
      item.classList.toggle("is-complete", completed[step]);
      item.classList.toggle("is-active", step === active);
      if (step === active) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    });
  };

  const moveToSection = (name: string, delay = 420) => {
    if (!window.matchMedia("(max-width: 760px)").matches) return;
    const section = sections.get(name);
    if (!section) return;
    window.setTimeout(() => {
      section.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
        block: "start"
      });
    }, delay);
  };

  const clearFollowing = (key: SelectionKey) => {
    const order: SelectionKey[] = ["blend", "roast", "grind", "device", "grindSize", "weight"];
    const index = order.indexOf(key);
    order.slice(index + 1).forEach((nextKey) => {
      delete state[nextKey];
      builder.querySelectorAll<HTMLButtonElement>(`[data-choice="${nextKey}"]`).forEach((item) => {
        item.classList.remove("is-selected");
        item.setAttribute("aria-pressed", "false");
      });
    });
  };

  const selectChoice = (choice: HTMLButtonElement) => {
    const key = choice.dataset.choice as SelectionKey;
    const value = choice.dataset.value!;
    const english = choice.dataset.en || "";

    builder.querySelectorAll<HTMLButtonElement>(`[data-choice="${key}"]`).forEach((item) => {
      item.classList.remove("is-selected");
      item.setAttribute("aria-pressed", "false");
    });
    choice.classList.add("is-selected");
    choice.setAttribute("aria-pressed", "true");
    clearFollowing(key);
    state[key] = value;
    addCartButton.textContent = "افزودن به سبد سفارش";

    if (key === "blend") {
      ["grind", "device", "weight", "summary"].forEach(lock);
      const deviceSection = sections.get("device");
      if (deviceSection) deviceSection.hidden = true;
      builder.querySelector<HTMLElement>("[data-preview-blend]")!.textContent = english;
      unlock("roast");
      processDisplay.dataset.mode = "idle";
      processEyebrow.textContent = "BLEND PROFILE";
      processTitle.textContent = value;
      processNote.textContent = "ویژگی‌های فنجان بر اساس نسبت انتخابی تنظیم شد.";
      moveToSection("roast");
    }

    if (key === "roast") {
      ["device", "weight", "summary"].forEach(lock);
      const deviceSection = sections.get("device");
      if (deviceSection) deviceSection.hidden = true;
      const roastLevel = Number(choice.dataset.roastLevel || 2);
      const colors = ["#9a6540", "#714329", "#4b2b1d", "#281914"];
      processDisplay.style.setProperty("--bean-color", colors[roastLevel - 1]);
      builder.querySelector<HTMLElement>("[data-preview-roast]")!.textContent = english;
      processEyebrow.textContent = "ROASTING NOW";
      processTitle.textContent = `رُست ${value}`;
      processNote.textContent = english;
      playProcess("roast");
      unlock("grind");
      moveToSection("grind", 850);
    }

    if (key === "grind") {
      builder.querySelector<HTMLElement>("[data-preview-device]")!.textContent = english;
      const deviceSection = sections.get("device");

      if (value === "آسیاب‌شده") {
        if (deviceSection) deviceSection.hidden = false;
        unlock("device");
        lock("weight");
        lock("summary");
        processDisplay.dataset.mode = "grind";
        processEyebrow.textContent = "GRIND CALIBRATION";
        processTitle.textContent = "دستگاهت را انتخاب کن";
        processNote.textContent = "اندازه ذرات بر اساس روش دم‌آوری محاسبه می‌شود.";
        grindReadout.hidden = true;
        moveToSection("device");
      } else {
        if (deviceSection) deviceSection.hidden = true;
        delete state.device;
        delete state.grindSize;
        deviceResult.hidden = true;
        grindResult.hidden = true;
        grindReadout.hidden = true;
        processDisplay.dataset.mode = "idle";
        processEyebrow.textContent = "WHOLE BEAN";
        processTitle.textContent = "دان کامل";
        processNote.textContent = "برای حفظ بیشترین عطر تا لحظه دم‌آوری.";
        unlock("weight");
        moveToSection("weight");
      }
    }

    if (key === "device") {
      lock("summary");
      const grindFaValue = choice.dataset.grindFa!;
      const grindEnValue = choice.dataset.grindEn!;
      const grindLevel = Number(choice.dataset.grindLevel || 4);
      state.grindSize = `${grindFaValue} · ${grindEnValue}`;
      grindFa.textContent = grindFaValue;
      grindEn.textContent = grindEnValue;
      grindScale.style.setProperty("--grind-position", `${(grindLevel / 7) * 100}%`);
      processDisplay.style.setProperty("--particle-size", `${Math.max(1.4, grindLevel * 0.55)}px`);
      grindReadout.hidden = false;
      processEyebrow.textContent = "GRINDING NOW";
      processTitle.textContent = value;
      processNote.textContent = `${grindFaValue} · ${grindEnValue}`;
      builder.querySelector<HTMLElement>("[data-preview-device]")!.textContent = english;
      playProcess("grind", 1800);
      unlock("weight");
      moveToSection("weight", 900);
    }

    if (key === "weight") {
      unlock("summary");
      moveToSection("summary");
    }
    updateResults();
    updateProgress();
  };

  builder.addEventListener("click", (event) => {
    const choice = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-choice]");
    if (!choice || choice.closest(".is-locked")) return;
    selectChoice(choice);
  });

  builder.querySelector<HTMLButtonElement>("[data-restart]")?.addEventListener("click", () => {
    (Object.keys(state) as SelectionKey[]).forEach((key) => delete state[key]);
    builder.querySelectorAll(".is-selected").forEach((item) => item.classList.remove("is-selected"));
    builder.querySelectorAll<HTMLButtonElement>("[data-choice]").forEach((item) => item.setAttribute("aria-pressed", "false"));
    ["roast", "grind", "device", "weight", "summary"].forEach(lock);
    const deviceSection = sections.get("device");
    if (deviceSection) deviceSection.hidden = true;
    grindReadout.hidden = true;
    processDisplay.dataset.mode = "idle";
    processEyebrow.textContent = "LIVE ROASTERY";
    processTitle.textContent = "انتخاب تو، همان لحظه";
    processNote.textContent = "فرآیند آماده‌سازی اینجا نمایش داده می‌شود.";
    builder.querySelector<HTMLElement>("[data-preview-blend]")!.textContent = "YOUR PRIVATE BLEND";
    builder.querySelector<HTMLElement>("[data-preview-roast]")!.textContent = "ROASTED TO ORDER";
    builder.querySelector<HTMLElement>("[data-preview-device]")!.textContent = "WHOLE BEAN / GROUND";
    addCartButton.textContent = "افزودن به سبد سفارش";
    updateResults();
    updateProgress();
    sections.get("blend")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  addCartButton.addEventListener("click", () => {
    if (!state.blend || !state.roast || !state.grind || !state.weight) return;
    const item: CartItemInput = {
      blend: state.blend,
      roast: state.roast,
      grind: state.grind,
      device: state.device,
      grindSize: state.grindSize,
      weight: state.weight
    };
    document.dispatchEvent(new CustomEvent(ADD_TO_CART_EVENT, { detail: item }));
    addCartButton.textContent = "به سبد اضافه شد ✓";
    progressItems.find((item) => item.dataset.progressStep === "summary")?.classList.add("is-complete");
  });

  builder.querySelectorAll<HTMLButtonElement>("[data-choice]").forEach((item) => item.setAttribute("aria-pressed", "false"));
  updateResults();
  updateProgress();
};
