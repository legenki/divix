// panelBuilder.js — shared control-panel construction for the workspaces.
// Each workspace passes its own state object,
// applyChange dispatcher and refreshVisibility; per-workspace differences are
// expressed as options instead of forked copies of the same builder:
//   compact sliders   — sections with `compact: true`
//   color style       — 'code' shows a hex label; 'code-upper' also stores the
//                       value uppercased; 'alpha' renders the
//                       #RRGGBBAA picker + alpha slider pair
//   onSliderInput     — extra hook after a slider writes state

/** Reads a dotted path ("params.size.font") from a state object. */
export function getByPath(root, path) {
  return path.split('.').reduce((o, k) => (o == null ? o : o[k]), root);
}

/** Writes a dotted path on a state object. */
export function setByPath(root, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const obj = keys.reduce((o, k) => o[k], root);
  obj[last] = value;
}

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') node.className = v;
    else if (k === 'style') node.style.cssText = v;
    else if (k === 'textContent') node.textContent = v;
    else if (k === 'checked') node.checked = v;
    else if (k === 'title') node.title = v;
    else node.setAttribute(k, v);
  }
  for (const child of children) {
    if (child == null) continue;
    node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

function chevronSVG() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'chevron-icon');
  svg.setAttribute('width', '10');
  svg.setAttribute('height', '10');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2.5');
  const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  poly.setAttribute('points', '6 9 12 15 18 9');
  svg.appendChild(poly);
  return svg;
}

// Select options come in two authored shapes: { label: value } objects and
// [{ value, label }] arrays. Both render; pick whichever reads better.
function optionEntries(options) {
  if (Array.isArray(options)) return options.map((o) => [o.label, o.value]);
  return Object.entries(options);
}

function sliderAttrs(ctrl, val) {
  return { type: 'range', class: 'custom-slider', id: ctrl.id, min: ctrl.min, max: ctrl.max, step: ctrl.step, value: val };
}

function numAttrs(ctrl, val) {
  return { type: 'number', class: 'grafema-num-input', id: `${ctrl.id}-num`, min: ctrl.min, max: ctrl.max, step: ctrl.step, value: val };
}

/**
 * Creates the builder bound to one workspace.
 *
 * @param {Object} opts
 * @param {Object}   opts.state             Shared state object for path reads/writes.
 * @param {Function} opts.applyChange       (ctrl) => void — change dispatcher.
 * @param {Function} opts.refreshVisibility () => void — re-evaluate row visibility.
 * @param {'code'|'code-upper'|'alpha'} [opts.colorStyle='code']
 * @param {Function} [opts.onSliderInput]   (ctrl, n) => void — after state write.
 */
