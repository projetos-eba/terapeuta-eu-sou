import { renderEmailTemplate } from "./templates.ts";
import { emailActionRegistry } from "./registry.ts";

declare const Deno: {
  test(name: string, fn: () => void | Promise<void>): void;
};

Deno.test("email verification template escapes dynamic values", () => {
  const rendered = renderEmailTemplate("email_verification", {
    name: "<Ana>",
    role: "patient",
    url: "https://example.test/confirmar-email?token=abc",
  });

  assertEquals(rendered.subject, "Confirme seu e-mail para continuar no TES");
  assert(
    rendered.html.includes("Falta apenas um passo para ativar sua conta."),
  );
  assert(rendered.html.includes("&lt;Ana&gt;"));
  assert(!rendered.html.includes("<Ana>"));
  assert(rendered.text.includes("https://example.test/confirmar-email"));
});

Deno.test("every registered event renders the TES email shell from its controlled fixture", () => {
  for (const entry of Object.values(emailActionRegistry)) {
    const rendered = renderEmailTemplate(entry.actionKey, entry.previewFixture);
    assertEquals(rendered.html.includes("{{"), false);
    assert(rendered.html.includes('role="presentation"'));
    assert(
      rendered.html.includes(
        'src="https://terapeutaeusou.com.br/logo-oficial-terapeuta-eu-sou.png"',
      ),
    );
    assert(rendered.html.includes('alt="Terapeuta Eu Sou"'));
    assert(rendered.html.includes("Central de Ajuda"));
    assert(rendered.html.includes("display:none"));
  }
});

Deno.test(
  "auth defaults render the Manual preheaders and official CTAs",
  () => {
    const passwordChanged = renderEmailTemplate("password_changed", {
      recipient_name: "Ana",
      support_url: "https://example.test/ajuda",
    });
    const patientWelcome = renderEmailTemplate("patient_welcome", {
      recipient_name: "Ana",
      therapist_search_url: "https://example.test/terapeutas",
    });

    assertEquals(passwordChanged.subject, "Sua senha foi alterada com sucesso");
    assert(passwordChanged.html.includes("Sua conta foi atualizada."));
    assert(passwordChanged.html.includes("Entrar em contato com o suporte"));
    assertEquals(
      patientWelcome.subject,
      "Seja bem-vindo ao TES. Sua jornada começa agora.",
    );
    assert(patientWelcome.text.includes("Encontrar um terapeuta"));
  },
);

Deno.test("auth template rejects a missing required token", () => {
  try {
    renderEmailTemplate("registration_completed", {
      recipient_name: "Ana",
    });
    throw new Error("Expected template failure.");
  } catch (error) {
    assert(
      error instanceof Error &&
        error.message === "email_template_token_missing",
    );
  }
});

Deno.test(
  "therapist lifecycle templates keep sensitive reasons outside the email",
  () => {
    const rendered = renderEmailTemplate("therapist_documents_requested", {
      profile_edit_url: "https://example.test/terapeuta/perfil/editar",
      recipient_name: "Terapeuta",
    });

    assertEquals(
      rendered.subject,
      "Precisamos de algumas informações para continuar a análise do seu perfil",
    );
    assert(rendered.html.includes("acesse sua conta"));
    assert(!rendered.html.includes("documento enviado"));
    assert(rendered.text.includes("Enviar informações"));
  },
);

