import { useEffect, useState, type CSSProperties } from "react";
import { Hammer } from "lucide-react";

const PHRASES = [
  "Laying the foundation…",
  "Mixing the cement…",
  "Raising the frame…",
  "Almost ready…",
];

// Rocks kicked up on each hammer strike: horizontal reach, peak height
// (negative = up), spin, and size — varied so the burst looks natural.
const ROCKS = [
  { dx: -22, dy: -18, spin: -200, size: 5 },
  { dx: -12, dy: -26, spin: 160, size: 4 },
  { dx: -4, dy: -20, spin: -120, size: 3 },
  { dx: 8, dy: -28, spin: 220, size: 4 },
  { dx: 16, dy: -16, spin: -180, size: 5 },
  { dx: 25, dy: -22, spin: 140, size: 3 },
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
        <div className="absolute bottom-3 left-1/2" aria-hidden>
          {ROCKS.map((r, i) => (
            <span
              key={i}
              className="site-loader-rock absolute bg-brand"
              style={
                {
                  "--dx": `${r.dx}px`,
                  "--dy": `${r.dy}px`,
                  "--spin": `${r.spin}deg`,
                  width: r.size,
                  height: r.size,
                  left: -r.size / 2,
                  top: -r.size / 2,
                  // Irregular corners so they read as rock chips, not dots.
                  borderRadius: i % 2 ? "30% 60% 40% 50%" : "55% 25% 50% 35%",
                } as CSSProperties
              }
            />
          ))}
        </div>
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
