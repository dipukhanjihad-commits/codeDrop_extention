/* ============================================================
   helpers
   ============================================================ */
const $ = (id) => document.getElementById(id);
function setStatus(el, text, cls) {
  el.textContent = text;
  el.className = 'status' + (cls ? ' ' + cls : '');
}
const setStatusFiles  = (t, c) => setStatus($('statusFiles'), t, c);
const setStatusDetail = (t, c) => setStatus($('statusDetail'), t, c);
const setStatus2      = (t, c) => setStatus($('status2'), t, c);

/* ============================================================
   theme
   ============================================================ */
function applyTheme(theme, persist = true) {
  document.documentElement.setAttribute('data-theme', theme);
  $('themeBtn').textContent = theme === 'dark' ? '☀️' : '🌙';
  if (persist) localStorage.setItem('codedrop-theme', theme);
}
applyTheme(document.documentElement.getAttribute('data-theme') || 'light', false);
$('themeBtn').onclick = () => {
  const cur = document.documentElement.getAttribute('data-theme');
  applyTheme(cur === 'dark' ? 'light' : 'dark');
};

/* ============================================================
   IndexedDB — persist folder handle
   ============================================================ */
const DB_NAME = 'codedrop-db', STORE = 'handles';
function openDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => res(req.result);
    req.onerror = () => rej(req.error);
  });
}
async function saveHandle(h) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(h, 'root');
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}
async function loadHandle() {
  const db = await openDB();
  return new Promise((res, rej) => {
    const req = db.transaction(STORE).objectStore(STORE).get('root');
    req.onsuccess = () => res(req.result || null);
    req.onerror = () => rej(req.error);
  });
}

/* ============================================================
   global state
   ============================================================ */
let rootHandle = null;
let allFiles = [];
let selectedFile = null;
let mode = localStorage.getItem('codedrop-mode') || 'single';

/* ============================================================
   tab switching
   ============================================================ */
function switchTab(name) {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
  $('tab-' + name).classList.remove('hidden');
}
document.querySelectorAll('.tab').forEach(tab => {
  tab.onclick = () => switchTab(tab.dataset.tab);
});

/* ============================================================
   FILES TAB
   ============================================================ */
async function ensureReadPermission(handle) {
  const opts = { mode: 'read' };
  if ((await handle.queryPermission(opts)) === 'granted') return true;
  return (await handle.requestPermission(opts)) === 'granted';
}

async function walk(dirHandle, prefix, skipHeavy) {
  const out = [];
  for await (const entry of dirHandle.values()) {
    if (skipHeavy && ['node_modules', '.git', 'dist', 'build', '.next', 'target'].includes(entry.name)) continue;
    const path = prefix ? prefix + '/' + entry.name : entry.name;
    if (entry.kind === 'file') out.push({ path, handle: entry });
    else if (entry.kind === 'directory') out.push(...await walk(entry, path, skipHeavy));
    if (out.length > 20000) break;
  }
  return out;
}

async function loadFiles() {
  if (!rootHandle) return;
  if (!await ensureReadPermission(rootHandle)) { setStatusFiles('Folder permission denied.', 'err'); return; }
  setStatusFiles('Scanning files...');
  try {
    allFiles = await walk(rootHandle, '', $('excludeNodeModules').checked);
    allFiles.sort((a, b) => a.path.localeCompare(b.path));
    renderFiles();
    setStatusFiles(`Loaded ${allFiles.length} files.`);
  } catch (e) { setStatusFiles('Error: ' + e.message, 'err'); }
}

