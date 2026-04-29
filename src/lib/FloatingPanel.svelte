<script>
  import { onMount } from 'svelte'
  
  let { x = 0, y = 0, onClose } = $props()

  $effect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    const handleClickOutside = (e) => {
      if (!e.target.closest('.floating-panel')) onClose?.()
    }
    document.addEventListener('keydown', handleEsc)
    document.addEventListener('click', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.removeEventListener('click', handleClickOutside)
    }
  })
</script>

<div class="floating-panel p-2" style="left: {x}px; top: {y}px;">
  <div class="grid grid-cols-1 gap-1 min-w-[200px]">
    <button class="w-full px-3 py-2 text-left text-sm text-notion-text hover:bg-notion-hover rounded transition-colors flex items-center gap-2">
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
        <polyline points="14 2 14 8 20 8"/>
      </svg>
      New Note
    </button>
    <button class="w-full px-3 py-2 text-left text-sm text-notion-text hover:bg-notion-hover rounded transition-colors flex items-center gap-2">
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
        <polyline points="15 3 21 3 21 9"/>
        <line x1="10" y1="14" x2="21" y2="3"/>
      </svg>
      Duplicate
    </button>
    <button class="w-full px-3 py-2 text-left text-sm text-notion-text hover:bg-notion-hover rounded transition-colors flex items-center gap-2">
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Export
    </button>
    <button class="w-full px-3 py-2 text-left text-sm text-notion-text hover:bg-notion-hover rounded transition-colors flex items-center gap-2">
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
      </svg>
      Share
    </button>
    <hr class="border-notion-border my-1">
    <button class="w-full px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 rounded transition-colors flex items-center gap-2">
      <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"/>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
      </svg>
      Delete Note
    </button>
  </div>
</div>
