type SmsResult = {
  debugCode?: string;
};

type KavenegarResponse = {
  return?: {
    status?: number;
    message?: string;
  };
};

const sendWithKavenegar = async (phone: string, code: string, apiKey: string, template: string) => {
  const endpoint = `https://api.kavenegar.com/v1/${encodeURIComponent(apiKey)}/verify/lookup.json`;
  const body = new URLSearchParams({
    receptor: phone,
    token: code,
    template
  });

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(10_000)
    });
    const payload = await response.json().catch(() => null) as KavenegarResponse | null;
    if (!response.ok || payload?.return?.status !== 200) {
      throw new Error("KAVENEGAR_DELIVERY_REJECTED");
    }
  } catch {
    // Never expose the provider URL because it contains the API key.
    throw new Error("SMS_DELIVERY_FAILED");
  }
};

export const sendPasswordResetCode = async (phone: string, code: string): Promise<SmsResult> => {
  const kavenegarApiKey = process.env.KAVENEGAR_API_KEY || process.env.KAVENEGAR_LICENSE || "";
  const kavenegarTemplate =
    process.env.KAVENEGAR_PASSWORD_TEMPLATE ||
    process.env.KAVENEGAR_TEMPLATE ||
    "password";
  const webhookUrl = process.env.SMS_WEBHOOK_URL || "";
  const webhookToken = process.env.SMS_WEBHOOK_TOKEN || "";
  const debugEnabled = process.env.PASSWORD_RESET_DEBUG === "true";

  if (kavenegarApiKey) {
    await sendWithKavenegar(phone, code, kavenegarApiKey, kavenegarTemplate);
    return {};
  }

  if (!webhookUrl) {
    if (!debugEnabled) {
      throw new Error("SMS_PROVIDER_NOT_CONFIGURED");
    }
    console.info(`[local reset test] Password reset code for ${phone}: ${code}`);
    return { debugCode: code };
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(webhookToken ? { Authorization: `Bearer ${webhookToken}` } : {})
    },
    body: JSON.stringify({
      phone,
      code,
      purpose: "password-reset",
      message: `کد بازیابی رمز عبور اورنزا: ${code}`
    }),
    signal: AbortSignal.timeout(10_000)
  });

  if (!response.ok) throw new Error("SMS_DELIVERY_FAILED");
  return {};
};
