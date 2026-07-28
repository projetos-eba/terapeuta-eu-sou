import { redirect } from "next/navigation";

import { routes } from "@/lib/routes";

export default function AdminHomePage() {
  redirect(routes.admin.therapies);
}
