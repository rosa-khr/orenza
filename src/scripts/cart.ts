import { ADD_TO_CART_EVENT, type CartItem, type CartItemInput } from "./order-types";

export const initCart = () => {
  const cartLayer = document.querySelector<HTMLElement>("[data-cart-layer]");
  const cartItems = document.querySelector<HTMLOListElement>("[data-cart-items]");
  const cartEmpty = document.querySelector<HTMLElement>("[data-cart-empty]");
  const cartCheckout = document.querySelector<HTMLElement>("[data-cart-checkout]");
  const cartCountElements = document.querySelectorAll<HTMLElement>("[data-cart-count]");
  const whatsappOrder = document.querySelector<HTMLAnchorElement>("[data-whatsapp-order]");
  const baleOrder = document.querySelector<HTMLAnchorElement>("[data-bale-order]");
  const customerName = document.querySelector<HTMLInputElement>("[data-customer-name]");
  const customerPhone = document.querySelector<HTMLInputElement>("[data-customer-phone]");
  const customerProvince = document.querySelector<HTMLInputElement>("[data-customer-province]");
  const customerCity = document.querySelector<HTMLInputElement>("[data-customer-city]");
  const customerAddress = document.querySelector<HTMLTextAreaElement>("[data-customer-address]");
  const customerPostal = document.querySelector<HTMLInputElement>("[data-customer-postal]");
  const shippingInputs = [
    ...document.querySelectorAll<HTMLInputElement>('input[name="shipping-method"]')
  ];
  const paymentInputs = [
    ...document.querySelectorAll<HTMLInputElement>('input[name="payment-method"]')
  ];
  const copyStatus = document.querySelector<HTMLElement>("[data-copy-status]");
  const numberFormatter = new Intl.NumberFormat("fa-IR");
  let lastFocused: HTMLElement | null = null;

  const readCart = (): CartItem[] => {
    try {
      const saved = JSON.parse(localStorage.getItem("orenza-cart") || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  };

  let cart = readCart();
  const saveCart = () => localStorage.setItem("orenza-cart", JSON.stringify(cart));

  const createOrderSummary = () => {
    const name = customerName?.value.trim();
    const phone = customerPhone?.value.trim();
    const province = customerProvince?.value.trim();
    const city = customerCity?.value.trim();
    const address = customerAddress?.value.trim();
    const postal = customerPostal?.value.trim();
    const shipping = shippingInputs.find((input) => input.checked)?.value;
    const payment = paymentInputs.find((input) => input.checked)?.value;
    const lines = cart.map((item, index) => {
      const device = item.device ? `، دستگاه: ${item.device}` : "";
      const grindSize = item.grindSize ? `، درجه آسیاب: ${item.grindSize}` : "";
      return `${numberFormatter.format(index + 1)}. ${item.blend} | رست ${item.roast} | ${item.grind}${device}${grindSize} | ${item.weight}`;
    });

    return [
      "سلام اورنزا، برای استعلام قیمت این سفارش پیام می‌دهم:",
      "",
      ...lines,
      "",
      name ? `نام تحویل‌گیرنده: ${name}` : "",
      phone ? `شماره تماس: ${phone}` : "",
      province ? `استان: ${province}` : "",
      city ? `شهر: ${city}` : "",
      address ? `نشانی: ${address}` : "",
      postal ? `کد پستی: ${postal}` : "",
      shipping ? `شیوه ارسال: ${shipping}` : "",
      payment ? `شیوه پرداخت: ${payment}` : "",
      "",
      "لطفاً مبلغ نهایی، هزینه ارسال و زمان آماده‌سازی را اعلام کنید."
    ].filter((line, index, all) => line || all[index - 1] !== "").join("\n");
  };

  const addressInputs = [customerName, customerPhone, customerProvince, customerCity, customerAddress, customerPostal].filter(
    (input): input is HTMLInputElement | HTMLTextAreaElement => Boolean(input)
  );

  const checkoutIsComplete = () =>
    addressInputs.every((input) => input.value.trim().length > 0 && input.checkValidity()) &&
    shippingInputs.some((input) => input.checked) &&
    paymentInputs.some((input) => input.checked);

  const normalizeDigits = (value: string) =>
    value
      .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
      .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));

  const showCheckoutValidation = () => {
    const firstInvalid = addressInputs.find((input) => !input.value.trim() || !input.checkValidity());
    if (firstInvalid) {
      firstInvalid.reportValidity();
      firstInvalid.focus();
      if (copyStatus) copyStatus.textContent = "لطفاً اطلاعات کامل تحویل سفارش را وارد کن.";
      return;
    }
    const shippingChoice = document.querySelector<HTMLElement>("[data-shipping-choice]");
    shippingChoice?.scrollIntoView({ behavior: "smooth", block: "center" });
    shippingInputs[0]?.focus();
    if (copyStatus) copyStatus.textContent = "لطفاً تیپاکس یا پست را برای ارسال انتخاب کن.";
  };

  const updateOrderLinks = () => {
    const isComplete = checkoutIsComplete();
    const message = encodeURIComponent(createOrderSummary());
    if (whatsappOrder) {
      whatsappOrder.href = `https://api.whatsapp.com/send/?phone=989103060396&text=${message}&type=phone_number&app_absent=0`;
      whatsappOrder.classList.remove("is-disabled");
      whatsappOrder.removeAttribute("aria-disabled");
    }
    if (baleOrder) {
      baleOrder.href = `https://ble.ir/share/url?url=${encodeURIComponent("https://orenza.ir")}&text=${message}`;
      baleOrder.classList.remove("is-disabled");
      baleOrder.removeAttribute("aria-disabled");
    }
    if (copyStatus && isComplete) {
      copyStatus.textContent = "سفارش آماده است؛ واتساپ یا بله را انتخاب کن.";
    }
  };

  const createCartItem = (item: CartItem, index: number) => {
    const row = document.createElement("li");
    row.className = "cart-item";

    const number = document.createElement("span");
    number.className = "cart-item-number";
    number.textContent = numberFormatter.format(index + 1).padStart(2, "۰");

    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = item.blend;
    const details = document.createElement("small");
    details.textContent = [`رست ${item.roast}`, item.grind, item.device, item.grindSize, item.weight].filter(Boolean).join(" · ");
    copy.append(title, details);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "cart-remove";
    remove.dataset.removeCart = String(item.id);
    remove.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4.5 7h15M9 7V4.5h6V7m-8.5 0 .8 12h9.4l.8-12M10 10.5v5m4-5v5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    `;
    remove.setAttribute("aria-label", `حذف ${item.blend} از سبد`);
    remove.title = "حذف از سبد";
    row.append(number, copy, remove);
    return row;
  };

  const render = () => {
    cartCountElements.forEach((element) => {
      element.textContent = numberFormatter.format(cart.length);
    });
    cartItems?.replaceChildren(...cart.map(createCartItem));
    if (cartEmpty) cartEmpty.hidden = cart.length > 0;
    if (cartCheckout) cartCheckout.hidden = cart.length === 0;
    updateOrderLinks();
  };

  const open = () => {
    if (!cartLayer) return;
    lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cartLayer.hidden = false;
    document.body.classList.add("cart-is-open");
    requestAnimationFrame(() => cartLayer.classList.add("is-open"));
    cartLayer.querySelector<HTMLButtonElement>("[data-cart-close]")?.focus();
  };

  const close = () => {
    if (!cartLayer) return;
    cartLayer.classList.remove("is-open");
    document.body.classList.remove("cart-is-open");
    window.setTimeout(() => {
      cartLayer.hidden = true;
      lastFocused?.focus();
    }, 280);
  };

  document.querySelectorAll<HTMLButtonElement>("[data-cart-open]").forEach((button) => button.addEventListener("click", open));
  document.querySelectorAll<HTMLButtonElement>("[data-cart-close]").forEach((button) => {
    button.addEventListener("click", () => {
      close();
      if (button.hasAttribute("data-scroll-builder")) {
        const builder = document.querySelector("#coffee-builder");
        if (builder) {
          builder.scrollIntoView({ behavior: "smooth" });
        } else {
          window.location.href = "/order/";
        }
      }
    });
  });

  cartItems?.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-remove-cart]");
    if (!button) return;
    cart = cart.filter((item) => item.id !== Number(button.dataset.removeCart));
    saveCart();
    render();
  });

  addressInputs.forEach((input) => {
    input.addEventListener("input", () => {
      if (input === customerPhone || input === customerPostal) {
        input.value = normalizeDigits(input.value);
      }
      updateOrderLinks();
    });
  });
  [...shippingInputs, ...paymentInputs].forEach((input) => input.addEventListener("change", updateOrderLinks));

  whatsappOrder?.addEventListener("click", (event) => {
    if (checkoutIsComplete()) {
      updateOrderLinks();
      return;
    }
    event.preventDefault();
    showCheckoutValidation();
  });

  baleOrder?.addEventListener("click", async (event) => {
    if (!checkoutIsComplete()) {
      event.preventDefault();
      showCheckoutValidation();
      return;
    }
    try {
      await navigator.clipboard.writeText(createOrderSummary());
      if (copyStatus) copyStatus.textContent = "پیش‌نویس سفارش در بله باز شد؛ گفت‌وگوی khoobrooz را انتخاب کن.";
    } catch {
      if (copyStatus) copyStatus.textContent = "پیش‌نویس سفارش در بله باز شد.";
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!cartLayer || cartLayer.hidden) return;
    if (event.key === "Escape") {
      close();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = [
      ...cartLayer.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href]:not([aria-disabled="true"]), input:not([disabled]), textarea:not([disabled])'
      )
    ].filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  document.addEventListener(ADD_TO_CART_EVENT, (event) => {
    const item = (event as CustomEvent<CartItemInput>).detail;
    cart.push({ ...item, id: Date.now() });
    saveCart();
    render();
    document.querySelectorAll<HTMLElement>("[data-cart-open]").forEach((trigger) => {
      trigger.classList.remove("has-new-item");
      requestAnimationFrame(() => trigger.classList.add("has-new-item"));
      window.setTimeout(() => trigger.classList.remove("has-new-item"), 900);
    });
    window.setTimeout(open, 520);
  });

  render();
};
