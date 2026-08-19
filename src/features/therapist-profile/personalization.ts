import type { CSSProperties } from "react";

import type { BioIllustrationId, PublicProfileThemeId } from "./types";

type ThemeStyle = CSSProperties & {
  "--profile-accent": string;
  "--profile-hero-background": string;
  "--profile-shape": string;
};

export type PublicProfileThemeDefinition = {
  description: string;
  heroBackgroundSrc?: string;
  heroIllustrationClassName?: string;
  heroIllustrationSrc?: string;
  id: PublicProfileThemeId;
  label: string;
  palette: string[];
  style: ThemeStyle;
};

export const publicProfileThemes: PublicProfileThemeDefinition[] = [
  {
    description: "Lavanda e ciano em uma composição leve e acolhedora.",
    heroBackgroundSrc: "/therapists/profile-themes/serene/hero-background.png",
    heroIllustrationClassName: "bottom-[-18%] right-[-1%] w-[min(33vw,430px)]",
    heroIllustrationSrc:
      "/therapists/profile-themes/serene/hero-illustration.png",
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
    heroBackgroundSrc: "/therapists/profile-themes/natural/hero-background.png",
    heroIllustrationClassName: "bottom-[-18%] right-[-1%] w-[min(33vw,430px)]",
    heroIllustrationSrc:
      "/therapists/profile-themes/natural/hero-illustration.png",
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
    heroBackgroundSrc: "/therapists/profile-themes/warm/hero-background.png",
    heroIllustrationClassName: "bottom-[-19%] right-[-2%] w-[min(36vw,470px)]",
    heroIllustrationSrc:
      "/therapists/profile-themes/warm/hero-illustration.png",
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
    alt: "Ilustração botânica em tons lilás para acompanhar uma apresentação sensível.",
    description:
      "Uma composição botânica em tons lilás para acompanhar uma apresentação sensível.",
    id: "organic_flow",
    label: "Planta serena",
    src: "/therapists/profile-bio/serene-plant.png",
  },
  {
    alt: "Ilustração botânica em tons de verde e sálvia.",
    description:
      "Uma composição botânica em verde e sálvia para uma presença natural.",
    id: "gentle_horizon",
    label: "Planta natural",
    src: "/therapists/profile-bio/natural-plant.png",
  },
  {
    alt: "Poltrona terracota com mesa, vela e plantas em uma composição acolhedora.",
    description:
      "Uma poltrona terracota com elementos naturais para uma presença mais acolhedora.",
    id: "warm_layers",
    label: "Canto acolhedor",
    src: "/therapists/profile-bio/warm-chair.png",
  },
  {
    alt: "Folhas em tons lilás formando uma composição leve e editorial.",
    description: "Folhas em tons lilás para uma apresentação leve e editorial.",
    id: "essential_lines",
    label: "Folhas essenciais",
    src: "/therapists/profile-bio/essential-leaves.png",
  },
];

export const bioIllustrationById = Object.fromEntries(
  bioIllustrations.map((illustration) => [illustration.id, illustration]),
) as Record<BioIllustrationId, BioIllustrationDefinition>;
