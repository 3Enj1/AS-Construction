import { useEffect, useState } from "react";
import { Hammer } from "lucide-react";

const PHRASES = [
  "Laying the foundation…",
  "Mixing the cement…",
  "Raising the frame…",
  "Almost ready…",
];

export function LoadingSprite() {
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setPhraseIndex((i) => (i + 1) % PHRASES.length);
    }, 1400);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="relative grid h-20 w-20 place-items-center">
        <div className="site-loader-spark absolute bottom-2 h-2.5 w-10 rounded-full bg-brand blur-[3px]" />
        <Hammer
          className="site-loader-hammer relative size-11 text-brand drop-shadow-[0_0_10px_var(--brand)]"
          style={{ transform: "rotate(-38deg)" }}
        />
      </div>
      <div className="text-center">
        <div className="text-sm font-semibold tracking-wide text-foreground">AS Construction</div>
        <div className="mt-1.5 text-xs text-muted-foreground" aria-live="polite">
          {PHRASES[phraseIndex]}
        </div>
      </div>
    </div>
  );
}
