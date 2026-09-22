import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  tokens_used?: number | null;
  created_at?: string | null;
};

/**
 * Avatars live in the private `avatars` bucket, so `avatar_url` holds a storage
 * path (e.g. `<uid>/avatar-123.jpg`). Turn it into something an <img> can show.
 */
export async function resolveAvatarUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  if (/^(https?:|data:|blob:)/.test(value)) return value;
  const { data } = await supabase.storage.from("avatars").createSignedUrl(value, 60 * 60 * 24);
  return data?.signedUrl ?? null;
}

/** A username auto-created by the phone sign-up trigger (just the digits) is not a real handle. */
export function isPlaceholderUsername(username: string | null | undefined): boolean {
  return !username || /^\d+$/.test(username);
}

export function useProfile() {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, display_name, avatar_url, tokens_used, created_at")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      const profile = (data ?? null) as Profile | null;
      return {
        profile,
        avatarUrl: await resolveAvatarUrl(profile?.avatar_url),
      };
    },
    staleTime: 60_000,
  });

  const profile = query.data?.profile ?? null;
  const username = isPlaceholderUsername(profile?.username) ? null : profile!.username;

  return {
    profile,
    username,
    displayName: profile?.display_name && !/^\d+$/.test(profile.display_name) ? profile.display_name : "",
    avatarUrl: query.data?.avatarUrl ?? null,
    isLoading: query.isLoading,
    refetch: query.refetch,
  };
}
