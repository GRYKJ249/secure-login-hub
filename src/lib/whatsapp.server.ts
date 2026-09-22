/**
 * Sends one-time codes over WhatsApp via Green API (green-api.com).
 *
 * Required secrets (set them and code delivery turns on automatically):
 *   WHATSAPP_PHONE_NUMBER_ID  - the Green API idInstance (e.g. 710722741840)
 *   WHATSAPP_TOKEN            - the Green API apiTokenInstance
 *   WHATSAPP_API_URL          - optional, defaults to https://7107.api.greenapi.com
 */

function greenApiConfig() {
  const instance = process.env["WHATSAPP_PHONE_NUMBER_ID"];
  const token = process.env["WHATSAPP_TOKEN"];
  if (!instance || !token) return null;
  const apiUrl = (process.env["WHATSAPP_API_URL"] ?? "https://api.green-api.com").replace(/\/+$/, "");
  return { instance, token, apiUrl };
}

export function whatsappConfigured() {
  return Boolean(greenApiConfig());
}

/** Reads the Green API instance state, e.g. "authorized" or "notAuthorized". */
export async function whatsappInstanceState() {
  const config = greenApiConfig();
  if (!config) return { ok: false as const, reason: "not_configured" as const };

  const url = `${config.apiUrl}/waInstance${config.instance}/getStateInstance/${config.token}`;
  try {
    const response = await fetch(url);
    const body = await response.text();
    if (!response.ok) {
      return { ok: false as const, reason: "provider_error" as const, status: response.status, detail: body };
    }
    const parsed = JSON.parse(body) as { stateInstance?: string };
    return { ok: true as const, state: parsed.stateInstance ?? "unknown" };
  } catch (error) {
    return { ok: false as const, reason: "network_error" as const, detail: String(error) };
  }
}

export async function sendWhatsappCode(phone: string, code: string) {
  const config = greenApiConfig();
  if (!config) {
    return { sent: false as const, reason: "not_configured" as const };
  }

  const digits = phone.replace(/\D/g, "");
  const url = `${config.apiUrl}/waInstance${config.instance}/sendMessage/${config.token}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chatId: `${digits}@c.us`,
        message: `رمز التحقق الخاص بك هو: ${code}\nYour verification code is: ${code}`,
      }),
    });
  } catch (error) {
    console.error("whatsapp send network error", error);
    return { sent: false as const, reason: "network_error" as const, detail: String(error) };
  }

  const body = await response.text();

  if (!response.ok) {
    console.error("whatsapp send failed", response.status, body);
    return {
      sent: false as const,
      reason: "provider_error" as const,
      status: response.status,
      detail: body.slice(0, 500),
    };
  }

  // Green API answers 200 with { idMessage: "..." } on success.
  let idMessage: string | undefined;
  try {
    idMessage = (JSON.parse(body) as { idMessage?: string }).idMessage;
  } catch {
    idMessage = undefined;
  }

  if (!idMessage) {
    console.error("whatsapp send returned no message id", body);
    return { sent: false as const, reason: "provider_error" as const, detail: body.slice(0, 500) };
  }

  return { sent: true as const, idMessage };
}
