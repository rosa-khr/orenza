import assert from "node:assert/strict";
import { createRequire } from "node:module";

const puppeteer = createRequire(new URL("../backend/package.json", import.meta.url))("puppeteer-core");

const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
const productSlug = process.env.PRODUCT_SLUG || "masala-chai";
const executablePath = process.env.CHROME_PATH || "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const browser = await puppeteer.launch({
  executablePath,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

try {
  const page = await browser.newPage();
  const failedResponses = [];
  page.on("response", (response) => {
    if (response.status() >= 500) failedResponses.push(`${response.status()} ${response.url()}`);
  });

  await page.goto(`${baseUrl}/products/${productSlug}/`, { waitUntil: "networkidle0", timeout: 45_000 });
  await page.waitForFunction(
    () => document.querySelectorAll("[data-product-detail-weights] button").length > 0,
    { timeout: 15_000 },
  );

  const before = await page.evaluate(() => ({
    title: document.querySelector("[data-product-detail-title]")?.textContent?.trim(),
    price: document.querySelector("[data-product-detail-price]")?.textContent?.trim(),
    weights: [...document.querySelectorAll("[data-product-detail-weights] button")].map((button) => ({
      value: button.dataset.weight,
      text: button.textContent?.trim(),
    })),
  }));
  assert.ok(before.title, "Product title was not rendered");
  assert.ok(before.price && before.price !== "—", "Initial product price was not rendered");
  assert.ok(before.weights.length > 0, "No weight option was rendered");

  let afterWeightPrice = before.price;
  if (before.weights.length > 1) {
    await page.click("[data-product-detail-weights] button:nth-child(2)");
    afterWeightPrice = await page.$eval("[data-product-detail-price]", (node) => node.textContent?.trim());
    assert.notEqual(afterWeightPrice, before.price, "Changing weight did not change the displayed price");
  }

  await page.click("[data-product-detail-action]");
  await page.waitForFunction(() => JSON.parse(localStorage.getItem("orenza-cart") || "[]").length > 0);
  const cart = await page.evaluate(() => JSON.parse(localStorage.getItem("orenza-cart") || "[]"));
  assert.equal(cart.length, 1, "Product was not added to cart exactly once");
  assert.ok(Number(cart[0].unitPrice) > 0, "Cart unit price is invalid");
  assert.ok(Number(cart[0].weightGrams) > 0, "Cart weight is invalid");

  await page.goto(`${baseUrl}/order/`, { waitUntil: "networkidle0", timeout: 45_000 });
  await page.waitForFunction(() => document.querySelectorAll("[data-cart-items] .cart-item").length > 0);
  const checkout = await page.evaluate(() => ({
    items: document.querySelectorAll("[data-cart-items] .cart-item").length,
    subtotal: document.querySelector("[data-cart-subtotal]")?.textContent?.trim(),
    registerButton: Boolean(document.querySelector("[data-register-order]")),
    orderState: document.querySelector("[data-order-state]")?.textContent?.trim(),
  }));
  assert.equal(checkout.items, 1, "Cart item was not preserved on checkout page");
  assert.ok(checkout.subtotal && !checkout.subtotal.startsWith("۰"), "Checkout subtotal is invalid");
  assert.equal(checkout.registerButton, true, "Checkout submit control is missing");
  assert.deepEqual(failedResponses, [], `Server errors were observed: ${failedResponses.join(", ")}`);

  console.log(JSON.stringify({
    status: "PASS",
    mode: "non-transactional",
    productSlug,
    productTitle: before.title,
    weights: before.weights,
    initialPrice: before.price,
    changedWeightPrice: afterWeightPrice,
    cart: { items: cart.length, weightGrams: cart[0].weightGrams, unitPrice: cart[0].unitPrice },
    checkout,
    submittedOrder: false,
  }, null, 2));
} finally {
  await browser.close();
}
