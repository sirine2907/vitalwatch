// The "§2" in front of a report section heading. Screen readers skip it.
export function SectionMark({ number }: { number: number }) {
  return (
    <span className="mr-2 font-mono text-sm font-normal text-mark" aria-hidden>
      §{number}
    </span>
  );
}
