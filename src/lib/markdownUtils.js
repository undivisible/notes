// Markdown to HTML converter - Notion style
export function markdownToHtml(markdown) {
  if (!markdown) return '<p class="text-notion-textMuted">Start typing your notes here...</p>'

  let html = escapeHtml(markdown)

  // Code blocks (fenced)
  html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Headings
  html = html.replace(/^###### (.*)$/gm, '<h6>$1</h6>')
  html = html.replace(/^##### (.*)$/gm, '<h5>$1</h5>')
  html = html.replace(/^#### (.*)$/gm, '<h4>$1</h4>')
  html = html.replace(/^### (.*)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.*)$/gm, '<h2>$1</h2>')
  html = html.replace(/^# (.*)$/gm, '<h1>$1</h1>')

  // Horizontal rule
  html = html.replace(/^---$/gm, '<hr>')

  // Blockquotes (must be before lists)
  html = html.replace(/^&gt; (.*)$/gm, '<blockquote>$1</blockquote>')

  // Tables - match header and separator line
  html = html.replace(/\|(.+)\|\r?\n\|[\s:-|]+\|\r?\n((?:\|.*\|\r?\n?)+)/g, (match, header, rows) => {
    let table = '<table><thead><tr>'
    header.split('|').filter(h => h.trim()).forEach(h => {
      table += '<th>' + h.trim() + '</th>'
    })
    table += '</tr></thead><tbody>'
    rows.split('\n').forEach(row => {
      if (row.trim()) {
        table += '<tr>'
        row.split('|').filter(c => c.trim() !== '').forEach(c => {
          table += '<td>' + c.trim() + '</td>'
        })
        table += '</tr>'
      }
    })
    table += '</tbody></table>'
    return table
  })

  // Process lists - convert markdown lists to HTML
  const lines = html.split('\n')
  const result = []
  let inUl = false
  let inOl = false

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Unordered list item: - or * or +
    if (/^[-*+] /.test(trimmed)) {
      if (!inUl) {
        result.push('<ul>')
        inUl = true
      }
      result.push('<li>' + trimmed.substring(2) + '</li>')
    } 
    // Ordered list item: number.
    else if (/^\d+\. /.test(trimmed)) {
      if (!inOl) {
        result.push('<ol>')
        inOl = true
      }
      result.push('<li>' + trimmed.replace(/^\d+\. /, '') + '</li>')
    } 
    else {
      // Close any open lists
      if (inUl) {
        result.push('</ul>')
        inUl = false
      }
      if (inOl) {
        result.push('</ol>')
        inOl = false
      }

      // Bold and italic
      let processed = trimmed
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/__(.+?)__/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/_(.+?)_/g, '<em>$1</em>')

      // Links
      processed = processed.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2">$1</a>')

      // Add paragraph if needed
      if (trimmed !== '' && !trimmed.match(/^<(h[1-6]|p|ul|ol|li|blockquote|table|pre|code|hr)[^>]*>/) && !trimmed.match(/^<\/(ul|ol|li|blockquote|table)>/)) {
        if (trimmed.startsWith('<h') || trimmed.startsWith('<blockquote') || trimmed.startsWith('<pre') || trimmed.startsWith('<table')) {
          result.push(processed)
        } else {
          result.push('<p>' + processed + '</p>')
        }
      } else if (trimmed !== '') {
        result.push(processed)
      }
    }
  }

  // Close any remaining lists
  if (inUl) result.push('</ul>')
  if (inOl) result.push('</ol>')

  html = result.join('\n')

  return html
}

function escapeHtml(text) {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

// Copy markdown as HTML (Notion-style copy)
export function copyAsMarkdown(markdown) {
  const html = markdownToHtml(markdown)
  
  // Try to copy as HTML first (for rich paste)
  const blob = new Blob([html], { type: 'text/html' })
  const clipboardItem = new ClipboardItem({ 'text/html': blob })
  
  navigator.clipboard.write([clipboardItem]).catch(() => {
    // Fallback to plain text
    navigator.clipboard.writeText(markdown)
  })
}

// Process paste to preserve markdown formatting
export function processMarkdownOnPaste(e) {
  const text = e.clipboardData.getData('text/plain')
  const html = e.clipboardData.getData('text/html')
  
  // If copying from a rich source, try to convert to markdown
  if (html) {
    // Simple conversion - strip tags but preserve basic formatting
    const tempDiv = document.createElement('div')
    tempDiv.innerHTML = html
    let converted = tempDiv.innerText || tempDiv.textContent
    // Preserve line breaks
    converted = converted.replace(/\n/g, '\n')
    return converted
  }
  
  return text
}


export function download(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
