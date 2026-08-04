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
  type: "cardToCard" | "zarinpal";
  title: string;
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
  taxAmount: number;
  finalAmount: number;
};

export const initCart = () => {
  const cartLayer = document.querySelector<HTMLElement>("[data-cart-layer]");
  const cartItems = document.querySelector<HTMLOListElement>("[data-cart-items]");
  const cartEmpty = document.querySelector<HTMLElement>("[data-cart-empty]");
  const cartCheckout = document.querySelector<HTMLElement>("[data-cart-checkout]");
  const cartCountElements = document.querySelectorAll<HTMLElement>("[data-cart-count]");
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
  const cartTax = document.querySelector<HTMLElement>("[data-cart-tax]");
  const cartFinal = document.querySelector<HTMLElement>("[data-cart-final]");
  const paymentCard = document.querySelector<HTMLElement>("[data-payment-card]");
  const paymentCardList = document.querySelector<HTMLElement>("[data-payment-card-list]");
  const paymentMethodList = document.querySelector<HTMLElement>("[data-payment-method-list]");
  const paymentProof = document.querySelector<HTMLElement>("[data-payment-proof]");
  const paymentRef = document.querySelector<HTMLInputElement>("[data-payment-ref]");
  const paymentReceipt = document.querySelector<HTMLInputElement>("[data-payment-receipt]");
  const paymentReceiptName = document.querySelector<HTMLElement>("[data-payment-receipt-name]");
  const registerOrderButton = document.querySelector<HTMLButtonElement>("[data-register-order]");
  const orderState = document.querySelector<HTMLElement>("[data-order-state]");
  const addedChoice = document.querySelector<HTMLElement>("[data-cart-added-choice]");
  const addedChoiceTitle = document.querySelector<HTMLElement>("[data-cart-added-title]");
  const continueChoice = document.querySelector<HTMLButtonElement>("[data-cart-continue]");
  const viewCartChoice = document.querySelector<HTMLButtonElement>("[data-cart-view]");
  const checkoutAlert = document.querySelector<HTMLElement>("[data-checkout-alert]");
  const checkoutAlertTitle = document.querySelector<HTMLElement>("[data-checkout-alert-title]");
  const checkoutAlertMessage = document.querySelector<HTMLElement>("[data-checkout-alert-message]");
  const checkoutAlertIcon = document.querySelector<HTMLElement>("[data-checkout-alert-icon]");
  const checkoutAlertAction = document.querySelector<HTMLButtonElement>("[data-checkout-alert-action]");
  const checkoutAlertCloseButtons = document.querySelectorAll<HTMLButtonElement>("[data-checkout-alert-close]");
  const numberFormatter = new Intl.NumberFormat("fa-IR");
  let lastFocused: HTMLElement | null = null;
  let accountUser: AccountUser | null = null;
  let accountRequest: Promise<void> | null = null;
  let paymentMethod: PaymentMethod | null = null;
  let selectedPaymentCard: PaymentCard | null = null;
  let selectedReceipt: File | null = null;
  let receiptSelectionId = 0;
  let alertFocusTarget: HTMLElement | null = null;
  let alertAfterClose: (() => void) | null = null;
  let alertTimer: number | null = null;
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
  const taxableAmount = () => Math.max(0, subtotal() - discountAmount);
  const taxAmount = () => submittedOrder ? Number(submittedOrder.taxAmount || 0) : Math.round(taxableAmount() * 0.10);
  const finalAmount = () => submittedOrder ? Number(submittedOrder.finalAmount || 0) : taxableAmount() + taxAmount();

  const addressInputs = [customerName, customerPhone, customerProvince, customerCity, customerAddress, customerPostal].filter(
    (input): input is HTMLInputElement | HTMLTextAreaElement => Boolean(input)
  );

  const checkoutIsComplete = () =>
    addressInputs.every((input) => {
      input.setCustomValidity("");
      return input.value.trim().length > 0 && input.checkValidity();
    }) &&
    shippingInputs.some((input) => input.checked) &&
    paymentInputs.some((input) => input.checked) &&
    Boolean(paymentMethod && selectedPaymentCard) &&
    Boolean(paymentRef?.value.trim() && paymentRef.checkValidity() && selectedReceipt) &&
    cart.length > 0;

  const setCheckoutFieldError = (
    control: HTMLInputElement | HTMLTextAreaElement,
    message = ""
  ) => {
    const label = control.closest("label");
    if (!label) return;
    let error = label.querySelector<HTMLElement>(".checkout-field-error");
    if (!error) {
      error = document.createElement("small");
      error.className = "checkout-field-error";
      error.setAttribute("aria-live", "polite");
      label.append(error);
    }
    label.classList.toggle("is-invalid", Boolean(message));
    control.setAttribute("aria-invalid", message ? "true" : "false");
    error.textContent = message;
    error.hidden = !message;
  };

  const validateCheckoutField = (control: HTMLInputElement | HTMLTextAreaElement) => {
    control.setCustomValidity("");
    if (control.value.trim() && control.checkValidity()) {
      setCheckoutFieldError(control);
      return true;
    }
    validateControlFa(control);
    setCheckoutFieldError(control, control.validationMessage || "این فیلد را کامل کن.");
    return false;
  };

  const updateTotals = () => {
    if (cartSubtotal) cartSubtotal.textContent = `${numberFormatter.format(subtotal())} تومان`;
    if (cartDiscount) cartDiscount.textContent = `− ${numberFormatter.format(discountAmount)} تومان`;
    if (cartDiscountRow) cartDiscountRow.hidden = discountAmount === 0;
    if (cartTax) cartTax.textContent = `${numberFormatter.format(taxAmount())} تومان`;
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
      if (paymentMethodList) {
        paymentMethodList.replaceChildren();
        const label = document.createElement("label");
        label.className = "choice-card";
        label.innerHTML = `<input type="radio" name="payment-method" value="کارت‌به‌کارت" checked required /><span><strong>${paymentMethod.title || "کارت‌به‌کارت"}</strong><small>بررسی فیش توسط مدیریت</small></span>`;
        paymentMethodList.append(label);
        paymentInputs.splice(0, paymentInputs.length, ...paymentMethodList.querySelectorAll<HTMLInputElement>('input[name="payment-method"]'));
        paymentInputs.forEach((input) => input.addEventListener("change", updateOrderLinks));
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
      if (paymentProof) paymentProof.hidden = false;
      updateOrderLinks();
    } catch {
      paymentMethod = null;
    }
  };

  const normalizeDigits = (value: string) =>
    value
      .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
      .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)));

  const closeCheckoutAlert = () => {
    if (!checkoutAlert || checkoutAlert.hidden) return;
    if (alertTimer !== null) {
      window.clearTimeout(alertTimer);
      alertTimer = null;
    }
    checkoutAlert.classList.remove("is-visible");
    window.setTimeout(() => {
      checkoutAlert.hidden = true;
      alertFocusTarget?.focus();
      alertFocusTarget = null;
      const afterClose = alertAfterClose;
      alertAfterClose = null;
      afterClose?.();
    }, 180);
  };

  const showCheckoutAlert = (
    message: string,
    focusTarget?: HTMLElement | null,
    variant: "error" | "success" = "error"
  ) => {
    if (copyStatus) copyStatus.textContent = message;
    if (!checkoutAlert || !checkoutAlertMessage) return;
    if (alertTimer !== null) window.clearTimeout(alertTimer);
    alertAfterClose = null;
    alertFocusTarget = focusTarget || null;
    checkoutAlert.classList.toggle("is-error", variant === "error");
    checkoutAlert.classList.toggle("is-success", variant === "success");
    if (checkoutAlertTitle) {
      checkoutAlertTitle.textContent = variant === "success" ? "سفارش با موفقیت ثبت شد" : "امکان ثبت سفارش نیست";
    }
    if (checkoutAlertIcon) checkoutAlertIcon.textContent = variant === "success" ? "✓" : "!";
    if (checkoutAlertAction) checkoutAlertAction.textContent = variant === "success" ? "مشاهده سفارش" : "متوجه شدم";
    checkoutAlertMessage.textContent = message;
    checkoutAlert.hidden = false;
    requestAnimationFrame(() => checkoutAlert.classList.add("is-visible"));
    checkoutAlert.querySelector<HTMLButtonElement>(".checkout-alert-card button")?.focus();
  };

  const showOrderSuccessAlert = (orderNumber: string) => new Promise<void>((resolve) => {
    if (!checkoutAlert) {
      resolve();
      return;
    }
    showCheckoutAlert(
      `سفارش ${orderNumber} ثبت شد و برای بررسی پرداخت به مدیریت ارسال گردید. تا چند لحظه دیگر به صفحه تأیید سفارش منتقل می‌شوی.`,
      null,
      "success"
    );
    alertAfterClose = resolve;
    alertTimer = window.setTimeout(closeCheckoutAlert, 3200);
  });

  const applyAddress = (address: SavedAddress) => {
    submittedOrder = null;
    if (customerName) customerName.value = address.recipient_name || accountUser?.displayName || "";
    if (customerPhone) customerPhone.value = address.phone || accountUser?.phone || "";
    if (customerProvince) customerProvince.value = address.province;
    if (customerCity) customerCity.value = address.city;
    if (customerAddress) customerAddress.value = address.address_line;
    if (customerPostal) customerPostal.value = address.postal_code;
    addressInputs.forEach((input) => {
      input.setCustomValidity("");
      setCheckoutFieldError(input);
    });
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
      firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
      showCheckoutAlert(firstInvalid.validationMessage || "لطفاً اطلاعات کامل تحویل سفارش را وارد کن.", firstInvalid);
      return;
    }
    if (!shippingInputs.some((input) => input.checked)) {
      const shippingChoice = document.querySelector<HTMLElement>("[data-shipping-choice]");
      shippingChoice?.scrollIntoView({ behavior: "smooth", block: "center" });
      showCheckoutAlert("لطفاً تیپاکس یا پست را برای ارسال انتخاب کن.", shippingInputs[0]);
      return;
    }
    if (!paymentMethod || !selectedPaymentCard || !paymentInputs.some((input) => input.checked)) {
      paymentCard?.scrollIntoView({ behavior: "smooth", block: "center" });
      showCheckoutAlert("لطفاً یکی از کارت‌های فعال را انتخاب کن.", paymentInputs[0]);
      return;
    }
    if (!paymentRef?.value.trim()) {
      paymentRef?.scrollIntoView({ behavior: "smooth", block: "center" });
      showCheckoutAlert("کد پیگیری تراکنش را وارد کن.", paymentRef);
      return;
    }
    if (!selectedReceipt) {
      paymentReceipt?.scrollIntoView({ behavior: "smooth", block: "center" });
      showCheckoutAlert("تصویر فیش واریزی را از دوربین یا گالری انتخاب کن.", paymentReceipt);
      return;
    }
    if (!cart.length) showCheckoutAlert("سبد سفارش خالی است.");
  };

  const updateOrderLinks = () => {
    const isComplete = checkoutIsComplete();
    if (copyStatus) {
      copyStatus.classList.toggle("is-ready", isComplete);
      copyStatus.textContent = isComplete
        ? "اطلاعات کامل است؛ اکنون می‌توانی سفارش را ثبت کنی."
        : "برای فعال‌شدن دکمه ثبت سفارش، همه فیلدهای اجباری و اطلاعات پرداخت را کامل کن.";
    }
    if (registerOrderButton) {
      const disabled = Boolean(submittedOrder) || !isComplete;
      registerOrderButton.disabled = disabled;
      registerOrderButton.setAttribute("aria-disabled", String(disabled));
    }
  };

  const updateSubmittedState = () => {
    if (!orderState) return;
    if (!submittedOrder) {
      orderState.hidden = true;
      orderState.textContent = "";
      return;
    }
    orderState.hidden = false;
    orderState.innerHTML = `
      <strong>سفارش ${submittedOrder.orderNumber} ثبت شد.</strong>
      <span>فیش و کد پیگیری دریافت شد. سفارش در انتظار تأیید پرداخت توسط مدیریت است.</span>
    `;
  };

  const registerOrder = async () => {
    if (submittedOrder) return submittedOrder;
    if (!paymentMethod) throw new Error("روش پرداخت فعال پیدا نشد.");
    if (!selectedReceipt) throw new Error("تصویر فیش واریزی را انتخاب کن.");
    const shipping = shippingInputs.find((input) => input.checked)?.value;
    const orderPayload = {
        customerName: customerName?.value.trim(),
        customerPhone: customerPhone?.value.trim(),
        customerProvince: customerProvince?.value.trim(),
        customerCity: customerCity?.value.trim(),
        customerAddress: customerAddress?.value.trim(),
        customerPostalCode: customerPostal?.value.trim(),
        shippingMethod: shipping === "تیپاکس" ? "tipax" : "post",
        paymentMethodId: paymentMethod.id,
        paymentCardId: selectedPaymentCard?.id,
        paymentRefId: normalizeDigits(paymentRef?.value.trim() || ""),
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
      };
    const formData = new FormData();
    formData.append("payload", JSON.stringify(orderPayload));
    formData.append("receipt", selectedReceipt, selectedReceipt.name);
    const response = await fetch("/api/v1/orders/card-transfer", {
      method: "POST",
      credentials: "include",
      body: formData
    });
    const responseText = await response.text();
    let payload: { error?: string; order?: SubmittedOrder } = {};
    try {
      payload = responseText ? JSON.parse(responseText) : {};
    } catch {
      // Nginx and mobile networks may return an HTML error page instead of JSON.
    }
    if (!response.ok) {
      const fallback = response.status === 413
        ? "حجم تصویر فیش زیاد است؛ یک تصویر کوچک‌تر انتخاب کن."
        : "ثبت سفارش انجام نشد؛ اتصال اینترنت را بررسی و دوباره تلاش کن.";
      throw new Error(payload.error || fallback);
    }
    if (!payload.order) throw new Error("پاسخ ثبت سفارش کامل نبود؛ دوباره تلاش کن.");
    submittedOrder = payload.order as SubmittedOrder;
    discountAmount = submittedOrder.discountAmount;
    updateTotals();
    updateOrderLinks();
    updateSubmittedState();
    return submittedOrder;
  };

  const submitOrderOnly = async () => {
    if (!checkoutIsComplete()) {
      showCheckoutValidation();
      return;
    }
    if (registerOrderButton) registerOrderButton.disabled = true;
    if (copyStatus) copyStatus.textContent = "در حال ثبت سفارش…";
    try {
      const order = await registerOrder();
      localStorage.removeItem("orenza-cart");
      cart = [];
      if (copyStatus) copyStatus.textContent = `سفارش ${order.orderNumber} با موفقیت ثبت شد؛ در حال انتقال…`;
      if (registerOrderButton) registerOrderButton.textContent = "سفارش ثبت شد ✓";
      await showOrderSuccessAlert(order.orderNumber);
      window.location.assign(`/order-success/?order=${encodeURIComponent(order.orderNumber)}`);
    } catch (error) {
      const message = error instanceof TypeError
        ? "ارتباط با سرور برقرار نشد؛ اینترنت موبایل را بررسی و دوباره تلاش کن."
        : error instanceof Error ? error.message : "ثبت سفارش انجام نشد.";
      showCheckoutAlert(message, registerOrderButton);
    } finally {
      if (registerOrderButton) registerOrderButton.disabled = Boolean(submittedOrder);
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

  const showAddedChoice = (item: CartItemInput) => {
    if (!addedChoice) return;
    if (addedChoiceTitle) addedChoiceTitle.textContent = item.productTitle || item.blend || "انتخاب اورنزا";
    addedChoice.hidden = false;
    addedChoice.classList.remove("is-visible");
    requestAnimationFrame(() => addedChoice.classList.add("is-visible"));
    window.setTimeout(() => addedChoice.classList.remove("is-visible"), 5200);
  };

  const hideAddedChoice = () => {
    if (!addedChoice) return;
    addedChoice.classList.remove("is-visible");
    window.setTimeout(() => { addedChoice.hidden = true; }, 220);
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
      input.setCustomValidity("");
      if (input.getAttribute("aria-invalid") === "true" && input.value.trim() && input.checkValidity()) {
        setCheckoutFieldError(input);
      }
      submittedOrder = null;
      updateSubmittedState();
      updateOrderLinks();
    });
    input.addEventListener("blur", () => {
      validateCheckoutField(input);
      updateOrderLinks();
    });
  });
  [...shippingInputs, ...paymentInputs].forEach((input) => input.addEventListener("change", () => {
    submittedOrder = null;
    updateSubmittedState();
    updateOrderLinks();
  }));

  discountCode?.addEventListener("input", () => {
    discountAmount = 0;
    submittedOrder = null;
    updateSubmittedState();
    if (discountStatus) discountStatus.textContent = "";
    updateTotals();
  });

  paymentRef?.addEventListener("input", () => {
    paymentRef.value = normalizeDigits(paymentRef.value);
    paymentRef.setCustomValidity("");
    if (paymentRef.getAttribute("aria-invalid") === "true" && paymentRef.value.trim() && paymentRef.checkValidity()) {
      setCheckoutFieldError(paymentRef);
    }
    submittedOrder = null;
    updateSubmittedState();
    updateOrderLinks();
  });
  paymentRef?.addEventListener("blur", () => {
    validateCheckoutField(paymentRef);
    updateOrderLinks();
  });
  const loadReceiptImage = async (file: File) => {
    if ("createImageBitmap" in window) {
      try {
        const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
        return {
          width: bitmap.width,
          height: bitmap.height,
          draw: (context: CanvasRenderingContext2D, width: number, height: number) => {
            context.drawImage(bitmap, 0, 0, width, height);
            bitmap.close();
          }
        };
      } catch {
        // Safari may only decode some camera formats through an image element.
      }
    }

    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      return {
        width: image.naturalWidth,
        height: image.naturalHeight,
        draw: (context: CanvasRenderingContext2D, width: number, height: number) => {
          context.drawImage(image, 0, 0, width, height);
        }
      };
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const prepareReceipt = async (file: File) => {
    const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
    const maxUploadSize = 4.5 * 1024 * 1024;
    if (allowedTypes.has(file.type) && file.size <= maxUploadSize) return file;
    if (!file.type.startsWith("image/") && !/\.(?:heic|heif)$/i.test(file.name)) {
      throw new Error("فیش باید یک فایل تصویری باشد.");
    }

    const source = await loadReceiptImage(file);
    const maxSide = 1800;
    const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
    const width = Math.max(1, Math.round(source.width * scale));
    const height = Math.max(1, Math.round(source.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("مرورگر نتوانست تصویر فیش را آماده کند.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    source.draw(context, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    canvas.width = 1;
    canvas.height = 1;
    if (!blob || blob.size > maxUploadSize) {
      throw new Error("حجم تصویر فیش زیاد است؛ لطفاً از فیش اسکرین‌شات بگیر و همان را انتخاب کن.");
    }
    const baseName = file.name.replace(/\.[^.]+$/, "") || "payment-receipt";
    return new File([blob], `${baseName}.jpg`, { type: "image/jpeg", lastModified: Date.now() });
  };

  paymentReceipt?.addEventListener("change", async () => {
    const selectionId = ++receiptSelectionId;
    const file = paymentReceipt.files?.[0];
    selectedReceipt = null;
    paymentReceipt.closest("label")?.classList.remove("is-invalid");
    paymentReceipt.setAttribute("aria-invalid", "false");
    if (!file) {
      if (paymentReceiptName) paymentReceiptName.textContent = "عکس دوربین یا گالری؛ حجم به‌صورت خودکار بهینه می‌شود";
    } else {
      if (paymentReceiptName) paymentReceiptName.textContent = "در حال آماده‌سازی تصویر…";
      try {
        const prepared = await prepareReceipt(file);
        if (selectionId !== receiptSelectionId) return;
        selectedReceipt = prepared;
        paymentReceipt.closest("label")?.classList.remove("is-invalid");
        paymentReceipt.setAttribute("aria-invalid", "false");
        if (paymentReceiptName) {
          const size = Math.max(1, Math.round(prepared.size / 1024));
          paymentReceiptName.textContent = `${prepared.name} · ${numberFormatter.format(size)} کیلوبایت · آماده ارسال`;
        }
      } catch (error) {
        if (selectionId !== receiptSelectionId) return;
        paymentReceipt.value = "";
        selectedReceipt = null;
        paymentReceipt.closest("label")?.classList.add("is-invalid");
        paymentReceipt.setAttribute("aria-invalid", "true");
        if (paymentReceiptName) {
          const message = error instanceof Error
            ? error.message
            : "تصویر فیش قابل پردازش نیست؛ تصویر دیگری انتخاب کن.";
          paymentReceiptName.textContent = message;
          showCheckoutAlert(message, paymentReceipt);
        }
      }
    }
    submittedOrder = null;
    updateSubmittedState();
    updateOrderLinks();
  });

  applyDiscount?.addEventListener("click", async () => {
    const code = discountCode?.value.trim();
    if (!code) {
      discountAmount = 0;
      if (discountStatus) discountStatus.textContent = "کد تخفیف را وارد کن.";
      showCheckoutAlert("برای اعمال تخفیف، ابتدا کد تخفیف را وارد کن.", discountCode);
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
      updateSubmittedState();
      if (discountStatus) discountStatus.textContent = "تخفیف روی سفارش اعمال شد.";
      updateTotals();
      updateOrderLinks();
    } catch (error) {
      discountAmount = 0;
      submittedOrder = null;
      updateSubmittedState();
      const message = error instanceof Error ? error.message : "کد تخفیف معتبر نیست.";
      if (discountStatus) discountStatus.textContent = message;
      showCheckoutAlert(message, discountCode);
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
    updateSubmittedState();
  });

  registerOrderButton?.addEventListener("click", () => { void submitOrderOnly(); });
  checkoutAlertCloseButtons.forEach((button) => button.addEventListener("click", closeCheckoutAlert));
  continueChoice?.addEventListener("click", hideAddedChoice);
  viewCartChoice?.addEventListener("click", () => {
    hideAddedChoice();
    open();
  });

  document.addEventListener("keydown", (event) => {
    if (!cartLayer || cartLayer.hidden) return;
    if (event.key === "Escape") {
      if (checkoutAlert && !checkoutAlert.hidden) {
        closeCheckoutAlert();
        return;
      }
      close();
      return;
    }
    if (event.key !== "Tab") return;

    const focusRoot = checkoutAlert && !checkoutAlert.hidden ? checkoutAlert : cartLayer;
    const focusable = [
      ...focusRoot.querySelectorAll<HTMLElement>(
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
    updateSubmittedState();
    saveCart();
    render();
    document.querySelectorAll<HTMLElement>("[data-cart-open]").forEach((trigger) => {
      trigger.classList.remove("has-new-item");
      requestAnimationFrame(() => trigger.classList.add("has-new-item"));
      window.setTimeout(() => trigger.classList.remove("has-new-item"), 900);
    });
    showAddedChoice(item);
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
