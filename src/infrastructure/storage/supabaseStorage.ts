import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { FileStorage } from "@/core/application/ports";
import { errors } from "@/core/domain/errors";

export const FILES_BUCKET = "meeting-files";

/** Server-side Storage adapter. The bucket is private; access is only via short-lived signed URLs. */
export function createSupabaseStorage(opts: { supabaseUrl: string; serviceRoleKey?: string }): FileStorage {
  let client: SupabaseClient | undefined;
  const bucket = () => {
    if (!opts.serviceRoleKey) throw errors.notConfigured("File storage (SUPABASE_SERVICE_ROLE_KEY)");
    client ??= createClient(opts.supabaseUrl, opts.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    return client.storage.from(FILES_BUCKET);
  };

  return {
    async createUploadUrl(path) {
      const { data, error } = await bucket().createSignedUploadUrl(path);
      if (error || !data) throw new Error(`Could not create upload URL: ${error?.message}`);
      return { url: data.signedUrl, token: data.token };
    },
    async createDownloadUrl(path, expiresInSeconds) {
      const { data, error } = await bucket().createSignedUrl(path, expiresInSeconds);
      if (error || !data) throw new Error(`Could not create download URL: ${error?.message}`);
      return data.signedUrl;
    },
    async exists(path) {
      const { data, error } = await bucket().info(path);
      if (error || !data) return { exists: false };
      return { exists: true, size: typeof data.size === "number" ? data.size : undefined };
    },
    async remove(paths) {
      const { error } = await bucket().remove(paths);
      if (error) throw new Error(`Could not remove files: ${error.message}`);
    },
  };
}
