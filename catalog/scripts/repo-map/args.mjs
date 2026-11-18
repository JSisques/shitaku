/**
 * Command-line parsing for repo-map. Pure: no IO, no process access.
 */

export const DEFAULT_OUT = '.shitaku';
const SUPPORTED_FORMATS = ['json'];

/**
 * @param {string} message without the `repo-map: ` prefix
 * @returns {Error & { exitCode: number }}
 */
function usageError(message) {
  const err = /** @type {Error & { exitCode: number }} */ (new Error(`repo-map: ${message}`));
  err.exitCode = 2;
  return err;
}

/**
 * @param {string[]} argv
 * @returns {{ format: string, out: string, ignore: string[] }}
 */
export function parseArgs(argv) {
  let format = 'json';
  let out = DEFAULT_OUT;
  /** @type {string[]} */
  const ignore = [];

  /** @param {string} flag @param {number} index */
  const valueOf = (flag, index) => {
    const value = argv[index];
    if (value === undefined || value === '') throw usageError(`${flag} requires a value`);
    return value;
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = String(argv[i]);
    if (arg === '--format') {
      format = valueOf(arg, ++i);
    } else if (arg === '--out') {
      out = valueOf(arg, ++i);
    } else if (arg === '--ignore') {
      ignore.push(valueOf(arg, ++i));
    } else if (arg.startsWith('-')) {
      throw usageError(`unsupported option ${arg}`);
    } else {
      throw usageError(`unexpected argument ${arg}`);
    }
  }

  if (!SUPPORTED_FORMATS.includes(format)) throw usageError(`unsupported --format ${format}`);
  return { format, out, ignore };
}
