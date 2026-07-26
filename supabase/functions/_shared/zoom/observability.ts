export function logZoomOperation(
  level: "error" | "info" | "warn",
  fields: Record<string, unknown>,
) {
  const safe = {
    ...fields,
    code: fields.code ?? "ZOOM_OPERATION",
    provider: "zoom",
  };
  const line = JSON.stringify(safe);

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}
