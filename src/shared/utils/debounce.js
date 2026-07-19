/**
 * Returns a debounced wrapper around `fn`.
 * @param {Function} fn
 * @param {number} ms
 * @returns {Function & { cancel: () => void }}
 */
export function debounce(fn, ms) {
  let timer = null;
  function wrapped(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn.apply(this, args);
    }, ms);
  }
  wrapped.cancel = () => {
    clearTimeout(timer);
    timer = null;
  };
  return wrapped;
}
