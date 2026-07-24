const PLACEHOLDER_SUPABASE_URL = "https://your-project-ref.supabase.co";
const PLACEHOLDER_SUPABASE_PUBLISHABLE_KEY =
  "replace-with-supabase-publishable-key";

export type SupabasePublicConfig = {
  apiKey: string;
  url: string;
};

export function getSupabasePublicConfig(): SupabasePublicConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (
    !url ||
    !publishableKey ||
    url === PLACEHOLDER_SUPABASE_URL ||
    publishableKey === PLACEHOLDER_SUPABASE_PUBLISHABLE_KEY
  ) {
    return null;
  }

  return { apiKey: publishableKey, url: url.replace(/\/$/, "") };
}