export function createPanelBuilder({
  state,
  applyChange,
  refreshVisibility,
  colorStyle = 'code',
  onSliderInput,
}) {
  function buildControl(ctrl, compact = false) {
    const row = el('div', {
      className: compact && ctrl.type === 'slider' ? 'parameter-row compact' : 'parameter-row',
      'data-control-id': ctrl.id,
      ...(ctrl.group ? { 'data-group': ctrl.group } : {}),
    });
    const val = ctrl.path ? getByPath(state, ctrl.path) : undefined;

    if (ctrl.type === 'slider') {
      const slide = el('input', sliderAttrs(ctrl, val));
      const numWrap = el('div', { className: 'num-input-wrapper' }, el('input', numAttrs(ctrl, val)));
      const num = numWrap.querySelector('input');

      if (compact) {
        row.appendChild(el('span', { className: 'parameter-label', textContent: ctrl.label }));
        row.appendChild(slide);
        row.appendChild(numWrap);
      } else {
        const header = el('div', { className: 'parameter-header' },
          el('span', { className: 'parameter-label', textContent: ctrl.label }),
          numWrap,
        );
        row.appendChild(header);
        row.appendChild(slide);
      }

      slide.addEventListener('input', (e) => {
        const n = parseFloat(e.target.value);
        num.value = n;
        setByPath(state, ctrl.path, n);
        if (onSliderInput) onSliderInput(ctrl, n);
        applyChange(ctrl);
      });
      num.addEventListener('input', (e) => {
        const n = parseFloat(e.target.value);
        if (!Number.isFinite(n)) return;
        slide.value = n;
        setByPath(state, ctrl.path, n);
        if (onSliderInput) onSliderInput(ctrl, n);
        applyChange(ctrl);
      });

    } else if (ctrl.type === 'select') {
      const header = el('div', { className: 'parameter-header' },
        el('span', { className: 'parameter-label', textContent: ctrl.label }),
      );
      const select = el('select', { className: 'grafema-select', id: ctrl.id });
      for (const [label, v] of optionEntries(ctrl.options)) {
        const opt = el('option', { value: v }, label);
        if (v === val) opt.selected = true;
        select.appendChild(opt);
      }
      row.appendChild(header);
      row.appendChild(select);
      select.addEventListener('change', (e) => {
        setByPath(state, ctrl.path, e.target.value);
        applyChange(ctrl);
        refreshVisibility();
      });

    } else if (ctrl.type === 'check') {
      const checkbox = el('input', { type: 'checkbox', id: ctrl.id, checked: !!val });
      const label = el('label', { className: 'checkbox-container' },
        checkbox,
        el('span', { className: 'custom-checkbox' }),
        el('span', { textContent: ctrl.label }),
      );
      row.appendChild(label);
      checkbox.addEventListener('change', (e) => {
        setByPath(state, ctrl.path, e.target.checked);
        applyChange(ctrl);
        refreshVisibility();
      });

    } else if (ctrl.type === 'color') {
      const header = el('div', { className: 'parameter-header' },
        el('span', { className: 'parameter-label', textContent: ctrl.label }),
      );
      row.appendChild(header);

      if (colorStyle === 'alpha') {
        // Colors are #RRGGBBAA. <input type=color> only does #RRGGBB, so keep
        // alpha in state and show a separate alpha slider.
        const hex6 = String(val).slice(0, 7);
        const aHex = String(val).length >= 9 ? String(val).slice(7, 9) : 'FF';
        const aVal = parseInt(aHex, 16) / 255;
        const colorInput = el('input', { type: 'color', id: ctrl.id, value: hex6 });
        const alphaSlider = el('input', {
          type: 'range', id: `${ctrl.id}-a`, min: '0', max: '1', step: '0.01',
          value: aVal, class: 'custom-slider', style: 'flex:1; margin-left:8px;', title: 'Alpha',
        });
        const wrapper = el('div', { className: 'color-picker-wrapper' }, colorInput, alphaSlider);
        row.appendChild(wrapper);
        const update = () => {
          const c = colorInput.value;
          const a = parseFloat(alphaSlider.value);
          const aH = Math.round(a * 255).toString(16).padStart(2, '0').toUpperCase();
          setByPath(state, ctrl.path, c.toUpperCase() + aH);
          applyChange(ctrl);
        };
        colorInput.addEventListener('input', update);
        alphaSlider.addEventListener('input', update);
      } else {
        const hex =
          colorStyle === 'code-upper'
            ? String(val).slice(0, 7)
            : String(val).startsWith('#')
              ? val
              : '#000000';
        const colorInput = el('input', { type: 'color', id: ctrl.id, value: hex });
        const code = el('span', { className: 'color-code', id: `${ctrl.id}-code`, textContent: hex.toUpperCase() });
        const wrapper = el('div', { className: 'color-picker-wrapper' }, colorInput, code);
        row.appendChild(wrapper);
        colorInput.addEventListener('input', (e) => {
          const stored = colorStyle === 'code-upper' ? e.target.value.toUpperCase() : e.target.value;
          setByPath(state, ctrl.path, stored);
          code.textContent = e.target.value.toUpperCase();
          applyChange(ctrl);
        });
      }

    } else if (ctrl.type === 'text') {
      const header = el('div', { className: 'parameter-header' },
        el('span', { className: 'parameter-label', textContent: ctrl.label }),
      );
      const input = el('input', { type: 'text', class: 'grafema-text-input', id: ctrl.id, value: String(val) });
      row.appendChild(header);
      row.appendChild(input);
      input.addEventListener('input', (e) => {
        setByPath(state, ctrl.path, e.target.value);
        applyChange(ctrl);
      });

    } else if (ctrl.type === 'button') {
      // Action button: no state path; the workspace dispatches on ctrl.id
      // inside its applyChange.
      const btn = el('button', { id: ctrl.id, className: 'btn btn-secondary', style: 'width:100%;', textContent: ctrl.label });
      row.appendChild(btn);
      btn.addEventListener('click', () => {
        applyChange(ctrl);
        refreshVisibility();
      });

    } else if (ctrl.type === 'icon-button') {
      const btn = el('button', { id: ctrl.id, className: 'btn btn-icon', title: ctrl.label });
      btn.innerHTML = ctrl.icon; // ctrl.icon is trusted SVG from our own controls.js
      row.appendChild(btn);
      btn.addEventListener('click', () => {
        applyChange(ctrl);
        refreshVisibility();
      });
    }

    return row;
  }

  /** Builds all SECTIONS into root: collapsible header + control rows. */
  function buildSections(root, sections) {
    for (const section of sections) {
      const sec = el('section', { className: 'panel-section' });

      const h2 = el('h2', { className: 'section-title' },
        el('span', { textContent: section.title }),
        chevronSVG(),
      );
      const content = el('div', { className: 'section-content' });
      sec.classList.add('collapsed');
      h2.addEventListener('click', () => sec.classList.toggle('collapsed'));

      let pairContainer = null;
      for (const ctrl of section.controls) {
        const row = buildControl(ctrl, section.compact);
        if (!row) continue;
        if ((ctrl.type === 'slider' && ctrl.pair) || (ctrl.pair && ctrl.type !== 'slider')) {
          if (!pairContainer) {
            pairContainer = el('div', { className: 'parameter-row-group' });
            if (ctrl.type === 'icon-button') pairContainer.style.cssText = 'display:grid;grid-template-columns:auto 1fr;gap:8px;';
            content.appendChild(pairContainer);
          }
          pairContainer.appendChild(row);
        } else {
          pairContainer = null;
          content.appendChild(row);
        }
      }

      sec.appendChild(h2);
      sec.appendChild(content);
      root.appendChild(sec);
    }
  }

  /** Pushes current state values back into the built inputs. */
  function syncUIFromState(sections) {
    for (const section of sections) {
      for (const ctrl of section.controls) {
        const el = document.getElementById(ctrl.id);
        if (!el) continue;
        const val = ctrl.path ? getByPath(state, ctrl.path) : undefined;
        if (ctrl.type === 'slider') {
          el.value = val;
          const num = document.getElementById(`${ctrl.id}-num`);
          if (num) num.value = val;
        } else if (ctrl.type === 'select' || ctrl.type === 'text') {
          el.value = val;
        } else if (ctrl.type === 'check') {
          el.checked = val;
        } else if (ctrl.type === 'color') {
          el.value = String(val).slice(0, 7);
          if (colorStyle === 'alpha') {
            const aEl = document.getElementById(`${ctrl.id}-a`);
            if (aEl)
              aEl.value =
                String(val).length >= 9 ? parseInt(String(val).slice(7, 9), 16) / 255 : 1;
          } else {
            const code = document.getElementById(`${ctrl.id}-code`);
            if (code) code.textContent = String(val).toUpperCase();
          }
        }
      }
    }
  }

  return { buildControl, buildSections, syncUIFromState };
}

