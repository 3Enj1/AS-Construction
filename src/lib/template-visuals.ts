import {
  Building2,
  ChefHat,
  Expand,
  FileBox,
  Hammer,
  Home,
  Triangle,
  type LucideIcon,
} from "lucide-react";

type TemplateVisual = { icon: LucideIcon; gradient: string; label: string };

const VISUALS: Record<string, TemplateVisual> = {
  residential_build: {
    icon: Home,
    gradient: "linear-gradient(135deg, oklch(0.4 0.14 27), oklch(0.2 0.05 20))",
    label: "New build",
  },
  renovation: {
    icon: Hammer,
    gradient: "linear-gradient(135deg, oklch(0.4 0.12 230), oklch(0.2 0.05 240))",
    label: "Renovation",
  },
  kitchen_bath: {
    icon: ChefHat,
    gradient: "linear-gradient(135deg, oklch(0.42 0.13 300), oklch(0.2 0.05 290))",
    label: "Kitchen & bath",
  },
  roofing: {
    icon: Triangle,
    gradient: "linear-gradient(135deg, oklch(0.42 0.15 350), oklch(0.2 0.06 340))",
    label: "Roofing",
  },
  commercial: {
    icon: Building2,
    gradient: "linear-gradient(135deg, oklch(0.4 0.08 250), oklch(0.2 0.04 255))",
    label: "Commercial",
  },
  extension: {
    icon: Expand,
    gradient: "linear-gradient(135deg, oklch(0.42 0.13 150), oklch(0.2 0.05 155))",
    label: "Extension",
  },
  general: {
    icon: FileBox,
    gradient: "linear-gradient(135deg, oklch(0.3 0.01 270), oklch(0.18 0.01 270))",
    label: "General",
  },
};

export function templateVisual(category: string): TemplateVisual {
  return VISUALS[category] ?? VISUALS.general;
}

export const TEMPLATE_CATEGORIES = Object.keys(VISUALS).filter((k) => k !== "general") as string[];
