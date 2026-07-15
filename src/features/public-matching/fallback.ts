import type {
  MatchingConfig,
  MatchingTherapy,
  MatchingWeight,
} from "./types";

export const fallbackMatchingVersionId = "73000000-0000-4000-8000-000000000001";

export const fallbackMatchingConfig: MatchingConfig = {
  source: "fallback",
  version: 1,
  versionId: fallbackMatchingVersionId,
  themes: [
    theme("000000000001", "Equilíbrio emocional", "equilibrio-emocional", 1, [
      ["000000000001", "Acolher emoções", "acolher-emocoes"],
      ["000000000002", "Equilíbrio emocional", "equilibrio-emocional-interesse"],
      ["000000000003", "Leveza na rotina", "leveza-na-rotina"],
    ]),
    theme("000000000002", "Autoestima e poder pessoal", "autoestima-poder-pessoal", 2, [
      ["000000000004", "Amor-próprio", "amor-proprio"],
      ["000000000005", "Autoconfiança", "autoconfianca"],
      ["000000000006", "Limites pessoais", "limites-pessoais"],
    ]),
    theme("000000000003", "Relacionamentos", "relacionamentos", 3, [
      ["000000000007", "Comunicação afetiva", "comunicacao-afetiva"],
      ["000000000008", "Vínculos familiares", "vinculos-familiares"],
      ["000000000009", "Relações amorosas", "relacoes-amorosas"],
    ]),
    theme("000000000004", "Espiritualidade", "espiritualidade", 4, [
      ["000000000010", "Conexão espiritual", "conexao-espiritual"],
      ["000000000011", "Intuição", "intuicao"],
      ["000000000012", "Rituais de presença", "rituais-de-presenca"],
    ]),
    theme("000000000005", "Estresse e ansiedade", "estresse-ansiedade", 5, [
      ["000000000013", "Ansiedade", "ansiedade"],
      ["000000000014", "Sobrecarga mental", "sobrecarga-mental"],
      ["000000000015", "Sono e descanso", "sono-descanso"],
    ]),
    theme("000000000006", "Mudanças de vida", "mudancas-de-vida", 6, [
      ["000000000016", "Recomeços", "recomecos-match"],
      ["000000000017", "Transições de vida", "transicoes-de-vida"],
      ["000000000018", "Medo do futuro", "medo-do-futuro"],
    ]),
    theme("000000000007", "Propósito e direção", "proposito-direcao", 7, [
      ["000000000019", "Clareza interior", "clareza-interior"],
      ["000000000020", "Escolhas profissionais", "escolhas-profissionais"],
      ["000000000021", "Propósito", "proposito"],
    ]),
    theme("000000000008", "Luto e despedidas", "luto-despedidas", 8, [
      ["000000000022", "Saudade", "saudade"],
      ["000000000023", "Encerramento de ciclos", "encerramento-de-ciclos"],
      ["000000000024", "Acolhimento do luto", "acolhimento-do-luto"],
    ]),
    theme("000000000009", "Corpo e energia", "corpo-energia", 9, [
      ["000000000025", "Relaxamento corporal", "relaxamento-corporal"],
      ["000000000026", "Energia vital", "energia-vital"],
      ["000000000027", "Sensação de sobrecarga", "sensacao-de-sobrecarga"],
    ]),
    theme("000000000010", "Criatividade e expressão", "criatividade-expressao", 10, [
      ["000000000028", "Expressar sentimentos", "expressar-sentimentos"],
      ["000000000029", "Criar novos caminhos", "criar-novos-caminhos"],
      ["000000000030", "Voz própria", "voz-propria"],
    ]),
  ],
};

export const fallbackMatchingTherapies: MatchingTherapy[] = [
  therapy("222222222221", "Terapia Integrativa", "terapia-integrativa", "Um caminho amplo para organizar sentimentos, escolhas e momentos de transição.", 2),
  therapy("222222222222", "Terapia Floral", "terapia-floral", "Uma possibilidade para quem busca apoio em equilíbrio emocional e autoconhecimento.", 2),
  therapy("222222222223", "Meditação Guiada", "meditacao-guiada", "Uma prática para cultivar presença, pausa e percepção do próprio ritmo.", 1),
  therapy("222222222225", "Reiki", "reiki", "Prática integrativa de presença e equilíbrio energético.", 1),
  therapy("222222222226", "Aromaterapia", "aromaterapia", "Uso cuidadoso de óleos essenciais em práticas de acolhimento e bem-estar.", 1),
];

export const fallbackMatchingWeights: MatchingWeight[] = [
  weight("222222222221", "000000000001", null, 5),
  weight("222222222221", "000000000006", null, 5),
  weight("222222222221", "000000000007", null, 4),
  weight("222222222222", "000000000001", null, 5),
  weight("222222222222", "000000000002", null, 4),
  weight("222222222222", "000000000008", null, 4),
  weight("222222222223", "000000000005", null, 5),
  weight("222222222223", "000000000007", null, 4),
  weight("222222222223", "000000000009", null, 4),
  weight("222222222225", "000000000009", null, 5),
  weight("222222222225", "000000000004", null, 5),
  weight("222222222225", "000000000001", null, 4),
  weight("222222222226", "000000000005", null, 5),
  weight("222222222226", "000000000009", null, 4),
  weight("222222222226", "000000000010", null, 3),
  weight("222222222221", null, "000000000001", 5),
  weight("222222222221", null, "000000000017", 5),
  weight("222222222221", null, "000000000019", 4),
  weight("222222222221", null, "000000000007", 4),
  weight("222222222222", null, "000000000004", 5),
  weight("222222222222", null, "000000000024", 4),
  weight("222222222222", null, "000000000002", 5),
  weight("222222222222", null, "000000000006", 4),
  weight("222222222223", null, "000000000013", 5),
  weight("222222222223", null, "000000000015", 5),
  weight("222222222223", null, "000000000014", 5),
  weight("222222222223", null, "000000000025", 4),
  weight("222222222225", null, "000000000026", 5),
  weight("222222222225", null, "000000000010", 5),
  weight("222222222225", null, "000000000011", 4),
  weight("222222222225", null, "000000000027", 4),
  weight("222222222226", null, "000000000015", 5),
  weight("222222222226", null, "000000000012", 4),
  weight("222222222226", null, "000000000028", 3),
  weight("222222222226", null, "000000000025", 4),
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
    interests: interests.map(([interestSuffix, interestName, interestSlug], index) => ({
      id: `72000000-0000-4000-8000-${interestSuffix}`,
      name: interestName,
      slug: interestSlug,
      sortOrder: index + 1,
      themeId: id,
    })),
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
  therapistCount: number,
): MatchingTherapy {
  return {
    description: shortDescription,
    id: `22222222-2222-4222-8222-${suffix}`,
    imageUrl: null,
    isVisibleInMatching: true,
    name,
    shortDescription,
    slug,
    status: "active",
    therapistCount,
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
