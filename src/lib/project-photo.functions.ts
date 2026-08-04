import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PROJECT_PHOTO_BUCKET = "project-photos";

/** Signed URL for the project cover photo + whether the caller may change it. */
export const getProjectPhoto = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ projectId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: project, error } = await supabase
      .from("projects")
      .select("id, photo_path")
      .eq("id", data.projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!project) throw new Error("Access denied — you are not a member of this project.");

    const { data: canManage } = await supabase.rpc("can_manage_project_photo", {
      _project_id: data.projectId,
      _user_id: userId,
    });

    let photoUrl: string | null = null;
    if (project.photo_path) {
      const { data: signed } = await supabase.storage
        .from(PROJECT_PHOTO_BUCKET)
        .createSignedUrl(project.photo_path, 3600);
      photoUrl = signed?.signedUrl ?? null;
    }

    return { photoUrl, photoPath: project.photo_path ?? null, canManage: canManage === true };
  });

/** Point the project at a freshly uploaded photo, removing any previous one. */
export const setProjectPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        projectId: z.string().uuid(),
        photoPath: z.string().min(1).max(500),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: canManage } = await supabase.rpc("can_manage_project_photo", {
      _project_id: data.projectId,
      _user_id: userId,
    });
    if (canManage !== true) {
      throw new Error("Only a project admin or site manager can change the project photo.");
    }
    if (!data.photoPath.startsWith(`${data.projectId}/`)) {
      throw new Error("Invalid photo path.");
    }

    // The projects UPDATE policy is project-admin only, so a verified site
    // manager writes the pointer through the admin client after the check above.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = await supabaseAdmin
      .from("projects")
      .select("photo_path")
      .eq("id", data.projectId)
      .maybeSingle();

    const { error } = await supabaseAdmin
      .from("projects")
      .update({ photo_path: data.photoPath })
      .eq("id", data.projectId);
    if (error) throw new Error(error.message);

    if (existing?.photo_path && existing.photo_path !== data.photoPath) {
      await supabaseAdmin.storage
        .from(PROJECT_PHOTO_BUCKET)
        .remove([existing.photo_path])
        .catch(() => {});
    }

    const { data: signed } = await supabase.storage
      .from(PROJECT_PHOTO_BUCKET)
      .createSignedUrl(data.photoPath, 3600);

    return { photoUrl: signed?.signedUrl ?? null, photoPath: data.photoPath };
  });
