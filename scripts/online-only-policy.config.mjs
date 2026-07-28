export const onlineOnlyPolicyConfig = {
  excludedPathPatterns: [
    /^\.next\//,
    /^coverage\//,
    /^node_modules\//,
    /^src\/lib\/supabase\/database\.types\.ts$/,
    /^supabase\/migrations\/202607\d+_.*\.sql$/,
    /\.test\./,
    /\.spec\./,
    /\.snap$/,
  ],
  fileExtensions: [".md", ".sql", ".ts", ".tsx"],
  allowedPathPatterns: [
    {
      pathPattern: /^AGENTS\.md$/,
      reason: "Fonte de verdade pode documentar termos fora do escopo.",
    },
    {
      pathPattern:
        /^docs\/architecture\/adr\/ADR-009-online-only-delivery-policy\.md$/,
      reason: "ADR registra termos legados e regra online-only.",
    },
    {
      pathPattern: /^docs\/architecture\/agenda-sessions-preparation\.md$/,
      reason: "Documento historico registra a origem da divergencia.",
    },
    {
      pathPattern: /^docs\/architecture\/relatorio-25-07-2026\.md$/,
      reason: "Relatorio historico preserva contratos analisados na epoca.",
    },
    {
      pathPattern: /^docs\/product\/glossary\.md$/,
      reason: "Glossario pode citar termos proibidos como legado.",
    },
    {
      pathPattern: /^scripts\/online-only-policy\.config\.mjs$/,
      reason: "A propria politica lista termos bloqueados.",
    },
    {
      pathPattern: /^scripts\/validate-online-only-policy\.mjs$/,
      reason: "O validador precisa listar os termos bloqueados.",
    },
    {
      pathPattern: /^supabase\/tests\/009_therapy_service_foundation\.sql$/,
      reason: "pgTAP cobre rejeicao explicita de formatos legados.",
    },
  ],
  blockedPatterns: [
    {
      pattern: /\bPresencial\b|\bpresencial\b/g,
      type: "copy presencial fora da allowlist",
    },
    {
      pattern: /\bH[ií]brido\b|\bh[ií]brido\b/g,
      type: "copy hibrida fora da allowlist",
    },
    {
      pattern: /\bin_person\b/g,
      type: "valor tecnico in_person fora da allowlist",
    },
    {
      pattern: /\bhybrid\b/g,
      type: "valor tecnico hybrid fora da allowlist",
    },
    {
      pattern: /Online ou presencial/g,
      type: "copy de escolha de formato fora da allowlist",
    },
  ],
};
