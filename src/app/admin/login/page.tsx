import Image from "next/image";

import { AdminLoginForm } from "@/features/admin-auth/components/admin-login-form";

export default function AdminLoginPage() {
  return (
    <main className="min-h-screen bg-surface-soft px-4 py-8 text-brand-deep sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-64px)] w-full max-w-5xl flex-col justify-center gap-8">
        <div className="flex justify-center">
          <Image
            alt="Terapeuta Eu Sou"
            height={58}
            priority
            src="/logo-oficial-terapeuta-eu-sou.png"
            width={144}
          />
        </div>
        <section className="grid overflow-hidden rounded-[24px] border border-brand-lavender bg-white shadow-float lg:grid-cols-[0.9fr_1.1fr]">
          <div className="bg-brand-deep p-8 text-white sm:p-10">
            <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-white/70">
              Operação segura
            </p>
            <h2 className="mt-8 font-display text-4xl font-light italic leading-tight sm:text-5xl">
              Catálogo, Match e serviços em uma só governança.
            </h2>
            <p className="mt-5 text-base font-semibold leading-7 text-white/80">
              Publicações, descontinuações e mudanças de disponibilidade
              registram impacto e auditoria.
            </p>
          </div>
          <div className="p-6 sm:p-10">
            <AdminLoginForm />
          </div>
        </section>
      </div>
    </main>
  );
}
