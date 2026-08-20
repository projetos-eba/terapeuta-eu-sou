"use client";
import { useCallback, useEffect, useState } from "react";

type Detail = {
  label: string;
  description: string;
  allowedTokens: Array<{ key: string; label: string }>;
  senders: Array<{
    id: string;
    display_name: string;
    active: boolean;
    is_default: boolean;
  }>;
  setting: {
    enabled: boolean;
    automatic_dispatch_enabled: boolean;
    sender_profile_id: string | null;
    subject_override: string | null;
    preheader_override: string | null;
    text_override: string | null;
    html_override: string | null;
  } | null;
  preview: { subject: string; preheader: string; text: string; html: string };
};
export function AdminEmailEventEditor({ actionKey }: { actionKey: string }) {
  const [data, setData] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get", actionKey }),
    });
    const result = await response.json();
    if (!response.ok || !result.ok)
      setError(result.error?.message ?? "Não foi possível carregar o evento.");
    else setData(result.data);
  }, [actionKey]);
  useEffect(() => {
    void load();
  }, [load]);
  async function save(form: HTMLFormElement) {
    setSaving(true);
    setError("");
    const fields = new FormData(form);
    const response = await fetch("/api/admin/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save",
        actionKey,
        enabled: fields.get("enabled") === "on",
        automaticDispatchEnabled: fields.get("automatic") === "on",
        senderProfileId: fields.get("sender") || null,
        overrides: {
          subject: fields.get("subject"),
          preheader: fields.get("preheader"),
          text: fields.get("text"),
          html: fields.get("html"),
        },
      }),
    });
    const result = await response.json();
    setSaving(false);
    if (!response.ok || !result.ok)
      setError(result.error?.message ?? "Não foi possível salvar.");
    else setData(result.data);
  }
  if (error && !data) return <p className="p-6 text-status-danger">{error}</p>;
  if (!data) return <p className="p-6">Carregando configuração…</p>;
  const setting = data.setting;
  return (
    <form
      className="mx-auto grid max-w-6xl gap-6 p-6 lg:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        void save(event.currentTarget);
      }}
    >
      <section className="space-y-4 rounded-3xl border p-6">
        <h1 className="text-2xl font-extrabold text-brand-deep">
          {data.label}
        </h1>
        <p className="text-sm text-tesText-secondary">
          {data.description}. O destinatário é resolvido pelo evento.
        </p>
        <label className="flex gap-2">
          <input
            defaultChecked={setting?.enabled ?? true}
            name="enabled"
            type="checkbox"
          />{" "}
          Evento habilitado
        </label>
        <label className="flex gap-2">
          <input
            defaultChecked={setting?.automatic_dispatch_enabled ?? true}
            name="automatic"
            type="checkbox"
          />{" "}
          Envio automático
        </label>
        <label className="grid gap-1 text-sm font-bold">
          Perfil de envio
          <select defaultValue={setting?.sender_profile_id ?? ""} name="sender">
            <option value="">Padrão</option>
            {data.senders
              .filter((sender) => sender.active)
              .map((sender) => (
                <option key={sender.id} value={sender.id}>
                  {sender.display_name}
                  {sender.is_default ? " (padrão)" : ""}
                </option>
              ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-bold">
          Assunto
          <input
            defaultValue={setting?.subject_override ?? ""}
            name="subject"
            placeholder="Usar padrão"
          />
        </label>
        <label className="grid gap-1 text-sm font-bold">
          Preheader
          <input
            defaultValue={setting?.preheader_override ?? ""}
            name="preheader"
            placeholder="Usar padrão"
          />
        </label>
        <label className="grid gap-1 text-sm font-bold">
          Texto
          <textarea
            defaultValue={setting?.text_override ?? ""}
            name="text"
            placeholder="Usar padrão"
            rows={7}
          />
        </label>
        <label className="grid gap-1 text-sm font-bold">
          HTML
          <textarea
            defaultValue={setting?.html_override ?? ""}
            name="html"
            placeholder="Usar padrão"
            rows={9}
          />
        </label>
        <div className="flex flex-wrap gap-2">
          {data.allowedTokens.map((token) => (
            <span
              className="rounded-full bg-brand-lavenderSoft px-3 py-1 text-xs"
              key={token.key}
            >{`{{${token.key}}}`}</span>
          ))}
        </div>
        <button
          className="rounded-xl bg-brand-primary px-4 py-3 font-bold text-white"
          disabled={saving}
          type="submit"
        >
          {saving ? "Salvando…" : "Salvar configuração"}
        </button>
        {error ? <p className="text-sm text-status-danger">{error}</p> : null}
      </section>
      <section className="rounded-3xl border p-6">
        <h2 className="font-extrabold text-brand-deep">Preview seguro</h2>
        <p className="mt-2 text-sm">{data.preview.subject}</p>
        <iframe
          className="mt-4 min-h-96 w-full rounded-xl border"
          sandbox=""
          srcDoc={data.preview.html}
          title="Preview seguro do e-mail"
        />
      </section>
    </form>
  );
}
