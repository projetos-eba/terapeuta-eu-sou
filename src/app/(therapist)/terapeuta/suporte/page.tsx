import { redirect } from "next/navigation";

import { routes } from "@/lib/routes";

export default function TherapistSupportRedirectPage() {
  redirect(routes.therapist.messages);
}
