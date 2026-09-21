import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TherapistProfileEditableFields } from "../therapist-profile-editor.types";
import {
  ProfilePhotoUploader,
  ProfileVideoUploader,
} from "./profile-media-uploader";

const commandMocks = vi.hoisted(() => ({
  uploadTherapistProfileMedia: vi.fn(),
}));

vi.mock("../therapist-profile-editor.commands", () => commandMocks);

function makeFields(): TherapistProfileEditableFields {
  return {
    bio: "",
    bioIllustrationId: null,
    city: "",
    essenceBody: "",
    experienceYears: null,
    guideItems: [],
    headline: "",
    invitationBody: "",
    photoUrl: "",
    publicName: "Brunna P",
    publicProfileTheme: "serene",
    reflections: [],
    shortIntro: "",
    state: "",
    videoProvider: "external",
    videoThumbnailUrl: "",
    videoTitle: "",
    videoUrl: "",
  };
}

function PhotoUploaderHarness() {
  const [fields, setFields] = useState(makeFields);

  return (
    <ProfilePhotoUploader
      fields={fields}
      updateField={(key, value) =>
        setFields((current) => ({ ...current, [key]: value }))
      }
    />
  );
}

function VideoUploaderHarness() {
  const [fields, setFields] = useState(makeFields);

  return (
    <ProfileVideoUploader
      canUploadVideo
      fields={fields}
      updateField={(key, value) =>
        setFields((current) => ({ ...current, [key]: value }))
      }
    />
  );
}

describe("ProfilePhotoUploader", () => {
  beforeEach(() => {
    commandMocks.uploadTherapistProfileMedia.mockReset();
    commandMocks.uploadTherapistProfileMedia.mockReturnValue(
      new Promise(() => {}),
    );
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:profile-preview"),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows an immediate local preview while the profile photo upload is pending", () => {
    render(<PhotoUploaderHarness />);

    const file = new File(["image-content"], "brunna.webp", {
      type: "image/webp",
    });
    fireEvent.change(screen.getByLabelText("Enviar foto de perfil"), {
      target: { files: [file] },
    });

    expect(screen.getByAltText("Prévia da foto de perfil")).toHaveAttribute(
      "src",
      "blob:profile-preview",
    );
    expect(commandMocks.uploadTherapistProfileMedia).toHaveBeenCalledWith({
      file,
      kind: "photo",
    });
  });
});

describe("ProfileVideoUploader", () => {
  it("places the video title before the video preview", () => {
    render(<VideoUploaderHarness />);

    const title = screen.getByLabelText("Título do vídeo");
    const preview = screen.getByText("Adicione uma capa para o vídeo");

    expect(
      title.compareDocumentPosition(preview) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});
