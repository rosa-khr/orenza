import { ADD_TO_CART_EVENT, type CartItem, type CartItemInput } from "./order-types";
import { enablePersianValidation, validateControlFa } from "./persian-validation";

type AccountUser = {
  displayName: string | null;
  phone: string | null;
};

type SavedAddress = {
  id: string;
  label: string;
  recipient_name: string;
  phone: string;
  province: string;
  city: string;
  postal_code: string;
  address_line: string;
  is_default: boolean;
};

type PaymentMethod = {
  id: string;
  cards: PaymentCard[];
};

type PaymentCard = {
  id: string;
  cardNumber: string;
  shebaNumber: string;
  accountNumber: string;
  accountOwner: string;
  bankName: string;
};

type SubmittedOrder = {
  id: string;
  orderNumber: string;
  totalAmount: number;
  discountAmount: number;
  finalAmount: number;
};

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
  const customerFields = document.querySelector<HTMLElement>("[data-customer-fields]");
  const checkoutAccount = document.querySelector<HTMLElement>("[data-checkout-account]");
  const checkoutProfile = document.querySelector<HTMLElement>("[data-checkout-profile]");
  const checkoutLogin = document.querySelector<HTMLElement>("[data-checkout-login]");
  const savedAddresses = document.querySelector<HTMLFieldSetElement>("[data-saved-addresses]");
  const savedAddressList = document.querySelector<HTMLElement>("[data-saved-address-list]");
  const savedAddressState = document.querySelector<HTMLElement>("[data-saved-address-state]");
  const useNewAddress = document.querySelector<HTMLButtonElement>("[data-use-new-address]");
  const shippingInputs = [
    ...document.querySelectorAll<HTMLInputElement>('input[name="shipping-method"]')
  ];
  const paymentInputs = [
    ...document.querySelectorAll<HTMLInputElement>('input[name="payment-method"]')
  ];
  const copyStatus = document.querySelector<HTMLElement>("[data-copy-status]");
  const discountCode = document.querySelector<HTMLInputElement>("[data-discount-code]");
  const applyDiscount = document.querySelector<HTMLButtonElement>("[data-apply-discount]");
  const discountStatus = document.querySelector<HTMLElement>("[data-discount-status]");
  const cartSubtotal = document.querySelector<HTMLElement>("[data-cart-subtotal]");
  const cartDiscount = document.querySelector<HTMLElement>("[data-cart-discount]");
  const cartDiscountRow = document.querySelector<HTMLElement>("[data-cart-discount-row]");
  const cartFinal = document.querySelector<HTMLElement>("[data-cart-final]");
  const paymentCard = document.querySelector<HTMLElement>("[data-payment-card]");
  const paymentCardList = document.querySelector<HTMLElement>("[data-payment-card-list]");
  const numberFormatter = new Intl.NumberFormat("fa-IR");
  let lastFocused: HTMLElement | null = null;
  let accountUser: AccountUser | null = null;
  let accountRequest: Promise<void> | null = null;
  let paymentMethod: PaymentMethod | null = null;
  let selectedPaymentCard: PaymentCard | null = null;
  let discountAmount = 0;
  let submittedOrder: SubmittedOrder | null = null;

  const readCart = (): CartItem[] => {
    try {
      const saved = JSON.parse(localStorage.getItem("orenza-cart") || "[]");
      return Array.isArray(saved) ? saved.filter((item) => item?.productId && item?.weightGrams) : [];
    } catch {
      return [];
    }
  };

  let cart = readCart();
  const saveCart = () => localStorage.setItem("orenza-cart", JSON.stringify(cart));
  const subtotal = () => cart.reduce((sum, item) => sum + Number(item.totalPrice || 0), 0);
  const finalAmount = () => Math.max(0, subtotal() - discountAmount);

  const createOrderSummary = () => {
    const name = accountUser?.displayName?.trim() || customerName?.value.trim();
    const phone = accountUser?.phone?.trim() || customerPhone?.value.trim();
    const province = customerProvince?.value.trim();
    const city = customerCity?.value.trim();
    const address = customerAddress?.value.trim();
    const postal = customerPostal?.value.trim();
    const shipping = shippingInputs.find((input) => input.checked)?.value;
    const payment = paymentInputs.find((input) => input.checked)?.value;
    const lines = cart.map((item, index) => {
      const device = item.device ? `، دستگاه: ${item.device}` : "";
      const grindSize = item.grindSize ? `، درجه آسیاب: ${item.grindSize}` : "";
      return `${numberFormatter.format(index + 1)}. ${item.productTitle} | ${item.blend} | رست ${item.roast} | ${item.grind}${device}${grindSize} | ${item.weight} | ${numberFormatter.format(item.quantity)} عدد | ${numberFormatter.format(item.totalPrice)} تومان`;
    });

    return [
      "سلام، وقت بخیر.",
      "این سفارش قهوه را در سایت اورنزا آماده کرده‌ام:",
      "",
      ...lines,
      "",
      submittedOrder ? `شماره سفارش: ${submittedOrder.orderNumber}` : "",
      `مبلغ اقلام: ${numberFormatter.format(subtotal())} تومان`,
      discountAmount ? `تخفیف: ${numberFormatter.format(discountAmount)} تومان` : "",
      `مبلغ نهایی: ${numberFormatter.format(finalAmount())} تومان`,
      "",
      "مشخصات تحویل",
      name ? `نام: ${name}` : "",
      phone ? `شماره تماس: ${phone}` : "",
      province && city ? `شهر: ${province}، ${city}` : "",
      address ? `نشانی کامل: ${address}` : "",
      postal ? `کد پستی: ${postal}` : "",
      shipping ? `شیوه ارسال: ${shipping}` : "",
      payment ? `شیوه پرداخت: ${payment}` : "",
      selectedPaymentCard ? `شماره کارت: ${selectedPaymentCard.cardNumber}` : "",
      selectedPaymentCard ? `شماره شبا: IR${selectedPaymentCard.shebaNumber}` : "",
      selectedPaymentCard ? `شماره حساب: ${selectedPaymentCard.accountNumber}` : "",
      selectedPaymentCard ? `به نام: ${selectedPaymentCard.accountOwner} · ${selectedPaymentCard.bankName}` : "",
      "",
      "فیش واریزی را در ادامه همین پیام ارسال می‌کنم. سپاس."
    ].filter((line, index, all) => line || all[index - 1] !== "").join("\n");
  };

  const addressInputs = [customerName, customerPhone, customerProvince, customerCity, customerAddress, customerPostal].filter(
    (input): input is HTMLInputElement | HTMLTextAreaElement => Boolean(input)
  );

  const checkoutIsComplete = () =>
    addressInputs.every((input) => input.value.trim().length > 0 && input.checkValidity()) &&
    shippingInputs.some((input) => input.checked) &&
    paymentInputs.some((input) => input.checked) &&
    Boolean(paymentMethod && selectedPaymentCard) &&
    cart.length > 0;

  const updateTotals = () => {
    if (cartSubtotal) cartSubtotal.textContent = `${numberFormatter.format(subtotal())} تومان`;
    if (cartDiscount) cartDiscount.textContent = `− ${numberFormatter.format(discountAmount)} تومان`;
    if (cartDiscountRow) cartDiscountRow.hidden = discountAmount === 0;
    if (cartFinal) cartFinal.textContent = `${numberFormatter.format(finalAmount())} تومان`;
  };

  const loadPaymentMethod = async () => {
    try {
      const response = await fetch("/api/v1/payment-methods/active");
      const payload = await response.json();
      paymentMethod = response.ok ? payload.item as PaymentMethod | null : null;
      selectedPaymentCard = paymentMethod?.cards?.[0] || null;
      if (!paymentMethod || !selectedPaymentCard) {
        if (copyStatus) copyStatus.textContent = "روش پرداخت فعال نیست؛ لطفاً با اورنزا تماس بگیر.";
        return;
      }
      if (paymentCardList) {
        paymentCardList.replaceChildren();
        paymentMethod.cards.forEach((card, index) => {
          const label = document.createElement("label");
          const radio = document.createElement("input");
          const copy = document.createElement("span");
          const number = document.createElement("strong");
          const detail = document.createElement("small");
          radio.type = "radio";
          radio.name = "payment-card";
          radio.value = card.id;
          radio.checked = index === 0;
          number.dir = "ltr";
          number.textContent = card.cardNumber.replace(/(\d{4})(?=\d)/g, "$1 ");
          detail.textContent = `${card.bankName} · ${card.accountOwner}`;
          copy.append(number, detail);
          label.append(radio, copy);
          radio.addEventListener("change", () => {
            selectedPaymentCard = card;
            submittedOrder = null;
            updateOrderLinks();
          });
          paymentCardList.append(label);
        });
      }
      if (paymentCard) paymentCard.hidden = false;
      updateOrderLinks();
    } catch {
      paymentMethod = null;
    }
  };

  const normalizeDigits = (value: string) =>
    value
      .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
      .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));

  const applyAddress = (address: SavedAddress) => {
    submittedOrder = null;
    if (customerName) customerName.value = address.recipient_name || accountUser?.displayName || "";
    if (customerPhone) customerPhone.value = address.phone || accountUser?.phone || "";
    if (customerProvince) customerProvince.value = address.province;
    if (customerCity) customerCity.value = address.city;
    if (customerAddress) customerAddress.value = address.address_line;
    if (customerPostal) customerPostal.value = address.postal_code;
    addressInputs.forEach((input) => input.setCustomValidity(""));
    if (customerFields) customerFields.hidden = true;
    if (savedAddressState) savedAddressState.textContent = `ارسال به نشانی «${address.label}»`;
    updateOrderLinks();
  };

  const renderSavedAddresses = (addresses: SavedAddress[]) => {
    if (!savedAddressList || !savedAddresses) return;
    savedAddressList.replaceChildren();
    addresses.forEach((address, index) => {
      const label = document.createElement("label");
      label.className = "saved-address-card";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "saved-address";
      input.value = address.id;
      input.checked = address.is_default || (!addresses.some((item) => item.is_default) && index === 0);
      const copy = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent = address.is_default ? `${address.label} · پیش‌فرض` : address.label;
      const detail = document.createElement("small");
      detail.textContent = `${address.province}، ${address.city}، ${address.address_line}`;
      const recipient = document.createElement("small");
      recipient.textContent = `${address.recipient_name} · ${address.phone}`;
      copy.append(title, detail, recipient);
      label.append(input, copy);
      savedAddressList.append(label);
      input.addEventListener("change", () => applyAddress(address));
      if (input.checked) applyAddress(address);
    });
    savedAddresses.hidden = false;
    if (useNewAddress) useNewAddress.hidden = false;
  };

  const loadCheckoutAccount = () => {
    if (accountRequest) return accountRequest;
    accountRequest = (async () => {
      try {
        const meResponse = await fetch("/api/v1/me", { credentials: "include" });
        if (!meResponse.ok) throw new Error("guest");
        const mePayload = await meResponse.json();
        accountUser = mePayload.user as AccountUser;
        if (customerName && accountUser.displayName) {
          customerName.value = accountUser.displayName;
          customerName.readOnly = true;
        }
        if (customerPhone && accountUser.phone) {
          customerPhone.value = accountUser.phone;
          customerPhone.readOnly = true;
        }
        if (checkoutProfile) {
          checkoutProfile.textContent =
            [accountUser.displayName, accountUser.phone].filter(Boolean).join(" · ") || "حساب کاربری شما";
        }
        if (checkoutAccount) checkoutAccount.hidden = false;
        if (checkoutLogin) checkoutLogin.hidden = true;
        if (savedAddresses) savedAddresses.hidden = false;
        if (savedAddressState) savedAddressState.textContent = "در حال دریافت نشانی‌های ذخیره‌شده...";

        const addressesResponse = await fetch("/api/v1/me/addresses", { credentials: "include" });
        if (!addressesResponse.ok) throw new Error("addresses");
        const payload = await addressesResponse.json();
        const addresses = (payload.addresses || []) as SavedAddress[];
        if (addresses.length) {
          renderSavedAddresses(addresses);
        } else {
          savedAddressList?.replaceChildren();
          if (savedAddressState) {
            savedAddressState.textContent = "هنوز نشانی ذخیره‌شده‌ای نداری؛ اطلاعات تحویل را وارد کن.";
          }
          if (useNewAddress) useNewAddress.hidden = true;
          if (customerFields) customerFields.hidden = false;
        }
        updateOrderLinks();
      } catch {
        accountUser = null;
        if (checkoutAccount) checkoutAccount.hidden = true;
        if (checkoutLogin) checkoutLogin.hidden = false;
        if (savedAddresses) savedAddresses.hidden = true;
        if (customerFields) customerFields.hidden = false;
      } finally {
        accountRequest = null;
      }
    })();
    return accountRequest;
  };

  const showCheckoutValidation = () => {
    const firstInvalid = addressInputs.find((input) => !input.value.trim() || !input.checkValidity());
    if (firstInvalid) {
      validateControlFa(firstInvalid);
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
      whatsappOrder.classList.toggle("is-disabled", !isComplete);
      whatsappOrder.setAttribute("aria-disabled", String(!isComplete));
    }
    if (baleOrder) {
      baleOrder.href = `https://ble.ir/share/url?url=${encodeURIComponent("https://orenza.ir")}&text=${message}`;
      baleOrder.classList.toggle("is-disabled", !isComplete);
      baleOrder.setAttribute("aria-disabled", String(!isComplete));
    }
    if (copyStatus && isComplete) {
      copyStatus.textContent = "سفارش آماده است؛ واتساپ یا بله را انتخاب کن.";
    }
  };

  const registerOrder = async () => {
    if (submittedOrder) return submittedOrder;
    if (!paymentMethod) throw new Error("روش پرداخت فعال پیدا نشد.");
    const shipping = shippingInputs.find((input) => input.checked)?.value;
    const response = await fetch("/api/v1/orders", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: customerName?.value.trim(),
        customerPhone: customerPhone?.value.trim(),
        customerProvince: customerProvince?.value.trim(),
        customerCity: customerCity?.value.trim(),
        customerAddress: customerAddress?.value.trim(),
        customerPostalCode: customerPostal?.value.trim(),
        shippingMethod: shipping === "تیپاکس" ? "tipax" : "post",
        paymentMethodId: paymentMethod.id,
        paymentCardId: selectedPaymentCard?.id,
        discountCode: discountCode?.value.trim() || undefined,
        customerNote: null,
        items: cart.map((item) => ({
          productId: item.productId,
          weight: item.weightGrams,
          quantity: item.quantity,
          grindType: item.grindSize || item.grind,
          roastType: item.roast,
          blendType: item.blend,
          brewMethod: item.device || null
        }))
      })
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "ثبت سفارش انجام نشد.");
    submittedOrder = payload.order as SubmittedOrder;
    discountAmount = submittedOrder.discountAmount;
    updateTotals();
    updateOrderLinks();
    return submittedOrder;
  };

  const openMessenger = async (kind: "whatsapp" | "bale") => {
    if (!checkoutIsComplete()) {
      showCheckoutValidation();
      return;
    }
    const target = window.open("", "_blank");
    if (copyStatus) copyStatus.textContent = "سفارش در حال ثبت است…";
    try {
      await registerOrder();
      const message = encodeURIComponent(createOrderSummary());
      const url = kind === "whatsapp"
        ? `https://api.whatsapp.com/send/?phone=989103060396&text=${message}&type=phone_number&app_absent=0`
        : `https://ble.ir/share/url?url=${encodeURIComponent("https://orenza.ir")}&text=${message}`;
      if (kind === "bale") {
        try { await navigator.clipboard.writeText(createOrderSummary()); } catch { /* share URL carries the text */ }
      }
      if (target) target.location.href = url;
      else location.href = url;
      if (copyStatus) copyStatus.textContent = `سفارش ${submittedOrder?.orderNumber} ثبت شد؛ حالا فیش را در پیام‌رسان پیوست کن.`;
    } catch (error) {
      target?.close();
      if (copyStatus) copyStatus.textContent = error instanceof Error ? error.message : "ثبت سفارش انجام نشد.";
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
    title.textContent = item.productTitle;
    const details = document.createElement("small");
    details.textContent = [`رست ${item.roast}`, item.grind, item.device, item.grindSize, item.weight, `${numberFormatter.format(item.quantity)} عدد`].filter(Boolean).join(" · ");
    const itemPrice = document.createElement("b");
    itemPrice.textContent = `${numberFormatter.format(item.totalPrice)} تومان`;
    copy.append(title, details, itemPrice);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "cart-remove";
    remove.dataset.removeCart = String(item.id);
    remove.innerHTML = `
      <svg class="lucide lucide-trash-2" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6m5 5v5m4-5v5" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" stroke-linejoin="round"/>
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
    updateTotals();
    updateOrderLinks();
  };

  const open = () => {
    if (!cartLayer) return;
    void loadCheckoutAccount();
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
    submittedOrder = null;
    discountAmount = 0;
    saveCart();
    render();
  });

  addressInputs.forEach((input) => {
    input.addEventListener("input", () => {
      if (input === customerPhone || input === customerPostal) {
        input.value = normalizeDigits(input.value);
      }
      updateOrderLinks();
      submittedOrder = null;
    });
  });
  [...shippingInputs, ...paymentInputs].forEach((input) => input.addEventListener("change", () => {
    submittedOrder = null;
    updateOrderLinks();
  }));

  discountCode?.addEventListener("input", () => {
    discountAmount = 0;
    submittedOrder = null;
    if (discountStatus) discountStatus.textContent = "";
    updateTotals();
  });

  applyDiscount?.addEventListener("click", async () => {
    const code = discountCode?.value.trim();
    if (!code) {
      discountAmount = 0;
      if (discountStatus) discountStatus.textContent = "کد تخفیف را وارد کن.";
      updateTotals();
      return;
    }
    applyDiscount.disabled = true;
    try {
      const response = await fetch("/api/v1/discounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, totalAmount: subtotal() })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "کد تخفیف معتبر نیست.");
      discountAmount = Number(payload.discountAmount || 0);
      submittedOrder = null;
      if (discountStatus) discountStatus.textContent = "تخفیف روی سفارش اعمال شد.";
      updateTotals();
      updateOrderLinks();
    } catch (error) {
      discountAmount = 0;
      if (discountStatus) discountStatus.textContent = error instanceof Error ? error.message : "کد تخفیف معتبر نیست.";
      updateTotals();
    } finally {
      applyDiscount.disabled = false;
    }
  });

  useNewAddress?.addEventListener("click", () => {
    savedAddressList?.querySelectorAll<HTMLInputElement>('input[name="saved-address"]').forEach((input) => {
      input.checked = false;
    });
    if (customerProvince) customerProvince.value = "";
    if (customerCity) customerCity.value = "";
    if (customerAddress) customerAddress.value = "";
    if (customerPostal) customerPostal.value = "";
    if (customerFields) customerFields.hidden = false;
    if (savedAddressState) savedAddressState.textContent = "نشانی جدید را در فرم زیر وارد کن.";
    submittedOrder = null;
    customerProvince?.focus();
    updateOrderLinks();
  });

  whatsappOrder?.addEventListener("click", (event) => {
    event.preventDefault();
    void openMessenger("whatsapp");
  });

  baleOrder?.addEventListener("click", (event) => {
    event.preventDefault();
    void openMessenger("bale");
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
    submittedOrder = null;
    discountAmount = 0;
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
  void loadCheckoutAccount();
  void loadPaymentMethod();
  enablePersianValidation(cartLayer || document);
  if (new URLSearchParams(location.search).get("cart") === "open") {
    window.setTimeout(open, 250);
    const cleanUrl = new URL(location.href);
    cleanUrl.searchParams.delete("cart");
    history.replaceState({}, "", `${cleanUrl.pathname}${cleanUrl.search}${cleanUrl.hash}`);
  }
};
