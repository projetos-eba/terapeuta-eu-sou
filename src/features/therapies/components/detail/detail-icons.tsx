import {
  Activity,
  BadgeCheck,
  BookOpen,
  CircleDot,
  Diamond,
  Flower2,
  Heart,
  Leaf,
  Moon,
  Scale,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Sun,
  Waves,
} from "lucide-react";

const iconClassName = "h-5 w-5";

export function DetailIcon({ iconKey }: { iconKey: string }) {
  const normalizedKey = iconKey.toLowerCase();

  if (normalizedKey === "heart") return <Heart className={iconClassName} />;
  if (normalizedKey === "leaf") return <Leaf className={iconClassName} />;
  if (normalizedKey === "flower") return <Flower2 className={iconClassName} />;
  if (normalizedKey === "shield") return <ShieldCheck className={iconClassName} />;
  if (normalizedKey === "sun") return <Sun className={iconClassName} />;
  if (normalizedKey === "moon") return <Moon className={iconClassName} />;
  if (normalizedKey === "balance") return <Scale className={iconClassName} />;
  if (normalizedKey === "diamond") return <Diamond className={iconClassName} />;
  if (normalizedKey === "energy") return <Activity className={iconClassName} />;
  if (normalizedKey === "oracle") return <BookOpen className={iconClassName} />;
  if (normalizedKey === "systemic") return <UsersRound className={iconClassName} />;
  if (normalizedKey === "pattern") return <CircleDot className={iconClassName} />;
  if (normalizedKey === "lotus") return <Flower2 className={iconClassName} />;
  if (normalizedKey === "sparkles") return <Sparkles className={iconClassName} />;

  return <Waves className={iconClassName} />;
}

export function VerifiedMiniIcon() {
  return <BadgeCheck className="h-4 w-4" aria-hidden="true" />;
}
