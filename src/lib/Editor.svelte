<script>
  import { onMount } from 'svelte'
  import { markdownToHtml, download } from './markdownUtils'

  const themes = ['light', 'nord', 'dark', 'oled', 'sepia', 'taiga']
  const themeColors = { light: '#fafafa', nord: '#2e3440', dark: '#0d0d0d', oled: '#000', sepia: '#f4ecd8', taiga: '#1a1c1f' }

  const googleFontsList = ['JetBrains Mono','Roboto Mono','Fira Code','Fira Mono','Source Code Pro','IBM Plex Mono','Courier Prime','Space Mono','Inconsolata','Cascadia Code','Ubuntu Mono','Anonymous Pro','Overpass Mono','Red Hat Mono','Syne Mono','Geist Mono','VT323','Share Tech Mono','Nanum Gothic Coding','Noto Sans Mono','DM Mono','Azeret Mono','Martian Mono','Recursive','Monaspace Neon','Monaspace Xenon','Monaspace Argon','Spline Mono','Major Mono Display']

  onMount(() => {
    const families = ['JetBrains+Mono:wght@400;500;600;700','Roboto+Mono:wght@400;500;600;700','Fira+Code:wght@400;500;600;700','Fira+Mono:wght@400;500;600;700','Source+Code+Pro:wght@400;500;600;700;900','IBM+Plex+Mono:wght@400;500;600;700','Courier+Prime:wght@400;500;600;700','Space+Mono:wght@400;500;600;700','Inconsolata:wght@400;500;600;700;900','Cascadia+Code:wght@400;500;600;700','Ubuntu+Mono:wght@400;500;600;700','Anonymous+Pro:wght@400;500;600;700','Overpass+Mono:wght@400;500;600;700','Red+Hat+Mono:wght@400;500;600;700','Syne+Mono:wght@400;500;600;700;800','Geist+Mono:wght@400;500;600;700','VT323:wght@400','Share+Tech+Mono:wght@400','Nanum+Gothic+Coding:wght@400;700','Noto+Sans+Mono:wght@400;500;600;700','DM+Mono:wght@400;500;600;700','Azeret+Mono:wght@400;500;600;700;800','Martian+Mono:wght@400;500;600;700','Recursive:wght@400;500;600;700','Monaspace+Neon:wght@400;500;600;700','Monaspace+Xenon:wght@400;500;600;700','Monaspace+Argon:wght@400;500;600;700','Spline+Mono:wght@400;500;600;700;800','Major+Mono+Display:wght@400']
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=' + families.join('&family=') + '&display=swap'
    document.head.appendChild(link)
    const saved = localStorage.getItem('notes-content')
    if (saved) content = saved
    const savedFont = localStorage.getItem('notes-font')
    if (savedFont) currentFont = savedFont
    const savedTheme = localStorage.getItem('notes-theme')
    if (savedTheme) { currentTheme = savedTheme; document.body.className = 'theme-' + savedTheme }
  })

  let content = $state(localStorage.getItem('notes-content') || '')
  let wordCount = $state(0), charCount = $state(0)
  let isSaving = $state(false), lastSaved = $state('Just now')
  let currentFont = $state("'JetBrains Mono', monospace")
  let currentTheme = $state('light')
  let showExport = $state(false)
  let showTheme = $state(false)
  let showFont = $state(false)
  let fontSearch = $state('')

  let renderedHtml = $derived(markdownToHtml(content))
  let filteredFonts = $derived(fontSearch ? googleFontsList.filter(f => f.toLowerCase().includes(fontSearch.toLowerCase())) : googleFontsList)

  function getEditor() { return document.getElementById('noteEditor') }

  $effect(() => {
    if (content !== undefined) {
      debouncedSave(content)
      updateCounts()
    }
  })

  let saveTimeout
  function debouncedSave(t) {
    clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      localStorage.setItem('notes-content', t)
      isSaving = true
      lastSaved = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      setTimeout(() => { isSaving = false }, 1000)
    }, 500)
  }

  function updateCounts() {
    const t = content || ''
    wordCount = t.trim() ? t.trim().split(/\s+/).length : 0
    charCount = t.length
  }

  function format(prefix, suffix = '') {
    const ta = getEditor()
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = content.substring(start, end)
    content = content.substring(0, start) + prefix + selected + suffix + content.substring(end)
    setTimeout(() => {
      ta.selectionStart = start + prefix.length
      ta.selectionEnd = end + prefix.length
      ta.focus()
    }, 0)
  }

  function formatLine(prefix) {
    const ta = getEditor()
    if (!ta) return
    const start = ta.selectionStart
    const lineStart = content.lastIndexOf('\n', start - 1) + 1
    content = content.substring(0, lineStart) + prefix + content.substring(lineStart)
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = start + prefix.length
      ta.focus()
    }, 0)
  }

  function insertCodeBlock() {
    const ta = getEditor()
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = content.substring(start, end)
    const insert = selected ? '```\n' + selected + '\n```' : '```\n\n```'
    content = content.substring(0, start) + insert + content.substring(end)
    setTimeout(() => {
      ta.selectionStart = ta.selectionEnd = selected ? start + insert.length : start + 4
      ta.focus()
    }, 0)
  }

  function handleKeydown(e) {
    if (e.key === 'Tab') {
      e.preventDefault()
      const ta = getEditor()
      if (!ta) return
      const start = ta.selectionStart
      content = content.substring(0, start) + '  ' + content.substring(start)
      setTimeout(() => { ta.selectionStart = ta.selectionEnd = start + 2 }, 0)
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') { e.preventDefault(); format('**', '**'); return }
    if ((e.metaKey || e.ctrlKey) && e.key === 'i') { e.preventDefault(); format('*', '*'); return }
    if ((e.metaKey || e.ctrlKey) && e.key === 'h') { e.preventDefault(); formatLine('# '); return }
    if (e.key === 'Escape') { showExport = false; showTheme = false; showFont = false }
  }

  function handleWindowKeydown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); showExport = !showExport; return }
    if (e.key === 'Escape') { showExport = false; showTheme = false; showFont = false }
  }

  function closeAll() { showExport = false; showTheme = false; showFont = false }

  function changeTheme(t) {
    currentTheme = t
    document.body.className = 'theme-' + t
    localStorage.setItem('notes-theme', t)
    showTheme = false
  }

  function selectFont(f) {
    currentFont = `'${f}', monospace`
    localStorage.setItem('notes-font', currentFont)
    showFont = false
    fontSearch = ''
  }

  function exportFormat(type) {
    showExport = false
    const c = content || ''
    if (type === 'md') {
      const b = new Blob([c], { type: 'text/markdown' })
      download(b, `notes-${Date.now()}.md`)
    } else if (type === 'html') {
      const h = '<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:ui-monospace,monospace;max-width:800px;margin:40px auto;padding:20px;line-height:1.8}pre{background:#f5f5f5;padding:16px;border-radius:8px;overflow-x:auto}code{background:#e8e8e6;padding:2px 6px;border-radius:4px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #e8e8e6;padding:8px}</style></head><body>' + markdownToHtml(c) + '</body></html>'
      const b = new Blob([h], { type: 'text/html' })
      download(b, `notes-${Date.now()}.html`)
    } else if (type === 'pdf') {
      const h = markdownToHtml(c)
      const pw = window.open('', '_blank')
      pw.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><style>@media print{@page{size:A4;margin:2cm}body{font-family:ui-monospace,monospace;max-width:100%}pre{background:#f5f5f5;padding:16px;border:1px solid #e8e8e6}code{background:#e8e8e6;padding:2px 6px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #e8e8e6;padding:8px}</style></head><body>' + h + '<script>print();close()<\/script></body></html>')
      pw.document.close()
    }
  }

  function copyDownload() {
    const b = new Blob([content || ''], { type: 'text/markdown' })
    download(b, `notes-${Date.now()}.md`)
  }

  function currentFontName() {
    const m = currentFont.match(/'([^']+)'/)
    return m ? m[1] : 'Font'
  }
</script>

<svelte:window onkeydown={handleWindowKeydown} onclick={(e) => { if (!e.target.closest('.popout-wrap')) closeAll() }} />

<div class="wrap">
  <aside class="sidebar">
    <div class="sb-top">
      <div class="popout-wrap">
        <button class="sidebar-icon" onclick={(e) => { e.stopPropagation(); showTheme = !showTheme; showFont = false; showExport = false }} title="Theme">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20"/><path d="M12 7a5 5 0 0 1 0 10"/></svg>
          <span class="tooltip">Theme</span>
        </button>
        {#if showTheme}
        <div class="popout theme-popout">
          <div class="theme-grid">
            {#each themes as t}
              <button class="theme-swatch-btn {currentTheme === t ? 'active' : ''}" onclick={() => changeTheme(t)} style="background:{themeColors[t]}" title={t}></button>
            {/each}
          </div>
        </div>
        {/if}
      </div>

      <div class="popout-wrap">
        <button class="sidebar-icon" onclick={(e) => { e.stopPropagation(); showFont = !showFont; showTheme = false; showExport = false }} title="Font">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
          <span class="tooltip">{currentFontName()}</span>
        </button>
        {#if showFont}
        <div class="popout font-popout">
          <input class="font-search" type="text" placeholder="Search fonts…" bind:value={fontSearch} onclick={(e) => e.stopPropagation()} />
          <div class="font-list">
            {#each filteredFonts as f}
              <button class="font-item {currentFont === `'${f}', monospace` ? 'active' : ''}" style="font-family:'{f}',monospace" onclick={() => selectFont(f)}>{f}</button>
            {/each}
          </div>
        </div>
        {/if}
      </div>

      <div class="sb-divider"></div>

      <button class="sidebar-icon" onclick={() => format('**', '**')} title="Bold">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 5h6a3 3 0 0 1 0 6H9z"/><path d="M9 12h6a3 3 0 0 1 0 6H9z"/></svg>
        <span class="tooltip">Bold (⌘B)</span>
      </button>
      <button class="sidebar-icon" onclick={() => format('*', '*')} title="Italic">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 4H10"/><path d="M14 20H5"/><line x1="15" y1="4" x2="10" y2="20"/></svg>
        <span class="tooltip">Italic (⌘I)</span>
      </button>
      <button class="sidebar-icon" onclick={() => formatLine('# ')} title="Heading">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6h16"/><path d="M4 12h16"/><path d="M4 18h16"/></svg>
        <span class="tooltip">Heading</span>
      </button>
      <button class="sidebar-icon" onclick={() => formatLine('- ')} title="List">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/></svg>
        <span class="tooltip">List</span>
      </button>
      <button class="sidebar-icon" onclick={() => formatLine('> ')} title="Quote">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21c3 0 7-1 7-7V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h3"/></svg>
        <span class="tooltip">Quote</span>
      </button>
      <button class="sidebar-icon" onclick={insertCodeBlock} title="Code">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        <span class="tooltip">Code block</span>
      </button>

      <div class="sb-divider"></div>

      <div class="popout-wrap">
        <button class="sidebar-icon" onclick={(e) => { e.stopPropagation(); showExport = !showExport; showTheme = false; showFont = false }} title="Export">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span class="tooltip">Export</span>
        </button>
        {#if showExport}
        <div class="popout export-popout">
          <button class="export-item" onclick={() => exportFormat('md')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Markdown (.md)
          </button>
          <button class="export-item" onclick={() => exportFormat('html')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>HTML (.html)
          </button>
          <button class="export-item" onclick={() => exportFormat('pdf')}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>PDF
          </button>
        </div>
        {/if}
      </div>

      <button class="sidebar-icon" onclick={copyDownload} title="Download">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span class="tooltip">Download</span>
      </button>
    </div>

    <div class="sidebar-footer">
      {#if isSaving}
        <svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-opacity=".25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
      {:else}
        <div class="sb-stat">{wordCount}</div>
        <div class="sb-stat">{charCount}</div>
      {/if}
    </div>
  </aside>

  <main class="editor-area">
    <div class="editor-split">
      <div class="editor-pane">
        <textarea
          id="noteEditor"
          class="md-textarea"
          bind:value={content}
          onkeydown={handleKeydown}
          placeholder="Start typing..."
          style="font-family: {currentFont}"
          spellcheck="false"
        ></textarea>
      </div>
      <div class="preview-pane">
        <div class="md-preview" style="font-family: {currentFont}">
          {#if content}
            {@html renderedHtml}
          {:else}
            <span class="placeholder">Preview</span>
          {/if}
        </div>
      </div>
    </div>
  </main>
</div>
