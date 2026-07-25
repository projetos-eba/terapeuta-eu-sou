import { redirect } from "next/navigation";

import { routes } from "@/lib/routes";

type SingularTherapistRedirectProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function SingularTherapistRedirect({
  params,
}: SingularTherapistRedirectProps) {
  const { slug } = await params;
  redirect(routes.public.therapistProfile(slug));
}
