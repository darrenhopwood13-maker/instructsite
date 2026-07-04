import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

export const Route = createFileRoute("/api/drawing/$drawingId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        try {
          const url = new URL(request.url);
          const access = url.searchParams.get("access");
          let supabase: any;
          let userId: string;

          if (access) {
            const { getDrawingAccessSecret, verifyDrawingAccessToken } = await import(
              "@/lib/drawing-token.server"
            );
            let payload;
            try {
              payload = verifyDrawingAccessToken(access, getDrawingAccessSecret());
            } catch (err) {
              return new Response(err instanceof Error ? err.message : "Unauthorized", {
                status: 401,
              });
            }
            if (payload.drawingId !== params.drawingId) {
              return new Response("Forbidden", { status: 403 });
            }
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            supabase = supabaseAdmin;
            userId = payload.userId;
          } else {
            const auth = request.headers.get("authorization") ?? "";
            const token = auth.replace(/^Bearer\s+/i, "");
            if (!token) return new Response("Unauthorized", { status: 401 });

            supabase = createClient(
              process.env.SUPABASE_URL!,
              process.env.SUPABASE_PUBLISHABLE_KEY!,
              {
                global: { headers: { Authorization: `Bearer ${token}` } },
                auth: { persistSession: false, autoRefreshToken: false },
              },
            );

            const { data: userData, error: userErr } = await supabase.auth.getUser();
            if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });
            userId = userData.user.id;
          }

          const { data: drawing, error } = await supabase
            .from("project_drawings")
            .select(
              "project_id,site_documents(file_path,bucket,mime_type,file_name)",
            )
            .eq("id", params.drawingId)
            .maybeSingle();
          if (error || !drawing) return new Response("Not found", { status: 404 });

          const sd = Array.isArray(drawing.site_documents)
            ? drawing.site_documents[0]
            : drawing.site_documents;
          if (!sd?.file_path) return new Response("Missing file", { status: 404 });

          // Verify project membership via RPC (RLS backstop only)
          const { data: isMember } = await supabase.rpc("is_project_member", {
            _project_id: drawing.project_id,
            _user_id: userId,
          });
          if (!isMember) return new Response("Forbidden", { status: 403 });

          const { data: blob, error: dlErr } = await supabase.storage
            .from(sd.bucket ?? "project-bible")
            .download(sd.file_path);
          if (dlErr || !blob) return new Response("Download failed", { status: 502 });

          const download = url.searchParams.get("download") === "1";
          const disposition = download ? "attachment" : "inline";
          const filename = (sd.file_name ?? "drawing").replace(/"/g, "");

          return new Response(blob, {
            status: 200,
            headers: {
              "Content-Type": sd.mime_type ?? "application/octet-stream",
              "Content-Disposition": `${disposition}; filename="${filename}"`,
              "Cache-Control": "private, max-age=1800",
            },
          });
        } catch (e) {
          return new Response(
            e instanceof Error ? e.message : "Internal error",
            { status: 500 },
          );
        }
      },
    },
  },
});
