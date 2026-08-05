import type { ReactNode } from "react";

/** Reads one balanced {...} group starting at `start` (which must be "{"). */
function readGroup(text: string, start: number): { body: string; end: number } | null {
  if (text[start] !== "{") return null;
  let depth = 0;
  for (let i = start; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}") {
      depth -= 1;
      if (depth === 0) return { body: text.slice(start + 1, i), end: i + 1 };
    }
  }
  return null;
}

function Fraction({ top, bottom }: { top: string; bottom: string }) {
  return (
    <span className="mx-1 inline-flex flex-col items-center align-middle leading-tight">
      <span className="px-1">{top}</span>
      <span className="my-0.5 h-px w-full self-stretch bg-current" />
      <span className="px-1">{bottom}</span>
    </span>
  );
}

/**
 * Renders assistant text, turning `frac{numerator}{denominator}` (or `\frac{..}{..}`)
 * into a properly stacked numerator-over-denominator fraction.
 */
export function MathText({ text, className = "" }: { text: string; className?: string }) {
  const nodes: ReactNode[] = [];
  let buffer = "";
  let index = 0;
  let key = 0;

  const flush = () => {
    if (buffer) {
      nodes.push(<span key={`t-${key++}`}>{buffer}</span>);
      buffer = "";
    }
  };

  while (index < text.length) {
    const isFrac =
      text.startsWith("frac{", index) &&
      !/[A-Za-z]/.test(text[index - 1] ?? "");
    const isBackslashFrac = text.startsWith("\\frac{", index);

    if (isFrac || isBackslashFrac) {
      const openAt = index + (isBackslashFrac ? 5 : 4);
      const top = readGroup(text, openAt);
      const bottom = top ? readGroup(text, top.end) : null;
      if (top && bottom) {
        flush();
        nodes.push(<Fraction key={`f-${key++}`} top={top.body} bottom={bottom.body} />);
        index = bottom.end;
        continue;
      }
    }

    buffer += text[index];
    index += 1;
  }
  flush();

  return <span className={`whitespace-pre-wrap ${className}`}>{nodes}</span>;
}
