import { notFound } from "next/navigation";
import { requireAdminSession } from "@/lib/auth/admin-session";
import { AdminEmailEventEditor } from "@/features/admin-email-management/admin-email-event-editor";

export default async function AdminEmailEventRoute({ params }: { params: Promise<{ actionKey: string }> }) { await requireAdminSession({ permission: "admin.settings.read" }); const { actionKey } = await params; if (!["therapy_catalog_request_submitted", "therapy_catalog_request_updated"].includes(actionKey)) notFound(); return <AdminEmailEventEditor actionKey={actionKey} />; }
