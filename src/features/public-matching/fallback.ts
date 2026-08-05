import type { MatchingConfig, MatchingTherapy, MatchingWeight } from "./types";

export const fallbackMatchingVersionId = "73000000-0000-4000-8000-000000000001";

export const fallbackMatchingConfig: MatchingConfig = {
  source: "fallback",
  version: 1,
  versionId: fallbackMatchingVersionId,
  themes: [
    theme("000000000001", "Emoções e Bem-Estar", "emocoes-bem-estar", 1, [
      ["000000000001", "Ansiedade", "ansiedade"],
      ["000000000002", "Estresse", "estresse"],
      ["000000000003", "Medo", "medo"],
      ["000000000004", "Tristeza", "tristeza"],
      ["000000000005", "Irritação", "irritacao"],
      ["000000000006", "Sobrecarga emocional", "sobrecarga-emocional"],
      ["000000000007", "Sensibilidade excessiva", "sensibilidade-excessiva"],
    ]),
    theme(
      "000000000002",
      "Autoconhecimento e Transformação",
      "autoconhecimento-transformacao",
      2,
      [
        ["000000000008", "Entender a si mesmo", "entender-a-si-mesmo"],
        ["000000000009", "Identificar padrões", "identificar-padroes"],
        ["000000000010", "Clareza emocional", "clareza-emocional"],
        ["000000000011", "Autoaceitação", "autoaceitacao"],
        ["000000000012", "Desenvolvimento pessoal", "desenvolvimento-pessoal"],
      ],
    ),
    theme("000000000003", "Relacionamentos", "relacionamentos", 3, [
      ["000000000013", "Conflitos familiares", "conflitos-familiares"],
      ["000000000014", "Relacionamentos amorosos", "relacionamentos-amorosos"],
      ["000000000015", "Separações", "separacoes"],
      ["000000000016", "Dependência emocional", "dependencia-emocional"],
      ["000000000017", "Perdão", "perdao"],
      ["000000000018", "Solidão", "solidao"],
      [
        "000000000019",
        "Dificuldade de impor limites",
        "dificuldade-de-impor-limites",
      ],
    ]),
    theme(
      "000000000004",
      "Autoestima e Poder Pessoal",
      "autoestima-poder-pessoal",
      4,
      [
        ["000000000020", "Fortalecer a confiança", "fortalecer-a-confianca"],
        ["000000000021", "Melhorar a autoimagem", "melhorar-a-autoimagem"],
        ["000000000022", "Trabalhar a insegurança", "trabalhar-a-inseguranca"],
        [
          "000000000023",
          "Desenvolver amor próprio",
          "desenvolver-amor-proprio",
        ],
        ["000000000024", "Superar a autocrítica", "superar-a-autocritica"],
      ],
    ),
    theme("000000000005", "Propósito e Direção", "proposito-direcao", 5, [
      ["000000000025", "Clareza de vida", "clareza-de-vida"],
      ["000000000026", "Propósito", "proposito"],
      ["000000000027", "Vocação", "vocacao"],
      ["000000000028", "Decisões importantes", "decisoes-importantes"],
      ["000000000029", "Recomeços", "recomecos"],
    ]),
    theme(
      "000000000006",
      "Espiritualidade e Conexão Interior",
      "espiritualidade",
      6,
      [
        ["000000000030", "Conexão espiritual", "conexao-espiritual"],
        ["000000000031", "Expansão de consciência", "expansao-de-consciencia"],
        ["000000000032", "Intuição", "intuicao"],
        [
          "000000000033",
          "Desenvolvimento espiritual",
          "desenvolvimento-espiritual",
        ],
        ["000000000034", "Alinhamento interior", "alinhamento-interior"],
      ],
    ),
    theme(
      "000000000007",
      "Energia e Equilíbrio Energético",
      "energia-equilibrio-energetico",
      7,
      [
        ["000000000035", "Cansaço energético", "cansaco-energetico"],
        ["000000000036", "Bloqueios energéticos", "bloqueios-energeticos"],
        ["000000000037", "Sensação de peso", "sensacao-de-peso"],
        [
          "000000000038",
          "Desequilíbrio energético",
          "desequilibrio-energetico",
        ],
        [
          "000000000039",
          "Necessidade de revitalização",
          "necessidade-de-revitalizacao",
        ],
        ["000000000040", "Proteção energética", "protecao-energetica"],
      ],
    ),
    theme("000000000008", "Libertação e Renovação", "libertacao-renovacao", 8, [
      ["000000000041", "Encerrar ciclos", "encerrar-ciclos"],
      ["000000000042", "Soltar o passado", "soltar-o-passado"],
      [
        "000000000043",
        "Liberar crenças limitantes",
        "liberar-crencas-limitantes",
      ],
      ["000000000044", "Trabalhar mágoas", "trabalhar-magoas"],
      [
        "000000000045",
        "Superar bloqueios emocionais",
        "superar-bloqueios-emocionais",
      ],
      ["000000000046", "Abrir espaço para o novo", "abrir-espaco-para-o-novo"],
    ]),
    theme(
      "000000000009",
      "Corpo, Relaxamento e Qualidade de Vida",
      "corpo-relaxamento-qualidade-vida",
      9,
      [
        ["000000000047", "Relaxamento profundo", "relaxamento-profundo"],
        ["000000000048", "Melhora do sono", "melhora-do-sono"],
        ["000000000049", "Redução de tensões", "reducao-de-tensoes"],
        ["000000000050", "Reconexão corporal", "reconexao-corporal"],
        ["000000000051", "Presença", "presenca"],
        ["000000000052", "Equilíbrio corpo-mente", "equilibrio-corpo-mente"],
      ],
    ),
    theme(
      "000000000010",
      "Vida Profissional e Prosperidade",
      "vida-profissional-prosperidade",
      10,
      [
        [
          "000000000053",
          "Prosperidade e abundância",
          "prosperidade-e-abundancia",
        ],
        ["000000000054", "Bloqueios financeiros", "bloqueios-financeiros"],
        ["000000000055", "Relação com dinheiro", "relacao-com-dinheiro"],
        ["000000000056", "Crescimento na carreira", "crescimento-na-carreira"],
        ["000000000057", "Transição profissional", "transicao-profissional"],
        ["000000000058", "Produtividade", "produtividade"],
      ],
    ),
  ],
};

