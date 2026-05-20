// Markdown to HTML
export function markdownToHtml(markdown) {
  if (!markdown) return "";

  let html = escapeHtml(markdown);

  // Fenced code blocks — capture optional language tag
  html = html.replace(/```(\w*)\r?\n?([\s\S]*?)```/g, (_, lang, code) => {
    const normalizedLang = normalizeCodeLang(lang);
    const langClass = normalizedLang
      ? ` class="language-${normalizedLang}"`
      : "";
    const langAttr = normalizedLang ? ` data-lang="${normalizedLang}"` : "";
    return `<pre${langAttr}><code${langClass}>${code}</code></pre>`;
  });

  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, "<del>$1</del>");

  // Inline code
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

  // Headings
  html = html.replace(/^###### (.*)$/gm, "<h6>$1</h6>");
  html = html.replace(/^##### (.*)$/gm, "<h5>$1</h5>");
  html = html.replace(/^#### (.*)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.*)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.*)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.*)$/gm, "<h1>$1</h1>");

  // Horizontal rule
  html = html.replace(/^---$/gm, "<hr>");

  // Blockquotes
  html = html.replace(/^&gt; (.*)$/gm, "<blockquote>$1</blockquote>");

  // Tables
  html = html.replace(
    /\|(.+)\|\r?\n\|[\s:-|]+\|\r?\n((?:\|.*\|\r?\n?)+)/g,
    (match, header, rows) => {
      let table = "<table><thead><tr>";
      header
        .split("|")
        .filter((h) => h.trim())
        .forEach((h) => {
          table += "<th>" + h.trim() + "</th>";
        });
      table += "</tr></thead><tbody>";
      rows.split("\n").forEach((row) => {
        if (row.trim()) {
          table += "<tr>";
          row
            .split("|")
            .filter((c) => c.trim() !== "")
            .forEach((c) => {
              table += "<td>" + c.trim() + "</td>";
            });
          table += "</tr>";
        }
      });
      table += "</tbody></table>";
      return table;
    },
  );

  const lines = html.split("\n");
  const result = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = line.trim();
    if (isMarkdownListLine(line)) {
      const listLines = [];
      while (i < lines.length && isMarkdownListLine(lines[i])) {
        listLines.push(lines[i]);
        i += 1;
      }
      i -= 1;
      result.push(markdownListToHtml(listLines));
    } else {
      let p = inlineMarkdown(trimmed);
      if (trimmed !== "") {
        const isBlock =
          /^<(h[1-6]|ul|ol|li|blockquote|table|pre|hr|img)[^>]*>/.test(trimmed);
        result.push(isBlock ? p : "<p>" + p + "</p>");
      } else {
        result.push("");
      }
    }
  }
  return result.join("\n");
}

function inlineMarkdown(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/__(.+?)__/g, "<strong>$1</strong>")
    .replace(/~~(.+?)~~/g, "<del>$1</del>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/_([^_\n]+)_/g, "<u>$1</u>")
    .replace(
      /!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g,
      '<img alt="$1" src="$2">',
    )
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
}

function normalizeCodeLang(lang) {
  const normalized = (lang || "").toLowerCase().trim();
  const aliases = {
    js: "javascript",
    jsx: "jsx",
    ts: "typescript",
    tsx: "tsx",
    py: "python",
    rb: "ruby",
    sh: "bash",
    shell: "bash",
    zsh: "bash",
    yml: "yaml",
    html: "markup",
    xml: "markup",
    md: "markdown",
    rs: "rust",
  };
  return aliases[normalized] || normalized;
}

function isMarkdownListLine(line) {
  return /^(\s*)([-*+]|\d+\.)\s+\S/.test(line);
}

function parseMarkdownListLine(line) {
  const match = line.match(/^(\s*)([-*+]|\d+\.)\s+(.+)$/);
  if (!match) return null;
  return {
    depth: Math.floor(match[1].replace(/\t/g, "  ").length / 2),
    type: /^\d+\.$/.test(match[2]) ? "ol" : "ul",
    content: match[3],
  };
}

function markdownListToHtml(listLines) {
  const items = listLines.map(parseMarkdownListLine).filter(Boolean);
  let index = 0;

  function render(depth) {
    let html = "";
    let openType = null;
    while (index < items.length) {
      const item = items[index];
      if (item.depth < depth) break;
      if (item.depth > depth) {
        html += render(item.depth);
        continue;
      }
      if (openType !== item.type) {
        if (openType) html += `</${openType}>`;
        openType = item.type;
        html += `<${openType}>`;
      }
      html += `<li>${inlineMarkdown(item.content)}`;
      index += 1;
      if (index < items.length && items[index].depth > depth) {
        html += render(items[index].depth);
      }
      html += "</li>";
    }
    if (openType) html += `</${openType}>`;
    return html;
  }

  return render(items[0]?.depth || 0);
}

// HTML → Markdown (for saving from the contenteditable)
export function htmlToMarkdown(html) {
  if (!html) return "";
  const el = document.createElement("div");
  el.innerHTML = html;
  return nodeToMd(el)
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function nodeToMd(node) {
  if (node.nodeType === 3) return node.textContent;
  if (node.nodeType !== 1) return "";
  const tag = node.tagName.toLowerCase();
  const kids = () => Array.from(node.childNodes).map(nodeToMd).join("");
  const text = () => kids().trim();

  switch (tag) {
    case "div":
    case "p": {
      const t = text();
      return t ? t + "\n" : "\n";
    }
    case "br":
      return "\n";
    case "strong":
    case "b": {
      const t = text();
      return t ? `**${t}**` : "";
    }
    case "em":
    case "i": {
      const t = text();
      return t ? `*${t}*` : "";
    }
    case "del":
    case "s":
    case "strike": {
      const t = text();
      return t ? `~~${t}~~` : "";
    }
    case "u": {
      const t = text();
      return t ? `_${t}_` : "";
    }
    case "h1":
      return `# ${text()}\n`;
    case "h2":
      return `## ${text()}\n`;
    case "h3":
      return `### ${text()}\n`;
    case "h4":
      return `#### ${text()}\n`;
    case "h5":
      return `##### ${text()}\n`;
    case "h6":
      return `###### ${text()}\n`;
    case "blockquote":
      return `> ${text()}\n`;
    case "code":
      if (node.parentElement?.tagName.toLowerCase() === "pre")
        return node.textContent;
      return `\`${node.textContent}\``;
    case "pre": {
      const codeEl = node.querySelector("code") || node;
      const lang =
        node.getAttribute("data-lang") ||
        codeEl.className.match(/language-(\w+)/)?.[1] ||
        "";
      return "```" + lang + "\n" + codeEl.textContent.trim() + "\n```\n";
    }
    case "ul":
    case "ol":
      return listToMd(node, listDepth(node));
    case "li": {
      return liToMd(node, listDepth(node.parentElement));
    }
    case "a":
      return `[${kids()}](${node.getAttribute("href") || ""})`;
    case "hr":
      return "---\n";
    case "img":
      return `![${node.getAttribute("alt") || ""}](${node.getAttribute("src") || ""})\n`;
    case "table":
      return kids();
    case "thead":
    case "tbody":
      return kids();
    case "tr": {
      const cells = Array.from(node.children).map((c) => nodeToMd(c).trim());
      return "| " + cells.join(" | ") + " |\n";
    }
    case "th":
    case "td":
      return text();
    default:
      return kids();
  }
}

function listDepth(list) {
  let depth = -1;
  let current = list;
  while (current) {
    if (
      current.nodeType === 1 &&
      ["ul", "ol"].includes(current.tagName.toLowerCase())
    ) {
      depth += 1;
    }
    current = current.parentElement;
  }
  return Math.max(depth, 0);
}

function listToMd(list, depth = 0) {
  let markdown = "";
  for (const child of Array.from(list.children)) {
    const tag = child.tagName.toLowerCase();
    if (tag === "li") {
      markdown += liToMd(child, depth);
    } else if (["ul", "ol"].includes(tag)) {
      markdown += listToMd(child, depth + 1);
    }
  }
  return markdown;
}

function liToMd(li, depth = 0) {
  const parentTag = li.parentElement?.tagName.toLowerCase();
  const marker =
    parentTag === "ol"
      ? `${Array.from(li.parentElement.children).indexOf(li) + 1}.`
      : "-";
  const indent = "  ".repeat(depth);
  const inline = Array.from(li.childNodes)
    .filter(
      (child) =>
        !(
          child.nodeType === 1 &&
          ["ul", "ol"].includes(child.tagName.toLowerCase())
        ),
    )
    .map(nodeToMd)
    .join("")
    .trim();
  const nested = Array.from(li.children)
    .filter((child) => ["ul", "ol"].includes(child.tagName.toLowerCase()))
    .map((child) => listToMd(child, depth + 1))
    .join("");
  return `${indent}${marker} ${inline}\n${nested}`;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
