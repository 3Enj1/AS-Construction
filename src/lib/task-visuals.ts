import {
  Droplets,
  FileBox,
  Flame,
  Hammer,
  Layers,
  Trees,
  Triangle,
  Zap,
  type LucideIcon,
} from "lucide-react";

type TaskVisual = { icon: LucideIcon; tone: string; label: string };

const VISUALS: Record<string, TaskVisual> = {
  plumbing: { icon: Droplets, tone: "text-info bg-info/15", label: "Plumbing" },
  electrical: { icon: Zap, tone: "text-warning bg-warning/15", label: "Electrical" },
  roofing: { icon: Triangle, tone: "text-danger bg-danger/15", label: "Roofing" },
  foundation: { icon: Layers, tone: "text-muted-foreground bg-muted", label: "Foundation" },
  framing: { icon: Hammer, tone: "text-brand bg-brand/15", label: "Framing" },
  finishing: { icon: Flame, tone: "text-success bg-success/15", label: "Finishing" },
  landscaping: { icon: Trees, tone: "text-success bg-success/15", label: "Landscaping" },
  general: { icon: FileBox, tone: "text-muted-foreground bg-muted", label: "General" },
};

export function taskVisual(category: string): TaskVisual {
  return VISUALS[category] ?? VISUALS.general;
}

export const TASK_CATEGORIES = Object.keys(VISUALS) as string[];
