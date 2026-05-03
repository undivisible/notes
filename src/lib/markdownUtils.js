// Markdown to HTML
export function markdownToHtml(markdown) {
  if (!markdown) return ''

  let html = escapeHtml(markdown)

  // Fenced code blocks — capture optional language tag
  html = html.replace(/```(\w*)\r?\n?([\s\S]*?)```/g, (_, lang, code) => {
    const langClass = lang ? ` class="language-${lang}"` : ''
    const langAttr  = lang ? ` data-lang="${lang}"` : ''
    return `<pre${langAttr}><code${langClass}>${code}</code></pre>`
  })

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Headings
  html = html.replace(/^###### (.*)$/gm, '<h6>$1</h6>')
  html = html.replace(/^##### (.*)$/gm,  '<h5>$1</h5>')
  html = html.replace(/^#### (.*)$/gm,   '<h4>$1</h4>')
  html = html.replace(/^### (.*)$/gm,    '<h3>$1</h3>')
  html = html.replace(/^## (.*)$/gm,     '<h2>$1</h2>')
  html = html.replace(/^# (.*)$/gm,      '<h1>$1</h1>')

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr>')

  // Blockquotes
  html = html.replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>')

  // Tables
  html = html.replace(/\|(.+)\|\r?\n\|[\s:-|]+\|\r?\n((?:\|.*\|\r?\n?)+)/g, (match, header, rows) => {
    let table = '<table><thead><tr>'
    header.split('|').filter(h => h.trim()).forEach(h => { table += '<th>' + h.trim() + '</th>' })
    table += '</tr></thead><tbody>'
    rows.split('\n').forEach(row => {
      if (row.trim()) {
        table += '<tr>'
        row.split('|').filter(c => c.trim() !== '').forEach(c => { table += '<td>' + c.trim() + '</td>' })
        table += '</tr>'
      }
    })
    table += '</tbody></table>'
    return table
  })

  // Lists
  const lines = html.split('\n')
  const result = []
  let inUl = false, inOl = false
  for (const line of lines) {
    const trimmed = line.trim()
    if (/^[-*+] /.test(trimmed)) {
      if (!inUl) { result.push('<ul>'); inUl = true }
      result.push('<li>' + trimmed.substring(2) + '</li>')
    } else if (/^\d+\. /.test(trimmed)) {
      if (!inOl) { result.push('<ol>'); inOl = true }
      result.push('<li>' + trimmed.replace(/^\d+\. /, '') + '</li>')
    } else {
      if (inUl) { result.push('</ul>'); inUl = false }
      if (inOl) { result.push('</ol>'); inOl = false }
      let p = trimmed
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.+?)__/g,     '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g,     '<em>$1</em>')
        .replace(/_(.+?)_/g,       '<em>$1</em>')
        .replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2">$1</a>')
      if (trimmed !== '') {
        const isBlock = /^<(h[1-6]|ul|ol|li|blockquote|table|pre|hr)[^>]*>/.test(trimmed)
        result.push(isBlock ? p : '<p>' + p + '</p>')
      } else {
        result.push('')
      }
    }
  }
  if (inUl) result.push('</ul>')
  if (inOl) result.push('</ol>')
  return result.join('\n')
}

// HTML → Markdown (for saving from the contenteditable)
export function htmlToMarkdown(html) {
  if (!html) return ''
  const el = document.createElement('div')
  el.innerHTML = html
  return nodeToMd(el).replace(/\n{3,}/g, '\n\n').trim()
}

function nodeToMd(node) {
  if (node.nodeType === 3) return node.textContent
  if (node.nodeType !== 1) return ''
  const tag = node.tagName.toLowerCase()
  const kids = () => Array.from(node.childNodes).map(nodeToMd).join('')
  const text = () => kids().trim()

  switch (tag) {
    case 'div':
    case 'p': { const t = text(); return t ? t + '\n' : '\n' }
    case 'br': return '\n'
    case 'strong': case 'b': { const t = text(); return t ? `**${t}**` : '' }
    case 'em':     case 'i': { const t = text(); return t ? `*${t}*` : '' }
    case 'h1': return `# ${text()}\n`
    case 'h2': return `## ${text()}\n`
    case 'h3': return `### ${text()}\n`
    case 'h4': return `#### ${text()}\n`
    case 'h5': return `##### ${text()}\n`
    case 'h6': return `###### ${text()}\n`
    case 'blockquote': return `> ${text()}\n`
    case 'code':
      if (node.parentElement?.tagName.toLowerCase() === 'pre') return node.textContent
      return `\`${node.textContent}\``
    case 'pre': {
      const codeEl = node.querySelector('code') || node
      const lang = node.getAttribute('data-lang')
             || codeEl.className.match(/language-(\w+)/)?.[1]
             || ''
      return '```' + lang + '\n' + codeEl.textContent.trim() + '\n```\n'
    }
    case 'ul': case 'ol': return kids()
    case 'li': return `- ${text()}\n`
    case 'a':  return `[${kids()}](${node.getAttribute('href') || ''})`
    case 'hr': return '---\n'
    case 'img': return `![${node.getAttribute('alt') || ''}](${node.getAttribute('src') || ''})\n`
    case 'table': return kids()
    case 'thead': case 'tbody': return kids()
    case 'tr': {
      const cells = Array.from(node.children).map(c => nodeToMd(c).trim())
      return '| ' + cells.join(' | ') + ' |\n'
    }
    case 'th': case 'td': return text()
    default: return kids()
  }
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

export function download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
