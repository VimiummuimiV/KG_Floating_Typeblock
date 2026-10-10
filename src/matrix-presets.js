import { times } from './utils.js';

// Characters of a Unicode range as a string
const range = (start, end) => times(end - start + 1, (offset) => String.fromCodePoint(start + offset)).join('');

export const DIGITS = '0123456789';

// Glyph sets: label + characters. The 'custom' chars come from the settings; digits are an optional add-on.
export const GLYPH_SETS = {
  katakana: { label: 'Катакана', chars: 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン' },
  latin: { label: 'Латиница', chars: range(0x41, 0x5a) },
  cyrillic: { label: 'Кириллица', chars: range(0x410, 0x42f) },
  binary: { label: 'Бинарный код', chars: '01' },
  tech: { label: 'Технические символы', chars: '⌘⌬⊕⊗⊙⊞⊠∆∇∑∏∫√∞≈≠±' },
  braille: { label: 'Брайль', chars: range(0x2801, 0x28ff) },
  runes: { label: 'Руны', chars: range(0x16a0, 0x16ea) },
  blocks: { label: 'Блоки', chars: '░▒▓█▀▄▌▐■□▪▫' },
  custom: { label: 'Свой набор', chars: '' }
};

// speed: rows per step [min, max] (≤ 1, so no row is skipped);
// direction: 1 down, -1 up, 0 random per column; drift: columns shifted per row
export const FALL_STYLES = {
  classic: { label: 'Классика', speed: [1, 1], direction: 1, drift: 0 },
  varied: { label: 'Разная скорость', speed: [0.3, 1], direction: 1, drift: 0 },
  rising: { label: 'Вверх', speed: [0.4, 1], direction: -1, drift: 0 },
  both: { label: 'Вверх и вниз', speed: [0.4, 1], direction: 0, drift: 0 },
  diagonal: { label: 'Диагональ', speed: [0.4, 1], direction: 1, drift: 0.5 }
};

const SAMPLE_LENGTH = 5;

const toOptions = (entries) => Object.fromEntries(entries);

// Select options with a short sample of the glyphs
export const GLYPH_OPTIONS = toOptions(Object.entries(GLYPH_SETS).map(([key, { label, chars }]) => [
  key,
  chars ? `${label}  ${[...chars].slice(0, SAMPLE_LENGTH).join('')}` : label
]));

export const FALL_OPTIONS = toOptions(Object.entries(FALL_STYLES).map(([key, { label }]) => [key, label]));

export function resolveGlyphs(setName, customGlyphs, withDigits) {
  const chars = (setName === 'custom' ? customGlyphs : GLYPH_SETS[setName].chars) + (withDigits ? DIGITS : '');
  const glyphs = [...chars.replace(/\s/g, '')];
  return glyphs.length ? glyphs : [...GLYPH_SETS.katakana.chars];
}