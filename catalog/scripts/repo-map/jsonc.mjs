/**
 * JSON with comments and trailing commas (tsconfig style). Pure and dependency free.
 */

/**
 * Replace comments with spaces, outside strings. Newlines inside block comments are kept.
 * @param {string} text
 */
function stripComments(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const char = text.charAt(i);
    const next = text.charAt(i + 1);
    if (char === '"') {
      const start = i;
      i++;
      while (i < text.length && text.charAt(i) !== '"') i += text.charAt(i) === '\\' ? 2 : 1;
      i++;
      out += text.slice(start, i);
    } else if (char === '/' && next === '/') {
      while (i < text.length && text.charAt(i) !== '\n') i++;
    } else if (char === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      const stop = end === -1 ? text.length : end + 2;
      out += text.slice(i, stop).replace(/[^\n]/g, ' ');
      i = stop;
    } else {
      out += char;
      i++;
    }
  }
  return out;
}

/**
 * Drop a comma that is followed only by whitespace and a closing bracket, outside strings.
 * Expects comment-free text.
 * @param {string} text
 */
function stripTrailingCommas(text) {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const char = text.charAt(i);
    if (char === '"') {
      const start = i;
      i++;
      while (i < text.length && text.charAt(i) !== '"') i += text.charAt(i) === '\\' ? 2 : 1;
      i++;
      out += text.slice(start, i);
    } else if (char === ',') {
      let j = i + 1;
      while (/\s/.test(text.charAt(j))) j++;
      const closer = text.charAt(j);
      if (closer !== '}' && closer !== ']') out += char;
      i++;
    } else {
      out += char;
      i++;
    }
  }
  return out;
}

/**
 * @param {string} text
 * @returns {unknown}
 * @throws {Error} when the text is not valid JSONC
 */
export function parseJsonc(text) {
  const withoutBom = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  return JSON.parse(stripTrailingCommas(stripComments(withoutBom)));
}
