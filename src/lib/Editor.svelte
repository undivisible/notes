<script>
  import { onMount } from 'svelte'
  import { markdownToHtml, htmlToMarkdown, download } from './markdownUtils'
  import Prism from 'prismjs'
  import 'prismjs/components/prism-markup'
  import 'prismjs/components/prism-css'
  import 'prismjs/components/prism-clike'
  import 'prismjs/components/prism-javascript'
  import 'prismjs/components/prism-typescript'
  import 'prismjs/components/prism-python'
  import 'prismjs/components/prism-json'
  import 'prismjs/components/prism-bash'
  import 'prismjs/components/prism-rust'
  import 'prismjs/components/prism-go'
  import 'prismjs/components/prism-java'
  import 'prismjs/components/prism-sql'
  import 'prismjs/components/prism-yaml'
  import 'prismjs/components/prism-c'
  import 'prismjs/components/prism-cpp'

  const themes = ['light', 'dark', 'sepia', 'taiga']
  const themeColors = { light: '#fafafa', dark: '#1c1c1e', sepia: '#f4ecd8', taiga: '#141f1a' }

  // Comprehensive Google Fonts list — grouped
  const googleFontsList = [
    // Monospace
    'JetBrains Mono','Fira Code','Cascadia Code','Source Code Pro','IBM Plex Mono',
    'Roboto Mono','Inconsolata','Space Mono','Courier Prime','Ubuntu Mono',
    'Anonymous Pro','Overpass Mono','Red Hat Mono','Geist Mono','DM Mono',
    'Syne Mono','Azeret Mono','Martian Mono','Monaspace Neon','Monaspace Xenon',
    'Monaspace Argon','Spline Mono','Recursive','Share Tech Mono','Noto Sans Mono',
    'Nanum Gothic Coding','VT323','Major Mono Display','Fira Mono','Cousine',
    // Sans-serif
    'Inter','Roboto','Open Sans','Lato','Montserrat','Poppins','Raleway',
    'Nunito','Source Sans 3','Work Sans','Outfit','Plus Jakarta Sans','DM Sans',
    'Figtree','Sora','Urbanist','Be Vietnam Pro','Manrope','Jost','Quicksand',
    'Mulish','Barlow','Karla','Rubik','Lexend','Cabin','Noto Sans','IBM Plex Sans',
    'Nunito Sans','Exo 2','Kanit',
    // Serif
    'Merriweather','Playfair Display','Lora','EB Garamond','PT Serif',
    'Libre Baskerville','Source Serif 4','Spectral','Fraunces','Cormorant Garamond',
    'Crimson Pro','Bitter','Zilla Slab','Arvo','Cardo','Vollkorn','Alegreya',
    'Frank Ruhl Libre','Libre Caslon Text',
    // Display
    'Oswald','Anton','Archivo','Righteous','Comfortaa','Pacifico',
  ]

  let editorEl = $state(null)
  let fontListEl = $state(null)
  let content = $state('')
  let wordCount = $state(0), charCount = $state(0)
  let isSaving = $state(false), lastSaved = $state('Just now')
  let currentFont = $state("'JetBrains Mono', monospace")
  let currentTheme = $state('light')
  let showExport = $state(false)
  let showTheme = $state(false)
  let showFont = $state(false)
  let fontSearch = $state('')
  let fontsLoaded = $state(false)
  let isEmpty = $state(true)

  // ── Slash command menu ──
  let showSlash = $state(false)
  let slashQuery = $state('')
  let slashIndex = $state(0)
  let slashPos = $state({ top: 0, left: 0 })
  let slashBlock = null

  const slashCommands = [
    { id:'h1',   label:'Heading 1',    hint:'Large section heading',   icon:'H1',  tag:'h1' },
    { id:'h2',   label:'Heading 2',    hint:'Medium section heading',  icon:'H2',  tag:'h2' },
    { id:'h3',   label:'Heading 3',    hint:'Small section heading',   icon:'H3',  tag:'h3' },
    { id:'ul',   label:'Bullet List',  hint:'Unordered list',          icon:'•',   action:'ul' },
    { id:'ol',   label:'Numbered List',hint:'Ordered list',            icon:'1.',  action:'ol' },
    { id:'code', label:'Code Block',   hint:'Syntax highlighted code', icon:'</>',action:'code' },
    { id:'quote',label:'Quote',        hint:'Block quotation',         icon:'"',  tag:'blockquote' },
    { id:'hr',   label:'Divider',      hint:'Horizontal separator',    icon:'—',   action:'hr' },
  ]

  let filteredCmds = $derived(
    slashQuery.trim()
      ? slashCommands.filter(c => c.label.toLowerCase().includes(slashQuery.toLowerCase()))
      : slashCommands
  )

  let filteredFonts = $derived(
    fontSearch.trim()
      ? googleFontsList.filter(f => f.toLowerCase().includes(fontSearch.toLowerCase()))
      : googleFontsList
  )

  // Load all font CSS (one request) when font picker opens
  function ensureAllFontsLoaded() {
    if (fontsLoaded) return
    fontsLoaded = true
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://fonts.googleapis.com/css2?'
      + googleFontsList.map(f => 'family=' + f.replace(/ /g, '+')).join('&')
      + '&display=swap'
    document.head.appendChild(link)
  }

  onMount(() => {
    // Load selected font at startup
    const savedFont = localStorage.getItem('notes-font') || currentFont
    currentFont = savedFont
    const fontName = savedFont.replace(/'/g, '').split(',')[0].trim()
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/ /g, '+')}:wght@400;700&display=swap`
    document.head.appendChild(link)

    const savedTheme = localStorage.getItem('notes-theme')
    if (savedTheme) { currentTheme = savedTheme; document.body.className = 'theme-' + savedTheme }
    else document.body.className = 'theme-' + currentTheme

    const saved = localStorage.getItem('notes-content') || ''
    content = saved
    isEmpty = saved.trim() === ''
    if (editorEl) {
      editorEl.innerHTML = saved ? markdownToHtml(saved) : ''
      editorEl.style.fontFamily = currentFont
      scheduleHighlight()
    }
    updateCounts(saved)
  })

  let saveTimeout
  function debouncedSave(md) {
    clearTimeout(saveTimeout)
    saveTimeout = setTimeout(() => {
      localStorage.setItem('notes-content', md)
      isSaving = true
      lastSaved = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      setTimeout(() => { isSaving = false }, 1000)
    }, 500)
  }

  function updateCounts(text) {
    const t = text || ''
    wordCount = t.trim() ? t.trim().split(/\s+/).length : 0
    charCount = t.length
  }

  function syncContent() {
    if (!editorEl) return
    content = htmlToMarkdown(editorEl.innerHTML)
    isEmpty = content.trim() === ''
    debouncedSave(content)
    updateCounts(content)
    scheduleHighlight()
  }

  // ── Prism syntax highlighting ──
  let hlTimeout
  function scheduleHighlight() {
    clearTimeout(hlTimeout)
    hlTimeout = setTimeout(applyPrism, 700)
  }

  function applyPrism() {
    if (!editorEl) return
    const sel = window.getSelection()
    editorEl.querySelectorAll('pre code').forEach(block => {
      // Skip the block where the cursor is currently typing
      if (sel?.focusNode && block.contains(sel.focusNode)) return
      // Strip any existing Prism spans to re-highlight cleanly
      const raw = block.textContent
      block.textContent = raw
      Prism.highlightElement(block)
    })
  }

  // ── Block helpers ──
  function getContainingBlock(node) {
    let el = node?.nodeType === 3 ? node.parentElement : node
    while (el && el.parentElement !== editorEl && el !== editorEl) el = el.parentElement
    return (el && el !== editorEl) ? el : null
  }

  // ── Input handler ──
  function handleInput() {
    // Track slash query if menu is open
    if (showSlash && slashBlock) {
      const text = slashBlock.textContent ?? ''
      const idx = text.lastIndexOf('/')
      if (idx === -1) {
        showSlash = false
      } else {
        slashQuery = text.slice(idx + 1)
        slashIndex = 0
      }
    }
    syncContent()
  }

  // ── Execute slash command ──
  function executeSlashCmd(cmd) {
    const block = slashBlock
    showSlash = false
    slashQuery = ''
    slashBlock = null
    if (!block) return

    // Clear the /query text from the block
    if (block !== editorEl) block.innerHTML = '<br>'

    const sel = window.getSelection()
    function place(el) {
      const r = document.createRange()
      r.setStart(el.firstChild ?? el, 0); r.collapse(true)
      sel?.removeAllRanges(); sel?.addRange(r)
    }

    if (cmd.tag) {
      const el = document.createElement(cmd.tag)
      el.innerHTML = '<br>'
      block.replaceWith(el)
      place(el)
    } else if (cmd.action === 'ul' || cmd.action === 'ol') {
      const list = document.createElement(cmd.action)
      const li = document.createElement('li'); li.innerHTML = '<br>'
      list.appendChild(li)
      block.replaceWith(list)
      place(li)
    } else if (cmd.action === 'code') {
      const pre = document.createElement('pre')
      const code = document.createElement('code'); code.textContent = '\n'
      pre.appendChild(code)
      const after = document.createElement('p'); after.innerHTML = '<br>'
      block.replaceWith(pre); pre.after(after)
      const r = document.createRange()
      r.setStart(code.firstChild, 0); r.collapse(true)
      sel?.removeAllRanges(); sel?.addRange(r)
    } else if (cmd.action === 'hr') {
      const hr = document.createElement('hr')
      const p = document.createElement('p'); p.innerHTML = '<br>'
      block.replaceWith(hr); hr.after(p)
      place(p)
    }

    editorEl?.focus()
    syncContent()
  }

  // ── Keydown handler ──
  function handleKeydown(e) {
    const sel = window.getSelection()
    const range = sel?.rangeCount ? sel.getRangeAt(0) : null
    const startNode = range?.startContainer

    // ── Slash menu navigation ──
    if (showSlash && filteredCmds.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); slashIndex = (slashIndex + 1) % filteredCmds.length; return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); slashIndex = (slashIndex - 1 + filteredCmds.length) % filteredCmds.length; return }
      if (e.key === 'Enter')     { e.preventDefault(); executeSlashCmd(filteredCmds[slashIndex]); return }
    }
    if (showSlash && e.key === 'Escape') { showSlash = false; return }

    // ── Detect / to open slash menu ──
    if (e.key === '/' && !showSlash) {
      setTimeout(() => {
        const s = window.getSelection()
        if (!s?.rangeCount) return
        const rect = s.getRangeAt(0).getBoundingClientRect()
        slashPos  = { top: rect.bottom + 6, left: rect.left }
        slashBlock = getContainingBlock(s.getRangeAt(0).startContainer) ?? null
        slashQuery = ''
        slashIndex = 0
        showSlash  = true
      }, 0)
    }

    // ── Backspace: fix first-element / special-block deletion ──
    if (e.key === 'Backspace' && range?.collapsed) {
      const block = getContainingBlock(startNode)
      if (block) {
        const tag = block.tagName.toLowerCase()
        const special = ['h1','h2','h3','h4','h5','h6','blockquote'].includes(tag)
        const empty = block.innerHTML === '' || block.innerHTML === '<br>'
        if (special && empty) {
          e.preventDefault()
          const p = document.createElement('p'); p.innerHTML = '<br>'
          block.replaceWith(p)
          const r = document.createRange()
          r.setStart(p, 0); r.collapse(true)
          sel.removeAllRanges(); sel.addRange(r)
          syncContent(); return
        }
        // Also handle: cursor at offset 0 in first child of a special block
        if (special && range.startOffset === 0 && !block.previousElementSibling) {
          // Convert block type to paragraph so user can delete back into it
          e.preventDefault()
          document.execCommand('formatBlock', false, 'p')
          syncContent(); return
        }
      }
    }

    // ── Enter ──
    if (e.key === 'Enter' && !e.shiftKey) {
      // Inside a code block: handle ``` fence closing
      const codeEl = startNode?.nodeType === 3
        ? startNode.parentElement?.closest('pre code')
        : startNode?.closest?.('pre code')

      if (codeEl) {
        const preEl = codeEl.closest('pre')
        // Detect ``` line as exit fence
        const lineText = (() => {
          if (startNode?.nodeType === 3) {
            const lastNl = startNode.textContent.lastIndexOf('\n', range.startOffset - 1)
            return startNode.textContent.slice(lastNl + 1, range.startOffset).trim()
          }
          return ''
        })()
        if (lineText === '```') {
          e.preventDefault()
          // Remove the closing ``` from the code block's text
          if (startNode?.nodeType === 3) {
            const lastNl = startNode.textContent.lastIndexOf('\n', range.startOffset - 1)
            startNode.textContent =
              startNode.textContent.slice(0, lastNl === -1 ? 0 : lastNl)
              + startNode.textContent.slice(range.startOffset)
          }
          const newP = document.createElement('p'); newP.innerHTML = '<br>'
          preEl.after(newP)
          const r = document.createRange()
          r.setStart(newP, 0); r.collapse(true)
          sel.removeAllRanges(); sel.addRange(r)
          syncContent(); return
        }
        // Normal newline inside code block
        e.preventDefault()
        document.execCommand('insertText', false, '\n')
        syncContent(); return
      }

      // Detect ``` or ```lang at start of block → create code block
      const block = getContainingBlock(startNode)
      if (block) {
        const blockText = block.textContent.trim()
        const m = blockText.match(/^```(\w*)$/)
        if (m) {
          e.preventDefault()
          const lang = m[1]
          const pre = document.createElement('pre')
          if (lang) pre.setAttribute('data-lang', lang)
          const code = document.createElement('code')
          if (lang) code.className = `language-${lang}`
          code.textContent = '\n'
          pre.appendChild(code)
          // Insert pre + a paragraph after it so user can exit
          const after = document.createElement('p'); after.innerHTML = '<br>'
          block.replaceWith(pre)
          pre.after(after)
          const r = document.createRange()
          r.setStart(code.firstChild, 0); r.collapse(true)
          sel.removeAllRanges(); sel.addRange(r)
          syncContent(); return
        }
      }

      // Exit headings / blockquote on Enter when at end of non-empty block
      if (block) {
        const tag = block.tagName.toLowerCase()
        if (['h1','h2','h3','h4','h5','h6','blockquote'].includes(tag)) {
          const atEnd = range.startOffset === (startNode?.textContent?.length ?? 0)
          if (atEnd || block.textContent.trim() !== '') {
            e.preventDefault()
            const p = document.createElement('p'); p.innerHTML = '<br>'
            block.after(p)
            const r = document.createRange()
            r.setStart(p, 0); r.collapse(true)
            sel.removeAllRanges(); sel.addRange(r)
            syncContent(); return
          }
        }
      }
    }

    // ── Space: markdown input rules ──
    if (e.key === ' ' && startNode?.nodeType === 3) {
      const before = startNode.textContent.slice(0, range.startOffset)
      let tag = null
      if      (before === '#')   tag = 'h1'
      else if (before === '##')  tag = 'h2'
      else if (before === '###') tag = 'h3'
      else if (before === '>')   tag = 'blockquote'

      if (tag) {
        e.preventDefault()
        // Remaining text after the trigger prefix
        const remaining = startNode.textContent.slice(before.length + range.startOffset - before.length) || ''
        const newEl = document.createElement(tag)
        if (remaining) newEl.textContent = remaining
        else newEl.innerHTML = '<br>'

        const block = getContainingBlock(startNode)
        if (block) {
          block.replaceWith(newEl)
        } else if (startNode.parentElement === editorEl) {
          // Text is directly inside the editor div — wrap it
          startNode.replaceWith(newEl)
        } else {
          editorEl.insertBefore(newEl, startNode.parentElement)
          startNode.parentElement?.remove()
        }

        const r = document.createRange()
        const target = newEl.firstChild ?? newEl
        r.setStart(target, 0); r.collapse(true)
        sel.removeAllRanges(); sel.addRange(r)
        syncContent(); return
      }

      if (before === '-' || before === '*') {
        e.preventDefault()
        const ul = document.createElement('ul')
        const li = document.createElement('li'); li.innerHTML = '<br>'
        ul.appendChild(li)
        const block = getContainingBlock(startNode)
        if (block) {
          block.replaceWith(ul)
        } else if (startNode.parentElement === editorEl) {
          startNode.replaceWith(ul)
        }
        const r = document.createRange()
        r.setStart(li, 0); r.collapse(true)
        sel.removeAllRanges(); sel.addRange(r)
        syncContent(); return
      }
    }

    // ── Backtick: detect triple-backtick ──
    if (e.key === '`' && startNode?.nodeType === 3) {
      const before = startNode.textContent.slice(0, range.startOffset)
      if (before.endsWith('``')) {
        e.preventDefault()
        // Remove the two preceding backticks and current block text before them
        const block = getContainingBlock(startNode)
        const lang = before.slice(0, -2).trim()
        const pre = document.createElement('pre')
        if (lang) pre.setAttribute('data-lang', lang)
        const code = document.createElement('code')
        if (lang) code.className = `language-${lang}`
        code.textContent = '\n'
        pre.appendChild(code)
        const after = document.createElement('p'); after.innerHTML = '<br>'
        if (block) { block.replaceWith(pre) } else { editorEl.appendChild(pre) }
        pre.after(after)
        const r = document.createRange()
        r.setStart(code.firstChild, 0); r.collapse(true)
        sel.removeAllRanges(); sel.addRange(r)
        syncContent(); return
      }
    }

    // ── Standard shortcuts ──
    if (e.key === 'Tab') {
      e.preventDefault()
      document.execCommand('insertHTML', false, '\u00a0\u00a0')
      return
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'b') { e.preventDefault(); document.execCommand('bold');   syncContent(); return }
    if ((e.metaKey || e.ctrlKey) && e.key === 'i') { e.preventDefault(); document.execCommand('italic'); syncContent(); return }
    if ((e.metaKey || e.ctrlKey) && e.key === 'h') { e.preventDefault(); execFormat('h2'); return }
    if (e.key === 'Escape') closeAll()
  }

  function handleWindowKeydown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); showExport = !showExport; showTheme = false; showFont = false }
    if (e.key === 'Escape') closeAll()
  }

  function handlePaste(e) {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
    syncContent()
  }

  // Re-highlight a code block when focus leaves it
  function handleFocusOut(e) {
    const codeBlock = e.target.closest?.('pre code')
    if (codeBlock) {
      const raw = codeBlock.textContent
      codeBlock.textContent = raw
      Prism.highlightElement(codeBlock)
    }
  }

  function execFormat(tag) {
    if (!editorEl) return
    editorEl.focus()
    document.execCommand('formatBlock', false, tag)
    syncContent()
  }

  function applyBold()    { editorEl?.focus(); document.execCommand('bold');              syncContent() }
  function applyItalic()  { editorEl?.focus(); document.execCommand('italic');            syncContent() }
  function applyHeading() { execFormat('h2') }
  function applyList()    { editorEl?.focus(); document.execCommand('insertUnorderedList'); syncContent() }
  function applyQuote()   { execFormat('blockquote') }
  function applyCode() {
    if (!editorEl) return
    editorEl.focus()
    const sel = window.getSelection()
    if (sel?.rangeCount && !sel.isCollapsed) {
      const txt = sel.getRangeAt(0).toString()
      document.execCommand('insertHTML', false, `<code>${txt}</code>`)
    } else {
      const pre = document.createElement('pre')
      const code = document.createElement('code'); code.textContent = '\n'
      pre.appendChild(code)
      const after = document.createElement('p'); after.innerHTML = '<br>'
      const r = sel?.getRangeAt(0)
      if (r) {
        r.deleteContents()
        r.insertNode(after)
        r.insertNode(pre)
        const nr = document.createRange()
        nr.setStart(code.firstChild, 0); nr.collapse(true)
        sel.removeAllRanges(); sel.addRange(nr)
      }
    }
    syncContent()
  }

  function closeAll() { showExport = false; showTheme = false; showFont = false }

  function changeTheme(t) {
    currentTheme = t
    document.body.className = 'theme-' + t
    localStorage.setItem('notes-theme', t)
    showTheme = false
  }

  function selectFont(f) {
    currentFont = `'${f}', sans-serif`
    localStorage.setItem('notes-font', currentFont)
    if (editorEl) editorEl.style.fontFamily = currentFont
    showFont = false; fontSearch = ''
  }

  function exportFormat(type) {
    showExport = false
    const c = content || ''
    if (type === 'md') {
      download(new Blob([c], { type: 'text/markdown' }), `notes-${Date.now()}.md`)
    } else if (type === 'html') {
      const h = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:ui-monospace,monospace;max-width:800px;margin:40px auto;padding:20px;line-height:1.8}pre{background:#f5f5f5;padding:16px;border-radius:8px;overflow-x:auto}code{background:#eee;padding:2px 6px;border-radius:4px}</style></head><body>${markdownToHtml(c)}</body></html>`
      download(new Blob([h], { type: 'text/html' }), `notes-${Date.now()}.html`)
    } else if (type === 'pdf') {
      const pw = window.open('', '_blank')
      pw.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>@media print{@page{size:A4;margin:2cm}body{font-family:ui-monospace,monospace}}</style></head><body>${markdownToHtml(c)}<script>print();close()<\/script></body></html>`)
      pw.document.close()
    }
  }

  function copyDownload() {
    download(new Blob([content || ''], { type: 'text/markdown' }), `notes-${Date.now()}.md`)
  }

  function currentFontName() {
    return currentFont.replace(/'/g, '').split(',')[0].trim()
  }
</script>

<svelte:window
  onkeydown={handleWindowKeydown}
  onclick={(e) => {
    if (!e.target.closest('.popout-wrap') && !e.target.closest('.font-search')) closeAll()
    if (!e.target.closest('.slash-menu')) showSlash = false
  }}
/>

<div class="wrap">
  <aside class="sidebar">
    <div class="sb-top">

      <!-- Theme -->
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

      <!-- Font -->
      <div class="popout-wrap">
        <button class="sidebar-icon" onclick={(e) => { e.stopPropagation(); showFont = !showFont; ensureAllFontsLoaded(); showTheme = false; showExport = false }} title="Font">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
          <span class="tooltip">{currentFontName()}</span>
        </button>
        {#if showFont}
        <div class="popout font-popout">
          <input
            class="font-search"
            type="text"
            placeholder="Search fonts…"
            bind:value={fontSearch}
            onclick={(e) => e.stopPropagation()}
          />
          <div class="font-list" bind:this={fontListEl}>
            {#each filteredFonts as f}
              <button
                class="font-item {currentFont.includes(f) ? 'active' : ''}"
                style={`font-family: "${f}", sans-serif`}
                onclick={() => selectFont(f)}
                data-font={f}
              >{f}</button>
            {/each}
            {#if filteredFonts.length === 0}
              <div class="font-empty">No fonts found</div>
            {/if}
          </div>
        </div>
        {/if}
      </div>

      <div class="sb-divider"></div>

      <button class="sidebar-icon" onclick={applyBold}    title="Bold"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 5h6a3 3 0 0 1 0 6H9z"/><path d="M9 12h6a3 3 0 0 1 0 6H9z"/></svg><span class="tooltip">Bold (⌘B)</span></button>
      <button class="sidebar-icon" onclick={applyItalic}  title="Italic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 4H10"/><path d="M14 20H5"/><line x1="15" y1="4" x2="10" y2="20"/></svg><span class="tooltip">Italic (⌘I)</span></button>
      <button class="sidebar-icon" onclick={applyHeading} title="Heading"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6v12"/><path d="M20 6v12"/><path d="M4 12h16"/></svg><span class="tooltip">Heading (⌘H)</span></button>
      <button class="sidebar-icon" onclick={applyList}    title="List"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/></svg><span class="tooltip">List</span></button>
      <button class="sidebar-icon" onclick={applyQuote}   title="Quote"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21c3 0 7-1 7-7V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h3"/></svg><span class="tooltip">Quote</span></button>
      <button class="sidebar-icon" onclick={applyCode}    title="Code"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg><span class="tooltip">Code</span></button>

      <div class="sb-divider"></div>

      <!-- Export -->
      <div class="popout-wrap">
        <button class="sidebar-icon" onclick={(e) => { e.stopPropagation(); showExport = !showExport; showTheme = false; showFont = false }} title="Export">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          <span class="tooltip">Export</span>
        </button>
        {#if showExport}
        <div class="popout export-popout">
          <button class="export-item" onclick={() => exportFormat('md')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>Markdown</button>
          <button class="export-item" onclick={() => exportFormat('html')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>HTML</button>
          <button class="export-item" onclick={() => exportFormat('pdf')}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>PDF</button>
        </div>
        {/if}
      </div>

      <button class="sidebar-icon" onclick={copyDownload} title="Download .md">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        <span class="tooltip">Download .md</span>
      </button>
    </div>

    <div class="sidebar-footer">
      {#if isSaving}
        <svg class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10" stroke-opacity=".25"/><path d="M12 2a10 10 0 0 1 10 10"/></svg>
      {:else}
        <div class="sb-stat">{wordCount}w</div>
      {/if}
    </div>
  </aside>

  <main class="editor-area">
    <div
      id="noteEditor"
      bind:this={editorEl}
      contenteditable="true"
      class="notion-editor {isEmpty ? 'is-empty' : ''}"
      oninput={handleInput}
      onkeydown={handleKeydown}
      onpaste={handlePaste}
      onfocusout={handleFocusOut}
      data-placeholder="Start typing… or type / for commands"
    ></div>
  </main>
</div>

{#if showSlash && filteredCmds.length > 0}
<div class="slash-menu" style="top:{slashPos.top}px;left:{slashPos.left}px">
  <div class="slash-header">Blocks</div>
  {#each filteredCmds as cmd, i}
    <button
      class="slash-item {slashIndex === i ? 'active' : ''}"
      onmousedown={(e) => { e.preventDefault(); executeSlashCmd(cmd) }}
      onmouseover={() => { slashIndex = i }}
      onfocus={() => { slashIndex = i }}
    >
      <span class="slash-icon">{cmd.icon}</span>
      <span class="slash-text">
        <span class="slash-label">{cmd.label}</span>
        <span class="slash-hint">{cmd.hint}</span>
      </span>
    </button>
  {/each}
</div>
{/if}
