import type { PublicTherapyDetail } from "../../types/therapy-detail";

type VisualTheme = {
  accent: string;
  badge: string;
  benefitIcon: string;
  card: string;
  imageRing: string;
  soft: string;
};

export const therapyVisualThemes: Record<
  PublicTherapyDetail["visualThemeKey"],
  VisualTheme
> = {
  energy: {
    accent: "text-[#0f87bd]",
    badge: "bg-[#e5fafc] text-[#0f87bd]",
    benefitIcon: "bg-[#e5fafc] text-[#0f87bd]",
    card: "border-[#d8edf4] bg-white",
    imageRing: "ring-[#d8edf4]",
    soft: "bg-[#f4fcff]",
  },
  oracle: {
    accent: "text-[#7a3b9a]",
    badge: "bg-[#f1e6fb] text-[#6d2d8c]",
    benefitIcon: "bg-[#f1e6fb] text-[#6d2d8c]",
    card: "border-[#ead7f4] bg-white",
    imageRing: "ring-[#ead7f4]",
    soft: "bg-[#fbf5ff]",
  },
  systemic: {
    accent: "text-[#9a623b]",
    badge: "bg-[#f8eadf] text-[#8f552f]",
    benefitIcon: "bg-[#f8eadf] text-[#8f552f]",
    card: "border-[#efd8c8] bg-white",
    imageRing: "ring-[#efd8c8]",
    soft: "bg-[#fff8f3]",
  },
};
