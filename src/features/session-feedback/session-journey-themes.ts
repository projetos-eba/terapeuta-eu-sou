export const JOURNEY_THEME_OPTIONS = [
  { key: "self_knowledge", label: "Autoconhecimento" },
  { key: "emotional_wellbeing", label: "Bem-estar emocional" },
  { key: "relationships_and_bonds", label: "Relações e vínculos" },
  { key: "communication", label: "Comunicação" },
  { key: "personal_boundaries", label: "Limites pessoais" },
  { key: "self_esteem_and_confidence", label: "Autoestima e autoconfiança" },
  { key: "routine_and_self_care", label: "Rotina e autocuidado" },
  { key: "habits_and_organization", label: "Hábitos e organização" },
  { key: "work_and_career", label: "Trabalho e carreira" },
  { key: "purpose_and_life_projects", label: "Propósito e projetos de vida" },
  { key: "family", label: "Família" },
  { key: "parenting", label: "Parentalidade" },
  { key: "partnership", label: "Vida a dois" },
  { key: "life_transitions", label: "Transições de vida" },
  { key: "body_and_presence", label: "Corpo e presença" },
  { key: "other_topic", label: "Outro tema" },
] as const;

export type JourneyThemeKey = (typeof JOURNEY_THEME_OPTIONS)[number]["key"];

export const JOURNEY_THEME_LABEL_BY_KEY = new Map(
  JOURNEY_THEME_OPTIONS.map((theme) => [theme.key, theme.label]),
);
