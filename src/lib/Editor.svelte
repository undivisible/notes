<script>
  import { onMount } from 'svelte'
  import { markdownToHtml, download } from './markdownUtils'

  const googleFontsList = ['JetBrains Mono','Roboto Mono','Fira Code','Fira Mono','Source Code Pro','IBM Plex Mono','Courier Prime','Space Mono','Inconsolata','Cascadia Code','Ubuntu Mono','Anonymous Pro','Overpass Mono','Red Hat Mono','Syne Mono','Geist Mono','VT323','Share Tech Mono','Nanum Gothic Coding','Noto Sans Mono','DM Mono','Azeret Mono','Martian Mono','Recursive','Input Mono','Monaspace Neon','Monaspace Xenon','Monaspace Argon','Spline Mono','Iosevka','Comic Neue Mono','Major Mono Display','Courier','Consolas','Monaco','Menlo']

  onMount(() => {
    const families = ['JetBrains+Mono:wght@400;500;600;700','Roboto+Mono:wght@400;500;600;700','Fira+Code:wght@400;500;600;700','Fira+Mono:wght@400;500;600;700','Source+Code+Pro:wght@400;500;600;700;900','IBM+Plex+Mono:wght@400;500;600;700','Courier+Prime:wght@400;500;600;700','Space+Mono:wght@400;500;600;700','Inconsolata:wght@400;500;600;700;900','Cascadia+Code:wght@400;500;600;700','Ubuntu+Mono:wght@400;500;600;700','Anonymous+Pro:wght@400;500;600;700','Overpass+Mono:wght@400;500;600;700','Red+Hat+Mono:wght@400;500;600;700','Syne+Mono:wght@400;500;600;700;800','Geist+Mono:wght@400;500;600;700','VT323:wght@400','Share+Tech+Mono:wght@400','Nanum+Gothic+Coding:wght@400;500;600;700','Noto+Sans+Mono:wght@400;500;600;700','DM+Mono:wght@400;500;600;700','Azeret+Mono:wght@400;500;600;700;800','Martian+Mono:wght@400;500;600;700','Recursive:wght@400;500;600;700','Input+Mono:wght@400;500;600;700','Monaspace+Neon:wght@400;500;600;700','Monaspace+Xenon:wght@400;500;600;700','Monaspace+Argon:wght@400;500;600;700','Spline+Mono:wght@400;500;600;700;800','Iosevka:wght@400;500;600;700','Comic+Neue+Mono:wght@400;500;600;700','Major+Mono+Display:wght@400;500;600;700']
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?family=' + families.join('&family=') + '&display=swap'
    document.head.appendChild(link)
    const saved = localStorage.getItem('notes-content')
    if (saved) {
      content = saved
      setTimeout(() => { const ed = doc(); if(ed) ed.innerHTML = saved }, 10)
    }
    const savedFont = localStorage.getItem('notes-font')
    if (savedFont) currentFont = savedFont
    const savedTheme = localStorage.getItem('notes-theme')
    if (savedTheme) { currentTheme = savedTheme; document.body.className = 'theme-' + savedTheme }
    syncPreview()
  })

  let content = $state(localStorage.getItem('notes-content') || '')
  let wordCount = $state(0), charCount = $state(0)
  let isSaving = $state(false), lastSaved = $state('Just now')
  let currentFont = $state("'JetBrains Mono', monospace")
  let currentTheme = $state('light')
  let showExport = $state(false)

  function doc() { return document.getElementById('noteEditor') }
  function pr() { return document.getElementById('markdownPreview') }

  function syncPreview() {
    const c = content || ''
    const p = pr()
    if (p) p.innerHTML = markdownToHtml(c)
    const d = doc()
    if (d) {
      const fc = currentFont.startsWith("'") ? currentFont : `'${currentFont}', monospace`
      d.style.fontFamily = fc
    }
    if (p) p.style.fontFamily = currentFont
  }

  $effect(() => {
    if (content !== undefined && content !== null) { 
      debouncedSave(content)
      updateCounts()
      syncPreview()
    }
  })

  let saveTimeout
  function debouncedSave(t) {
    clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      localStorage.setItem('notes-content', t)
      isSaving = true
      lastSaved = new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})
      setTimeout(()=>{isSaving=false},1000)
    },500)
  }
  function updateCounts() {
    const t = content||''
    wordCount = t.trim()?t.trim().split(/\s+/).length:0
    charCount = t.length
  }

  function handleInput(e) {
    content = e.target.innerText || e.target.textContent || ''
  }

  function handleKeydown(e) {
    if (e.key === 'Tab') {
      e.preventDefault()
      document.execCommand('insertText', false, '  ')
    }
    if ((e.metaKey||e.ctrlKey)&&e.key==='b'){e.preventDefault();format('**','**');return}
    if ((e.metaKey||e.ctrlKey)&&e.key==='i'){e.preventDefault();format('*','*');return}
    if ((e.metaKey||e.ctrlKey)&&e.key==='h'){e.preventDefault();insertLine('# ');return}
    if ((e.metaKey||e.ctrlKey)&&e.key==='Enter'&&!e.shiftKey){e.preventDefault();showExport=!showExport;return}
    if (e.key==='Escape'){showExport=false}
  }

  function formatAsMD(prefix, suffix='') {
    const d = doc()
    if (!d) return
    const s = window.getSelection()
    if (!s.rangeCount) return
    const r = s.getRangeAt(0)
    const selected = r.toString()
    if (selected) {
      const wrapped = prefix + selected + suffix
      r.deleteContents()
      r.insertNode(document.createTextNode(wrapped))
      content = d.innerText || d.textContent || ''
    }
  }
  function insertLine(text) {
    const d = doc()
    if (!d) return
    const s = window.getSelection()
    if (!s.rangeCount) return
    const r = s.getRangeAt(0)
    const lineStart = r.startOffset === 0
    const br = document.createTextNode('\n' + text)
    r.insertNode(br)
    r.collapse(false)
    content = d.innerText || d.textContent || ''
  }

  function handlePaste(e) {
    const txt = e.clipboardData.getData('text/plain')
    if (txt) {
      e.preventDefault()
      document.execCommand('insertText', false, txt)
      content = doc().innerText || doc().textContent || ''
    }
  }

  function format(prefix, suffix='') { formatAsMD(prefix, suffix) }

  // Highlight-to-markdown copy
  function handleCopy(e) {
    const sel = window.getSelection().toString().trim()
    if (!sel) return
    // Find what block type the selection is in and convert to markdown
    const txt = sel
    // Keep as plain text (it's already markdown)
    e.preventDefault()
    const blob = new Blob([txt], { type: 'text/plain' })
    const dt = e.clipboardData
    dt.setData('text/plain', txt)
    dt.setData('text/html', '<pre>' + txt.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</pre>')
  }

  function changeTheme(t) {
    currentTheme = t
    document.body.className = 'theme-' + t
    localStorage.setItem('notes-theme', t)
    syncPreview()
  }
  function changeFont(e) {
    const f = e.target.value
    currentFont = f
    localStorage.setItem('notes-font', f)
    syncPreview()
  }
  function copySel() {
    const sel = window.getSelection().toString()
    const txt = sel || content
    const blob = new Blob([txt], { type: 'text/markdown' })
    download(blob, `notes-${Date.now()}.md`)
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
      const pw = window.open('','_blank')
      pw.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><style>@media print{@page{size:A4;margin:2cm}body{font-family:ui-monospace,monospace;max-width:100%}pre{background:#f5f5f5;padding:16px;border:1px solid #e8e8e6}code{background:#e8e8e6;padding:2px 6px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #e8e8e6;padding:8px}</style></head><body>'+h+'<script>print();close()<\/script></body></html>')
      pw.document.close()
    }
  }

</script>

<svelte:window onkeydown={handleKeydown} onclick={()=>{showExport=false}}/>

<div class="wrap">
  <aside class="sidebar">
    <div class="sidebar-sep"></div>
    <!-- Theme swatches (single hover effect) -->
    <div class="sidebar-sec">
      <div class="sidebar-label">Theme</div>
      <div class="theme-grid">
        <button class="theme-swatch-btn active" onclick={()=>changeTheme('light')} style="background:#fafafa;border-color:#fafafa" title="Light"></button>
        <button class="theme-swatch-btn" onclick={()=>changeTheme('nord')} style="background:#2e3440;border-color:#2e3440" title="Nord"></button>
        <button class="theme-swatch-btn" onclick={()=>changeTheme('dark')} style="background:#0d0d0d;border-color:#0d0d0d" title="Dark"></button>
        <button class="theme-swatch-btn" onclick={()=>changeTheme('oled')} style="background:#000;border-color:#000" title="OLED"></button>
        <button class="theme-swatch-btn" onclick={()=>changeTheme('sepia')} style="background:#f4ecd8;border-color:#f4ecd8" title="Sepia"></button>
        <button class="theme-swatch-btn" onclick={()=>changeTheme('taiga')} style="background:#1a1c1f;border-color:#1a1c1f" title="Taiga"></button>
      </div>
    </div>
    <!-- Font select -->
    <div class="sidebar-sec">
      <div class="sidebar-label">Font</div>
      <select class="sidebar-select" onchange={changeFont}>
        {#each googleFontsList as f}
          <option value="'{f}', monospace" selected={currentFont==="'"+f+"', monospace"}>{f}</option>
        {/each}
      </select>
    </div>
    <!-- Format buttons -->
    <div class="sidebar-sec">
      <div class="sidebar-label">Format</div>
      <div style="display:flex;gap:0.25rem;flex-wrap:wrap">
        <button class="sidebar-icon" onclick={()=>format('**','**')} title="Bold">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 5h6a3 3 0 0 1 0 6H9z"/><path d="M9 12h6a3 3 0 0 1 0 6H9z"/></svg>
        </button>
        <button class="sidebar-icon" onclick={()=>format('*','*')} title="Italic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 4H10"/><path d="M14 20H5"/><line x1="15" y1="4" x2="10" y2="20"/></svg>
        </button>
        <button class="sidebar-icon" onclick={()=>insertLine('# ')} title="Heading">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12h16"/><path d="M4 6h16"/><path d="M4 18h16"/></svg>
        </button>
        <button class="sidebar-icon" onclick={()=>format('- ')} title="List">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/></svg>
        </button>
        <button class="sidebar-icon" onclick={()=>format('> ')} title="Quote">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21c3 0 7-1 7-7V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h3"/><path d="M21 21c3 0 7-1 7-7V5c0-1.25-.756-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h3"/></svg>
        </button>
        <button class="sidebar-icon" onclick={()=>{const d=doc();if(!d)return;const s=d.selectionStart;content=content.substring(0,s)+'```\n\n```'+content.substring(s);d.focus();d.selectionStart=d.selectionEnd=s+3;syncPreview()}} title="Code">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        </button>
      </div>
    </div>
    <!-- Export & Copy -->
    <div class="sidebar-sec">
      <div class="sidebar-label">Actions</div>
      <button class="sidebar-icon" onclick={()=>showExport=!showExport} style="width:100%;justify-content:flex-start;text-align:left" title="Export">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span style="margin-left:0.25rem">Export...</span>
      </button>
      <button class="sidebar-icon" onclick={copySel} style="width:100%;justify-content:flex-start;text-align:left" title="Copy">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        <span style="margin-left:0.25rem">Copy</span>
      </button>
    </div>
    <div class="sidebar-footer">
      {#if isSaving}<div class="saving"><svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-opacity=".25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg></div>{/if}
      {#if !isSaving}<div style="font-size:.625rem;color:var(--text-3)">Saved {lastSaved}</div>{/if}
      <div style="margin-top:.25rem">W:<span class="mono">{wordCount.toLocaleString()}</span> C:<span class="mono">{charCount.toLocaleString()}</span></div>
    </div>
  </aside>

  <main class="editor-area">
    <div class="notion-editor"
      id="noteEditor"
      contenteditable="true"
      oninput={handleInput}
      onkeydown={handleKeydown}
      onpaste={handlePaste}
      oncopy={handleCopy}
      data-placeholder="Start typing..."
      style="font-family: {currentFont}"
    ></div>
    <div id="markdownPreview" class="markdown-preview" style="display:none"></div>
  </main>
</div>

{#if showExport}
  <div class="popup-backdrop" onclick={()=>showExport=false}></div>
  <div class="popup" style="right:0;top:3.5rem;transform:none">
    <div class="popup-inner">
      <div class="export-list">
        <button class="export-item" onclick={()=>exportFormat('md')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Markdown (.md)
        </button>
        <button class="export-item" onclick={()=>exportFormat('html')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>HTML (.html)
        </button>
        <button class="export-item" onclick={()=>exportFormat('pdf')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>PDF
        </button>
      </div>
    </div>
  </div>
{/if}