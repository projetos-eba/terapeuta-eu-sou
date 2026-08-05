import {
  Activity,
  BadgeCheck,
  BookOpen,
  Brain,
  CalendarCheck,
  CircleDot,
  Compass,
  Diamond,
  Flame,
  Flower2,
  Heart,
  HelpingHand,
  Leaf,
  Lightbulb,
  MessageCircleHeart,
  Moon,
  Mountain,
  Music,
  Orbit,
  Palette,
  PauseCircle,
  RefreshCcw,
  Scale,
  ShieldCheck,
  Sparkles,
  Sprout,
  Star,
  UsersRound,
  Sun,
  Target,
  TreePalm,
  Video,
  Waves,
  Wind,
  type LucideIcon,
} from "lucide-react";

const iconClassName = "h-5 w-5";

export const therapyDetailIconOptions = [
  { key: "sparkles", label: "Brilho e cuidado", icon: Sparkles },
  { key: "heart", label: "Acolhimento", icon: Heart },
  { key: "leaf", label: "Natural", icon: Leaf },
  { key: "flower", label: "Florescimento", icon: Flower2 },
  { key: "lotus", label: "Presença", icon: Flower2 },
  { key: "shield", label: "Segurança", icon: ShieldCheck },
  { key: "sun", label: "Clareza", icon: Sun },
  { key: "moon", label: "Descanso", icon: Moon },
  { key: "balance", label: "Equilíbrio", icon: Scale },
  { key: "diamond", label: "Valor pessoal", icon: Diamond },
  { key: "energy", label: "Energia", icon: Activity },
  { key: "oracle", label: "Orientação", icon: BookOpen },
  { key: "systemic", label: "Relações", icon: UsersRound },
  { key: "pattern", label: "Padrões", icon: CircleDot },
  { key: "waves", label: "Fluidez", icon: Waves },
  { key: "breath", label: "Respiração", icon: Wind },
  { key: "pause", label: "Pausa", icon: PauseCircle },
  { key: "mind", label: "Mente", icon: Brain },
  { key: "insight", label: "Insight", icon: Lightbulb },
  { key: "compass", label: "Direção", icon: Compass },
  { key: "target", label: "Foco", icon: Target },
  { key: "renewal", label: "Renovação", icon: RefreshCcw },
  { key: "growth", label: "Crescimento", icon: Sprout },
  { key: "support", label: "Apoio", icon: HelpingHand },
  { key: "connection", label: "Conexão", icon: MessageCircleHeart },
  { key: "mountain", label: "Estabilidade", icon: Mountain },
  { key: "flame", label: "Vitalidade", icon: Flame },
  { key: "star", label: "Potencial", icon: Star },
  { key: "creative", label: "Criatividade", icon: Palette },
  { key: "rhythm", label: "Ritmo", icon: Music },
  { key: "online", label: "Atendimento online", icon: Video },
  { key: "agenda", label: "Organização", icon: CalendarCheck },
  { key: "integration", label: "Integração", icon: Orbit },
  { key: "nature", label: "Natureza", icon: TreePalm },
] as const satisfies ReadonlyArray<{
  icon: LucideIcon;
  key: string;
  label: string;
}>;

export function DetailIcon({ iconKey }: { iconKey: string }) {
  const normalizedKey = iconKey.toLowerCase();
  const option = therapyDetailIconOptions.find(
    (item) => item.key === normalizedKey,
  );

  if (option) {
    const Icon = option.icon;
    return <Icon className={iconClassName} />;
  }

  return <Waves className={iconClassName} />;
}

export function VerifiedMiniIcon() {
  return <BadgeCheck className="h-4 w-4" aria-hidden="true" />;
}
