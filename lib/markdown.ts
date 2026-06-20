/** Minimal markdown -> HTML for AI chat bubbles (headings, lists, bold/italic/code). */
export function renderMarkdown(text: string): string {
  const lines = text.split("\n");
  const out: string[] = [];
  let inOl = false;
  let inUl = false;

  const closeList = () => {
    if (inOl) { out.push("</ol>"); inOl = false; }
    if (inUl) { out.push("</ul>"); inUl = false; }
  };

  const inlineFormat = (s: string) =>
    s
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>")
      .replace(/`([^`]+)`/g, '<code class="ai-inline-code">$1</code>');

  for (const raw of lines) {
    const line = raw.trimEnd();

    if (!line.trim()) {
      closeList();
      out.push("<br/>");
      continue;
    }

    const hMatch = line.match(/^(#{1,3})\s+(.+)/);
    if (hMatch) {
      closeList();
      const level = hMatch[1].length;
      const tag = level === 1 ? "h3" : level === 2 ? "h4" : "h5";
      out.push(`<${tag} class="ai-heading ai-h${level}">${inlineFormat(hMatch[2])}</${tag}>`);
      continue;
    }

    const olMatch = line.match(/^\s*\d+[.)]\s+(.*)/);
    if (olMatch) {
      if (inUl) { out.push("</ul>"); inUl = false; }
      if (!inOl) { out.push('<ol class="ai-ol">'); inOl = true; }
      out.push(`<li>${inlineFormat(olMatch[1])}</li>`);
      continue;
    }

    const ulMatch = line.match(/^\s*[-*•]\s+(.*)/);
    if (ulMatch) {
      if (inOl) { out.push("</ol>"); inOl = false; }
      if (!inUl) { out.push('<ul class="ai-ul">'); inUl = true; }
      out.push(`<li>${inlineFormat(ulMatch[1])}</li>`);
      continue;
    }

    closeList();
    out.push(`<p class="ai-p">${inlineFormat(line)}</p>`);
  }

  closeList();
  return out.join("");
}
