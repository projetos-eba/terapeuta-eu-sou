import {
  assertRealZoomAllowed,
  loadZoomVideoSdkEnv,
  zoomVideoSdkEnvStatus,
} from "./video-sdk-env-loader.mjs";

loadZoomVideoSdkEnv();

const status = zoomVideoSdkEnvStatus();
const allowed = assertRealZoomAllowed();

console.log(
  JSON.stringify(
    {
      allowRealZoom: allowed,
      checks: status.checks,
      note: "Preflight nao executa API real nem entra em sessao.",
    },
    null,
    2,
  ),
);
