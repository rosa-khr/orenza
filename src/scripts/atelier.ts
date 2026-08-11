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
  const mobileGrindFeedback = builder.querySelector<HTMLElement>("[data-mobile-grind-feedback]");
  const mobileGrindFa = builder.querySelector<HTMLElement>("[data-mobile-grind-fa]");
  const mobileGrindEn = builder.querySelector<HTMLElement>("[data-mobile-grind-en]");
  const deviceResults = [...builder.querySelectorAll<HTMLElement>("[data-device-result]")];
  const grindResults = [...builder.querySelectorAll<HTMLElement>("[data-grind-result]")];
  const addCartButton = builder.querySelector<HTMLButtonElement>("[data-add-cart]")!;
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

  const loadCatalog = async () => {
    try {
      const response = await fetch("/api/v1/products?category=coffee-blends");
      if (!response.ok) return;
      const payload = await response.json() as { items?: CatalogProduct[] };
      const products = payload.items || [];
      if (!products.length) return;
      const container = builder.querySelector<HTMLElement>(".blend-options");
      if (!container) return;
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
      if (requestedChoice) selectChoice(requestedChoice);
    } catch {
      // The static catalog remains visible until products are configured in admin.
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
        const heading = section.querySelector<HTMLElement>("h3");
        if (heading) {
          heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
        }
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
      moveToSection("roast");
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
      moveToSection("grind", 160);
    }

    if (key === "grind") {
      const deviceSection = sections.get("device");
      if (mobileGrindFeedback) mobileGrindFeedback.hidden = true;

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
      state.grindSize = `${grindFaValue} · ${grindEnValue}`;
      if (grindFa) grindFa.textContent = grindFaValue;
      if (grindEn) grindEn.textContent = grindEnValue;
      if (mobileGrindFa) mobileGrindFa.textContent = grindFaValue;
      if (mobileGrindEn) mobileGrindEn.textContent = grindEnValue;
      if (mobileGrindFeedback) {
        mobileGrindFeedback.hidden = false;
        mobileGrindFeedback.classList.remove("is-running");
        requestAnimationFrame(() => mobileGrindFeedback.classList.add("is-running"));
      }
      grindScale?.style.setProperty("--grind-position", `${(grindLevel / 7) * 100}%`);
      processDisplay?.style.setProperty("--particle-size", `${Math.max(1.4, grindLevel * 0.55)}px`);
      if (grindReadout) grindReadout.hidden = false;
      if (processEyebrow) processEyebrow.textContent = "GRINDING NOW";
      if (processTitle) processTitle.textContent = value;
      if (processNote) processNote.textContent = `${grindFaValue} · ${grindEnValue}`;
      playProcess("grind", 1800);
      unlock("weight");
      moveToSection("weight", 160);
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
  };

  builder.addEventListener("click", (event) => {
    const choice = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-choice]");
    if (!choice || choice.closest(".is-locked")) return;
    selectChoice(choice);
  });

  progressItems.forEach((item) => {
    item.querySelector<HTMLButtonElement>("[data-step-nav]")?.addEventListener("click", () => {
      const target = item.dataset.progressStep || "";
      const section = sections.get(target);
      if (!section?.classList.contains("is-ready") || section.hidden) return;
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
    if (grindReadout) grindReadout.hidden = true;
    if (mobileGrindFeedback) mobileGrindFeedback.hidden = true;
    if (processDisplay) processDisplay.dataset.mode = "idle";
    if (processEyebrow) processEyebrow.textContent = "LIVE ROASTERY";
    if (processTitle) processTitle.textContent = "حالا نوبت انتخاب توئه";
    if (processNote) processNote.textContent = "فرآیند آماده‌سازی اینجا نمایش داده می‌شود.";
    addCartButton.textContent = "افزودن به سبد سفارش";
    updateResults();
    updateProgress();
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
