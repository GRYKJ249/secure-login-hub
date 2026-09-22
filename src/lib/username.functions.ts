import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const HANDLE_RE = /^[a-z0-9_.]{3,24}$/;

/** Turn a display name into a lowercase ascii-ish slug. */
export function slugifyName(name: string): string {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s_.]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return base.join(" ");
}

/** Local (offline) suggestions built from the display name, in random styles. */
export function localSuggestions(name: string): string[] {
  const parts = slugifyName(name).split(" ").filter(Boolean);
  const joined = parts.join("") || "user";
  const underscored = parts.join("_") || "user";
  const rnd = () => String(Math.floor(Math.random() * 900) + 100);

  const candidates = [
    joined,
    underscored,
    `${joined}${rnd()}`,
    `${underscored}${rnd()}`,
    `${parts[0] ?? "user"}${rnd()}`,
    `the${joined}`,
    `${joined}_${rnd()}`,
  ]
    .map((value) => value.slice(0, 24))
    .filter((value) => HANDLE_RE.test(value));

  // Shuffle so the suggested style varies each time.
  for (let i = candidates.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j]!, candidates[i]!];
  }
  return [...new Set(candidates)];
}

async function takenSet(handles: string[]): Promise<Set<string>> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("username")
    .in("username", handles);
  return new Set((data ?? []).map((row) => (row.username ?? "").toLowerCase()));
}

/** Is this handle free? Returns a boolean only — no user data is exposed. */
export const checkUsername = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ username: z.string().trim().max(32) }).parse(input))
  .handler(async ({ data }) => {
    const handle = data.username.replace(/^@/, "").toLowerCase();
    if (!HANDLE_RE.test(handle)) return { ok: false as const, available: false, reason: "invalid" as const };
    const taken = await takenSet([handle]);
    return { ok: true as const, available: !taken.has(handle), reason: "checked" as const };
  });

/** Suggest a free username derived from the display name. */
export const suggestUsername = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ name: z.string().trim().max(80) }).parse(input))
  .handler(async ({ data }) => {
    const candidates = localSuggestions(data.name);
    if (candidates.length === 0) return { username: `user${Math.floor(Math.random() * 9000) + 1000}` };
    const taken = await takenSet(candidates);
    const free = candidates.find((candidate) => !taken.has(candidate));
    if (free) return { username: free };
    const base = (candidates[0] ?? "user").slice(0, 18);
    return { username: `${base}${Math.floor(Math.random() * 9000) + 1000}`.slice(0, 24) };
  });
