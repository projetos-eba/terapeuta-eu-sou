import {
  loadZoomVideoSdkEnv,
  zoomVideoSdkEnvStatus,
} from "./video-sdk-env-loader.mjs";
import {
  assertStaticRealZoomGates,
  listActiveSessions,
  maskIdentifier,
  printGateFailure,
} from "./video-sdk-real-helpers.mjs";

loadZoomVideoSdkEnv();

const status = zoomVideoSdkEnvStatus();
const failures = assertStaticRealZoomGates();

if (failures.length > 0) {
  printGateFailure(failures, "npm run zoom:video-sdk:real-preflight");
  process.exit(1);
}

const sessions = await listActiveSessions();
if (!sessions.ok) {
  printGateFailure(
    [
      {
        expected: "API Zoom Video SDK acessivel com credenciais development",
        item: `Zoom API HTTP ${sessions.status}`,
        where: "Zoom Build Platform / supabase/functions/.env",
      },
    ],
    "npm run zoom:video-sdk:real-preflight",
  );
  process.exit(1);
}

const activeSessions = sessions.activeSessions ?? [];

console.log(
  JSON.stringify(
    {
      activeSessionCount: activeSessions.length,
      activeSessions: activeSessions.map((session) => ({
        id: maskIdentifier(String(session.id ?? session.session_id ?? "")),
        status: String(session.status ?? "unknown"),
      })),
      allowRealZoom: true,
      checks: status.checks,
      environment: "development",
      note: "Preflight consultou apenas a API REST Video SDK; nao entrou em sessao.",
    },
    null,
    2,
  ),
);

if (activeSessions.length > 0) process.exit(1);
