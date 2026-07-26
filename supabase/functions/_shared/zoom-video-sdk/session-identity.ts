import { sha256Hex } from "./crypto.ts";

export async function createVideoUserKey(input: {
  bookingId: string;
  profileId: string;
  role: "patient" | "therapist";
}) {
  const rolePrefix = input.role === "therapist" ? "t" : "p";
  const digest = await sha256Hex(
    `video-user:${input.bookingId}:${input.profileId}:${input.role}`,
  );

  return `tes-v1-${rolePrefix}-${digest.slice(0, 24)}`;
}

export function sanitizeVideoDisplayName(value: string | null | undefined) {
  const normalized = (value ?? "Participante TES")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);

  return normalized || "Participante TES";
}
