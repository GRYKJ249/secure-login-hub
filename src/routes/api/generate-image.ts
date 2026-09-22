import { createFileRoute } from "@tanstack/react-router";
import { describeImageFailure } from "@/lib/image-errors";
import { generateImage, imageSettings } from "@/lib/image-gateway.server";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authorization = request.headers.get("authorization");
        if (!authorization?.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
        const supabaseUrl = process.env["SUPABASE_URL"];
        if (!publishableKey || !supabaseUrl) return new Response("Cloud authentication unavailable", { status: 500 });
        const authClient = createClient(supabaseUrl, publishableKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: authorization } } });
        const { data: { user }, error: authError } = await authClient.auth.getUser();
        if (authError || !user) return new Response("Unauthorized", { status: 401 });
        const { prompt, stream = true, size } = (await request.json()) as {
          prompt?: unknown;
          stream?: boolean;
          size?: unknown;
        };
        if (typeof prompt !== "string" || !prompt.trim()) {
          return new Response("A prompt is required", { status: 400 });
        }
        const allowedSizes = new Set(["1024x1024", "1536x1024", "1024x1536"]);
        if (size !== undefined && (typeof size !== "string" || !allowedSizes.has(size))) {
          return new Response("Unsupported image size", { status: 400 });
        }
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });

        const upstream = await generateImage(
          { ...imageSettings, apiKey },
          prompt,
          stream,
          undefined,
          typeof size === "string" ? { size } : undefined,
        );
        if (!upstream.ok) {
          const detail = await upstream.text().catch(() => "");
          const message = describeImageFailure(upstream.status, detail);
          return new Response(JSON.stringify({ error: { message } }), {
            status: upstream.status,
            headers: { "Content-Type": "application/json", "Cache-Control": "no-cache" },
          });
        }
        return new Response(upstream.body, {
          status: upstream.status,
          headers: {
            "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
            "Cache-Control": "no-cache",
          },
        });
      },
    },
  },
});
