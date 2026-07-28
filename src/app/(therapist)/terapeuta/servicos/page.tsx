import {
  TherapistServicesErrorState,
  TherapistServicesPage,
} from "@/features/therapist-services/components/therapist-services-page";
import { getTherapistServicesPage } from "@/features/therapist-services/therapist-services.queries";
import { therapistRoutePolicies } from "@/features/therapist-shell";
import { requireTherapistSession } from "@/lib/auth/therapist-session";

export default async function TherapistServicesRoutePage() {
  const session = await requireTherapistSession(
    therapistRoutePolicies.services,
  );
  const result = await getTherapistServicesPage({
    accessToken: session.accessToken,
  });

  if (result.status === "error") {
    return (
      <TherapistServicesErrorState
        message={result.message}
        requestId={result.requestId}
      />
    );
  }

  return (
    <TherapistServicesPage
      catalog={result.catalog}
      services={result.services}
    />
  );
}
