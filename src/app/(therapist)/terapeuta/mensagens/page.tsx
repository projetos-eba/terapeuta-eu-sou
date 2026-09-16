import { permanentRedirect } from "next/navigation";

import { routes } from "@/lib/routes";

export default function TherapistMessagesPage() {
  permanentRedirect(routes.therapist.support);
}
