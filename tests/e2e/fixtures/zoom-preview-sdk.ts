// Browser-only deterministic SDK double. It is aliased only by the local
// Playwright harness, never imported by the application or its production build.
type Participant = { userId: number; userKey: string; bVideoOn: boolean };
const listeners = new Map<string, (...args: unknown[]) => void>();
const players = new Map<HTMLElement, MediaStream>();
const searchParams = new URLSearchParams(location.search);
const role = searchParams.get("role") ?? "patient";
const isAbruptReentry = searchParams.get("abruptReentry") === "1";
const hasDelayedCapture = searchParams.get("delayedCapture") === "1";
const hasDelayedBinding = searchParams.get("delayedBinding") === "1";
const localId = role === "patient" ? (isAbruptReentry ? 17 : 7) : 9;
const remoteId = role === "patient" ? 9 : 7;
const participant = (userId: number, bVideoOn = true): Participant => ({
  userId,
  userKey:
    userId === 7 || userId === 17
      ? "local-patient-fixture"
      : "local-therapist-fixture",
  bVideoOn,
});
const stats = {
  joins: 0,
  starts: 0,
  stops: 0,
  localAttaches: 0,
  remoteAttaches: 0,
};
export const harness = {
  captureReady: !hasDelayedCapture,
  identityReady: role === "therapist" || isAbruptReentry,
  providerVideoReady: !hasDelayedBinding,
  failLocalPreview: false,
  failDetach: false,
  roster:
    role === "patient" && isAbruptReentry
      ? [
          participant(7),
          participant(localId, !hasDelayedBinding),
          participant(remoteId),
        ]
      : [participant(localId, !hasDelayedBinding), participant(remoteId)],
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
    if (hasDelayedCapture) {
      window.setTimeout(() => {
        harness.captureReady = true;
        listeners.get("video-capturing-change")?.({ state: "Started" });
      }, 1_700);
    }
    if (hasDelayedBinding) {
      window.setTimeout(() => {
        harness.providerVideoReady = true;
        const current = harness.roster.find((user) => user.userId === localId);
        if (current) current.bVideoOn = true;
        listeners.get("user-updated")?.([
          current ?? participant(localId, true),
        ]);
      }, 700);
    }
  },
  stopVideo: async () => {
    stats.stops += 1;
    return "";
  },
  attachVideo: async (
    userId: number,
    _quality?: number,
    persistentPlayer?: HTMLElement,
  ) => {
    if (userId === localId) {
      stats.localAttaches += 1;
      if (
        harness.failLocalPreview ||
        !harness.captureReady ||
        !harness.providerVideoReady
      )
        throw { errorCode: 2, type: "INTERNAL_ERROR" };
      if (!persistentPlayer) throw new Error("persistent player required");
      if (hasDelayedBinding) {
        window.setTimeout(() => {
          persistentPlayer.setAttribute("node-id", String(userId));
        }, 900);
      } else {
        persistentPlayer.setAttribute("node-id", String(userId));
      }
      return persistentPlayer;
    } else stats.remoteAttaches += 1;
    const canvas = document.createElement("canvas");
    canvas.width = 320;
    canvas.height = 240;
    const context = canvas.getContext("2d")!;
    context.fillStyle = userId === localId ? "#6c3d91" : "#14105a";
    context.fillRect(0, 0, 320, 240);
    const media =
      typeof canvas.captureStream === "function"
        ? canvas.captureStream(1)
        : null;
    const element = document.createElement("video");
    element.dataset.participantId = String(userId);
    element.muted = true;
    element.autoplay = true;
    element.playsInline = true;
    if (media) {
      element.srcObject = media;
      players.set(element, media);
    }
    return element;
  },
  detachVideo: async (_userId: number, element: HTMLElement) => {
    players
      .get(element)
      ?.getTracks()
      .forEach((track) => track.stop());
    players.delete(element);
    if (harness.failDetach) throw { errorCode: 2, type: "INTERNAL_ERROR" };
    if (element.localName === "video-player") {
      element.setAttribute("node-id", "0");
    }
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
    harness.identityReady
      ? harness.roster.find((user) => user.userId === localId)
      : undefined,
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
