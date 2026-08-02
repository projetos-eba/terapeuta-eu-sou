import { resolveSender } from "../email/sender-resolver.ts";

type RestClient = {
  get<T>(path: string): Promise<T>;
};

type LegalDocumentVersionRow = {
  document_key: string;
};

type EmailActionDefinitionRow = {
  action_key: string;
};

const SIGNUP_LEGAL_DOCUMENT_KEYS = ["terms-of-use", "privacy-policy"];

export async function assertSignupDependencies(
  client: RestClient,
  input: {
    requireEmailDelivery: boolean;
  },
) {
  await assertPublishedSignupLegalDocuments(client);

  if (input.requireEmailDelivery) {
    await assertEmailVerificationConfig(client);
  }
}

async function assertPublishedSignupLegalDocuments(client: RestClient) {
  const effectiveAt = encodeURIComponent(new Date().toISOString());
  const rows = await client.get<LegalDocumentVersionRow[]>(
    `/rest/v1/legal_document_versions?select=document_key&document_key=in.(${SIGNUP_LEGAL_DOCUMENT_KEYS.join(
      ",",
    )})&status=eq.published&effective_at=lte.${effectiveAt}`,
  );
  const publishedKeys = new Set(rows.map((row) => row.document_key));
  const hasRequiredDocuments = SIGNUP_LEGAL_DOCUMENT_KEYS.every((key) =>
    publishedKeys.has(key),
  );

  if (!hasRequiredDocuments) {
    throw new SignupDependencyError("legal_documents_not_ready");
  }
}

async function assertEmailVerificationConfig(client: RestClient) {
  const definitions = await client.get<EmailActionDefinitionRow[]>(
    "/rest/v1/email_action_definitions?select=action_key&action_key=eq.email_verification&active=eq.true&limit=1",
  );

  if (!definitions[0]) {
    throw new SignupDependencyError("email_configuration_incomplete");
  }

  try {
    await resolveSender(client, "email_verification");
  } catch {
    throw new SignupDependencyError("email_configuration_incomplete");
  }
}

export class SignupDependencyError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
