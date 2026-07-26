import { loadZoomVideoSdkEnv } from "./video-sdk-env-loader.mjs";

loadZoomVideoSdkEnv();

const responses = {
  "GET /videosdk/sessions": { sessions: [] },
  "GET /videosdk/sessions/mock-session": {
    id: "mock-session",
    status: "ended",
  },
};

console.log(
  JSON.stringify(
    {
      mode: "mock",
      realZoomCalled: false,
      responses,
    },
    null,
    2,
  ),
);
