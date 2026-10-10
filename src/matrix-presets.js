import { times } from './utils.js';

// Characters of a Unicode range as a string
const range = (start, end) => times(end - start + 1, (offset) => String.fromCodePoint(start + offset)).join('');

export const DIGITS = '0123456789';

// Glyph sets: label + characters. The 'custom' chars come from the settings; digits are an optional add-on.
// hasDigits: the digits belong to the set itself, so the digits add-on does not apply.
// 'tech' skips the colored emoji of its block.
export const GLYPH_SETS = {
  katakana: { label: 'Катакана', chars: range(0x30a2, 0x30f3) },
  katakanaNarrow: { label: 'Катакана узкая', chars: range(0xff66, 0xff9d) },
  hiragana: { label: 'Хирагана', chars: range(0x3041, 0x3093) },
  latin: { label: 'Латиница', chars: range(0x41, 0x5a) },
  cyrillic: { label: 'Кириллица', chars: range(0x410, 0x42f) },
  greek: { label: 'Греческий', chars: range(0x3b1, 0x3c9) },
  binary: { label: 'Бинарный код', chars: '01', hasDigits: true },
  hex: { label: 'Шестнадцатеричный', chars: 'ABCDEF0123456789', hasDigits: true },
  code: { label: 'Символы кода', chars: '<>{}[]()/\\|=+-*&^%$#@!?;:~' },
  math: { label: 'Математика', chars: range(0x2200, 0x22ff) },
  tech: { label: 'Технические символы', chars: range(0x2300, 0x2319) + range(0x231c, 0x23e8) },
  arrows: { label: 'Стрелки', chars: range(0x2190, 0x2199) + range(0x21d0, 0x21d5) },
  braille: { label: 'Брайль', chars: range(0x2801, 0x28ff) },
  runes: { label: 'Руны', chars: range(0x16a0, 0x16ea) },
  blocks: { label: 'Блоки', chars: range(0x2580, 0x259f) },
  frames: { label: 'Рамки', chars: range(0x2500, 0x257f) },
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

// Sets the digits add-on applies to
export const DIGITS_ADDABLE = Object.keys(GLYPH_SETS).filter((key) => !GLYPH_SETS[key].hasDigits);

export const FALL_OPTIONS = toOptions(Object.entries(FALL_STYLES).map(([key, { label }]) => [key, label]));

export function resolveGlyphs(setName, customGlyphs, withDigits) {
  const chars = (setName === 'custom' ? customGlyphs : GLYPH_SETS[setName].chars) + (withDigits && DIGITS_ADDABLE.includes(setName) ? DIGITS : '');
  const glyphs = [...chars.replace(/\s/g, '')];
  return glyphs.length ? glyphs : [...GLYPH_SETS.katakana.chars];
}