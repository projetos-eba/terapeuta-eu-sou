import { TherapistProfileEditorErrorState } from "@/features/therapist-profile-editor/components/therapist-profile-editor-page";
import {
  TherapistProfileOverviewPage,
  type TherapistProfilePublishedPreview,
} from "@/features/therapist-profile-editor/components/therapist-profile-overview-page";
import { getTherapistProfileEditorPage } from "@/features/therapist-profile-editor/therapist-profile-editor.queries";
import type { TherapistProfileEditorData } from "@/features/therapist-profile-editor/therapist-profile-editor.types";
import { getPublicTherapistProfileResult } from "@/features/therapist-profile/queries/public-profile";
import { therapistRoutePolicies } from "@/features/therapist-shell";
import { requireTherapistSession } from "@/lib/auth/therapist-session";

export default async function TherapistProfilePage() {
  const session = await requireTherapistSession(therapistRoutePolicies.profile);
  const result = await getTherapistProfileEditorPage({
    accessToken: session.accessToken,
  });

  if (result.status === "error") {
    return (
      <TherapistProfileEditorErrorState
        message={result.message}
        requestId={result.requestId}
      />
    );
  }

  const publishedPreview = await getPublishedPreview(result.editor);

  return (
    <TherapistProfileOverviewPage
      editor={result.editor}
      publishedPreview={publishedPreview}
    />
  );
}

async function getPublishedPreview(
  editor: TherapistProfileEditorData,
): Promise<TherapistProfilePublishedPreview> {
  if (
    editor.derived.publicStatus !== "published" ||
    !editor.publicProfileSlug.trim()
  ) {
    return { status: "not_published" };
  }

  const publicResult = await getPublicTherapistProfileResult(
    editor.publicProfileSlug,
    { fresh: true },
  );

  if (publicResult.status === "success") {
    return { data: publicResult.data, status: "success" };
  }

  if (publicResult.status === "not_found") {
    return { status: "not_found" };
  }

  return { status: "unavailable" };
}