/**
 * Preset dropdown section. Keys are humanized: fooBarPreset -> "Foo Bar".
 * Optional onExport/onImport callbacks add an Export/Import button pair.
 */
export function buildPresetSection(root, { idPrefix, presets, proPresets = {}, isPro = false, onExport, onImport, onOpenPaywall }) {
  const sec = el('section', { className: 'panel-section' });

  const h2 = el('h2', { className: 'section-title' }, el('span', { textContent: 'Preset' }));
  const select = el('select', { className: 'grafema-select', id: `${idPrefix}-preset` });

  function makeLabel(key) {
    // Acronym-aware camelCase → Title Case. Insert a space only at a
    // lowercase/digit→uppercase boundary and at an ACRONYM→Word boundary
    // (e.g. `SVGHere` → `SVG Here`), so consecutive capitals stay grouped
    // (`omgType` → `OMG Type`, `dropTheSVG` → `Drop The SVG`). Keys that are
    // already space-separated (`"Drop The SVG"`) pass through unchanged
    // instead of being split into `"Drop  The  S V G"`.
    return key
      .replace(/Preset$/, '')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
      .replace(/^./, (c) => c.toUpperCase())
      .trim();
  }

  // Free presets — always rendered
  const freeGroup = el('optgroup', {});
  freeGroup.label = 'Free';
  for (const key of Object.keys(presets)) {
    freeGroup.appendChild(el('option', { value: key }, makeLabel(key)));
  }
  select.appendChild(freeGroup);

  // Pro presets — optgroup always present; options only when isPro
  const hasProPresets = Object.keys(proPresets).length > 0;
  if (hasProPresets) {
    const proGroup = el('optgroup', {});
    proGroup.label = 'Pro ✦';
    if (isPro) {
      for (const key of Object.keys(proPresets)) {
        proGroup.appendChild(el('option', { value: key }, makeLabel(key)));
      }
    }
    select.appendChild(proGroup);
  }

  const selectRow = el('div', { className: 'parameter-row' },
    el('div', { className: 'parameter-header' }, el('span', { className: 'parameter-label', textContent: 'Preset List' })),
    select,
  );

  // Workspaces without factory presets (Clon, Sondeo) keep Export/Import
  // but an empty dropdown reads as broken — hide it.
  const hasAnyPresets = Object.keys(presets).length > 0 || Object.keys(proPresets).length > 0;
  const contentChildren = hasAnyPresets ? [selectRow] : [];

  if (hasProPresets && !isPro) {
    const note = el('p', { className: 'pro-preset-note' });
    const link = el('a', { textContent: 'Unlock with Pro →' });
    if (onOpenPaywall) link.addEventListener('click', onOpenPaywall);
    note.appendChild(link);
    contentChildren.push(note);
  }

  if (onExport || onImport) {
    const ioRow = el('div', { className: 'parameter-row', style: 'display:grid;grid-template-columns:1fr 1fr;gap:8px;' });
    if (onExport) {
      const exportBtn = el('button', { id: `${idPrefix}-preset-export`, className: 'btn btn-secondary', textContent: 'Export' });
      exportBtn.addEventListener('click', onExport);
      ioRow.appendChild(exportBtn);
    }
    if (onImport) {
      const importBtn = el('button', { id: `${idPrefix}-preset-import`, className: 'btn btn-secondary', textContent: 'Import' });
      importBtn.addEventListener('click', onImport);
      ioRow.appendChild(importBtn);
    }
    contentChildren.push(ioRow);
  }

  const content = el('div', { className: 'section-content' }, ...contentChildren);
  sec.appendChild(h2);
  sec.appendChild(content);
  root.appendChild(sec);
}

