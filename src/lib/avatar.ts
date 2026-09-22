import { supabase } from "@/integrations/supabase/client";
import { resolveAvatarUrl } from "@/hooks/useProfile";

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export type AvatarUploadResult =
  | { ok: true; path: string; url: string | null }
  | { ok: false; error: "not_image" | "too_large" | "no_user" | "upload_failed"; message?: string };

/** Upload an avatar into the private `avatars` bucket under the user's folder. */
export async function uploadAvatar(file: File): Promise<AvatarUploadResult> {
  if (!file.type.startsWith("image/")) return { ok: false, error: "not_image" };
  if (file.size > MAX_AVATAR_BYTES) return { ok: false, error: "too_large" };

  const { data: current } = await supabase.auth.getUser();
  if (!current.user) return { ok: false, error: "no_user" };

  const extension = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  const path = `${current.user.id}/avatar-${Date.now()}.${extension}`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) return { ok: false, error: "upload_failed", message: error.message };

  return { ok: true, path, url: await resolveAvatarUrl(path) };
}
