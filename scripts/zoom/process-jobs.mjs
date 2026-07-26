import { loadZoomEnv, sanitizeError } from "./env-loader.mjs";

loadZoomEnv();

const endpoint =
  process.env.ZOOM_JOBS_PROCESS_URL ??
  "http://127.0.0.1:54321/functions/v1/zoom-jobs-process";
const token = process.env.PAYMENTS_INTERNAL_OPERATIONS_TOKEN;

if (!token) {
  console.error(
    JSON.stringify({ error: "PAYMENTS_INTERNAL_OPERATIONS_TOKEN ausente" }),
  );
  process.exit(1);
}

try {
  const response = await fetch(endpoint, {
    headers: {
      "Content-Type": "application/json",
      "x-tes-internal-operations-token": token,
    },
    method: "POST",
  });
  const body = await response.json().catch(() => ({}));

  console.log(
    JSON.stringify(
      {
        body,
        httpStatus: response.status,
        status: response.ok ? "sucesso" : "falha",
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(
    JSON.stringify({ error: sanitizeError(error), status: "falha" }),
  );
  process.exit(1);
}
