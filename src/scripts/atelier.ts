import { ADD_TO_CART_EVENT, type CartItemInput, type SelectionKey } from "./order-types";
import { productSlug } from "./product-url";

type CatalogProduct = {
  id: string;
  titleFa: string;
  titleEn: string;
  blendType: string;
  description: string;
  pricePer100g: number;
  pricePer250g: number;
  pricePer500g: number;
  pricePer1000g: number;
  stockStatus: "inStock" | "outOfStock";
};

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

  const processDisplay = builder.querySelector<HTMLElement>("[data-process-display]");
  const processEyebrow = builder.querySelector<HTMLElement>("[data-process-eyebrow]");
  const processTitle = builder.querySelector<HTMLElement>("[data-process-title]");
  const processNote = builder.querySelector<HTMLElement>("[data-process-note]");
  const grindReadout = builder.querySelector<HTMLElement>("[data-grind-readout]");
  const grindFa = builder.querySelector<HTMLElement>("[data-grind-fa]");
  const grindEn = builder.querySelector<HTMLElement>("[data-grind-en]");
  const grindScale = builder.querySelector<HTMLElement>("[data-grind-scale]");
  const deviceResults = [...builder.querySelectorAll<HTMLElement>("[data-device-result]")];
  const grindResults = [...builder.querySelectorAll<HTMLElement>("[data-grind-result]")];
  const addCartButton = builder.querySelector<HTMLButtonElement>("[data-add-cart]")!;
  const nextButtons = [...builder.querySelectorAll<HTMLButtonElement>("[data-step-next]")];
  const progressItems = [...document.querySelectorAll<HTMLElement>("[data-progress-step]")];
  const quantityOutput = builder.querySelector<HTMLOutputElement>("[data-quantity]");
  const quantityResult = builder.querySelector<HTMLElement>('[data-result="quantity"]');
  const priceResult = builder.querySelector<HTMLElement>('[data-result="price"]');
  const money = new Intl.NumberFormat("fa-IR");
  let selectedProduct: CatalogProduct | null = null;
  const requestedWeightValue = Number(new URLSearchParams(location.search).get("weight"));
  let requestedWeight: 250 | 500 | 1000 | null =
    [250, 500, 1000].includes(requestedWeightValue)
      ? requestedWeightValue as 250 | 500 | 1000
      : null;
  let quantity = 1;
  let animationTimer = 0;
  let navigationTimer = 0;
  let currentSectionName = "blend";
  let keepBlendStepCurrent = false;
  let keepRoastStepCurrent = false;
  let keepDeviceStepCurrent = false;

  const blendRange = builder.querySelector<HTMLInputElement>("[data-blend-range]");
  const blendTitle = builder.querySelector<HTMLElement>("[data-blend-title]");
  const blendEn = builder.querySelector<HTMLElement>("[data-blend-en]");
  const blendNote = builder.querySelector<HTMLElement>("[data-blend-note]");
  const blendTaste = builder.querySelector<HTMLElement>("[data-blend-taste]");
  const blendSteps = [...builder.querySelectorAll<HTMLButtonElement>("[data-blend-slider-step]")];
  const blendMetricBars = [...builder.querySelectorAll<HTMLElement>("[data-blend-metric]")];
  const roastRange = builder.querySelector<HTMLInputElement>("[data-roast-range]");
  const roastTitle = builder.querySelector<HTMLElement>("[data-roast-title]");
  const roastEn = builder.querySelector<HTMLElement>("[data-roast-en]");
  const roastNote = builder.querySelector<HTMLElement>("[data-roast-note]");
  const roastImage = builder.querySelector<HTMLImageElement>("[data-roast-image]");
  const roastMetric = builder.querySelector<HTMLElement>("[data-roast-metric]");
  const roastSteps = [...builder.querySelectorAll<HTMLButtonElement>("[data-roast-slider-step]")];
  const grindRange = builder.querySelector<HTMLInputElement>("[data-grind-range]");
  const grindMethodTitle = builder.querySelector<HTMLElement>("[data-grind-method-title]");
  const grindMethodEn = builder.querySelector<HTMLElement>("[data-grind-method-en]");
  const grindMethodFa = builder.querySelector<HTMLElement>("[data-grind-method-fa]");
  const grindMethodEnSize = builder.querySelector<HTMLElement>("[data-grind-method-en-size]");
  const grindMethodCustomInput = builder.querySelector<HTMLInputElement>("[data-grind-method-custom-input]");
  const grindSizeCustomInput = builder.querySelector<HTMLInputElement>("[data-grind-size-custom-input]");
  const grindSteps = [...builder.querySelectorAll<HTMLButtonElement>("[data-grind-slider-step]")];

  const productPrice = (product: CatalogProduct, grams: number) =>
    Number(product[`pricePer${grams}g` as keyof CatalogProduct] || 0);

  const updateWeightPrices = () => {
    builder.querySelectorAll<HTMLButtonElement>('[data-choice="weight"]').forEach((button) => {
      const label = button.querySelector<HTMLElement>("[data-weight-price]");
      const grams = Number(button.dataset.grams);
      if (label) {
        label.textContent = selectedProduct
          ? `${money.format(productPrice(selectedProduct, grams))} تومان`
          : "پس از انتخاب قهوه";
      }
    });
  };

  const updatePrice = () => {
    const selectedWeight = builder.querySelector<HTMLButtonElement>('[data-choice="weight"].is-selected');
    const grams = Number(selectedWeight?.dataset.grams || 0);
    const unitPrice = selectedProduct && grams ? productPrice(selectedProduct, grams) : 0;
    if (quantityOutput) quantityOutput.textContent = money.format(quantity);
    if (quantityResult) quantityResult.textContent = money.format(quantity);
    if (priceResult) priceResult.textContent = unitPrice ? `${money.format(unitPrice * quantity)} تومان` : "—";
  };

  const blendChoiceForStep = (step: HTMLButtonElement | undefined) => {
    if (!step) return null;
    return builder.querySelector<HTMLButtonElement>(
      `[data-choice="blend"][data-value="${CSS.escape(step.dataset.targetValue || "")}"], ` +
      `[data-choice="blend"][data-en="${CSS.escape(step.dataset.targetEn || "")}"]`
    );
  };

  const sliderIndexForChoice = (choice: HTMLButtonElement | null) => {
    if (!choice) return -1;
    return blendSteps.findIndex((step) =>
      step.dataset.targetValue === choice.dataset.value || step.dataset.targetEn === choice.dataset.en
    );
  };

  const renderBlendSlider = (index: number) => {
    if (!blendSteps.length) return;
    const safeIndex = Math.min(Math.max(index, 0), blendSteps.length - 1);
    const step = blendSteps[safeIndex];
    if (blendRange) {
      blendRange.value = String(safeIndex);
      const max = Math.max(blendSteps.length - 1, 1);
      blendRange.style.setProperty("--blend-range-percent", `${(safeIndex / max) * 100}%`);
    }
    if (blendTitle) blendTitle.textContent = step.dataset.targetValue || "";
    if (blendEn) blendEn.textContent = step.dataset.targetEn || "";
    if (blendNote) blendNote.textContent = step.dataset.note || "";
    if (blendTaste) blendTaste.textContent = step.dataset.taste || "";
    blendMetricBars.forEach((bar) => {
      const key = bar.dataset.blendMetric || "";
      const value = Number(step.dataset[key] || 0);
      bar.style.setProperty("--metric", `${value * 20}%`);
    });
    blendSteps.forEach((item, itemIndex) => item.classList.toggle("is-active", itemIndex === safeIndex));
  };

  const syncBlendSliderAvailability = () => {
    let firstAvailableIndex = -1;
    blendSteps.forEach((step, index) => {
      const choice = blendChoiceForStep(step);
      const unavailable = !choice || choice.hidden || choice.disabled;
      step.disabled = unavailable;
      step.classList.toggle("is-unavailable", unavailable);
      if (!unavailable && firstAvailableIndex === -1) firstAvailableIndex = index;
    });
    const currentIndex = Number(blendRange?.value || 0);
    const currentChoice = blendChoiceForStep(blendSteps[currentIndex]);
    if ((!currentChoice || currentChoice.hidden || currentChoice.disabled) && firstAvailableIndex >= 0) {
      renderBlendSlider(firstAvailableIndex);
    }
  };

  const selectBlendFromSlider = (index: number) => {
    renderBlendSlider(index);
    const choice = blendChoiceForStep(blendSteps[index]);
    if (!choice || choice.hidden || choice.disabled) return;
    keepBlendStepCurrent = true;
    selectChoice(choice);
    keepBlendStepCurrent = false;
  };

  const renderRoastSlider = (index: number) => {
    if (!roastSteps.length) return;
    const safeIndex = Math.min(Math.max(index, 0), roastSteps.length - 1);
    const step = roastSteps[safeIndex];
    if (roastRange) {
      roastRange.value = String(safeIndex);
      const max = Math.max(roastSteps.length - 1, 1);
      roastRange.style.setProperty("--blend-range-percent", `${(safeIndex / max) * 100}%`);
    }
    if (roastTitle) roastTitle.textContent = step.dataset.targetValue || "";
    if (roastEn) roastEn.textContent = step.dataset.targetEn || "";
    if (roastNote) roastNote.textContent = step.dataset.note || "";
    if (roastImage) {
      roastImage.src = step.dataset.image || roastImage.src;
      roastImage.alt = `دانه قهوه با رُست ${step.dataset.targetValue || ""}`;
    }
    roastMetric?.style.setProperty("--metric", `${Number(step.dataset.level || 0) * 25}%`);
    roastSteps.forEach((item, itemIndex) => item.classList.toggle("is-active", itemIndex === safeIndex));
  };

  const selectRoastFromSlider = (index: number) => {
    renderRoastSlider(index);
    const step = roastSteps[index];
    const choice = step ? builder.querySelector<HTMLButtonElement>(
      `[data-choice="roast"][data-value="${CSS.escape(step.dataset.targetValue || "")}"], ` +
      `[data-choice="roast"][data-en="${CSS.escape(step.dataset.targetEn || "")}"]`
    ) : null;
    if (!choice || choice.disabled) return;
    keepRoastStepCurrent = true;
    selectChoice(choice);
    keepRoastStepCurrent = false;
  };

  const renderGrindSlider = (index: number) => {
    if (!grindSteps.length) return;
    const safeIndex = Math.min(Math.max(index, 0), grindSteps.length - 1);
    const step = grindSteps[safeIndex];
    if (grindRange) {
      grindRange.value = String(safeIndex);
      const max = Math.max(grindSteps.length - 1, 1);
      grindRange.style.setProperty("--blend-range-percent", `${(safeIndex / max) * 100}%`);
    }
    if (grindMethodTitle) grindMethodTitle.textContent = step.dataset.targetValue || "";
    if (grindMethodEn) grindMethodEn.textContent = step.dataset.targetEn || "";
    if (grindMethodFa) grindMethodFa.textContent = step.dataset.grindFa || "";
    if (grindMethodEnSize) grindMethodEnSize.textContent = step.dataset.grindEn || "";
    grindSteps.forEach((item, itemIndex) => item.classList.toggle("is-active", itemIndex === safeIndex));
  };

  const selectedGrindSize = (choice: HTMLButtonElement) => {
    const customSize = grindSizeCustomInput?.value.trim();
    return customSize || `${choice.dataset.grindFa || ""} · ${choice.dataset.grindEn || ""}`;
  };

  const sliderDeviceChoice = () => {
    const currentIndex = Number(grindRange?.value || 0);
    const step = grindSteps[Math.min(Math.max(currentIndex, 0), grindSteps.length - 1)];
    if (!step) return null;
    return builder.querySelector<HTMLButtonElement>(
      `[data-choice="device"][data-value="${CSS.escape(step.dataset.targetValue || "")}"], ` +
      `[data-choice="device"][data-en="${CSS.escape(step.dataset.targetEn || "")}"]`
    );
  };

  const renderSelectedGrindSize = (choice: HTMLButtonElement) => {
    const defaultGrindSizeValue = `${choice.dataset.grindFa || ""} · ${choice.dataset.grindEn || ""}`;
    const grindSizeValue = selectedGrindSize(choice);
    if (grindMethodFa) grindMethodFa.textContent = grindSizeValue;
    if (grindMethodEnSize) grindMethodEnSize.textContent =
      grindSizeValue === defaultGrindSizeValue ? choice.dataset.grindEn || "" : "";
    return { defaultGrindSizeValue, grindSizeValue };
  };

  const selectDeviceFromSlider = (index: number) => {
    renderGrindSlider(index);
    const choice = sliderDeviceChoice();
    if (!choice || choice.disabled) return;
    keepDeviceStepCurrent = true;
    selectChoice(choice);
    keepDeviceStepCurrent = false;
    if (grindMethodCustomInput?.value.trim()) syncCustomGrindMethod();
  };

  const syncCustomGrindMethod = () => {
    const customMethod = grindMethodCustomInput?.value.trim() || "";
    const choice = sliderDeviceChoice();
    if (!choice || !state.device) return;
    const { grindSizeValue } = renderSelectedGrindSize(choice);
    if (customMethod) {
      state.device = customMethod;
      state.grindSize = grindSizeValue;
      if (grindMethodTitle) grindMethodTitle.textContent = customMethod;
      if (grindMethodEn) grindMethodEn.textContent = "CUSTOM METHOD";
      if (processTitle) processTitle.textContent = customMethod;
      if (processNote) processNote.textContent = grindSizeValue;
    } else {
      state.device = choice.dataset.value || "";
      state.grindSize = grindSizeValue;
      renderGrindSlider(Number(grindRange?.value || 0));
      if (processTitle) processTitle.textContent = state.device;
      if (processNote) processNote.textContent = grindSizeValue;
    }
    updateResults();
    updateProgress();
    updateStepControls();
  };

  const loadCatalog = async () => {
    try {
      const response = await fetch("/api/v1/products?category=coffee-blends");
      if (!response.ok) {
        selectBlendFromSlider(Number(blendRange?.value || 0));
        return;
      }
      const payload = await response.json() as { items?: CatalogProduct[] };
      const products = payload.items || [];
      if (!products.length) {
        selectBlendFromSlider(Number(blendRange?.value || 0));
        return;
      }
      const container = builder.querySelector<HTMLElement>(".blend-options");
      if (!container) {
        selectBlendFromSlider(Number(blendRange?.value || 0));
        return;
      }
      const requestedProductId = new URLSearchParams(location.search).get("product");
      let requestedChoice: HTMLButtonElement | null = null;
      container.querySelectorAll<HTMLButtonElement>('[data-choice="blend"]').forEach((button) => {
        const product = products.find((item) =>
          item.blendType === button.dataset.value || item.titleEn === button.dataset.en
        );
        if (product) {
          if (product.stockStatus === "outOfStock") {
            button.disabled = true;
            button.classList.add("is-unavailable");
            button.setAttribute("aria-disabled", "true");
            const label = document.createElement("span");
            label.className = "blend-stock-label";
            label.textContent = "ناموجود";
            button.querySelector(".blend-copy")?.append(label);
            return;
          }
          button.dataset.product = JSON.stringify(product);
          if (
            product.id === requestedProductId ||
            product.titleEn === requestedProductId ||
            productSlug(product.titleEn) === requestedProductId
          ) requestedChoice = button;
        } else {
          button.hidden = true;
        }
      });
      syncBlendSliderAvailability();
      if (requestedChoice) {
        const requestedIndex = sliderIndexForChoice(requestedChoice);
        if (requestedIndex >= 0) renderBlendSlider(requestedIndex);
        selectChoice(requestedChoice);
        return;
      }
      selectBlendFromSlider(Number(blendRange?.value || 0));
    } catch {
      // The static catalog remains visible until products are configured in admin.
      selectBlendFromSlider(Number(blendRange?.value || 0));
    }
  };

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
    section.classList.remove("is-ready", "is-current");
    section.setAttribute("aria-disabled", "true");
  };

  const playProcess = (mode: "roast" | "grind", duration = 1500) => {
    if (!processDisplay) return;
    window.clearTimeout(animationTimer);
    processDisplay.dataset.mode = mode;
    processDisplay.classList.remove("is-running");
    requestAnimationFrame(() => processDisplay.classList.add("is-running"));
    animationTimer = window.setTimeout(() => processDisplay.classList.remove("is-running"), duration);
  };

  const updateResults = () => {
    (Object.keys(state) as SelectionKey[]).forEach((key) => {
      builder.querySelectorAll<HTMLElement>(`[data-result="${key}"]`).forEach((result) => {
        result.textContent = state[key] || "—";
      });
    });
    deviceResults.forEach((result) => { result.hidden = !state.device; });
    grindResults.forEach((result) => { result.hidden = !state.grindSize; });
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
    const active = currentSectionName === "device" ? "grind" : currentSectionName;

    progressItems.forEach((item) => {
      const step = item.dataset.progressStep || "";
      item.classList.toggle("is-complete", completed[step]);
      item.classList.toggle("is-active", step === active);
      if (step === active) item.setAttribute("aria-current", "step");
      else item.removeAttribute("aria-current");
    });
  };

  const nextSection = () => {
    if (currentSectionName === "blend" && state.blend) return "roast";
    if (currentSectionName === "roast" && state.roast) return "grind";
    if (currentSectionName === "grind" && state.grind) return state.grind === "آسیاب‌شده" ? "device" : "weight";
    if (currentSectionName === "device" && state.device) return "weight";
    if (currentSectionName === "weight" && state.weight) return "summary";
    return "";
  };

  const updateStepControls = () => {
    const target = nextSection();
    const targetSection = target ? sections.get(target) : null;
    const canMoveNext = Boolean(targetSection?.classList.contains("is-ready") && !targetSection.hidden);
    nextButtons.forEach((button) => {
      const owner = button.closest<HTMLElement>("[data-config-section]")?.dataset.configSection;
      button.disabled = owner !== currentSectionName || !canMoveNext;
      button.setAttribute("aria-disabled", String(button.disabled));
    });
  };

  const moveToSection = (name: string, delay = 120) => {
    const section = sections.get(name);
    if (!section) return;
    window.clearTimeout(navigationTimer);
    navigationTimer = window.setTimeout(() => {
      requestAnimationFrame(() => {
        sections.forEach((item) => {
          const isCurrent = item === section;
          item.classList.toggle("is-current", isCurrent);
          item.setAttribute("aria-hidden", String(!isCurrent));
        });
        currentSectionName = name;
        updateProgress();
        updateStepControls();
        const heading = section.querySelector<HTMLElement>("h3");
        if (heading) {
          heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
        }
      });
    }, delay);
  };

  const previousSection = () => {
    if (currentSectionName === "roast") return "blend";
    if (currentSectionName === "grind") return "roast";
    if (currentSectionName === "device") return "grind";
    if (currentSectionName === "weight") return state.grind === "آسیاب‌شده" && state.device ? "device" : "grind";
    if (currentSectionName === "summary") return "weight";
    return "";
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
      selectedProduct = choice.dataset.product ? JSON.parse(choice.dataset.product) as CatalogProduct : null;
      quantity = 1;
      updateWeightPrices();
      updatePrice();
      ["grind", "device", "weight", "summary"].forEach(lock);
      const deviceSection = sections.get("device");
      if (deviceSection) deviceSection.hidden = true;
      unlock("roast");
      if (processDisplay) processDisplay.dataset.mode = "idle";
      if (processEyebrow) processEyebrow.textContent = "BLEND PROFILE";
      if (processTitle) processTitle.textContent = value;
      if (processNote) processNote.textContent = "ویژگی‌های فنجان بر اساس نسبت انتخابی تنظیم شد.";
      selectRoastFromSlider(Number(roastRange?.value || 0));
      if (processDisplay) processDisplay.dataset.mode = "idle";
      if (processEyebrow) processEyebrow.textContent = "BLEND PROFILE";
      if (processTitle) processTitle.textContent = value;
      if (processNote) processNote.textContent = "ویژگی‌های فنجان بر اساس نسبت انتخابی تنظیم شد.";
      if (!keepBlendStepCurrent) moveToSection("roast");
    }

    if (key === "roast") {
      ["device", "weight", "summary"].forEach(lock);
      const deviceSection = sections.get("device");
      if (deviceSection) deviceSection.hidden = true;
      const roastLevel = Number(choice.dataset.roastLevel || 2);
      const colors = ["#9a6540", "#714329", "#4b2b1d", "#281914"];
      processDisplay?.style.setProperty("--bean-color", colors[roastLevel - 1]);
      if (processEyebrow) processEyebrow.textContent = "ROASTING NOW";
      if (processTitle) processTitle.textContent = `رُست ${value}`;
      if (processNote) processNote.textContent = english;
      playProcess("roast");
      unlock("grind");
      if (!keepRoastStepCurrent) moveToSection("grind", 160);
    }

    if (key === "grind") {
      const deviceSection = sections.get("device");

      if (value === "آسیاب‌شده") {
        if (deviceSection) deviceSection.hidden = false;
        unlock("device");
        lock("weight");
        lock("summary");
        if (processDisplay) processDisplay.dataset.mode = "grind";
        if (processEyebrow) processEyebrow.textContent = "GRIND CALIBRATION";
        if (processTitle) processTitle.textContent = "دستگاهت را انتخاب کن";
        if (processNote) processNote.textContent = "اندازه ذرات بر اساس روش دم‌آوری محاسبه می‌شود.";
        if (grindReadout) grindReadout.hidden = true;
        selectDeviceFromSlider(Number(grindRange?.value || 0));
        moveToSection("device");
      } else {
        if (deviceSection) deviceSection.hidden = true;
        delete state.device;
        delete state.grindSize;
        deviceResults.forEach((result) => { result.hidden = true; });
        grindResults.forEach((result) => { result.hidden = true; });
        if (grindReadout) grindReadout.hidden = true;
        if (processDisplay) processDisplay.dataset.mode = "idle";
        if (processEyebrow) processEyebrow.textContent = "WHOLE BEAN";
        if (processTitle) processTitle.textContent = "دان کامل";
        if (processNote) processNote.textContent = "برای حفظ بیشترین عطر تا لحظه دم‌آوری.";
        unlock("weight");
        moveToSection("weight");
        if (requestedWeight) {
          const requestedChoice = builder.querySelector<HTMLButtonElement>(`[data-choice="weight"][data-grams="${requestedWeight}"]`);
          requestedWeight = null;
          if (requestedChoice) window.setTimeout(() => selectChoice(requestedChoice), 0);
        }
      }
    }

    if (key === "device") {
      lock("summary");
      const grindFaValue = choice.dataset.grindFa!;
      const grindEnValue = choice.dataset.grindEn!;
      const grindLevel = Number(choice.dataset.grindLevel || 4);
      const { grindSizeValue } = renderSelectedGrindSize(choice);
      state.grindSize = grindSizeValue;
      if (grindFa) grindFa.textContent = grindFaValue;
      if (grindEn) grindEn.textContent = grindEnValue;
      grindScale?.style.setProperty("--grind-position", `${(grindLevel / 7) * 100}%`);
      processDisplay?.style.setProperty("--particle-size", `${Math.max(1.4, grindLevel * 0.55)}px`);
      if (grindReadout) grindReadout.hidden = false;
      if (processEyebrow) processEyebrow.textContent = "GRINDING NOW";
      if (processTitle) processTitle.textContent = value;
      if (processNote) processNote.textContent = grindSizeValue;
      playProcess("grind", 1800);
      unlock("weight");
      if (!keepDeviceStepCurrent) moveToSection("weight", 160);
      if (requestedWeight) {
        const requestedChoice = builder.querySelector<HTMLButtonElement>(`[data-choice="weight"][data-grams="${requestedWeight}"]`);
        requestedWeight = null;
        if (requestedChoice) window.setTimeout(() => selectChoice(requestedChoice), 0);
      }
    }

    if (key === "weight") {
      unlock("summary");
      updatePrice();
      moveToSection("summary");
    }
    updateResults();
    updateProgress();
    updateStepControls();
  };

  builder.addEventListener("click", (event) => {
    const choice = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-choice]");
    if (!choice || choice.closest(".is-locked")) return;
    selectChoice(choice);
  });

  blendRange?.addEventListener("input", () => {
    selectBlendFromSlider(Number(blendRange.value || 0));
  });

  blendSteps.forEach((step) => {
    step.addEventListener("click", () => {
      if (step.disabled) return;
      selectBlendFromSlider(Number(step.dataset.index || 0));
    });
  });

  roastRange?.addEventListener("input", () => {
    selectRoastFromSlider(Number(roastRange.value || 0));
  });

  roastSteps.forEach((step) => {
    step.addEventListener("click", () => {
      if (step.disabled) return;
      selectRoastFromSlider(Number(step.dataset.index || 0));
    });
  });

  grindRange?.addEventListener("input", () => {
    selectDeviceFromSlider(Number(grindRange.value || 0));
  });

  grindSteps.forEach((step) => {
    step.addEventListener("click", () => {
      if (step.disabled) return;
      selectDeviceFromSlider(Number(step.dataset.index || 0));
    });
  });

  grindMethodCustomInput?.addEventListener("input", syncCustomGrindMethod);

  grindSizeCustomInput?.addEventListener("input", () => {
    const choice = builder.querySelector<HTMLButtonElement>('[data-choice="device"].is-selected');
    if (!choice || !state.device) return;
    const { grindSizeValue } = renderSelectedGrindSize(choice);
    state.grindSize = grindSizeValue;
    if (grindMethodCustomInput?.value.trim()) syncCustomGrindMethod();
    if (processNote) processNote.textContent = grindSizeValue;
    updateResults();
  });

  progressItems.forEach((item) => {
    item.querySelector<HTMLButtonElement>("[data-step-nav]")?.addEventListener("click", () => {
      const target = item.dataset.progressStep || "";
      const section = sections.get(target);
      if (!section?.classList.contains("is-ready") || section.hidden) return;
      moveToSection(target, 0);
    });
  });

  builder.querySelectorAll<HTMLButtonElement>("[data-step-back]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = previousSection();
      const section = sections.get(target);
      if (!target || !section || section.hidden) return;
      moveToSection(target, 0);
    });
  });

  builder.querySelectorAll<HTMLButtonElement>("[data-step-next]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = nextSection();
      const section = target ? sections.get(target) : null;
      if (!target || !section?.classList.contains("is-ready") || section.hidden) return;
      moveToSection(target, 0);
    });
  });

  builder.querySelector<HTMLButtonElement>("[data-restart]")?.addEventListener("click", () => {
    (Object.keys(state) as SelectionKey[]).forEach((key) => delete state[key]);
    builder.querySelectorAll(".is-selected").forEach((item) => item.classList.remove("is-selected"));
    builder.querySelectorAll<HTMLButtonElement>("[data-choice]").forEach((item) => item.setAttribute("aria-pressed", "false"));
    ["roast", "grind", "device", "weight", "summary"].forEach(lock);
    const deviceSection = sections.get("device");
    if (deviceSection) deviceSection.hidden = true;
    if (grindMethodCustomInput) grindMethodCustomInput.value = "";
    if (grindSizeCustomInput) grindSizeCustomInput.value = "";
    if (grindReadout) grindReadout.hidden = true;
    if (processDisplay) processDisplay.dataset.mode = "idle";
    if (processEyebrow) processEyebrow.textContent = "LIVE ROASTERY";
    if (processTitle) processTitle.textContent = "حالا نوبت انتخاب توئه";
    if (processNote) processNote.textContent = "فرآیند آماده‌سازی اینجا نمایش داده می‌شود.";
    addCartButton.textContent = "افزودن به سبد سفارش";
    selectBlendFromSlider(Number(blendRange?.value || 0));
    updateResults();
    updateProgress();
    updateStepControls();
    moveToSection("blend", 80);
  });

  addCartButton.addEventListener("click", () => {
    const selectedWeight = builder.querySelector<HTMLButtonElement>('[data-choice="weight"].is-selected');
    const weightGrams = Number(selectedWeight?.dataset.grams) as 100 | 250 | 500 | 1000;
    if (!state.blend || !state.roast || !state.grind || !state.weight || !selectedProduct || !weightGrams) {
      addCartButton.textContent = selectedProduct ? "انتخاب‌ها را کامل کن" : "ابتدا محصول را در پنل فعال کن";
      return;
    }
    const unitPrice = productPrice(selectedProduct, weightGrams);
    const item: CartItemInput = {
      productId: selectedProduct.id,
      productTitle: selectedProduct.titleFa,
      blend: state.blend,
      roast: state.roast,
      grind: state.grind,
      device: state.device,
      grindSize: state.grindSize,
      weight: state.weight,
      weightGrams,
      quantity,
      unitPrice,
      totalPrice: unitPrice * quantity
    };
    document.dispatchEvent(new CustomEvent(ADD_TO_CART_EVENT, { detail: item }));
    addCartButton.textContent = "به سبد اضافه شد ✓";
    progressItems.find((item) => item.dataset.progressStep === "summary")?.classList.add("is-complete");
  });

  builder.querySelectorAll<HTMLButtonElement>("[data-choice]").forEach((item) => item.setAttribute("aria-pressed", "false"));
  builder.querySelector("[data-quantity-minus]")?.addEventListener("click", () => {
    quantity = Math.max(1, quantity - 1);
    updatePrice();
  });
  builder.querySelector("[data-quantity-plus]")?.addEventListener("click", () => {
    quantity = Math.min(50, quantity + 1);
    updatePrice();
  });
  updateResults();
  updateProgress();
  updateWeightPrices();
  updatePrice();
  void loadCatalog();
};
