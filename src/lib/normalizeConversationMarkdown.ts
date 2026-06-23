/** Prepare assistant markdown captured from streaming/Seroval for GFM rendering. */
export function normalizeConversationMarkdown(text: string): string {
  let s = text.replace(/\r\n/g, "\n");

  // Orphan backslash lines from escaped streaming payloads.
  s = s.replace(/^\s*\\\s*$/gm, "");
  // Trailing hard-break backslashes (e.g. "数据概览\\" or "line\\n").
  s = s.replace(/\\(\n)/g, "$1");
  s = s.replace(/\\$/gm, "");

  // Promote bare section labels immediately before a table to h3 headings.
  s = s.replace(/^([^#\n|][^\n]{0,60})\n\n(\|)/gm, "### $1\n\n$2");

  // Blank line before GFM tables when missing (required by remark-gfm).
  s = s.replace(
    /(^|\n)([^\n|][^\n]*)\n(\|[^\n]+\|)\n(\|[-:| ]+\|)/g,
    (_, start, heading, headerRow, dividerRow) => {
      const title = heading.startsWith("#") ? heading : `### ${heading}`;
      return `${start}${title}\n\n${headerRow}\n${dividerRow}`;
    },
  );

  // Collapse 3+ newlines to 2 — keeps paragraph breaks without splitting tables.
  s = s.replace(/\n{3,}/g, "\n\n");

  return s.trim();
}

/** Join streaming text chunks without inserting blank lines that break GFM tables. */
export function joinConversationTextChunks(chunks: string[]): string {
  return chunks.reduce((acc, chunk) => {
    const piece = chunk.trimEnd();
    if (!piece) return acc;
    if (!acc) return piece;
    const needsNewline = !acc.endsWith("\n") && !piece.startsWith("\n");
    return acc + (needsNewline ? "\n" : "") + piece;
  }, "");
}