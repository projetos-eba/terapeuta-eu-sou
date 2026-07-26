import { loadZoomVideoSdkEnv } from "./video-sdk-env-loader.mjs";
import {
  assertStaticRealZoomGates,
  endSessionByApi,
  listActiveSessions,
  maskIdentifier,
  printGateFailure,
} from "./video-sdk-real-helpers.mjs";
import {
  clearProviderSessionState,
  readRealState,
} from "./video-sdk-real-state.mjs";

loadZoomVideoSdkEnv();

const failures = assertStaticRealZoomGates();
if (failures.length > 0) {
  printGateFailure(failures, "npm run zoom:video-sdk:emergency-end");
  process.exit(1);
}

const state = await readRealState();
let providerSessionId = state.activeRun?.providerSessionId;
if (!providerSessionId && process.argv.includes("--active-singleton")) {
  const sessions = await listActiveSessions();
  if (!sessions.ok) {
    fail({
      blocked: true,
      message: "Nao foi possivel consultar sessoes ativas.",
      status: sessions.status,
    });
  } else {
    const activeSessions = sessions.activeSessions ?? [];
    if (activeSessions.length === 1) {
      providerSessionId = String(
        activeSessions[0].id ?? activeSessions[0].session_id ?? "",
      );
    } else {
      fail({
        activeSessionCount: activeSessions.length,
        blocked: true,
        message:
          "Encerramento por singleton exige exatamente uma sessao ativa.",
      });
    }
  }
}

if (!providerSessionId && !process.exitCode) {
  fail({
    blocked: true,
    message:
      "Nenhuma sessao real capturada no estado temporario. Use --active-singleton somente se o preflight mostrar exatamente uma sessao ativa.",
  });
}

if (providerSessionId) {
  const response = await endSessionByApi(providerSessionId);
  const ended = await waitUntilEnded(providerSessionId);
  if (!ended) {
    fail({
      message: "Nao foi possivel comprovar encerramento pela API Zoom.",
      sessionId: maskIdentifier(providerSessionId),
      status: response.status,
    });
  } else {
    await clearProviderSessionState({
      requestId: state.activeRun?.requestId,
    });

    console.log(
      JSON.stringify(
        {
          ended: true,
          sessionId: maskIdentifier(providerSessionId),
          status: response.status,
        },
        null,
        2,
      ),
    );
  }
}

function fail(payload) {
  console.error(JSON.stringify(payload, null, 2));
  process.exitCode = 1;
}

async function waitUntilEnded(sessionId) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const sessions = await listActiveSessions();
    if (!sessions.ok) return false;
    const stillOpen = (sessions.activeSessions ?? []).some(
      (session) => String(session.id ?? session.session_id ?? "") === sessionId,
    );
    if (!stillOpen) return true;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  return false;
}
