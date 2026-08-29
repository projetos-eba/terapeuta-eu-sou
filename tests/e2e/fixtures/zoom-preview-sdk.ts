// Browser-only deterministic SDK double. It is aliased only by the local
// Playwright harness, never imported by the application or its production build.
type Participant = { userId: number; userKey: string; bVideoOn: boolean };
const listeners = new Map<string, (...args: unknown[]) => void>();
const players = new Map<HTMLElement, MediaStream>();
const role = new URLSearchParams(location.search).get("role") ?? "patient";
const localId = role === "patient" ? 7 : 9;
const remoteId = role === "patient" ? 9 : 7;
const participant = (userId: number): Participant => ({
  userId,
  userKey: userId === 7 ? "local-patient-fixture" : "local-therapist-fixture",
  bVideoOn: true,
});
const stats = {
  joins: 0,
  starts: 0,
  stops: 0,
  localAttaches: 0,
  remoteAttaches: 0,
};
export const harness = {
  identityReady: role === "therapist",
  failLocalPreview: false,
  failDetach: false,
  roster: [participant(localId), participant(remoteId)],
  stats,
  emit: (name: string, payload: unknown) => listeners.get(name)?.(payload),
};
declare global {
  interface Window {
    __zoomPreviewHarness: typeof harness;
  }
}
window.__zoomPreviewHarness = harness;

const stream = {
  startAudio: async () => "",
  muteAudio: async () => "",
  unmuteAudio: async () => "",
  stopAudio: async () => "",
  startVideo: async () => {
    stats.starts += 1;
  },
  stopVideo: async () => {
    stats.stops += 1;
    return "";
  },
  attachVideo: async (userId: number) => {
    if (userId === localId) {
      stats.localAttaches += 1;
      if (harness.failLocalPreview)
        throw { errorCode: 2, type: "INTERNAL_ERROR" };
    } else stats.remoteAttaches += 1;
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const context = canvas.getContext("2d")!;
    context.fillStyle = userId === localId ? "#6c3d91" : "#14105a";
    context.fillRect(0, 0, 320, 240);
    const media = canvas.captureStream(1);
    const element = document.createElement("video");
    element.dataset.participantId = String(userId);
    element.muted = true;
    element.autoplay = true;
    element.playsInline = true;
    element.srcObject = media;
    players.set(element, media);
    return element;
  },
  detachVideo: async (_userId: number, element: HTMLElement) => {
    players
      .get(element)
      ?.getTracks()
      .forEach((track) => track.stop());
    players.delete(element);
    if (harness.failDetach) throw { errorCode: 2, type: "INTERNAL_ERROR" };
    return element;
  },
};
const client = {
  init: async () => "",
  join: async () => {
    stats.joins += 1;
    return "";
  },
  leave: async () => "",
  getMediaStream: () => stream,
  getCurrentUserInfo: () =>
    harness.identityReady ? participant(localId) : undefined,
  getAllUser: () => harness.roster,
  getUser: (id: number) => harness.roster.find((user) => user.userId === id),
  on: (event: string, handler: (...args: unknown[]) => void) =>
    listeners.set(event, handler),
  off: (event: string) => listeners.delete(event),
};
export default {
  checkSystemRequirements: () => ({ audio: true, video: true }),
  createClient: () => client,
  destroyClient: () => {
    for (const media of players.values())
      media.getTracks().forEach((track) => track.stop());
    players.clear();
    listeners.clear();
  },
};
