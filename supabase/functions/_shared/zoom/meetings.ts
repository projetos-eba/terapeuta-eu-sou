import { ZoomRestClient } from "./client.ts";
import type { ZoomConfig, ZoomMeeting } from "./types.ts";

export type CreateZoomMeetingInput = {
  durationMinutes: number;
  hostUserId?: string;
  passcode: string;
  startTime: string;
  timezone: string;
  topic: string;
};

export async function createZoomMeeting(
  config: ZoomConfig,
  input: CreateZoomMeetingInput,
) {
  const client = new ZoomRestClient(config);
  const hostUserId = encodeURIComponent(
    input.hostUserId ?? config.defaultHostUserId,
  );

  return client.request<ZoomMeeting>(`/users/${hostUserId}/meetings`, {
    body: {
      duration: input.durationMinutes,
      password: input.passcode,
      settings: {
        approval_type: 2,
        audio: "both",
        auto_recording: "none",
        join_before_host: false,
        mute_upon_entry: true,
        participant_video: true,
        waiting_room: true,
      },
      start_time: input.startTime,
      timezone: input.timezone,
      topic: input.topic,
      type: 2,
    },
    method: "POST",
  });
}

export async function getZoomMeeting(config: ZoomConfig, meetingId: string) {
  return new ZoomRestClient(config).request<ZoomMeeting>(
    `/meetings/${encodeURIComponent(meetingId)}`,
  );
}

export async function updateZoomMeeting(
  config: ZoomConfig,
  meetingId: string,
  input: Omit<CreateZoomMeetingInput, "passcode">,
) {
  await new ZoomRestClient(config).request<void>(
    `/meetings/${encodeURIComponent(meetingId)}`,
    {
      body: {
        duration: input.durationMinutes,
        start_time: input.startTime,
        timezone: input.timezone,
        topic: input.topic,
      },
      method: "PATCH",
    },
  );
}

export async function deleteZoomMeeting(config: ZoomConfig, meetingId: string) {
  await new ZoomRestClient(config).request<void>(
    `/meetings/${encodeURIComponent(meetingId)}`,
    { method: "DELETE" },
  );
}

export function buildSanitizedTopic(bookingId: string) {
  return `Sessao Terapeuta Eu Sou - ${bookingId.replace(/-/g, "").slice(0, 10)}`;
}

export function generateMeetingPasscode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));

  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("");
}