/** Font section: List (catalog) vs Custom (upload) toggle + font picker. */
export function buildFontSection(root, { idPrefix, fontList, font, accept }) {
  const sec = el('section', { className: 'panel-section' });

  const h2 = el('h2', { className: 'section-title' },
    el('span', { textContent: 'Font' }),
    chevronSVG(),
  );

  const modeSelector = el('div', { className: 'mode-selector', id: `${idPrefix}-font-mode`, style: 'margin-bottom:12px;' });
  for (const mode of ['list', 'custom']) {
    const btn = el('button', { className: `mode-btn${font.mode === mode ? ' active' : ''}`, 'data-mode': mode },
      el('span', { textContent: mode === 'list' ? 'List' : 'Custom' }),
    );
    modeSelector.appendChild(btn);
  }

  const fontSelect = el('select', { className: 'grafema-select', id: `${idPrefix}-font-list` });
  for (const f of fontList) {
    const opt = el('option', { value: f }, f);
    if (f === font.name) opt.selected = true;
    fontSelect.appendChild(opt);
  }
  const fontListRow = el('div', { className: 'parameter-row', id: `${idPrefix}-font-list-row` },
    el('div', { className: 'parameter-header' }, el('span', { className: 'parameter-label', textContent: 'Choose Font' })),
    fontSelect,
  );

  const uploadBtn = el('button', { id: `${idPrefix}-font-upload`, className: 'btn btn-secondary', style: 'width:100%;', textContent: 'Load Local Font' });
  const customName = el('span', { className: 'color-code', id: `${idPrefix}-font-custom-name`, style: 'display:block; margin-top:6px;', textContent: font.customName || 'no file' });
  const fontCustomRow = el('div', { className: 'parameter-row', id: `${idPrefix}-font-custom-row` }, uploadBtn, customName);

  const fileInput = el('input', { type: 'file', id: `${idPrefix}-font-input`, accept, style: 'display:none;' });

  const content = el('div', { className: 'section-content' },
    modeSelector,
    fontListRow,
    fontCustomRow,
    fileInput,
  );

  sec.appendChild(h2);
  sec.appendChild(content);
  root.appendChild(sec);
}

/** Expands the panel sections at the given indices (the rest stay collapsed). */
export function openSections(root, indices) {
  const sections = root.querySelectorAll('.panel-section');
  indices.forEach((i) => {
    if (sections[i]) sections[i].classList.remove('collapsed');
  });
}
