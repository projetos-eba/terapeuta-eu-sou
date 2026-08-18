import type { CSSProperties } from "react";

import type { BioIllustrationId, PublicProfileThemeId } from "./types";

type ThemeStyle = CSSProperties & {
  "--profile-accent": string;
  "--profile-hero-background": string;
  "--profile-shape": string;
};

export type PublicProfileThemeDefinition = {
  description: string;
  id: PublicProfileThemeId;
  label: string;
  palette: string[];
  style: ThemeStyle;
};

export const publicProfileThemes: PublicProfileThemeDefinition[] = [
  {
    description: "Lavanda e ciano em uma composição leve e acolhedora.",
    id: "serene",
    label: "Sereno",
    palette: ["bg-brand-lavenderSoft", "bg-brand-cyan", "bg-white"],
    style: {
      "--profile-accent": "var(--tes-color-brand-cyan)",
      "--profile-hero-background":
        "linear-gradient(105deg,var(--tes-color-surface-default) 0%,var(--tes-color-brand-lavender-soft) 64%,var(--tes-color-brand-cyan-soft) 100%)",
      "--profile-shape": "var(--tes-color-brand-lavender)",
    },
  },
  {
    description: "Mint e superfícies claras com presença orgânica.",
    id: "natural",
    label: "Natural",
    palette: ["bg-brand-mint", "bg-status-successBg", "bg-white"],
    style: {
      "--profile-accent": "var(--tes-color-status-success)",
      "--profile-hero-background":
        "linear-gradient(120deg,var(--tes-color-surface-default) 0%,var(--tes-color-status-success-bg) 72%,var(--tes-color-brand-mint) 100%)",
      "--profile-shape": "var(--tes-color-brand-mint)",
    },
  },
  {
    description: "Neutros quentes suaves e curvas delicadas.",
    id: "warm",
    label: "Acolhedor",
    palette: ["bg-status-warningBg", "bg-brand-lavender", "bg-white"],
    style: {
      "--profile-accent": "var(--tes-color-status-warning)",
      "--profile-hero-background":
        "linear-gradient(115deg,var(--tes-color-surface-default) 0%,var(--tes-color-status-warning-bg) 76%,var(--tes-color-brand-lavender-soft) 100%)",
      "--profile-shape": "var(--tes-color-status-warning-bg)",
    },
  },
  {
    description: "Branco, mist e roxo em uma composição editorial.",
    id: "essential",
    label: "Essencial",
    palette: ["bg-white", "bg-surface-mist", "bg-brand-primary"],
    style: {
      "--profile-accent": "var(--tes-color-brand-primary)",
      "--profile-hero-background":
        "linear-gradient(90deg,var(--tes-color-surface-default) 0%,var(--tes-color-surface-mist) 100%)",
      "--profile-shape": "var(--tes-color-brand-lavender-soft)",
    },
  },
];

export const publicProfileThemeById = Object.fromEntries(
  publicProfileThemes.map((theme) => [theme.id, theme]),
) as Record<PublicProfileThemeId, PublicProfileThemeDefinition>;

export type BioIllustrationDefinition = {
  alt: string;
  description: string;
  id: BioIllustrationId;
  label: string;
  src: string;
};

export const bioIllustrations: BioIllustrationDefinition[] = [
  {
    alt: "Formas fluidas em lavanda e ciano que se encontram suavemente.",
    description: "Movimento leve para acompanhar uma apresentação sensível.",
    id: "organic_flow",
    label: "Fluxo orgânico",
    src: "/therapists/profile-bio/organic-flow.svg",
  },
  {
    alt: "Horizonte abstrato em camadas claras de mint, ciano e lavanda.",
    description: "Uma paisagem abstrata de calma e abertura.",
    id: "gentle_horizon",
    label: "Horizonte suave",
    src: "/therapists/profile-bio/gentle-horizon.svg",
  },
  {
    alt: "Camadas curvas em tons quentes suaves e lavanda.",
    description: "Curvas acolhedoras para uma presença mais calorosa.",
    id: "warm_layers",
    label: "Camadas acolhedoras",
    src: "/therapists/profile-bio/warm-layers.svg",
  },
  {
    alt: "Linhas essenciais em roxo formando uma composição editorial abstrata.",
    description: "Traços precisos para uma apresentação essencial.",
    id: "essential_lines",
    label: "Linhas essenciais",
    src: "/therapists/profile-bio/essential-lines.svg",
  },
];

export const bioIllustrationById = Object.fromEntries(
  bioIllustrations.map((illustration) => [illustration.id, illustration]),
) as Record<BioIllustrationId, BioIllustrationDefinition>;