function renderFiles() {
  const q = $('searchBox').value.trim().toLowerCase();
  const list = $('fileList');
  list.innerHTML = '';
  const filtered = q ? allFiles.filter(f => f.path.toLowerCase().includes(q)) : allFiles;
  $('fileCount').textContent = `${filtered.length} file${filtered.length === 1 ? '' : 's'}`;

  const frag = document.createDocumentFragment();
  for (const f of filtered.slice(0, 500)) {
    const row = document.createElement('div');
    row.className = 'file-item' + (selectedFile?.path === f.path ? ' selected' : '');
    const name = document.createElement('span');
    name.className = 'file-path';
    name.textContent = f.path;
    name.title = f.path;
    row.appendChild(name);

    const actions = document.createElement('div');
    actions.className = 'file-actions';
    const viewBtn = document.createElement('button');
    viewBtn.className = 'btn'; viewBtn.textContent = 'View';
    viewBtn.onclick = (e) => { e.stopPropagation(); openFile(f); };
    const copyBtn = document.createElement('button');
    copyBtn.className = 'btn'; copyBtn.textContent = 'Copy';
    copyBtn.onclick = async (e) => { e.stopPropagation(); await copyFile(f); };
    actions.append(viewBtn, copyBtn);
    row.appendChild(actions);

    row.onclick = () => openFile(f);
    frag.appendChild(row);
  }
  if (filtered.length > 500) {
    const more = document.createElement('div');
    more.style.cssText = 'padding:8px;font-size:11px;color:var(--text-tertiary);text-align:center;';
    more.textContent = `… ${filtered.length - 500} more (narrow your search)`;
    frag.appendChild(more);
  }
  list.appendChild(frag);
}

async function readFile(f) { return await (await f.handle.getFile()).text(); }

async function copyFile(f) {
  try {
    await navigator.clipboard.writeText(await readFile(f));
    setStatusFiles(`Copied: ${f.path}`, 'ok');
  } catch (e) { setStatusFiles('Copy failed: ' + e.message, 'err'); }
}

/* ============================================================
   DETAIL TAB
   ============================================================ */
