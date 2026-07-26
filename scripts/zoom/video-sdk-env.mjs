import {
  loadZoomVideoSdkEnv,
  zoomVideoSdkEnvStatus,
} from "./video-sdk-env-loader.mjs";

loadZoomVideoSdkEnv();
console.log(JSON.stringify(zoomVideoSdkEnvStatus(), null, 2));