export const fallbackMatchingTherapies: MatchingTherapy[] = [
  therapy(
    "222222222225",
    "Reiki",
    "reiki",
    "Prática complementar de presença e cuidado energético.",
    "/therapies/reiki-editorial.png",
    1,
    ["000000000001", "000000000007"],
  ),
  therapy(
    "222222222228",
    "Tarô",
    "taro",
    "Leitura simbólica para reflexão, escolhas e autoconhecimento.",
    "/therapies/taro-editorial.png",
    2,
    ["000000000002", "000000000003", "000000000006"],
  ),
  therapy(
    "222222222230",
    "Constelação Familiar",
    "constelacao-familiar",
    "Experiência simbólica para observar vínculos e padrões com cuidado.",
    "/therapies/constelacao-familiar-editorial.png",
    3,
    ["000000000003", "000000000002", "000000000008"],
  ),
];

export const fallbackMatchingWeights: MatchingWeight[] = [
  weight("222222222225", "000000000001", null, 4),
  weight("222222222225", "000000000007", null, 5),
  weight("222222222225", null, "000000000001", 4),
  weight("222222222225", null, "000000000002", 4),
  weight("222222222225", null, "000000000038", 5),
  weight("222222222228", "000000000002", null, 5),
  weight("222222222228", "000000000003", null, 4),
  weight("222222222228", "000000000006", null, 3),
  weight("222222222228", null, "000000000008", 5),
  weight("222222222228", null, "000000000014", 4),
  weight("222222222228", null, "000000000032", 4),
  weight("222222222230", "000000000003", null, 5),
  weight("222222222230", "000000000002", null, 4),
  weight("222222222230", "000000000008", null, 4),
  weight("222222222230", null, "000000000013", 5),
  weight("222222222230", null, "000000000009", 5),
  weight("222222222230", null, "000000000041", 4),
];

function theme(
  suffix: string,
  name: string,
  slug: string,
  sortOrder: number,
  interests: Array<[string, string, string]>,
) {
  const id = `71000000-0000-4000-8000-${suffix}`;

  return {
    description: "Escolha este tema se ele conversa com o seu momento atual.",
    id,
    imageUrl: null,
    interests: interests.map(
      ([interestSuffix, interestName, interestSlug], index) => ({
        id: `72000000-0000-4000-8000-${interestSuffix}`,
        name: interestName,
        slug: interestSlug,
        sortOrder: index + 1,
        themeId: id,
      }),
    ),
    name,
    slug,
    sortOrder,
  };
}

function therapy(
  suffix: string,
  name: string,
  slug: string,
  shortDescription: string,
  imageUrl: string,
  sortOrder: number,
  themeSuffixes: string[],
): MatchingTherapy {
  return {
    description: shortDescription,
    id: `22222222-2222-4222-8222-${suffix}`,
    imageUrl,
    isVisibleInMatching: true,
    name,
    shortDescription,
    slug,
    sortOrder,
    status: "published",
    themeIds: themeSuffixes.map(
      (themeSuffix) => `71000000-0000-4000-8000-${themeSuffix}`,
    ),
    therapistCount: sortOrder,
  };
}

function weight(
  therapySuffix: string,
  themeSuffix: string | null,
  interestSuffix: string | null,
  value: number,
): MatchingWeight {
  return {
    interestId: interestSuffix
      ? `72000000-0000-4000-8000-${interestSuffix}`
      : null,
    isActive: true,
    themeId: themeSuffix ? `71000000-0000-4000-8000-${themeSuffix}` : null,
    therapyId: `22222222-2222-4222-8222-${therapySuffix}`,
    weight: value,
  };
}