Deno.test(
  "booking templates keep participant-specific CTAs and omit cancellation reasons",
  () => {
    const patientConfirmation = renderEmailTemplate("booking_confirmed_patient", {
      counterparty_name: "Terapeuta de exemplo",
      encounter_url: "https://example.test/app/encontros/exemplo",
      meeting_date_time: "20 de agosto de 2026 às 15:00",
      meeting_timezone: "America/Sao_Paulo",
      recipient_name: "Pessoa de exemplo",
      service_title: "Terapia de exemplo",
    });
    const therapistCancellation = renderEmailTemplate(
      "booking_cancelled_therapist",
      {
        counterparty_name: "Pessoa de exemplo",
        encounter_url: "https://example.test/terapeuta/sessoes/exemplo",
        meeting_date_time: "20 de agosto de 2026 às 15:00",
        meeting_timezone: "America/Sao_Paulo",
        recipient_name: "Terapeuta de exemplo",
        service_title: "Terapia de exemplo",
      },
    );

    assertEquals(patientConfirmation.subject, "Seu encontro foi confirmado");
    assert(patientConfirmation.html.includes("Está tudo certo."));
    assert(patientConfirmation.text.includes("Ver encontro"));
    assert(therapistCancellation.text.includes("Ver sessões"));
    assert(!therapistCancellation.html.includes("motivo"));
  },
);

Deno.test("booking templates reject an unknown token", () => {
  try {
    renderEmailTemplate(
      "booking_rescheduled_patient",
      {
        counterparty_name: "Terapeuta",
        encounter_url: "https://example.test/app/encontros/exemplo",
        meeting_date_time: "20 de agosto",
        meeting_timezone: "America/Sao_Paulo",
        recipient_name: "Pessoa",
        service_title: "Terapia",
      },
      { text_override: "{{unknown}}" },
    );
    throw new Error("Expected template failure.");
  } catch (error) {
    assert(
      error instanceof Error &&
        error.message === "email_template_token_not_allowed",
    );
  }
});

Deno.test("booking templates reject an unsafe CTA", () => {
  try {
    renderEmailTemplate("booking_rescheduled_patient", {
      counterparty_name: "Terapeuta",
      encounter_url: "javascript:alert(1)",
      meeting_date_time: "20 de agosto",
      meeting_timezone: "America/Sao_Paulo",
      recipient_name: "Pessoa",
      service_title: "Terapia",
    });
    throw new Error("Expected template failure.");
  } catch (error) {
    assert(error instanceof Error && error.message === "invalid_template_url");
  }
});

Deno.test("financial templates keep authoritative payment copy and safe CTAs", () => {
  const payment = renderEmailTemplate("session_payment_approved", {
    amount: "R$ 150,00",
    payment_url: "https://example.test/app/pagamentos",
    recipient_name: "Pessoa",
    service_title: "Terapia de exemplo",
  });
  const payout = renderEmailTemplate("therapist_payout_completed", {
    amount: "R$ 120,00",
    finance_url: "https://example.test/terapeuta/financeiro",
    recipient_name: "Terapeuta",
  });

  assertEquals(payment.subject, "Pagamento confirmado com sucesso");
  assert(payment.html.includes("Recebemos seu pagamento"));
  assert(payment.text.includes("Ver detalhes"));
  assertEquals(payout.subject, "Seu repasse foi realizado");
  assert(payout.text.includes("Ver painel financeiro"));
});

Deno.test("financial templates reject unsafe or unknown values", () => {
  try {
    renderEmailTemplate(
      "session_refund_approved",
      {
        amount: "R$ 150,00",
        recipient_name: "Pessoa",
        refund_url: "https://example.test/app/pagamentos",
      },
      { subject_override: "{{stripe_secret_key}}" },
    );
    throw new Error("Expected template failure.");
  } catch (error) {
    assert(
      error instanceof Error &&
        error.message === "email_template_token_not_allowed",
    );
  }
});

