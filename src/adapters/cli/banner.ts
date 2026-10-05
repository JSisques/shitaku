import { styleText } from 'node:util';
import { isTruthyFlag } from '@/domain/update.js';

/** Facts about the terminal, computed once in the composition root. */
export interface TerminalSettings {
  /** True when stdout and stderr are both terminals. */
  tty: boolean;
  /** True when stderr should receive ANSI color (`NO_COLOR` / `FORCE_COLOR` already applied). */
  color: boolean;
  /** True when the locale can render the optional kanji mark. */
  unicode: boolean;
}

/** Everything that decides whether this invocation prints the banner. */
export interface BannerDecision {
  tty: boolean;
  /** True when this command will prompt (interactive `init`). */
  prompts: boolean;
  /** True when the command asked for machine-readable output. */
  json: boolean;
  /** True for `version`, `-v` or `--version`. */
  version: boolean;
  /** True when the global `--no-banner` flag was passed. */
  noBanner: boolean;
  env: Record<string, string | undefined>;
}

/** What `renderBanner` needs besides the static art. */
export interface BannerRender {
  /** Installed package version; the tagline line is omitted when this is missing. */
  version?: string;
  color: boolean;
  unicode: boolean;
}

/** Figlet "standard" wordmark, committed as text so nothing renders it at runtime. */
const WORDMARK = [
  String.raw`      _     _ _        _`,
  String.raw`  ___| |__ (_) |_ __ _| | ___   _`,
  " / __| '_ \\| | __/ _` | |/ / | | |",
  String.raw` \__ \ | | | | || (_| |   <| |_| |`,
  String.raw` |___/_| |_|_|\__\__,_|_|\_\\__,_|`,
];

const TAGLINE = 'Get your agent environment ready';
const KANJI = '支度';

/** `FORCE_COLOR` values that Node treats as "color on". Matching is case-sensitive, like Node. */
const FORCE_COLOR_ON = new Set(['', '1', '2', '3', 'true']);

/**
 * Whether stderr should be colored, using the same rules as `util.styleText`:
 * `FORCE_COLOR` wins, then `NO_COLOR`, `NODE_DISABLE_COLORS` and `TERM=dumb` turn color off,
 * otherwise a TTY is colored.
 */
export function terminalSupportsColor(env: Record<string, string | undefined>, tty: boolean): boolean {
  const force = env.FORCE_COLOR;
  if (force !== undefined) return FORCE_COLOR_ON.has(force);
  if (env.NO_COLOR !== undefined || env.NODE_DISABLE_COLORS !== undefined || env.TERM === 'dumb') return false;
  return tty;
}

/** True when `LC_ALL`, else `LC_CTYPE`, else `LANG`, names a UTF-8 locale. */
export function localePrefersUtf8(env: Record<string, string | undefined>): boolean {
  const locale = env.LC_ALL ?? env.LC_CTYPE ?? env.LANG ?? '';
  return /utf-?8/i.test(locale);
}

/** Pure skip rules for the startup banner. Presentation only; it does not print. */
export function shouldShowBanner(input: BannerDecision): boolean {
  if (!input.tty) return false;
  if ((input.env.CI ?? '') !== '') return false;
  if (isTruthyFlag(input.env.SHITAKU_NO_BANNER)) return false;
  if (input.noBanner || input.version || input.json || !input.prompts) return false;
  return true;
}

function paint(line: string, format: 'cyan' | 'dim', color: boolean): string {
  if (!color) return line;
  return styleText(format, line, { validateStream: false });
}

/** Lines to write to stderr. Each line stays within 80 display columns. */
export function renderBanner(input: BannerRender): string[] {
  const art = WORDMARK.map((line, index) => {
    const marked = input.unicode && index === WORDMARK.length - 1 ? `${line}  ${KANJI}` : line;
    return paint(marked, 'cyan', input.color);
  });
  if (input.version === undefined) return art;
  return [...art, '', paint(`v${input.version} · ${TAGLINE}`, 'dim', input.color)];
}