async function openFile(f) {
  selectedFile = f;
  renderFiles();
  $('detailDot').classList.remove('hidden');

  try {
    const content = await readFile(f);
    $('detailPath').textContent = f.path;
    $('detailPath').classList.remove('empty');
    $('detailContent').value = content;

    const lines = content.split('\n').length;
    const bytes = new Blob([content]).size;
    const sizeStr = bytes < 1024 ? `${bytes} B`
                  : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB`
                  : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    $('detailMeta').textContent = `${lines} line${lines === 1 ? '' : 's'} • ${sizeStr}`;
    $('copyDetailBtn').disabled = false;

    setStatusDetail(`Loaded: ${f.path}`);
    switchTab('detail');
  } catch (e) {
    setStatusDetail('Read failed: ' + e.message, 'err');
  }
}

$('backToListBtn').onclick = () => switchTab('files');

// CHANGED: copy includes filename on first line, then content
$('copyDetailBtn').onclick = async () => {
  try {
    const path = selectedFile ? selectedFile.path : $('detailPath').textContent;
    const content = $('detailContent').value;
    await navigator.clipboard.writeText(path + '\n' + content);
    setStatusDetail('Copied (filename + content) to clipboard.', 'ok');
  } catch (e) { setStatusDetail('Copy failed: ' + e.message, 'err'); }
};

/* ============================================================
   PASTE TAB — mode + destination hint
   ============================================================ */
function setMode(m, persist = true) {
  mode = m;
  document.querySelectorAll('.mode-toggle button').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === m);
  });
  $('projectRow').classList.toggle('hidden', m !== 'project');
  if (persist) localStorage.setItem('codedrop-mode', m);
  updateDestHint();
}
document.querySelectorAll('.mode-toggle button').forEach(b => {
  b.onclick = () => setMode(b.dataset.mode);
});

function sanitizeName(s) { return (s || 'default').replace(/[^a-zA-Z0-9._-]/g, '_'); }

// NEW: allow slashes in base folder (multi-level path), sanitize each segment
function sanitizeBasePath(p) {
  return (p || '')
    .split('/')
    .map(s => s.trim().replace(/[^a-zA-Z0-9._-]/g, '_'))
    .filter(Boolean)
    .join('/');
}

// NEW: base folder persistence
$('baseFolder').value = localStorage.getItem('codedrop-base') || 'CodeDrop';
$('baseFolder').oninput = () => {
  localStorage.setItem('codedrop-base', $('baseFolder').value);
  updateDestHint();
};

function currentBasePath() {
  const baseName = sanitizeBasePath($('baseFolder').value) || 'CodeDrop';
  if (mode === 'project') {
    return `${baseName}/${sanitizeName($('projectName').value.trim())}`;
  }
  return baseName;
}

function updateDestHint() {
  $('destHint').textContent = `Destination: Downloads/${currentBasePath()}/<path>`;
}

$('projectName').value = localStorage.getItem('codedrop-project') || '';
$('projectName').oninput = () => {
  localStorage.setItem('codedrop-project', $('projectName').value);
  updateDestHint();
};

/* ============================================================
   path safety + MIME
   ============================================================ */
function safePath(p) {
  if (!p || p.startsWith('/') || p.includes('\\')) return null;
  const segs = p.split('/');
  if (segs.some(s => s === '' || s === '..' || s === '.')) return null;
  if (segs.some(s => /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(s))) return null;
  return p;
}

const MIME_MAP = {
  html: 'text/html', htm: 'text/html', xhtml: 'application/xhtml+xml',
  css: 'text/css', scss: 'text/x-scss', sass: 'text/x-sass', less: 'text/x-less',
  js: 'text/javascript', mjs: 'text/javascript', cjs: 'text/javascript',
  jsx: 'text/jsx', tsx: 'text/tsx', ts: 'text/typescript',
  json: 'application/json', jsonl: 'application/json', json5: 'application/json',
  md: 'text/markdown', markdown: 'text/markdown',
  txt: 'text/plain', text: 'text/plain', log: 'text/plain',
  xml: 'application/xml', svg: 'image/svg+xml',
  yml: 'text/yaml', yaml: 'text/yaml',
  py: 'text/x-python', pyw: 'text/x-python',
  java: 'text/x-java',
  c: 'text/x-c', h: 'text/x-c',
  cc: 'text/x-c++', cpp: 'text/x-c++', hpp: 'text/x-c++', cxx: 'text/x-c++',
  go: 'text/x-go', rs: 'text/x-rust',
  php: 'text/x-php', rb: 'text/x-ruby',
  sh: 'text/x-sh', bash: 'text/x-sh', zsh: 'text/x-sh',
  sql: 'text/x-sql',
  vue: 'text/plain', svelte: 'text/plain',
  toml: 'text/plain', ini: 'text/plain', cfg: 'text/plain', conf: 'text/plain',
  env: 'text/plain', gitignore: 'text/plain', gitattributes: 'text/plain',
  editorconfig: 'text/plain', dockerignore: 'text/plain',
  dockerfile: 'text/plain', makefile: 'text/plain',
};
function mimeForPath(path) {
  const name = (path.split('/').pop() || '').toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop() : '';
  return MIME_MAP[ext] || 'text/plain';
}

/* ============================================================
   PASTE TAB — fill blocks
   ============================================================ */
function addFillBlock(opts = {}) {
  const { skipFocus = false, prefillName = '', prefillContent = '' } = opts;
  const container = $('fillBlocks');

  const block = document.createElement('div');
  block.className = 'fill-block';
  block.innerHTML = `
    <div class="fill-header">
      <input type="text" class="fill-name" placeholder="path/to/file.ext" spellcheck="false">
      <button class="btn icon fill-toggle" title="Expand / collapse">▾</button>
      <button class="btn icon fill-paste" title="Paste clipboard into content">📋</button>
      <button class="btn icon fill-remove" title="Remove this file">✕</button>
    </div>
    <textarea class="fill-content" placeholder="File content..." spellcheck="false"></textarea>
  `;

  const nameEl = block.querySelector('.fill-name');
  const contentEl = block.querySelector('.fill-content');
  const toggleEl = block.querySelector('.fill-toggle');

  // NEW: collapse / expand
  toggleEl.onclick = () => {
    block.classList.toggle('collapsed');
    toggleEl.textContent = block.classList.contains('collapsed') ? '▸' : '▾';
  };

  block.querySelector('.fill-paste').onclick = async () => {
    try {
      const text = await navigator.clipboard.readText();
      contentEl.value = text;
      contentEl.dispatchEvent(new Event('input'));
      setStatus2(`Pasted ${text.length} chars into ${nameEl.value || 'block'}.`, 'ok');
    } catch (e) {
      setStatus2('Clipboard read failed — press Ctrl+V in the content field. ' + e.message, 'err');
    }
  };

  block.querySelector('.fill-remove').onclick = () => {
    block.remove();
    updatePreview();
    applyPasteFilter();
  };

  nameEl.oninput = () => { updatePreview(); applyPasteFilter(); };
  contentEl.oninput = updatePreview;
  nameEl.addEventListener('focus', applyPasteFilter);
  contentEl.addEventListener('focus', applyPasteFilter);

  container.appendChild(block);

  if (prefillName) nameEl.value = prefillName;
  if (prefillContent) contentEl.value = prefillContent;

  updatePreview();
  applyPasteFilter();
  if (!skipFocus) {
    nameEl.focus();
    block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  return block;
}

function collectFillBlocks() {
  const files = [];
  document.querySelectorAll('#fillBlocks .fill-block').forEach(block => {
    const name = block.querySelector('.fill-name').value.trim();
    const content = block.querySelector('.fill-content').value;
    if (name) files.push({ path: name, content });
  });
  return files;
}

function updatePreview() {
  const files = collectFillBlocks();
  const blockCount = document.querySelectorAll('#fillBlocks .fill-block').length;

  $('fillBlocks').classList.toggle('hidden', blockCount === 0);
  $('emptyState').classList.toggle('hidden', blockCount > 0);

  const badge = $('parsedCount');
  if (files.length > 0) { badge.textContent = files.length; badge.classList.remove('hidden'); }
  else badge.classList.add('hidden');

  $('addFillBtn').textContent = blockCount > 0 ? `➕ Add File (${blockCount})` : '➕ Add File';
}

/* NEW: filter fill blocks by filename. Blocks being edited (or empty) always visible. */
function applyPasteFilter() {
  const q = $('pasteSearchBox').value.trim().toLowerCase();
  document.querySelectorAll('#fillBlocks .fill-block').forEach(block => {
    const name = block.querySelector('.fill-name').value.trim();
    const isFocused = block.contains(document.activeElement);
    const show = !q || name === '' || name.toLowerCase().includes(q) || isFocused;
    block.style.display = show ? '' : 'none';
  });
}

$('addFillBtn').onclick = () => addFillBlock();
$('pasteSearchBox').oninput = applyPasteFilter;

// refilter when focus leaves any block so hidden ones stay hidden
$('fillBlocks').addEventListener('focusout', () => setTimeout(applyPasteFilter, 50));

/* ============================================================
   Paste from Clipboard — smart target
   ============================================================ */
$('pasteFromClipboardBtn').onclick = async () => {
  let text = '';
  try {
    text = await navigator.clipboard.readText();
  } catch (e) {
    setStatus2('Clipboard read failed — use the 📋 button in a block, or Ctrl+V. ' + e.message, 'err');
    return;
  }
  if (!text) { setStatus2('Clipboard is empty.', 'err'); return; }

  const focused = document.activeElement;
  if (focused && focused.classList && focused.classList.contains('fill-content')) {
    focused.value = text;
    focused.dispatchEvent(new Event('input'));
    setStatus2(`Pasted ${text.length} chars into focused block.`, 'ok');
    return;
  }

  const blocks = document.querySelectorAll('#fillBlocks .fill-block');
  for (let i = blocks.length - 1; i >= 0; i--) {
    const contentEl = blocks[i].querySelector('.fill-content');
    if (!contentEl.value) {
      contentEl.value = text;
      contentEl.dispatchEvent(new Event('input'));
      blocks[i].querySelector('.fill-name').focus();
      setStatus2(`Pasted ${text.length} chars into empty block. Enter a filename.`, 'ok');
      return;
    }
  }

  const block = addFillBlock({ prefillContent: text });
  block.querySelector('.fill-name').focus();
  setStatus2(`Pasted ${text.length} chars as new block. Enter a filename.`, 'ok');
};

/* ============================================================
   drag & drop onto the paste area
   ============================================================ */
const pasteDropArea = $('pasteDropArea');
const BINARY_EXT = /\.(png|jpe?g|gif|webp|svg|ico|bmp|tiff?|mp4|mov|avi|webm|mkv|mp3|wav|ogg|flac|zip|tar|gz|bz2|xz|7z|rar|exe|dll|so|dylib|bin|woff2?|ttf|otf|eot|pdf|docx?|xlsx?|pptx?|class|o|a|pyc|lock)$/i;
const MAX_FILE_SIZE = 2 * 1024 * 1024;
const SKIP_DIRS = ['node_modules', '.git', 'dist', 'build', '.next', 'target', '.cache'];
let dragDepth = 0;

pasteDropArea.addEventListener('dragenter', (e) => {
  e.preventDefault(); dragDepth++; pasteDropArea.classList.add('dragover');
});
pasteDropArea.addEventListener('dragover', (e) => {
  e.preventDefault();
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
});
pasteDropArea.addEventListener('dragleave', (e) => {
  e.preventDefault(); dragDepth--;
  if (dragDepth <= 0) { dragDepth = 0; pasteDropArea.classList.remove('dragover'); }
});
pasteDropArea.addEventListener('drop', handleDrop);

async function handleDrop(e) {
  e.preventDefault();
  dragDepth = 0;
  pasteDropArea.classList.remove('dragover');
  const dt = e.dataTransfer;
  if (!dt) return;

  if (dt.items && dt.items.length) {
    const entries = [];
    for (let i = 0; i < dt.items.length; i++) {
      if (dt.items[i].kind === 'file') {
        const entry = dt.items[i].webkitGetAsEntry?.();
        if (entry) entries.push(entry);
      }
    }
    if (entries.length) {
      setStatus2('Reading dropped files...');
      const collected = [];
      for (const entry of entries) {
        collected.push(...await collectFilesFromEntry(entry, ''));
      }
      if (!collected.length) {
        setStatus2('No readable text files found in drop.', 'err');
        return;
      }
      for (const file of collected) {
        addFillBlock({ skipFocus: true, prefillName: file.path, prefillContent: file.content });
      }
      setStatus2(`Added ${collected.length} file(s) from drop.`, 'ok');
      return;
    }
  }

  const text = dt.getData('text/plain');
  if (text) {
    addFillBlock({ prefillContent: text });
    setStatus2('Added dropped text as new block. Enter a filename.', 'ok');
  }
}

async function collectFilesFromEntry(entry, prefix) {
  const results = [];
  const path = prefix ? prefix + '/' + entry.name : entry.name;
  if (entry.isFile) {
    if (BINARY_EXT.test(entry.name)) return results;
    try {
      const file = await new Promise((res, rej) => entry.file(res, rej));
      if (file.size > MAX_FILE_SIZE) return results;
      results.push({ path, content: await file.text() });
    } catch (err) { console.warn('Skip file:', path, err); }
  } else if (entry.isDirectory) {
    if (SKIP_DIRS.includes(entry.name)) return results;
    const reader = entry.createReader();
    const children = await new Promise((res, rej) => {
      const acc = [];
      const step = () => reader.readEntries(batch => {
        if (batch.length === 0) return res(acc);
        acc.push(...batch); step();
      }, rej);
      step();
    });
    for (const child of children) {
      results.push(...await collectFilesFromEntry(child, path));
    }
  }
  return results;
}

/* ============================================================
   Clear All
   ============================================================ */
$('clearBtn').onclick = () => {
  const count = document.querySelectorAll('#fillBlocks .fill-block').length;
  if (count > 0 && !confirm(`Remove all ${count} file(s)?`)) return;
  $('fillBlocks').innerHTML = '';
  updatePreview();
  applyPasteFilter();
  setStatus2('Cleared.');
};

/* ============================================================
   DOWNLOAD — uses configurable base folder
   ============================================================ */
async function downloadFiles() {
  try {
    if (!chrome || !chrome.downloads || typeof chrome.downloads.download !== 'function') {
      setStatus2('Downloads API unavailable. Reload the extension.', 'err');
      return;
    }

    const files = collectFillBlocks();
    if (!files.length) {
      setStatus2('No files to download. Click "➕ Add File" and enter a filename.', 'err');
      return;
    }

    const totalBlocks = document.querySelectorAll('#fillBlocks .fill-block').length;
    const skipped = totalBlocks - files.length;

    const basePath = currentBasePath() + '/';

    setStatus2(`Downloading ${files.length} file${files.length === 1 ? '' : 's'} → Downloads/${basePath}`);

    let ok = 0, fail = 0;
    const failures = [];

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const safe = safePath(f.path);
      if (!safe) {
        fail++;
        failures.push(`${f.path} (invalid path)`);
        continue;
      }

      const mime = mimeForPath(safe);
      const blob = new Blob([f.content], { type: mime + ';charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const finalName = basePath + safe;

      try {
        const downloadId = await new Promise((resolve, reject) => {
          try {
            chrome.downloads.download(
              { url, filename: finalName, conflictAction: 'overwrite', saveAs: false },
              (id) => {
                const err = chrome.runtime.lastError;
                if (err) reject(new Error(err.message || 'Download error'));
                else if (id === undefined) reject(new Error('No download ID returned'));
                else resolve(id);
              }
            );
          } catch (syncErr) {
            reject(syncErr);
          }
        });
        console.log('[CodeDrop download OK]', { id: downloadId, name: finalName, mime, size: f.content.length });
        ok++;
      } catch (err) {
        console.error('[CodeDrop download FAIL]', { name: finalName, mime, error: err.message });
        fail++;
        failures.push(`${f.path}: ${err.message}`);
      } finally {
        setTimeout(() => URL.revokeObjectURL(url), 120000);
      }

      if (i < files.length - 1) await new Promise(r => setTimeout(r, 150));
    }

    let msg = `✓ ${ok} downloaded → Downloads/${basePath}`;
    if (fail) msg += ` • ✗ ${fail} failed`;
    if (skipped > 0) msg += ` • ${skipped} skipped (no filename)`;
    setStatus2(msg, fail === 0 ? 'ok' : 'err');
    if (failures.length) console.warn('Failed downloads:', failures);
  } catch (e) {
    console.error('[CodeDrop downloadFiles]', e);
    setStatus2('Download error: ' + e.message, 'err');
  }
}

$('downloadBtn').onclick = downloadFiles;

/* ============================================================
   Connect / refresh / search
   ============================================================ */
$('connectBtn').onclick = async () => {
  try {
    const handle = await window.showDirectoryPicker({ mode: 'read' });
    await saveHandle(handle);
    rootHandle = handle;
    $('folderName').textContent = handle.name;
    $('refreshBtn').disabled = false;
    await loadFiles();
  } catch (e) {
    if (e.name !== 'AbortError') setStatusFiles('Error: ' + e.message, 'err');
  }
};

$('refreshBtn').onclick = loadFiles;
$('searchBox').oninput = renderFiles;
$('excludeNodeModules').onchange = loadFiles;

/* ============================================================
   init
   ============================================================ */
setMode(mode, false);
updatePreview();
updateDestHint();

(async () => {
  try {
    const handle = await loadHandle();
    if (!handle) return;
    rootHandle = handle;
    $('folderName').textContent = handle.name;
    $('refreshBtn').disabled = false;
    if ((await handle.queryPermission({ mode: 'read' })) === 'granted') {
      await loadFiles();
    } else {
      setStatusFiles('Click "Refresh" to re-grant folder access.');
    }
  } catch (e) { console.error(e); }
})();