import { cn } from "@/lib/utils";

// Soft blurred color blobs that sit behind page content. Purely decorative.
const BLENDS = {
  warm: [
    "radial-gradient(closest-side at 62% 38%, rgb(244 114 182 / 0.65), transparent)",
    "radial-gradient(closest-side at 72% 18%, rgb(196 181 253 / 0.7), transparent)",
    "radial-gradient(closest-side at 32% 68%, rgb(253 224 71 / 0.55), transparent)",
    "radial-gradient(closest-side at 48% 60%, rgb(251 191 146 / 0.5), transparent)",
  ],
  cool: [
    "radial-gradient(closest-side at 55% 45%, rgb(94 234 212 / 0.6), transparent)",
    "radial-gradient(closest-side at 30% 60%, rgb(254 240 138 / 0.55), transparent)",
    "radial-gradient(closest-side at 70% 65%, rgb(165 243 252 / 0.5), transparent)",
  ],
};

export function Aura({ blend = "warm", className }: { blend?: keyof typeof BLENDS; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute -z-10 blur-3xl", className)}
      style={{ backgroundImage: BLENDS[blend].join(", ") }}
    />
  );
}
