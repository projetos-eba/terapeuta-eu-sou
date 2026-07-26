import { loadZoomEnv, zoomEnvStatus } from "./env-loader.mjs";

loadZoomEnv();

const status = zoomEnvStatus();

console.log(JSON.stringify(status, null, 2));

if (
  Object.values(status.variables).some(
    (value) => value === "ausente" || value === "invalido",
  )
) {
  process.exitCode = 1;
}
