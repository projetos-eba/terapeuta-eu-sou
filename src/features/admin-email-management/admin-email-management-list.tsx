"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { routes } from "@/lib/routes";
type Result = {
  actions: Array<{
    actionKey: string;
    category: string;
    label: string;
    description: string;
    setting: { enabled: boolean; automatic_dispatch_enabled: boolean } | null;
  }>;
  senders: Array<{
    id: string;
    display_name: string;
    mailbox_address: string;
    active: boolean;
    is_default: boolean;
  }>;
  logs: Array<{
    action_key: string;
    recipient_email: string;
    status: string;
    attempt_count: number;
    error_message: string | null;
    created_at: string;
  }>;
};
export function AdminEmailManagementList() {
  const [data, setData] = useState<Result | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    void (async () => {
      const response = await fetch("/api/admin/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list" }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok)
        setError(
          result.error?.message ?? "Não foi possível carregar os e-mails.",
        );
      else setData(result.data);
    })();
  }, []);
  if (error)
    return <p className="rounded-2xl border p-5 text-status-danger">{error}</p>;
  if (!data) return <p>Carregando e-mails…</p>;
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border p-6">
        <h2 className="font-extrabold text-brand-deep">Perfis de envio</h2>
        <div className="mt-4 grid gap-3">
          {data.senders.map((sender) => (
            <div
              className="flex justify-between rounded-xl bg-surface-soft p-4 text-sm"
              key={sender.id}
            >
              <span>
                {sender.display_name} · {sender.mailbox_address}
              </span>
              <span>
                {sender.active ? "Ativo" : "Inativo"}
                {sender.is_default ? " · Padrão" : ""}
              </span>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-3xl border p-6">
        <h2 className="font-extrabold text-brand-deep">Eventos de e-mail</h2>
        <div className="mt-4 grid gap-3">
          {data.actions.map((action) => (
            <Link
              className="rounded-xl border p-4"
              href={routes.admin.emailEvent(action.actionKey)}
              key={action.actionKey}
            >
              <strong>{action.label}</strong>
              <p className="mt-1 text-sm text-tesText-secondary">
                {action.description}
              </p>
              <p className="mt-2 text-xs">
                {action.setting?.enabled === false
                  ? "Desabilitado"
                  : "Habilitado"}{" "}
                ·{" "}
                {action.setting?.automatic_dispatch_enabled === false
                  ? "Manual"
                  : "Automático"}
              </p>
            </Link>
          ))}
        </div>
      </section>
      <section className="rounded-3xl border p-6">
        <h2 className="font-extrabold text-brand-deep">Histórico de envios</h2>
        <div className="mt-4 grid gap-2 text-sm">
          {data.logs.map((log, index) => (
            <div
              className="rounded-xl bg-surface-soft p-3"
              key={`${log.created_at}-${index}`}
            >
              {log.action_key} · {log.recipient_email} · {log.status} ·
              tentativa {log.attempt_count}
              {log.error_message ? ` · ${log.error_message}` : ""}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
