import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ZoomVideoSessionAdapter } from "../../../src/features/zoom/zoom-video-session-adapter";
import "../../../src/app/globals.css";
import "./zoom-preview-sdk";

const actorRole =
  new URLSearchParams(location.search).get("role") === "therapist"
    ? "therapist"
    : "patient";
const now = Date.now();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ZoomVideoSessionAdapter
      access={{
        allowed: true,
        availableFrom: new Date(now - 60_000).toISOString(),
        availableUntil: new Date(now + 3_600_000).toISOString(),
        reason: null,
        videoSessionStatus: "ready",
      }}
      actorRole={actorRole}
      bookingId="96000000-0000-4000-8000-000000000001"
      participantLabel={actorRole === "patient" ? "Terapeuta" : "Paciente"}
    />
  </StrictMode>,
);
