<script>
  import { onMount } from "svelte";
  import { markdownToHtml, htmlToMarkdown, download } from "./markdownUtils";
  import Prism from "prismjs";
  import "prismjs/components/prism-markup";
  import "prismjs/components/prism-css";
  import "prismjs/components/prism-clike";
  import "prismjs/components/prism-javascript";
  import "prismjs/components/prism-typescript";
  import "prismjs/components/prism-python";
  import "prismjs/components/prism-json";
  import "prismjs/components/prism-bash";
  import "prismjs/components/prism-rust";
  import "prismjs/components/prism-go";
  import "prismjs/components/prism-java";
  import "prismjs/components/prism-sql";
  import "prismjs/components/prism-yaml";
  import "prismjs/components/prism-c";
  import "prismjs/components/prism-cpp";

  const themes = ["light", "nord", "dark", "oled", "sepia", "taiga"];
  const themeColors = {
    light: "#fafafa",
    nord: "#2e3440",
    dark: "#1c1c1e",
    oled: "#000",
    sepia: "#f4ecd8",
    taiga: "#141f1a",
  };

  // ── Google Fonts — fetched via CORS-enabled Fontsource API, filtered to type=google ──
  let googleFontsList = $state([]);
  let fontsLoading = $state(false);
  let fontsFetched = false;
  const loadedFonts = new Set();

  function loadFont(name) {
    if (loadedFonts.has(name)) return;
    loadedFonts.add(name);
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}:wght@400;700&display=swap`;
    document.head.appendChild(link);
  }

  async function fetchFontList() {
    if (fontsFetched || fontsLoading) return;
    fontsLoading = true;
    try {
      const res = await fetch("https://api.fontsource.org/v1/fonts");
      const json = await res.json();
      googleFontsList = (Array.isArray(json) ? json : Object.values(json))
        .filter((f) => f.type === "google")
        .map((f) => f.family)
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      fontsFetched = true;
    } catch {
      googleFontsList = [];
    }
    fontsLoading = false;
  }

  // Lazy-load fonts as they scroll into view in the picker
  let fontObserver = null;
  $effect(() => {
    if (!showFont || !fontListEl) return;
    void filteredFonts.length; // reactive dependency
    fontObserver?.disconnect();
    fontObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) loadFont(e.target.dataset.font);
        });
      },
      { root: fontListEl, rootMargin: "120px" },
    );
    requestAnimationFrame(() => {
      fontListEl
        ?.querySelectorAll("[data-font]")
        .forEach((el) => fontObserver.observe(el));
    });
    return () => fontObserver?.disconnect();
  });

  // Auto-focus search input when picker opens
  let fontSearchEl = $state(null);
  $effect(() => {
    if (showFont) requestAnimationFrame(() => fontSearchEl?.focus());
  });

  let editorEl = $state(null);
  let fontListEl = $state(null);
  let content = $state("");
  let wordCount = $state(0),
    charCount = $state(0);
  let isSaving = $state(false),
    lastSaved = $state("Just now");
  let currentFont = $state("'JetBrains Mono', monospace");
  let currentTheme = $state("light");
  let showExport = $state(false);
  let showTheme = $state(false);
  let showFont = $state(false);
  let showSearch = $state(false);
  let fontSearch = $state("");
  let docSearch = $state("");
  let docSearchIndex = $state(0);
  let docSearchEl = $state(null);
  let isEmpty = $state(true);

  // ── Tabs ──────────────────────────────────────────────────────────────────
  function newTabId() {
    return `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }
  function tabKey(id) {
    return `notes-content-${id}`;
  }

  let tabs = $state([]);
  let activeTabId = $state("");
  let renamingTabId = $state(null);
  let renameVal = $state("");
  let renameInputEl = $state(null);

  function tabDisplayTitle(tab) {
    if (tab.title) return tab.title;
    const c =
      tab.id === activeTabId
        ? content
        : localStorage.getItem(tabKey(tab.id)) || "";
    const first = c
      .replace(/^#+\s*/, "")
      .split("\n")[0]
      .trim()
      .slice(0, 28);
    return first || "Untitled";
  }

  function loadTabs() {
    try {
      const saved = JSON.parse(localStorage.getItem("notes-tabs") || "null");
      if (Array.isArray(saved) && saved.length > 0) {
        tabs = saved;
        activeTabId = localStorage.getItem("notes-active-tab") || saved[0].id;
        return;
      }
    } catch {
      tabs = [];
    }
    const id = newTabId();
    tabs = [{ id, title: "" }];
    activeTabId = id;
    // Migrate legacy single-note content
    const legacy = localStorage.getItem("notes-content");
    if (legacy) localStorage.setItem(tabKey(id), legacy);
    _saveTabs();
  }

  function _saveTabs() {
    localStorage.setItem("notes-tabs", JSON.stringify(tabs));
    localStorage.setItem("notes-active-tab", activeTabId);
  }

  function activeMarkdown() {
    return htmlToMarkdown(editorEl?.innerHTML || "");
  }

  function _loadTabContent(id) {
    const saved = localStorage.getItem(tabKey(id)) || "";
    content = saved;
    isEmpty = saved.trim() === "";
    if (editorEl) {
      editorEl.innerHTML = saved ? markdownToHtml(saved) : "";
      editorEl.style.fontFamily = currentFont;
      scheduleHighlight();
    }
    updateCounts(saved);
  }

  function switchTab(id) {
    if (id === activeTabId) return;
    localStorage.setItem(tabKey(activeTabId), activeMarkdown());
    activeTabId = id;
    localStorage.setItem("notes-active-tab", id);
    _loadTabContent(id);
    closeAll();
  }

  function newTab() {
    localStorage.setItem(tabKey(activeTabId), activeMarkdown());
    const id = newTabId();
    tabs = [...tabs, { id, title: "" }];
    activeTabId = id;
    content = "";
    isEmpty = true;
    if (editorEl) {
      editorEl.innerHTML = "";
      editorEl.focus();
    }
    updateCounts("");
    _saveTabs();
  }

  function closeTab(id, e) {
    e?.stopPropagation();
    if (tabs.length === 1) return;
    localStorage.removeItem(tabKey(id));
    const idx = tabs.findIndex((t) => t.id === id);
    const next = tabs.filter((t) => t.id !== id);
    tabs = next;
    if (activeTabId === id) {
      const newActive = next[Math.min(idx, next.length - 1)];
      activeTabId = newActive.id;
      localStorage.setItem("notes-active-tab", newActive.id);
      _loadTabContent(newActive.id);
    }
    _saveTabs();
  }

  function startRename(tab) {
    renamingTabId = tab.id;
    renameVal = tab.title || tabDisplayTitle(tab);
    requestAnimationFrame(() => {
      renameInputEl?.select();
    });
  }

  function finishRename() {
    if (!renamingTabId) return;
    tabs = tabs.map((t) =>
      t.id === renamingTabId ? { ...t, title: renameVal.trim() } : t,
    );
    renamingTabId = null;
    _saveTabs();
  }

  // ── Slash command menu ──
  let showSlash = $state(false);
  let slashQuery = $state("");
  let slashIndex = $state(0);
  let slashPos = $state({ top: 0, left: 0 });
  let slashBlock = null;

  const slashCommands = [
    {
      id: "h1",
      label: "Heading 1",
      hint: "Large section heading",
      icon: "H1",
      tag: "h1",
      aliases: ["h1", "heading1", "heading", "title", "#"],
    },
    {
      id: "h2",
      label: "Heading 2",
      hint: "Medium section heading",
      icon: "H2",
      tag: "h2",
      aliases: ["h2", "heading2", "subtitle", "##"],
    },
    {
      id: "h3",
      label: "Heading 3",
      hint: "Small section heading",
      icon: "H3",
      tag: "h3",
      aliases: ["h3", "heading3", "###"],
    },
    {
      id: "ul",
      label: "Bullet List",
      hint: "Unordered list",
      icon: "•",
      action: "ul",
      aliases: ["ul", "bullet", "list", "-", "*"],
    },
    {
      id: "ol",
      label: "Numbered List",
      hint: "Ordered list",
      icon: "1.",
      action: "ol",
      aliases: ["ol", "numbered", "number", "ordered"],
    },
    {
      id: "code",
      label: "Code Block",
      hint: "Syntax highlighted code",
      icon: "</>",
      action: "code",
      aliases: ["code", "pre", "snippet", "```", "codeblock"],
    },
    {
      id: "quote",
      label: "Quote",
      hint: "Block quotation",
      icon: '"',
      tag: "blockquote",
      aliases: ["quote", "blockquote", ">", "citation"],
    },
    {
      id: "hr",
      label: "Divider",
      hint: "Horizontal separator",
      icon: "—",
      action: "hr",
      aliases: ["hr", "divider", "---", "rule", "line", "separator"],
    },
  ];

  let filteredCmds = $derived(
    slashQuery.trim()
      ? slashCommands.filter((c) => {
          const q = slashQuery.toLowerCase();
          return (
            c.label.toLowerCase().includes(q) ||
            c.id.includes(q) ||
            c.aliases?.some((a) => a.includes(q))
          );
        })
      : slashCommands,
  );

  let filteredFonts = $derived(
    fontSearch.trim()
      ? googleFontsList.filter((f) =>
          f.toLowerCase().includes(fontSearch.toLowerCase()),
        )
      : googleFontsList,
  );

  let searchResults = $derived.by(() => {
    const q = docSearch.trim().toLowerCase();
    if (!q) {
      return tabs.map((tab) => {
        const text =
          tab.id === activeTabId
            ? content
            : localStorage.getItem(tabKey(tab.id)) || "";
        return {
          tab,
          title: tabDisplayTitle(tab),
          snippet: firstSnippet(text),
          score: tab.id === activeTabId ? 1 : 0,
        };
      });
    }
    return tabs
      .map((tab) => {
        const text =
          tab.id === activeTabId
            ? content
            : localStorage.getItem(tabKey(tab.id)) || "";
        const title = tabDisplayTitle(tab);
        const titleIndex = title.toLowerCase().indexOf(q);
        const textIndex = text.toLowerCase().indexOf(q);
        if (titleIndex === -1 && textIndex === -1) return null;
        return {
          tab,
          title,
          snippet: matchSnippet(
            text,
            textIndex === -1 ? 0 : textIndex,
            q.length,
          ),
          score: titleIndex === -1 ? 1 : 2,
        };
      })
      .filter(Boolean)
      .sort(
        (a, b) =>
          b.score - a.score || tabs.indexOf(a.tab) - tabs.indexOf(b.tab),
      );
  });

  $effect(() => {
    docSearchIndex = Math.min(
      docSearchIndex,
      Math.max(searchResults.length - 1, 0),
    );
  });

  $effect(() => {
    if (showSearch) requestAnimationFrame(() => docSearchEl?.focus());
  });

  const RECENT_KEY = "notes-recent-fonts";
  const MAX_RECENT = 8;
  let recentFonts = $state([]);

  function loadRecentFonts() {
    try {
      recentFonts = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
    } catch {
      recentFonts = [];
    }
  }

  function saveRecentFont(name) {
    const next = [name, ...recentFonts.filter((f) => f !== name)].slice(
      0,
      MAX_RECENT,
    );
    recentFonts = next;
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  }

  onMount(() => {
    const savedFont = localStorage.getItem("notes-font") || currentFont;
    currentFont = savedFont;
    loadRecentFonts();

    const savedTheme = localStorage.getItem("notes-theme");
    if (savedTheme) {
      currentTheme = savedTheme;
      document.body.className = "theme-" + savedTheme;
    } else document.body.className = "theme-" + currentTheme;

    loadTabs();
    _loadTabContent(activeTabId);
  });

  let saveTimeout;
  function debouncedSave(md) {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      localStorage.setItem(tabKey(activeTabId), md);
      _saveTabs();
      isSaving = true;
      lastSaved = new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      setTimeout(() => {
        isSaving = false;
      }, 1000);
    }, 500);
  }

  function updateCounts(text) {
    const t = text || "";
    wordCount = t.trim() ? t.trim().split(/\s+/).length : 0;
    charCount = t.length;
  }

  function firstSnippet(text) {
    const line = text
      .split("\n")
      .map((l) => l.trim())
      .find(Boolean);
    return line || "Empty document";
  }

  function matchSnippet(text, index, length) {
    if (!text.trim()) return "Empty document";
    const start = Math.max(0, index - 42);
    const end = Math.min(text.length, index + Math.max(length, 1) + 80);
    const prefix = start > 0 ? "..." : "";
    const suffix = end < text.length ? "..." : "";
    return (
      prefix + text.slice(start, end).replace(/\s+/g, " ").trim() + suffix ||
      firstSnippet(text)
    );
  }

  function openSearch() {
    localStorage.setItem(tabKey(activeTabId), activeMarkdown());
    docSearch = "";
    docSearchIndex = 0;
    showSearch = true;
    showTheme = false;
    showFont = false;
    showExport = false;
  }

  function closeSearch() {
    showSearch = false;
    docSearch = "";
    docSearchIndex = 0;
    requestAnimationFrame(() => editorEl?.focus());
  }

  function selectSearchResult(result) {
    if (!result) return;
    if (result.tab.id !== activeTabId) switchTab(result.tab.id);
    closeSearch();
  }

  function syncContent() {
    if (!editorEl) return;
    content = htmlToMarkdown(editorEl.innerHTML);
    isEmpty = content.trim() === "";
    debouncedSave(content);
    updateCounts(content);
    scheduleHighlight();
  }

  // ── Language auto-detection ──
  const langOptions = [
    { id: "auto", label: "Auto-detect" },
    { id: "javascript", label: "JavaScript" },
    { id: "typescript", label: "TypeScript" },
    { id: "python", label: "Python" },
    { id: "html", label: "HTML" },
    { id: "css", label: "CSS" },
    { id: "json", label: "JSON" },
    { id: "bash", label: "Bash / Shell" },
    { id: "rust", label: "Rust" },
    { id: "go", label: "Go" },
    { id: "java", label: "Java" },
    { id: "sql", label: "SQL" },
    { id: "yaml", label: "YAML" },
    { id: "c", label: "C" },
    { id: "cpp", label: "C++" },
    { id: "markup", label: "XML / SVG" },
  ];

  let activePre = $state(null);
  let activePreRect = $state(null);
  let showLangPicker = $state(false);

  function detectLanguage(code) {
    const t = code.trim();
    if (!t || t.length < 8) return null;
    const checks = [
      [
        "typescript",
        [
          /\b(interface|type\s+\w+\s*=|enum|implements|readonly|namespace|as\s+\w+)\b/,
          /:\s*(string|number|boolean|void|any|never)\b/,
          /<[A-Z]\w+>/,
        ],
      ],
      [
        "javascript",
        [
          /\b(const|let|var|function\s+\w+|=>|async|await|require\s*\(|module\.exports)\b/,
          /console\.(log|error|warn)/,
          /\.(then|catch|finally)\(/,
          /`\${/,
        ],
      ],
      [
        "python",
        [
          /\bdef\s+\w+\s*\(/,
          /\b(import|from)\s+\w+/,
          /\bclass\s+\w+.*:/,
          /\bprint\s*\(/,
          /#.*$/,
          /"""/,
        ],
      ],
      [
        "html",
        [
          /<[a-z][\w-]*\s*[^>]*>/,
          /<!DOCTYPE\s+html/i,
          /<\/(div|span|p|a|h[1-6]|body|html)>/i,
        ],
      ],
      [
        "css",
        [
          /[.#][\w-]+\s*\{/,
          /@(media|keyframes|import|font-face)/,
          /:\s*[\w-]+\s*;/,
        ],
      ],
      [
        "json",
        [/^\s*[[{][\s\S]*[\]}]\s*$/, /"[\w-]+":\s*("|{|\[|\d|true|false|null)/],
      ],
      [
        "bash",
        [
          /^#!\//,
          /\b(echo|ls|cd|grep|sed|awk|chmod|export|curl|git)\s/,
          /\$\{?\w+\}?/,
          /\|\s*\w+/,
        ],
      ],
      [
        "sql",
        [/\b(SELECT|FROM|WHERE|JOIN|INSERT|UPDATE|DELETE|CREATE\s+TABLE)\b/i],
      ],
      [
        "rust",
        [
          /\bfn\s+\w+\s*\(/,
          /\b(let mut|impl |struct |enum |trait |use |pub |crate)\b/,
          /::/,
        ],
      ],
      [
        "go",
        [
          /\bfunc\s+\w+\s*\(/,
          /\b(package|var|type|interface|struct)\b/,
          /:=/,
          /fmt\./,
        ],
      ],
      [
        "java",
        [
          /\b(public|private|protected)\s+(static\s+)?[\w<>]+\s+\w+\s*\(/,
          /System\.(out|err)\./,
          /@Override/,
        ],
      ],
      ["cpp", [/#include\s*[<"]/, /\b(std::|cout|cin|nullptr|vector<|map<)\b/]],
      [
        "c",
        [
          /#include\s*[<"]/,
          /\b(printf|scanf|malloc|free|NULL)\b/,
          /\bint\s+main\s*\(/,
        ],
      ],
      ["yaml", [/^[\w-]+:\s*\S/m, /^\s*-\s+\w/m, /^---\s*$/m]],
      ["markup", [/<\?xml/, /<[A-Z][A-Z:]+[\s>]/, /xmlns:/]],
    ];
    let best = null,
      bestScore = 0;
    for (const [lang, pats] of checks) {
      const score = pats.filter((p) => p.test(t)).length;
      if (score > bestScore) {
        bestScore = score;
        best = lang;
      }
    }
    return bestScore >= 1 ? best : null;
  }

  function setCodeLang(langId) {
    if (!activePre) return;
    const codeEl = activePre.querySelector("code");
    if (langId === "auto") {
      activePre.removeAttribute("data-lang");
      if (codeEl) {
        const detected = detectLanguage(codeEl.textContent);
        if (detected) {
          activePre.setAttribute("data-lang", detected);
          codeEl.className = `language-${detected}`;
        } else {
          codeEl.className = "";
        }
      }
    } else {
      activePre.setAttribute("data-lang", langId);
      if (codeEl) codeEl.className = `language-${langId}`;
    }
    if (codeEl) {
      codeEl.textContent = codeEl.textContent; // strip old Prism spans
      Prism.highlightElement(codeEl);
    }
    showLangPicker = false;
    syncContent();
  }

  // ── Prism syntax highlighting ──
  let hlTimeout;
  function scheduleHighlight() {
    clearTimeout(hlTimeout);
    hlTimeout = setTimeout(applyPrism, 700);
  }

  function applyPrism() {
    if (!editorEl) return;
    const sel = window.getSelection();
    editorEl.querySelectorAll("pre code").forEach((block) => {
      // Skip the block where the cursor is currently typing
      if (sel?.focusNode && block.contains(sel.focusNode)) return;
      const pre = block.closest("pre");
      // Strip any existing Prism spans to re-highlight cleanly
      const raw = block.textContent;
      block.textContent = raw;
      if (!block.className) {
        const lang = pre?.getAttribute("data-lang") || detectLanguage(raw);
        if (lang) {
          pre?.setAttribute("data-lang", lang);
          block.className = `language-${lang}`;
        }
      }
      Prism.highlightElement(block);
    });
  }

  // ── Block helpers ──
  function getContainingBlock(node) {
    let el = node?.nodeType === 3 ? node.parentElement : node;
    while (el && el.parentElement !== editorEl && el !== editorEl)
      el = el.parentElement;
    return el && el !== editorEl ? el : null;
  }

  // ── Inline markdown shortcuts: **bold**, *italic*, `code` ──
  function applyInlineFormat(textNode, matchStart, matchEnd, tag, content) {
    const parent = textNode.parentNode;
    if (!parent) return false;
    const before = textNode.textContent.slice(0, matchStart);
    const after = textNode.textContent.slice(matchEnd);
    const fmtEl = document.createElement(tag);
    fmtEl.textContent = content;
    const afterNode = document.createTextNode(after || "\u200b");
    if (before) parent.insertBefore(document.createTextNode(before), textNode);
    parent.insertBefore(fmtEl, textNode);
    parent.insertBefore(afterNode, textNode);
    parent.removeChild(textNode);
    // Place cursor right after the formatted element
    const sel = window.getSelection();
    const r = document.createRange();
    r.setStart(afterNode, after ? 0 : 1);
    r.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(r);
    return true;
  }

  let _inlineSkip = false;
  function tryInlineMarkdown() {
    if (_inlineSkip) return;
    const sel = window.getSelection();
    if (!sel?.rangeCount || !sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== 3) return; // text node only
    if (node.parentElement?.closest("pre, code")) return; // skip code blocks
    const offset = range.startOffset;
    const text = node.textContent.slice(0, offset);

    // **bold**
    const boldM = text.match(/\*\*([^*\n]+)\*\*$/);
    if (boldM) {
      _inlineSkip = true;
      applyInlineFormat(
        node,
        offset - boldM[0].length,
        offset,
        "strong",
        boldM[1],
      );
      _inlineSkip = false;
      syncContent();
      return;
    }
    // *italic* (not preceded by another *)
    const italicM = text.match(/(?<!\*)\*([^*\n]+)\*$/);
    if (italicM) {
      _inlineSkip = true;
      applyInlineFormat(
        node,
        offset - italicM[0].length,
        offset,
        "em",
        italicM[1],
      );
      _inlineSkip = false;
      syncContent();
      return;
    }
    // `inline code`
    const codeM = text.match(/`([^`\n]+)`$/);
    if (codeM) {
      _inlineSkip = true;
      applyInlineFormat(
        node,
        offset - codeM[0].length,
        offset,
        "code",
        codeM[1],
      );
      _inlineSkip = false;
      syncContent();
      return;
    }
    // ~~strikethrough~~
    const strikeM = text.match(/~~([^~\n]+)~~$/);
    if (strikeM) {
      _inlineSkip = true;
      applyInlineFormat(
        node,
        offset - strikeM[0].length,
        offset,
        "del",
        strikeM[1],
      );
      _inlineSkip = false;
      syncContent();
      return;
    }
  }

  // ── Floating selection toolbar ──
  let showSelBar = $state(false);
  let selBarPos = $state({ top: 0, left: 0 });
  let selBarLink = $state(false);
  let linkInputVal = $state("");
  let _savedRange = null;
  let selBarEl = $state(null);

  function handleSelectionChange() {
    const sel = window.getSelection();
    // Keep open if link input is active
    if (selBarLink) return;
    if (!sel || sel.isCollapsed || !sel.rangeCount) {
      showSelBar = false;
      return;
    }
    if (!editorEl?.contains(sel.anchorNode)) {
      showSelBar = false;
      return;
    }
    if (sel.anchorNode?.parentElement?.closest("pre")) {
      showSelBar = false;
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    if (rect.width === 0) {
      showSelBar = false;
      return;
    }
    selBarPos = {
      top: rect.top - 48,
      left: Math.max(
        80,
        Math.min(window.innerWidth - 80, rect.left + rect.width / 2),
      ),
    };
    showSelBar = true;
  }

  function selBarBold() {
    document.execCommand("bold");
    syncContent();
  }
  function selBarItalic() {
    document.execCommand("italic");
    syncContent();
  }
  function selBarStrike() {
    document.execCommand("strikeThrough");
    syncContent();
  }
  function selBarUnderline() {
    document.execCommand("underline");
    syncContent();
  }
  function selBarCode() {
    const sel = window.getSelection();
    if (!sel?.rangeCount) return;
    const txt = sel.getRangeAt(0).toString();
    if (txt) {
      document.execCommand("insertHTML", false, `<code>${txt}</code>`);
      syncContent();
    }
  }
  function selBarOpenLink() {
    const sel = window.getSelection();
    if (sel?.rangeCount) _savedRange = sel.getRangeAt(0).cloneRange();
    linkInputVal = "";
    selBarLink = true;
    // focus the input on next tick
    setTimeout(() => selBarEl?.querySelector(".sel-link-input")?.focus(), 0);
  }
  function selBarApplyLink() {
    const url = linkInputVal.trim();
    selBarLink = false;
    if (!url) return;
    if (_savedRange) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(_savedRange);
      _savedRange = null;
    }
    document.execCommand(
      "createLink",
      false,
      url.startsWith("http") ? url : "https://" + url,
    );
    showSelBar = false;
    syncContent();
  }

  // ── Input handler ──
  function handleInput() {
    // Track slash query if menu is open
    if (showSlash && slashBlock) {
      const text = slashBlock.textContent ?? "";
      const idx = text.lastIndexOf("/");
      if (idx === -1) {
        showSlash = false;
      } else {
        slashQuery = text.slice(idx + 1);
        slashIndex = 0;
      }
    }
    tryInlineMarkdown();
    syncContent();
  }

  // ── Execute slash command ──
  function executeSlashCmd(cmd) {
    const block = slashBlock;
    showSlash = false;
    slashQuery = "";
    slashBlock = null;
    if (!block) return;

    // Clear the /query text from the block
    if (block !== editorEl) block.innerHTML = "<br>";

    const sel = window.getSelection();
    function place(el) {
      const r = document.createRange();
      r.setStart(el.firstChild ?? el, 0);
      r.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(r);
    }

    if (cmd.tag) {
      const el = document.createElement(cmd.tag);
      el.innerHTML = "<br>";
      block.replaceWith(el);
      place(el);
    } else if (cmd.action === "ul" || cmd.action === "ol") {
      const list = document.createElement(cmd.action);
      const li = document.createElement("li");
      li.innerHTML = "<br>";
      list.appendChild(li);
      block.replaceWith(list);
      place(li);
    } else if (cmd.action === "code") {
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = "\n";
      pre.appendChild(code);
      const after = document.createElement("p");
      after.innerHTML = "<br>";
      block.replaceWith(pre);
      pre.after(after);
      const r = document.createRange();
      r.setStart(code.firstChild, 0);
      r.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(r);
    } else if (cmd.action === "hr") {
      const hr = document.createElement("hr");
      const p = document.createElement("p");
      p.innerHTML = "<br>";
      block.replaceWith(hr);
      hr.after(p);
      place(p);
    }

    editorEl?.focus();
    syncContent();
  }

  // ── Keydown handler ──
  function handleKeydown(e) {
    const sel = window.getSelection();
    const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
    const startNode = range?.startContainer;

    // ── Slash menu navigation ──
    if (showSlash && filteredCmds.length) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        slashIndex = (slashIndex + 1) % filteredCmds.length;
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        slashIndex =
          (slashIndex - 1 + filteredCmds.length) % filteredCmds.length;
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        executeSlashCmd(filteredCmds[slashIndex]);
        return;
      }
    }
    if (showSlash && e.key === "Escape") {
      showSlash = false;
      return;
    }

    // ── Detect / to open slash menu ──
    if (e.key === "/" && !showSlash) {
      setTimeout(() => {
        const s = window.getSelection();
        if (!s?.rangeCount) return;
        const rect = s.getRangeAt(0).getBoundingClientRect();
        slashPos = { top: rect.bottom + 6, left: rect.left };
        slashBlock = getContainingBlock(s.getRangeAt(0).startContainer) ?? null;
        slashQuery = "";
        slashIndex = 0;
        showSlash = true;
      }, 0);
    }

    // ── Backspace: fix first-element / special-block deletion ──
    if (e.key === "Backspace" && range?.collapsed) {
      const block = getContainingBlock(startNode);
      if (block) {
        const tag = block.tagName.toLowerCase();
        const special = [
          "h1",
          "h2",
          "h3",
          "h4",
          "h5",
          "h6",
          "blockquote",
        ].includes(tag);
        const empty = block.innerHTML === "" || block.innerHTML === "<br>";
        if (special && empty) {
          e.preventDefault();
          const p = document.createElement("p");
          p.innerHTML = "<br>";
          block.replaceWith(p);
          const r = document.createRange();
          r.setStart(p, 0);
          r.collapse(true);
          sel.removeAllRanges();
          sel.addRange(r);
          syncContent();
          return;
        }
        // Also handle: cursor at offset 0 in first child of a special block
        if (
          special &&
          range.startOffset === 0 &&
          !block.previousElementSibling
        ) {
          // Convert block type to paragraph so user can delete back into it
          e.preventDefault();
          document.execCommand("formatBlock", false, "p");
          syncContent();
          return;
        }
      }
    }

    // ── Enter ──
    if (e.key === "Enter" && !e.shiftKey) {
      // Inside a code block: handle ``` fence closing
      const codeEl =
        startNode?.nodeType === 3
          ? startNode.parentElement?.closest("pre code")
          : startNode?.closest?.("pre code");

      if (codeEl) {
        const preEl = codeEl.closest("pre");
        // Detect ``` line as exit fence
        const lineText = (() => {
          if (startNode?.nodeType === 3) {
            const lastNl = startNode.textContent.lastIndexOf(
              "\n",
              range.startOffset - 1,
            );
            return startNode.textContent
              .slice(lastNl + 1, range.startOffset)
              .trim();
          }
          return "";
        })();
        if (lineText === "```") {
          e.preventDefault();
          // Remove the closing ``` from the code block's text
          if (startNode?.nodeType === 3) {
            const lastNl = startNode.textContent.lastIndexOf(
              "\n",
              range.startOffset - 1,
            );
            startNode.textContent =
              startNode.textContent.slice(0, lastNl === -1 ? 0 : lastNl) +
              startNode.textContent.slice(range.startOffset);
          }
          const newP = document.createElement("p");
          newP.innerHTML = "<br>";
          preEl.after(newP);
          const r = document.createRange();
          r.setStart(newP, 0);
          r.collapse(true);
          sel.removeAllRanges();
          sel.addRange(r);
          syncContent();
          return;
        }
        // Normal newline inside code block
        e.preventDefault();
        document.execCommand("insertText", false, "\n");
        syncContent();
        return;
      }

      // Detect --- → divider (robust: handles null block and br siblings)
      const block = getContainingBlock(startNode);
      const hrTarget =
        block ??
        (startNode?.nodeType === 3 && startNode.parentElement === editorEl
          ? null
          : startNode?.parentElement) ??
        (startNode?.nodeType === 3 ? startNode : null);
      if (hrTarget && /^-{3,}$/.test(hrTarget.textContent?.trim() ?? "")) {
        e.preventDefault();
        const hr = document.createElement("hr");
        const p = document.createElement("p");
        p.innerHTML = "<br>";
        hrTarget.replaceWith(hr);
        hr.after(p);
        const r = document.createRange();
        r.setStart(p, 0);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
        syncContent();
        return;
      }

      // Detect ``` or ```lang at start of block → create code block
      if (block) {
        const blockText = block.textContent.trim();
        const m = blockText.match(/^```(\w*)$/);
        if (m) {
          e.preventDefault();
          const lang = m[1];
          const pre = document.createElement("pre");
          if (lang) pre.setAttribute("data-lang", lang);
          const code = document.createElement("code");
          if (lang) code.className = `language-${lang}`;
          code.textContent = "\n";
          pre.appendChild(code);
          // Insert pre + a paragraph after it so user can exit
          const after = document.createElement("p");
          after.innerHTML = "<br>";
          block.replaceWith(pre);
          pre.after(after);
          const r = document.createRange();
          r.setStart(code.firstChild, 0);
          r.collapse(true);
          sel.removeAllRanges();
          sel.addRange(r);
          syncContent();
          return;
        }
      }

      // Exit headings / blockquote on Enter when at end of non-empty block
      if (block) {
        const tag = block.tagName.toLowerCase();
        if (["h1", "h2", "h3", "h4", "h5", "h6", "blockquote"].includes(tag)) {
          const atEnd =
            range.startOffset === (startNode?.textContent?.length ?? 0);
          if (atEnd || block.textContent.trim() !== "") {
            e.preventDefault();
            const p = document.createElement("p");
            p.innerHTML = "<br>";
            block.after(p);
            const r = document.createRange();
            r.setStart(p, 0);
            r.collapse(true);
            sel.removeAllRanges();
            sel.addRange(r);
            syncContent();
            return;
          }
        }
      }
    }

    // ── Space: markdown input rules ──
    if (e.key === " " && startNode?.nodeType === 3) {
      const before = startNode.textContent.slice(0, range.startOffset);
      let tag = null;
      if (before === "#") tag = "h1";
      else if (before === "##") tag = "h2";
      else if (before === "###") tag = "h3";
      else if (before === ">") tag = "blockquote";

      if (tag) {
        e.preventDefault();
        // Remaining text after the trigger prefix
        const remaining =
          startNode.textContent.slice(
            before.length + range.startOffset - before.length,
          ) || "";
        const newEl = document.createElement(tag);
        if (remaining) newEl.textContent = remaining;
        else newEl.innerHTML = "<br>";

        const block = getContainingBlock(startNode);
        if (block) {
          block.replaceWith(newEl);
        } else if (startNode.parentElement === editorEl) {
          // Text is directly inside the editor div — wrap it
          startNode.replaceWith(newEl);
        } else {
          editorEl.insertBefore(newEl, startNode.parentElement);
          startNode.parentElement?.remove();
        }

        const r = document.createRange();
        const target = newEl.firstChild ?? newEl;
        r.setStart(target, 0);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
        syncContent();
        return;
      }

      if (before === "-" || before === "*") {
        e.preventDefault();
        const ul = document.createElement("ul");
        const li = document.createElement("li");
        li.innerHTML = "<br>";
        ul.appendChild(li);
        const block = getContainingBlock(startNode);
        if (block) {
          block.replaceWith(ul);
        } else if (startNode.parentElement === editorEl) {
          startNode.replaceWith(ul);
        }
        const r = document.createRange();
        r.setStart(li, 0);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
        syncContent();
        return;
      }
    }

    // ── Backtick: detect triple-backtick ──
    if (e.key === "`" && startNode?.nodeType === 3) {
      const before = startNode.textContent.slice(0, range.startOffset);
      if (before.endsWith("``")) {
        e.preventDefault();
        // Remove the two preceding backticks and current block text before them
        const block = getContainingBlock(startNode);
        const lang = before.slice(0, -2).trim();
        const pre = document.createElement("pre");
        if (lang) pre.setAttribute("data-lang", lang);
        const code = document.createElement("code");
        if (lang) code.className = `language-${lang}`;
        code.textContent = "\n";
        pre.appendChild(code);
        const after = document.createElement("p");
        after.innerHTML = "<br>";
        if (block) {
          block.replaceWith(pre);
        } else {
          editorEl.appendChild(pre);
        }
        pre.after(after);
        const r = document.createRange();
        r.setStart(code.firstChild, 0);
        r.collapse(true);
        sel.removeAllRanges();
        sel.addRange(r);
        syncContent();
        return;
      }
    }

    // ── Standard shortcuts ──
    if (e.key === "Tab") {
      e.preventDefault();
      document.execCommand("insertHTML", false, "\u00a0\u00a0");
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "b") {
      e.preventDefault();
      document.execCommand("bold");
      syncContent();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "i") {
      e.preventDefault();
      document.execCommand("italic");
      syncContent();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "u") {
      e.preventDefault();
      document.execCommand("underline");
      syncContent();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "h") {
      e.preventDefault();
      execFormat("h2");
      return;
    }
    if (e.key === "Escape") closeAll();
  }

  function handleWindowKeydown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      openSearch();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      showExport = !showExport;
      showTheme = false;
      showFont = false;
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "t") {
      e.preventDefault();
      newTab();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === "w") {
      e.preventDefault();
      closeTab(activeTabId);
    }
    if (e.key === "Escape") {
      if (showSearch) {
        closeSearch();
      } else if (renamingTabId) {
        renamingTabId = null;
      } else closeAll();
    }
  }

  function handlePaste(e) {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    syncContent();
  }

  // Re-highlight a code block when focus leaves it + auto-detect language
  function handleFocusOut(e) {
    const codeBlock = e.target.closest?.("pre code");
    if (codeBlock) {
      const raw = codeBlock.textContent;
      codeBlock.textContent = raw;
      const pre = codeBlock.closest("pre");
      if (pre && !pre.getAttribute("data-lang")) {
        const detected = detectLanguage(raw);
        if (detected) {
          pre.setAttribute("data-lang", detected);
          codeBlock.className = `language-${detected}`;
        }
      }
      Prism.highlightElement(codeBlock);
      if (activePre === pre) activePreRect = pre.getBoundingClientRect();
    }
  }

  function handleEditorMouseOver(e) {
    const pre = e.target.closest?.("pre");
    if (pre && editorEl?.contains(pre)) {
      activePre = pre;
      activePreRect = pre.getBoundingClientRect();
    }
  }

  function handleEditorMouseLeave(e) {
    if (!e.relatedTarget?.closest?.(".code-toolbar")) {
      if (!showLangPicker) activePre = null;
    }
  }

  function handleToolbarMouseLeave(e) {
    if (
      !e.relatedTarget?.closest?.(".code-toolbar") &&
      !e.relatedTarget?.closest?.("pre")
    ) {
      showLangPicker = false;
      activePre = null;
    }
  }

  function execFormat(tag) {
    if (!editorEl) return;
    editorEl.focus();
    document.execCommand("formatBlock", false, tag);
    syncContent();
  }

  function applyBold() {
    document.execCommand("bold");
    syncContent();
  }
  function applyItalic() {
    document.execCommand("italic");
    syncContent();
  }
  function applyHeading() {
    execFormat("h2");
  }
  function applyList() {
    document.execCommand("insertUnorderedList");
    syncContent();
  }
  function applyQuote() {
    execFormat("blockquote");
  }
  function applyCode() {
    if (!editorEl) return;
    editorEl.focus();
    const sel = window.getSelection();
    if (sel?.rangeCount && !sel.isCollapsed) {
      const txt = sel.getRangeAt(0).toString();
      document.execCommand("insertHTML", false, `<code>${txt}</code>`);
    } else {
      const pre = document.createElement("pre");
      const code = document.createElement("code");
      code.textContent = "\n";
      pre.appendChild(code);
      const after = document.createElement("p");
      after.innerHTML = "<br>";
      const r = sel?.getRangeAt(0);
      if (r) {
        r.deleteContents();
        r.insertNode(after);
        r.insertNode(pre);
        const nr = document.createRange();
        nr.setStart(code.firstChild, 0);
        nr.collapse(true);
        sel.removeAllRanges();
        sel.addRange(nr);
      }
    }
    syncContent();
  }

  function closeAll() {
    showExport = false;
    showTheme = false;
    showFont = false;
  }

  function changeTheme(t) {
    currentTheme = t;
    document.body.className = "theme-" + t;
    localStorage.setItem("notes-theme", t);
    showTheme = false;
  }

  function selectFont(f) {
    currentFont = `'${f}', sans-serif`;
    localStorage.setItem("notes-font", currentFont);
    if (editorEl) editorEl.style.fontFamily = currentFont;
    saveRecentFont(f);
    showFont = false;
    fontSearch = "";
  }

  function exportFormat(type) {
    showExport = false;
    const c = content || "";
    if (type === "md") {
      download(
        new Blob([c], { type: "text/markdown" }),
        `notes-${Date.now()}.md`,
      );
    } else if (type === "html") {
      const h = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:ui-monospace,monospace;max-width:800px;margin:40px auto;padding:20px;line-height:1.8}pre{background:#f5f5f5;padding:16px;border-radius:8px;overflow-x:auto}code{background:#eee;padding:2px 6px;border-radius:4px}</style></head><body>${markdownToHtml(c)}</body></html>`;
      download(
        new Blob([h], { type: "text/html" }),
        `notes-${Date.now()}.html`,
      );
    } else if (type === "pdf") {
      const pw = window.open("", "_blank");
      pw.document.write(
        `<!DOCTYPE html><html><head><meta charset="utf-8"><style>@media print{@page{size:A4;margin:2cm}body{font-family:ui-monospace,monospace}}</style></head><body>${markdownToHtml(c)}<script>print();close()</scr` +
          `ipt></body></html>`,
      );
      pw.document.close();
    }
  }

  function copyDownload() {
    download(
      new Blob([content || ""], { type: "text/markdown" }),
      `notes-${Date.now()}.md`,
    );
  }

  function currentFontName() {
    return currentFont.replace(/'/g, "").split(",")[0].trim();
  }
</script>

<svelte:window
  onkeydown={handleWindowKeydown}
  onselectionchange={handleSelectionChange}
  onclick={(e) => {
    if (!e.target.closest(".popout-wrap") && !e.target.closest(".font-search"))
      closeAll();
    if (!e.target.closest(".slash-menu")) showSlash = false;
    if (!e.target.closest(".code-toolbar") && !e.target.closest("pre")) {
      showLangPicker = false;
      activePre = null;
    }
    if (!e.target.closest(".sel-toolbar")) {
      selBarLink = false;
    }
  }}
/>

<div class="wrap">
  <aside class="sidebar">
    <div class="sb-top">
      <!-- Theme -->
      <div class="popout-wrap">
        <button
          class="sidebar-icon"
          onclick={(e) => {
            e.stopPropagation();
            showTheme = !showTheme;
            showFont = false;
            showExport = false;
          }}
          title="Theme"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            ><circle cx="12" cy="12" r="10" /><path
              d="M12 2a10 10 0 0 1 0 20"
            /><path d="M12 7a5 5 0 0 1 0 10" /></svg
          >
          <span class="tooltip">Theme</span>
        </button>
        {#if showTheme}
          <div class="popout theme-popout">
            <div class="theme-grid">
              {#each themes as t}
                <button
                  class="theme-swatch-btn {currentTheme === t ? 'active' : ''}"
                  onclick={() => changeTheme(t)}
                  style="background:{themeColors[t]}"
                  title={t}
                ></button>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <!-- Font -->
      <div class="popout-wrap">
        <button
          class="sidebar-icon"
          onclick={(e) => {
            e.stopPropagation();
            showFont = !showFont;
            if (showFont) {
              fetchFontList();
              recentFonts.forEach((f) => loadFont(f));
            }
            showTheme = false;
            showExport = false;
          }}
          title="Font"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            ><polyline points="4 7 4 4 20 4 20 7" /><line
              x1="9"
              y1="20"
              x2="15"
              y2="20"
            /><line x1="12" y1="4" x2="12" y2="20" /></svg
          >
          <span class="tooltip">{currentFontName()}</span>
        </button>
        {#if showFont}
          <div class="popout font-popout">
            <input
              class="font-search"
              type="text"
              placeholder="Search fonts…"
              bind:value={fontSearch}
              bind:this={fontSearchEl}
              onclick={(e) => e.stopPropagation()}
              onkeydown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  fontListEl?.querySelector(".font-item")?.focus();
                } else if (e.key === "Escape") {
                  showFont = false;
                }
              }}
            />
            <div class="font-list" bind:this={fontListEl}>
              {#if fontsLoading}
                <div class="font-empty">Loading fonts…</div>
              {:else}
                {#if !fontSearch.trim() && recentFonts.length > 0}
                  <div class="font-section-label">Recent</div>
                  {#each recentFonts as f, i}
                    <button
                      class="font-item {currentFont.includes(f)
                        ? 'active'
                        : ''}"
                      style={`font-family: "${f}", sans-serif`}
                      onclick={() => selectFont(f)}
                      onkeydown={(e) => {
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          fontListEl
                            .querySelectorAll(".font-item")
                            [i + 1]?.focus();
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          i === 0
                            ? fontSearchEl?.focus()
                            : fontListEl
                                .querySelectorAll(".font-item")
                                [i - 1]?.focus();
                        } else if (e.key === "Enter") selectFont(f);
                        else if (e.key === "Escape") showFont = false;
                      }}>{f}</button
                    >
                  {/each}
                  <div class="font-section-divider"></div>
                  <div class="font-section-label">All fonts</div>
                {/if}
                {#each filteredFonts as f, i}
                  {@const allIdx =
                    !fontSearch.trim() && recentFonts.length > 0
                      ? recentFonts.length + i
                      : i}
                  <button
                    class="font-item {currentFont.includes(f) ? 'active' : ''}"
                    style={`font-family: "${f}", sans-serif`}
                    onclick={() => selectFont(f)}
                    data-font={f}
                    onkeydown={(e) => {
                      if (e.key === "ArrowDown") {
                        e.preventDefault();
                        fontListEl
                          .querySelectorAll(".font-item")
                          [allIdx + 1]?.focus();
                      } else if (e.key === "ArrowUp") {
                        e.preventDefault();
                        allIdx === 0
                          ? fontSearchEl?.focus()
                          : fontListEl
                              .querySelectorAll(".font-item")
                              [allIdx - 1]?.focus();
                      } else if (e.key === "Enter") selectFont(f);
                      else if (e.key === "Escape") showFont = false;
                    }}>{f}</button
                  >
                {/each}
                {#if filteredFonts.length === 0}
                  <div class="font-empty">No fonts found</div>
                {/if}
              {/if}
            </div>
          </div>
        {/if}
      </div>

      <div class="sb-divider"></div>

      <button
        class="sidebar-icon"
        onmousedown={(e) => e.preventDefault()}
        onclick={applyBold}
        title="Bold"
        ><svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          ><path d="M9 5h6a3 3 0 0 1 0 6H9z" /><path
            d="M9 12h6a3 3 0 0 1 0 6H9z"
          /></svg
        ><span class="tooltip">Bold (⌘B)</span></button
      >
      <button
        class="sidebar-icon"
        onmousedown={(e) => e.preventDefault()}
        onclick={applyItalic}
        title="Italic"
        ><svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          ><path d="M19 4H10" /><path d="M14 20H5" /><line
            x1="15"
            y1="4"
            x2="10"
            y2="20"
          /></svg
        ><span class="tooltip">Italic (⌘I)</span></button
      >
      <button
        class="sidebar-icon"
        onmousedown={(e) => e.preventDefault()}
        onclick={applyHeading}
        title="Heading"
        ><svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          ><path d="M4 6v12" /><path d="M20 6v12" /><path d="M4 12h16" /></svg
        ><span class="tooltip">Heading (⌘H)</span></button
      >
      <button
        class="sidebar-icon"
        onmousedown={(e) => e.preventDefault()}
        onclick={applyList}
        title="List"
        ><svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          ><line x1="8" y1="6" x2="21" y2="6" /><line
            x1="8"
            y1="12"
            x2="21"
            y2="12"
          /><line x1="8" y1="18" x2="21" y2="18" /><circle
            cx="3"
            cy="6"
            r="1"
            fill="currentColor"
          /><circle cx="3" cy="12" r="1" fill="currentColor" /><circle
            cx="3"
            cy="18"
            r="1"
            fill="currentColor"
          /></svg
        ><span class="tooltip">List</span></button
      >
      <button
        class="sidebar-icon"
        onmousedown={(e) => e.preventDefault()}
        onclick={applyQuote}
        title="Quote"
        ><svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          ><path
            d="M3 21c3 0 7-1 7-7V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h3"
          /></svg
        ><span class="tooltip">Quote</span></button
      >
      <button
        class="sidebar-icon"
        onmousedown={(e) => e.preventDefault()}
        onclick={applyCode}
        title="Code"
        ><svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          ><polyline points="16 18 22 12 16 6" /><polyline
            points="8 6 2 12 8 18"
          /></svg
        ><span class="tooltip">Code</span></button
      >

      <div class="sb-divider"></div>

      <!-- Export -->
      <div class="popout-wrap">
        <button
          class="sidebar-icon"
          onclick={(e) => {
            e.stopPropagation();
            showExport = !showExport;
            showTheme = false;
            showFont = false;
          }}
          title="Export"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            ><path
              d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
            /><polyline points="14 2 14 8 20 8" /></svg
          >
          <span class="tooltip">Export</span>
        </button>
        {#if showExport}
          <div class="popout export-popout">
            <button class="export-item" onclick={() => exportFormat("md")}
              ><svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                ><path
                  d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
                /><polyline points="14 2 14 8 20 8" /></svg
              >Markdown</button
            >
            <button class="export-item" onclick={() => exportFormat("html")}
              ><svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                ><polyline points="16 18 22 12 16 6" /><polyline
                  points="8 6 2 12 8 18"
                /></svg
              >HTML</button
            >
            <button class="export-item" onclick={() => exportFormat("pdf")}
              ><svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                ><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline
                  points="7 10 12 15 17 10"
                /><line x1="12" y1="15" x2="12" y2="3" /></svg
              >PDF</button
            >
          </div>
        {/if}
      </div>

      <button class="sidebar-icon" onclick={copyDownload} title="Download .md">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          ><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline
            points="7 10 12 15 17 10"
          /><line x1="12" y1="15" x2="12" y2="3" /></svg
        >
        <span class="tooltip">Download .md</span>
      </button>
    </div>

    <div class="sidebar-footer">
      {#if isSaving}
        <svg
          class="spin"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          ><circle cx="12" cy="12" r="10" stroke-opacity=".25" /><path
            d="M12 2a10 10 0 0 1 10 10"
          /></svg
        >
      {:else}
        <div class="sb-stat" title={`${charCount} chars • saved ${lastSaved}`}>
          {wordCount}w
        </div>
      {/if}
    </div>
  </aside>

  <main class="editor-area">
    <!-- VS Code-style tab bar -->
    <div class="tab-bar">
      <div class="tab-list">
        {#each tabs as tab (tab.id)}
          <div class="tab {tab.id === activeTabId ? 'active' : ''}">
            {#if renamingTabId === tab.id}
              <input
                class="tab-rename-input"
                bind:this={renameInputEl}
                bind:value={renameVal}
                onblur={finishRename}
                onclick={(e) => e.stopPropagation()}
                onkeydown={(e) => {
                  if (e.key === "Enter") finishRename();
                  if (e.key === "Escape") {
                    renamingTabId = null;
                  }
                }}
              />
            {:else}
              <button
                class="tab-btn"
                onclick={() => switchTab(tab.id)}
                ondblclick={() => startRename(tab)}
              >
                {tabDisplayTitle(tab)}
              </button>
            {/if}
            <button
              class="tab-close"
              onclick={(e) => closeTab(tab.id, e)}
              title="Close"
              tabindex="-1"
            >
              <svg
                viewBox="0 0 10 10"
                width="10"
                height="10"
                fill="none"
                stroke="currentColor"
                stroke-width="1.5"
                ><line x1="2" y1="2" x2="8" y2="8" /><line
                  x1="8"
                  y1="2"
                  x2="2"
                  y2="8"
                /></svg
              >
            </button>
          </div>
        {/each}
      </div>
      <button class="tab-new" onclick={newTab} title="New note (⌘T)">
        <svg
          viewBox="0 0 12 12"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          ><line x1="6" y1="1" x2="6" y2="11" /><line
            x1="1"
            y1="6"
            x2="11"
            y2="6"
          /></svg
        >
      </button>
    </div>

    <!-- Scrollable editor -->
    <div class="editor-scroll">
      <div
        id="noteEditor"
        bind:this={editorEl}
        contenteditable="true"
        role="textbox"
        aria-multiline="true"
        tabindex="0"
        class="notion-editor {isEmpty ? 'is-empty' : ''}"
        oninput={handleInput}
        onkeydown={handleKeydown}
        onpaste={handlePaste}
        onfocusout={handleFocusOut}
        onmouseover={handleEditorMouseOver}
        onfocus={handleEditorMouseOver}
        onmouseleave={handleEditorMouseLeave}
        data-placeholder="Start typing… or type / for commands"
      ></div>
    </div>
  </main>
</div>

{#if showSelBar}
  <div
    bind:this={selBarEl}
    class="sel-toolbar"
    role="toolbar"
    tabindex="-1"
    style="top:{selBarPos.top}px;left:{selBarPos.left}px"
    onmousedown={(e) => e.preventDefault()}
  >
    {#if selBarLink}
      <input
        class="sel-link-input"
        bind:value={linkInputVal}
        placeholder="Paste URL…"
        onkeydown={(e) => {
          if (e.key === "Enter") selBarApplyLink();
          if (e.key === "Escape") {
            selBarLink = false;
          }
        }}
      />
      <button
        class="sel-btn sel-confirm"
        onclick={selBarApplyLink}
        title="Apply"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          width="13"
          height="13"><polyline points="20 6 9 17 4 12" /></svg
        >
      </button>
    {:else}
      <button class="sel-btn" onclick={selBarBold} title="Bold"><b>B</b></button
      >
      <button class="sel-btn sel-italic" onclick={selBarItalic} title="Italic"
        ><i>I</i></button
      >
      <button
        class="sel-btn sel-under"
        onclick={selBarUnderline}
        title="Underline (⌘U)"><u>U</u></button
      >
      <button
        class="sel-btn sel-strike"
        onclick={selBarStrike}
        title="Strikethrough"><s>S</s></button
      >
      <button class="sel-btn sel-mono" onclick={selBarCode} title="Inline code"
        >&lt;&gt;</button
      >
      <div class="sel-divider"></div>
      <button class="sel-btn" onclick={selBarOpenLink} title="Link">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          width="14"
          height="14"
          ><path
            d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
          /><path
            d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
          /></svg
        >
      </button>
    {/if}
  </div>
{/if}

{#if activePre && activePreRect}
  <div
    class="code-toolbar"
    role="toolbar"
    tabindex="-1"
    style="top:{activePreRect.top + 4}px;right:{window.innerWidth -
      activePreRect.right +
      8}px"
    onmouseleave={handleToolbarMouseLeave}
  >
    <button
      class="lang-badge"
      onclick={() => {
        showLangPicker = !showLangPicker;
      }}
    >
      <span>{activePre.getAttribute("data-lang") || "···"}</span>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        width="10"
        height="10"><polyline points="6 9 12 15 18 9" /></svg
      >
    </button>
    {#if showLangPicker}
      <div class="lang-dropdown">
        {#each langOptions as opt}
          <button
            class="lang-option {(activePre.getAttribute('data-lang') ||
              'auto') === opt.id
              ? 'active'
              : ''}"
            onmousedown={(e) => {
              e.preventDefault();
              setCodeLang(opt.id);
            }}>{opt.label}</button
          >
        {/each}
      </div>
    {/if}
  </div>
{/if}

{#if showSearch}
  <button
    class="search-backdrop"
    type="button"
    aria-label="Close search"
    onclick={closeSearch}
  ></button>
  <div class="search-panel" role="dialog" aria-label="Search open documents">
    <input
      class="doc-search"
      bind:this={docSearchEl}
      bind:value={docSearch}
      placeholder="Search open documents"
      onkeydown={(e) => {
        if (e.key === "ArrowDown") {
          e.preventDefault();
          docSearchIndex = searchResults.length
            ? (docSearchIndex + 1) % searchResults.length
            : 0;
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          docSearchIndex = searchResults.length
            ? (docSearchIndex - 1 + searchResults.length) % searchResults.length
            : 0;
        } else if (e.key === "Enter") {
          e.preventDefault();
          selectSearchResult(searchResults[docSearchIndex]);
        } else if (e.key === "Escape") {
          e.preventDefault();
          closeSearch();
        }
      }}
    />
    <div class="search-list">
      {#if searchResults.length > 0}
        {#each searchResults as result, i}
          <button
            class="search-result {docSearchIndex === i ? 'active' : ''}"
            onclick={() => selectSearchResult(result)}
            onmouseover={() => {
              docSearchIndex = i;
            }}
            onfocus={() => {
              docSearchIndex = i;
            }}
          >
            <span class="search-title">{result.title}</span>
            <span class="search-snippet">{result.snippet}</span>
          </button>
        {/each}
      {:else}
        <div class="search-empty">No open documents found</div>
      {/if}
    </div>
  </div>
{/if}

{#if showSlash && filteredCmds.length > 0}
  <div class="slash-menu" style="top:{slashPos.top}px;left:{slashPos.left}px">
    <div class="slash-header">Blocks</div>
    {#each filteredCmds as cmd, i}
      <button
        class="slash-item {slashIndex === i ? 'active' : ''}"
        onmousedown={(e) => {
          e.preventDefault();
          executeSlashCmd(cmd);
        }}
        onmouseover={() => {
          slashIndex = i;
        }}
        onfocus={() => {
          slashIndex = i;
        }}
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
