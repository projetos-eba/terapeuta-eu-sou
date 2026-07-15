import { redirect } from "next/navigation";

import { routes } from "@/lib/routes";

type SingularTherapistRedirectProps = {
  params: {
    slug: string;
  };
};

export default function SingularTherapistRedirect({
  params,
}: SingularTherapistRedirectProps) {
  redirect(routes.public.therapistProfile(params.slug));
}
