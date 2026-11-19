// Turns the Markdown the definition is written in into HTML: headings, paragraphs, lists, tables,
// fenced code, inline code, and links. It covers only what spec/ uses, so the site needs no package.

export const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type Heading = { level: number; text: string; id: string };

// Inline code first, so text inside backticks is never read as a link.
function inline(text: string, link: (href: string) => string): string {
  return text
    .split(/(`[^`]+`)/)
    .map((part) => {
      if (part.startsWith("`") && part.endsWith("`") && part.length > 1) return `<code>${escape(part.slice(1, -1))}</code>`;
      return escape(part).replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, href: string) => {
        const target = link(href.replace(/&amp;/g, "&"));
        const external = /^https?:/.test(target);
        return `<a href="${escape(target)}"${external ? ' rel="noopener"' : ""}>${label}</a>`;
      });
    })
    .join("");
}

const CJK = /[　-ヿ㐀-鿿＀-￯]$/;
const startsCJK = /^[　-ヿ㐀-鿿＀-￯]/;

// Joins the lines of one paragraph. Japanese lines join without a space, as the text has none.
function joinLines(lines: string[]): string {
  return lines.reduce((all, line) => (all === "" ? line : CJK.test(all) || startsCJK.test(line) ? all + line : `${all} ${line}`), "");
}

function cells(row: string): string[] {
  return row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

// Renders the document. The level-1 heading is returned apart, since the page draws its own title.
// Every level-2 and level-3 heading gets the id s<n>, counted in order, so a section has the same
// anchor in the English and the Japanese page.
export function render(markdown: string, link: (href: string) => string): { title: string; html: string; headings: Heading[] } {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  const headings: Heading[] = [];
  let title = "";
  let i = 0;
  const isBlockStart = (line: string) =>
    /^#{1,6} /.test(line) || line.startsWith("```") || /^\s*[-*] /.test(line) || /^\s*\d+\. /.test(line) || line.startsWith("|");
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === "") {
      i += 1;
      continue;
    }
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const body: string[] = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith("```")) body.push(lines[(i += 1) - 1]);
      i += 1;
      out.push(`<pre${lang ? ` data-lang="${escape(lang)}"` : ""}><code>${escape(body.join("\n"))}</code></pre>`);
      continue;
    }
    const heading = /^(#{1,6}) (.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      i += 1;
      if (level === 1 && title === "") {
        title = text.replace(/`/g, "");
        continue;
      }
      const id = `s${headings.length + 1}`;
      headings.push({ level, text: text.replace(/`/g, ""), id });
      out.push(`<h${level} id="${id}">${inline(text, link)}</h${level}>`);
      continue;
    }
    if (line.startsWith("|")) {
      const rows: string[] = [];
      while (i < lines.length && lines[i].startsWith("|")) rows.push(lines[(i += 1) - 1]);
      const [head, , ...body] = rows;
      out.push(
        [
          '<div class="table"><table>',
          `<thead><tr>${cells(head).map((c) => `<th>${inline(c, link)}</th>`).join("")}</tr></thead>`,
          `<tbody>${body.map((r) => `<tr>${cells(r).map((c) => `<td>${inline(c, link)}</td>`).join("")}</tr>`).join("")}</tbody>`,
          "</table></div>",
        ].join(""),
      );
      continue;
    }
    const item = /^\s*(?:([-*])|(\d+)\.) (.*)$/.exec(line);
    if (item) {
      const ordered = item[2] !== undefined;
      const items: string[][] = [];
      while (i < lines.length) {
        const m = /^\s*(?:([-*])|(\d+)\.) (.*)$/.exec(lines[i]);
        if (m && (m[2] !== undefined) === ordered) {
          items.push([m[3]]);
          i += 1;
        } else if (lines[i].trim() !== "" && /^\s{2,}\S/.test(lines[i]) && items.length > 0) {
          items[items.length - 1].push(lines[i].trim());
          i += 1;
        } else break;
      }
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}>${items.map((it) => `<li>${inline(joinLines(it), link)}</li>`).join("")}</${tag}>`);
      continue;
    }
    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !isBlockStart(lines[i])) paragraph.push(lines[(i += 1) - 1].trim());
    out.push(`<p>${inline(joinLines(paragraph), link)}</p>`);
  }
  return { title, html: out.join("\n"), headings };
}