Deno.test(
  "subscription templates preserve the Manual summaries and canonical CTAs",
  () => {
    const created = renderEmailTemplate("therapist_subscription_created", {
      date: "20 de agosto de 2026",
      next_renewal_date: "20 de setembro de 2026",
      plan_name: "Premium",
      recipient_name: "Terapeuta",
      subscription_url:
        "https://example.test/terapeuta/configuracoes#plano-assinatura",
    });
    const renewed = renderEmailTemplate("therapist_subscription_renewed", {
      date: "20 de agosto de 2026",
      next_renewal_date: "20 de setembro de 2026",
      plan_name: "Premium",
      recipient_name: "Terapeuta",
      subscription_url:
        "https://example.test/terapeuta/configuracoes#plano-assinatura",
    });
    const cancelled = renderEmailTemplate(
      "therapist_subscription_cancelled",
      {
        account_status: "Plano Free",
        date: "20 de agosto de 2026",
        plan_name: "Premium",
        recipient_name: "Terapeuta",
        subscription_url:
          "https://example.test/terapeuta/configuracoes#plano-assinatura",
      },
    );
    const planChanged = renderEmailTemplate(
      "therapist_subscription_plan_changed",
      {
        date: "20 de agosto de 2026",
        new_plan_name: "Premium Plus",
        next_renewal_date: "20 de setembro de 2026",
        recipient_name: "Terapeuta",
        subscription_url:
          "https://example.test/terapeuta/configuracoes#plano-assinatura",
      },
    );

    assertEquals(created.subject, "Sua assinatura está ativa");
    assert(created.html.includes("Resumo da assinatura"));
    assert(created.text.includes("Gerenciar assinatura"));
    assertEquals(renewed.subject, "Sua assinatura foi renovada com sucesso");
    assert(renewed.text.includes("Próxima renovação prevista"));
    assertEquals(cancelled.subject, "Sua assinatura foi cancelada");
    assert(cancelled.html.includes("Status atual: Plano Free"));
    assertEquals(planChanged.subject, "Seu plano foi atualizado");
    assert(planChanged.text.includes("Novo plano: Premium Plus"));
  },
);

Deno.test("subscription templates reject unknown tokens", () => {
  try {
    renderEmailTemplate(
      "therapist_subscription_created",
      {
        date: "20 de agosto de 2026",
        next_renewal_date: "20 de setembro de 2026",
        plan_name: "Premium",
        recipient_name: "Terapeuta",
        subscription_url:
          "https://example.test/terapeuta/configuracoes#plano-assinatura",
      },
      { subject_override: "{{stripe_secret_key}}" },
    );
    throw new Error("Expected template failure.");
  } catch (error) {
    assert(
      error instanceof Error &&
        error.message === "email_template_token_not_allowed",
    );
  }
});

Deno.test("password reset template rejects unsafe URLs", () => {
  try {
    renderEmailTemplate("password_reset", {
      url: "javascript:alert(1)",
    });
    throw new Error("Expected template failure.");
  } catch (error) {
    assert(error instanceof Error);
    if (error instanceof Error) {
      assert(error.message === "invalid_template_url");
    }
  }
});

Deno.test(
  "catalog overrides use only the event allowlist and escape values",
  () => {
    const rendered = renderEmailTemplate(
      "therapy_catalog_request_submitted",
      {
        name: "<Pessoa>",
        requestName: "Pedido",
        url: "https://example.test/request",
      },
      {
        subject_override: "Atualização {{request_name}}",
        html_override: "<p>{{recipient_name}}</p><script>alert(1)</script>",
      },
    );
    assert(rendered.subject === "Atualização Pedido");
    assert(rendered.html.includes("&lt;Pessoa&gt;"));
    assert(!rendered.html.includes("script"));
  },
);

Deno.test("catalog overrides fail closed for unknown tokens", () => {
  try {
    renderEmailTemplate(
      "therapy_catalog_request_submitted",
      { url: "https://example.test" },
      { text_override: "{{unknown}}" },
    );
    throw new Error("Expected template failure.");
  } catch (error) {
    assert(
      error instanceof Error &&
        error.message === "email_template_token_not_allowed",
    );
  }
});

function assert(value: unknown) {
  if (!value) {
    throw new Error("Assertion failed.");
  }
}

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) {
    throw new Error(
      `Expected ${String(expected)}, received ${String(actual)}.`,
    );
  }
}
