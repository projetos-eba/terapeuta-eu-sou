import {
  TherapistProfileEditorErrorState,
  TherapistProfileEditorPage,
} from "@/features/therapist-profile-editor/components/therapist-profile-editor-page";
import { getTherapistProfileEditorPage } from "@/features/therapist-profile-editor/therapist-profile-editor.queries";
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

  return <TherapistProfileEditorPage editor={result.editor} />;
}
