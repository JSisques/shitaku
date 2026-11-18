/**
 * Canonical JSON writer: keys sorted recursively in code-unit order, two-space indent and a
 * trailing newline, so equal documents always produce equal bytes. Pure.
 */

/**
 * @param {unknown} value
 * @returns {unknown}
 */
function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    // Array#sort without a comparator orders by UTF-16 code unit; never use localeCompare here.
    const entries = Object.keys(value)
      .sort()
      .map((key) => [key, sortKeys(/** @type {Record<string, unknown>} */ (value)[key])]);
    // fromEntries defines own data properties, so a `__proto__` key stays plain data.
    return Object.fromEntries(entries);
  }
  return value;
}

/**
 * @param {unknown} document
 * @returns {string}
 */
export function renderJson(document) {
  return `${JSON.stringify(sortKeys(document), null, 2)}\n`;
}
