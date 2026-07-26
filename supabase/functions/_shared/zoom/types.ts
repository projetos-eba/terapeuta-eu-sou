export type ZoomEnvironment = "development" | "production";

export type ZoomConfigStatus = "ausente" | "configurado" | "invalido";

export type ZoomConfig = {
  accountId: string;
  apiBaseUrl: string;
  environment: ZoomEnvironment;
  defaultHostUserId: string;
  meetingSdkClientId: string;
  meetingSdkClientSecret: string;
  s2sClientId: string;
  s2sClientSecret: string;
  webhookSecretToken: string;
};

export type ZoomAccessToken = {
  accessToken: string;
  apiBaseUrl: string;
  expiresAt: number;
  scope: string;
};

export type ZoomMeeting = {
  id: number | string;
  uuid?: string;
  host_id?: string;
  topic?: string;
  start_time?: string;
  duration?: number;
  timezone?: string;
  password?: string;
  join_url?: string;
  start_url?: string;
  created_at?: string;
  settings?: Record<string, unknown>;
};

export type ZoomMeetingAccessRole = "patient" | "therapist";

export type ZoomMeetingSdkPayload = {
  sdkKey: string;
  signature: string;
  meetingNumber: string;
  userName: string;
  userEmail?: string;
  passWord?: string;
  zak?: string;
  role: 0 | 1;
  customerKey: string;
};
