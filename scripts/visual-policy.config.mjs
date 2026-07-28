export const visualPolicyConfig = {
  excludedPathPatterns: [
    /^\.next\//,
    /^coverage\//,
    /^node_modules\//,
    /^public\//,
    /^Referencias\//,
    /^src\/lib\/supabase\/database\.types\.ts$/,
    /\.test\./,
    /\.spec\./,
    /\.snap$/,
    /\.png$/,
    /\.jpe?g$/,
    /\.webp$/,
    /\.svg$/,
  ],
  fileExtensions: [".css", ".html", ".ts", ".tsx"],
  hardcodedHexAllowlist: [
    {
      pathPattern: /^src\/app\/globals\.css$/,
      reason: "Definição central dos CSS Variables TES.",
    },
    {
      pathPattern: /^docs\//,
      reason: "Documentação pode citar valores dos tokens e auditorias.",
    },
    {
      pathPattern: /^supabase\/functions\/_shared\/email\/templates\.ts$/,
      reason:
        "Templates HTML de e-mail precisam de estilos inline; migração para helper de tokens fica rastreada.",
    },
    {
      pathPattern: /^src\/features\/therapist-dashboard\//,
      reason:
        "Dashboard operacional legado com gráficos e indicadores; saneamento dedicado pendente.",
    },
    {
      pathPattern: /^src\/features\/therapist-journey-history\//,
      reason:
        "Histórico da jornada legado com hierarquia densa; saneamento dedicado pendente.",
    },
    {
      pathPattern:
        /^src\/features\/therapist-dashboard\/components\/therapist-week-chart\.tsx$/,
      reason: "Visualização de dados SVG controlada.",
    },
    {
      pathPattern:
        /^src\/features\/therapist-dashboard\/components\/therapist-week-summary\.tsx$/,
      reason: "Legenda de visualização de dados controlada.",
    },
    {
      pathPattern:
        /^src\/features\/therapies\/components\/detail\/therapy-visual-theme\.ts$/,
      reason: "Mapa semântico de temas editoriais de terapias.",
    },
    {
      pathPattern:
        /^src\/features\/therapist-agenda\/components\/therapist-calendar\.tsx$/,
      reason:
        "Mapa visual semântico do calendário e heatmap; pendente mapear todas as cores para tokens/component tokens.",
    },
    {
      pathPattern: /^src\/app\/page\.tsx$/,
      reason:
        "Home pública legada com hero e temas editoriais; saneamento dedicado pendente.",
    },
    {
      pathPattern: /^src\/app\/sua-jornada\//,
      reason:
        "Match público legado com tema visual próprio; saneamento dedicado pendente.",
    },
    {
      pathPattern: /^src\/features\/public-matching\//,
      reason:
        "Match público legado com tema visual próprio; saneamento dedicado pendente.",
    },
    {
      pathPattern: /^src\/app\/terapias\//,
      reason:
        "Catálogo/detalhe de terapias legado; saneamento dedicado pendente.",
    },
    {
      pathPattern: /^src\/features\/therapies\//,
      reason:
        "Componentes editoriais de terapias legados; saneamento dedicado pendente.",
    },
    {
      pathPattern: /^src\/features\/for-therapists\//,
      reason:
        "Landing de terapeutas legada com gráficos editoriais; saneamento dedicado pendente.",
    },
    {
      pathPattern: /^src\/features\/patient-overview\//,
      reason:
        "Shell do paciente legado; saneamento tipográfico dedicado pendente.",
    },
    {
      pathPattern: /^src\/features\/patient-encounters\//,
      reason:
        "Shell do paciente legado; saneamento tipográfico dedicado pendente.",
    },
  ],
  minFontSizeAllowlist: [
    {
      pathPattern:
        /^src\/features\/therapist-agenda\/components\/therapist-calendar\.tsx$/,
      reason:
        "Calendário denso legado; deve ser reorganizado em fase própria antes de remover microtexto.",
    },
    {
      pathPattern: /^src\/app\/\(therapist\)\/terapeuta\/sessoes\/page\.tsx$/,
      reason: "Tabela operacional densa legada; saneamento dedicado pendente.",
    },
    {
      pathPattern: /^src\/features\/patient-overview\//,
      reason:
        "Shell do paciente legado; saneamento tipográfico dedicado pendente.",
    },
    {
      pathPattern: /^src\/features\/patient-encounters\//,
      reason:
        "Shell do paciente legado; saneamento tipográfico dedicado pendente.",
    },
    {
      pathPattern: /^src\/features\/therapist-dashboard\//,
      reason:
        "Dashboard legado com metadados densos; saneamento dedicado pendente.",
    },
    {
      pathPattern: /^src\/features\/therapist-blocks\//,
      reason: "Painel operacional denso legado; saneamento dedicado pendente.",
    },
    {
      pathPattern: /^src\/features\/therapist-journey-history\//,
      reason:
        "Histórico da jornada legado com hierarquia densa; saneamento dedicado pendente.",
    },
    {
      pathPattern: /^src\/features\/for-therapists\//,
      reason: "Landing de terapeutas legada; saneamento dedicado pendente.",
    },
  ],
};
