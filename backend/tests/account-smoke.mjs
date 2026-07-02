const baseUrl = process.env.BASE_URL || "http://127.0.0.1:8080";
const phone = process.env.SMOKE_PHONE || "09000000001";
let cookie = "";

const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
      ...options.headers
    },
    redirect: "manual"
  });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const body = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(`${options.method || "GET"} ${path}: ${response.status} ${JSON.stringify(body)}`);
  return body;
};

await request("/auth/register", {
  method: "POST",
  body: JSON.stringify({ phone, password: "Orenza-Test-123", displayName: "کاربر تست اورنزا" })
});

const profile = await request("/me");
if (profile.user.phone !== phone) throw new Error("Profile phone mismatch.");

const created = await request("/me/addresses", {
  method: "POST",
  body: JSON.stringify({
    label: "خانه",
    recipientName: "کاربر تست اورنزا",
    phone,
    province: "تهران",
    city: "تهران",
    postalCode: "1234567890",
    addressLine: "خیابان تست، کوچه تست، پلاک یک",
    isDefault: true
  })
});
if (!created.address.is_default) throw new Error("First address must be default.");

await request("/me/change-password", {
  method: "POST",
  body: JSON.stringify({ currentPassword: "Orenza-Test-123", newPassword: "Orenza-Test-456" })
});
await request("/auth/logout", { method: "POST", body: "{}" });

await request("/auth/login", {
  method: "POST",
  body: JSON.stringify({ phone, password: "Orenza-Test-456" })
});

const addresses = await request("/me/addresses");
if (addresses.addresses.length !== 1) throw new Error("Saved address was not returned.");

console.log("Account smoke test passed.");
