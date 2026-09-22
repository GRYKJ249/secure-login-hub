import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{6,14}$/, "Enter a valid phone number with its country code.");

const requestSchema = z.object({
  phone: phoneSchema,
  countryCode: z.string().trim().length(2).optional(),
});

const verifySchema = z.object({
  phone: phoneSchema,
  code: z.string().trim().regex(/^\d{6}$/, "The code is six digits."),
});

/** Israel is intentionally not available for sign-up. */
const BLOCKED_DIAL_PREFIXES = ["+972"];
const BLOCKED_COUNTRY_CODES = ["IL"];

const CODE_TTL_MINUTES = 10;
const MAX_CODES_PER_WINDOW = 4;
const MAX_ATTEMPTS = 5;

function syntheticEmail(phone: string) {
  return `${phone.replace(/\D/g, "")}@phone.opera.local`;
}

async function hashCode(phone: string, code: string) {
  const data = new TextEncoder().encode(`${phone}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomCode() {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(100000 + ((bytes[0] ?? 0) % 900000));
}

function randomPassword() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(36)).join("");
}

export const requestPhoneCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => requestSchema.parse(input))
  .handler(async ({ data }) => {
    if (
      BLOCKED_DIAL_PREFIXES.some((prefix) => data.phone.startsWith(prefix)) ||
      (data.countryCode && BLOCKED_COUNTRY_CODES.includes(data.countryCode.toUpperCase()))
    ) {
      return { ok: false as const, error: "country_unavailable" as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const since = new Date(Date.now() - CODE_TTL_MINUTES * 60_000).toISOString();

    const { count } = await supabaseAdmin
      .from("phone_otps")
      .select("id", { count: "exact", head: true })
      .eq("phone", data.phone)
      .gte("created_at", since);

    if ((count ?? 0) >= MAX_CODES_PER_WINDOW) {
      return { ok: false as const, error: "too_many_requests" as const };
    }

    const code = randomCode();
    const { error } = await supabaseAdmin.from("phone_otps").insert({
      phone: data.phone,
      code_hash: await hashCode(data.phone, code),
      expires_at: new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString(),
    });
    if (error) {
      console.error("otp insert failed", error);
      return {
        ok: false as const,
        error: "server_error" as const,
        message: `${error.message}${error.hint ? ` (${error.hint})` : ""}`,
      };

    }

    const { sendWhatsappCode, whatsappConfigured } = await import("@/lib/whatsapp.server");
    if (!whatsappConfigured()) {
      // WhatsApp sending is not connected yet: show the code in the app so the
      // flow can be tested end to end. Once the WhatsApp secrets exist this
      // branch never runs and codes are only delivered on WhatsApp.
      return { ok: true as const, delivery: "preview" as const, code };
    }

    const result = await sendWhatsappCode(data.phone, code);
    if (!result.sent) {
      const { whatsappInstanceState } = await import("@/lib/whatsapp.server");
      const state = await whatsappInstanceState();
      console.error("whatsapp code not sent", { result, state });
      return {
        ok: false as const,
        error: "send_failed" as const,
        reason: result.reason,
        detail: "detail" in result ? result.detail : undefined,
        instanceState: state.ok ? state.state : state.reason,
      };
    }
    return { ok: true as const, delivery: "whatsapp" as const };
  });

export const verifyPhoneCode = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => verifySchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("phone_otps")
      .select("id, code_hash, attempts, expires_at")
      .eq("phone", data.phone)
      .is("consumed_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row) return { ok: false as const, error: "expired" as const };
    if (row.attempts >= MAX_ATTEMPTS) return { ok: false as const, error: "too_many_attempts" as const };

    const expected = await hashCode(data.phone, data.code);
    if (expected !== row.code_hash) {
      await supabaseAdmin
        .from("phone_otps")
        .update({ attempts: row.attempts + 1 })
        .eq("id", row.id);
      return { ok: false as const, error: "wrong_code" as const };
    }

    await supabaseAdmin
      .from("phone_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", row.id);

    const email = syntheticEmail(data.phone);
    const password = randomPassword();

    const { data: existing } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const found = existing?.users.find((user) => user.email === email);

    if (found) {
      // Sign the user in without touching their password, so a password they
      // set themselves keeps working for direct sign-in.
      const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
      });
      const tokenHash = link?.properties?.hashed_token;
      if (!linkError && tokenHash) {
        return { ok: true as const, mode: "otp" as const, email, tokenHash, isNew: false as const };
      }

      const { error } = await supabaseAdmin.auth.admin.updateUserById(found.id, { password });
      if (error) {
        console.error("password rotation failed", error);
        return { ok: false as const, error: "server_error" as const };
      }
      return { ok: true as const, mode: "password" as const, email, password, isNew: false as const };
    }

    const { error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { phone: data.phone },
    });
    if (error) {
      console.error("user creation failed", error);
      return { ok: false as const, error: "server_error" as const };
    }
    return { ok: true as const, mode: "password" as const, email, password, isNew: true as const };
  });
