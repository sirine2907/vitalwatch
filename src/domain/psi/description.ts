export type DescriptionPart =
  | { type: "text"; text: string }
  | { type: "link"; text: string; href: string };

const MARKDOWN_LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;

/**
 * Splits a Lighthouse description into text and links. Links are limited to
 * https so upstream text can't produce a `javascript:` href.
 */
export function parseDescription(description: string): DescriptionPart[] {
  const parts: DescriptionPart[] = [];
  let position = 0;

  for (const match of description.matchAll(MARKDOWN_LINK)) {
    const [whole, text, href] = match;
    if (match.index > position) {
      parts.push({ type: "text", text: description.slice(position, match.index) });
    }
    parts.push(href.startsWith("https://") ? { type: "link", text, href } : { type: "text", text });
    position = match.index + whole.length;
  }

  if (position < description.length) {
    parts.push({ type: "text", text: description.slice(position) });
  }
  return parts;
}
