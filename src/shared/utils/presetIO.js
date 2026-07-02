// Preset file I/O shared by the workspaces: JSON download for export and
// hidden file-input pickers for preset / image import.

/** Downloads `data` as a pretty-printed JSON file. */
export function downloadPresetJSON(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Opens a file picker for a .json preset; parsed object goes to onLoad.
 * Parse failures go to onError (or console.warn).
 */
export function openPresetFile(onLoad, onError) {
  pickFile('.json,application/json', (file) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        onLoad(JSON.parse(reader.result));
      } catch (e) {
        (onError || ((err) => console.warn('[presetIO] invalid preset file:', err)))(e);
      }
    };
    reader.readAsText(file);
  });
}

/** Opens a file picker for an image; the data-URL string goes to onLoad. */
export function openImageFile(onLoad) {
  pickFile('image/*', (file) => {
    const reader = new FileReader();
    reader.onload = () => onLoad(reader.result);
    reader.readAsDataURL(file);
  });
}

function pickFile(accept, onFile) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = accept;
  input.style.display = 'none';
  document.body.appendChild(input);
  input.addEventListener('change', () => {
    if (input.files && input.files[0]) onFile(input.files[0]);
    document.body.removeChild(input);
  });
  input.click();
}
