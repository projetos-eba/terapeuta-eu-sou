import { requireAdminSession } from "@/lib/auth/admin-session";
import { AdminEmailManagementList } from "@/features/admin-email-management/admin-email-management-list";

export default async function AdminEmailManagementPage() {
  await requireAdminSession({ permission: "admin.settings.read" });
  return <main className="mx-auto max-w-6xl space-y-6 p-6"><div><p className="text-sm font-bold text-brand-primary">Configurações</p><h1 className="text-3xl font-extrabold text-brand-deep">E-mails</h1><p className="mt-2 text-tesText-secondary">Perfis de envio, eventos configuráveis e histórico sanitizado.</p></div><AdminEmailManagementList /></main>;
}
