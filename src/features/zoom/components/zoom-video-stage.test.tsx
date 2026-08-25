import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ZoomVideoStage } from "./zoom-video-stage";

describe("ZoomVideoStage", () => {
  it("uses the supplied covers while local camera and remote video are unavailable", () => {
    render(
      <ZoomVideoStage
        actorRole="patient"
        audioMuted
        localVideoRef={{ current: null }}
        participantLabel="Com Juliane Moore"
        remoteParticipantPresent={false}
        remoteVideoState="off"
        remoteVideoRef={{ current: null }}
        state="joined"
        videoOn={false}
      />,
    );

    const sources = screen
      .getAllByAltText("")
      .map((image) => decodeURIComponent(image.getAttribute("src") ?? ""));

    expect(sources).toContainEqual(
      expect.stringContaining("/zoom/local-camera-off-cover.png"),
    );
    expect(sources).toContainEqual(
      expect.stringContaining("/zoom/remote-waiting-cover.png"),
    );
    expect(screen.getByText("Sua câmera está")).toBeVisible();
    expect(screen.getByText("terapeuta entrar")).toBeVisible();
  });

  it("offers explicit recovery when a remote camera cannot be attached", () => {
    render(
      <ZoomVideoStage
        actorRole="patient"
        audioMuted
        localVideoRef={{ current: null }}
        onRetryRemoteVideo={() => undefined}
        participantLabel="Com Juliane Moore"
        remoteParticipantPresent
        remoteVideoRef={{ current: null }}
        remoteVideoState="error"
        state="joined"
        videoOn={false}
      />,
    );

    expect(screen.getByText("Não foi possível exibir o vídeo")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Tentar exibir novamente" }),
    ).toBeVisible();
  });
});
