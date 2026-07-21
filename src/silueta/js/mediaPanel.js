// SILUETA — media library panel. A collapsible section listing every image in
// the library as a thumbnail: click to include/exclude it from the poster,
// upload to add, × to remove. Modelled on lumen's mediaPanel.js, but inline in
// the sidebar (silueta's library is small) rather than a modal overlay.

/**
 * @param {HTMLElement} root  the panel container (#sl-controls)
 * @param {object} deps
 * @param {object} deps.media   media library (createMediaLibrary)
 * @param {Function} deps.onChange  called after any add/remove/toggle
 */
export function buildMediaSection(root, { media, onChange }) {
  const sec = document.createElement('section');
  sec.className = 'panel-section';
  sec.innerHTML = `
    <h2 class="section-title"><span>Media Library</span>
      <svg class="chevron-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
    </h2>
    <div class="section-content">
      <div id="sl-media-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:8px;"></div>
      <button id="sl-media-add" class="btn btn-secondary" style="width:100%;">Add Images</button>
      <input type="file" id="sl-media-input" accept="image/*" multiple style="display:none;">
      <div id="sl-media-status" class="color-code" style="display:block;margin-top:6px;"></div>
    </div>`;
  sec.querySelector('.section-title').addEventListener('click', () => sec.classList.toggle('collapsed'));
  root.appendChild(sec);

  const grid = sec.querySelector('#sl-media-grid');
  const input = sec.querySelector('#sl-media-input');
  const status = sec.querySelector('#sl-media-status');

  function setStatus(msg) {
    status.textContent = msg || '';
  }

  function refresh() {
    grid.innerHTML = '';
    const items = media.all();
    if (!items.length) {
      setStatus('No images yet');
      return;
    }
    const on = items.filter((e) => e.enabled && e.ready).length;
    setStatus(`${on} of ${items.length} in use`);

    for (const entry of items) {
      const cell = document.createElement('div');
      cell.style.cssText =
        'position:relative;aspect-ratio:1;border-radius:5px;overflow:hidden;cursor:pointer;' +
        `border:2px solid ${entry.enabled ? 'var(--color-accent,#2563eb)' : 'transparent'};` +
        `opacity:${entry.enabled ? '1' : '0.4'};background:#f0f0f0;`;
      cell.title = `${entry.name} — click to ${entry.enabled ? 'exclude' : 'include'}`;

      if (entry.url) {
        const thumb = document.createElement('img');
        thumb.src = entry.url;
        thumb.alt = entry.name;
        thumb.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
        cell.appendChild(thumb);
      }

      cell.addEventListener('click', () => {
        media.toggle(entry.key);
        onChange?.();
      });

      const del = document.createElement('button');
      del.textContent = '×';
      del.title = 'Remove from library';
      del.style.cssText =
        'position:absolute;top:2px;right:2px;width:16px;height:16px;line-height:14px;' +
        'padding:0;border:none;border-radius:3px;cursor:pointer;font-size:13px;' +
        'background:rgba(0,0,0,.55);color:#fff;';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        media.remove(entry.key);
        onChange?.();
      });
      cell.appendChild(del);

      grid.appendChild(cell);
    }
  }

  sec.querySelector('#sl-media-add').addEventListener('click', () => input.click());
  input.addEventListener('change', async () => {
    const files = Array.from(input.files || []);
    input.value = '';
    if (!files.length) return;
    setStatus(`Loading ${files.length}…`);
    for (const file of files) {
      try {
        await media.addFile(file);
      } catch (err) {
        console.warn('[silueta] media add failed:', err);
        setStatus('Some images failed to load');
      }
    }
    onChange?.();
  });

  media.onChange(refresh);
  refresh();

  return { refresh };
}
