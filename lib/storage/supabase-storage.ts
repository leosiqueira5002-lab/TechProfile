import "server-only";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { ResumeProcessingError } from "@/features/documents/errors";

type StorageInput = {
  buffer: Buffer;
  contentType: string;
  extension: "pdf" | "docx";
  accessToken?: string;
};

export async function storeResumePrivately(input: StorageInput): Promise<boolean> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const bucket = process.env.SUPABASE_RESUME_BUCKET?.trim();

  if (!url && !anonKey && !bucket) return false;
  if (!url || !anonKey || !bucket) {
    throw new ResumeProcessingError("STORAGE_NOT_CONFIGURED");
  }
  if (!input.accessToken) throw new ResumeProcessingError("STORAGE_AUTH_REQUIRED");

  try {
    const supabase = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${input.accessToken}` } },
    });

    const { data: userData, error: authError } = await supabase.auth.getUser(input.accessToken);
    if (authError || !userData.user) throw new ResumeProcessingError("STORAGE_AUTH_REQUIRED");

    const { data: bucketDetails, error: bucketError } = await supabase.storage.getBucket(bucket);
    if (bucketError || !bucketDetails || bucketDetails.public !== false) {
      throw new ResumeProcessingError("STORAGE_FAILED");
    }

    const path = `${userData.user.id}/${randomUUID()}.${input.extension}`;
    const { error } = await supabase.storage.from(bucket).upload(path, input.buffer, {
      contentType: input.contentType,
      cacheControl: "0",
      upsert: false,
    });

    if (error) throw new ResumeProcessingError("STORAGE_FAILED");
    return true;
  } catch (error) {
    if (error instanceof ResumeProcessingError) throw error;
    throw new ResumeProcessingError("STORAGE_FAILED");
  }
}
