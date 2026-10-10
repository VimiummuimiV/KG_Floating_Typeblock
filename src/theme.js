import { SCHEMA, dimmingPath, getSetting } from './settings.js';
import { clamp, isFloating, setCssVars } from './utils.js';

// The light theme starts to lose brightness only when the backdrop dimming (%) passes this level,
// i.e. when the bright block really starts to glare on the dark backdrop
const DIMMING_ELEMENTS_THRESHOLD = 70;
// Share of brightness the light theme loses on a fully black backdrop
const DIMMING_ELEMENTS_STRENGTH = 0.25;

const disabledLight = 'hsl(0, 0%, 85%)';
const disabledDark = 'hsl(0, 0%, 10%)';

// Input colors for one state: caret follows text, selection inverts the pair
const createInputState = (background, text) => ({
  background,
  text,
  caret: text,
  selection: { background: text, text: background }
});

// Every value becomes a CSS variable: borderColor -> --kg-border-color, input.normal.text -> --kg-input-normal-text
const themes = {
  dark: {
    background: 'hsl(0, 0%, 15%)',
    borderColor: 'hsl(0, 0%, 20%)',
    // Two-layer drop shadow: the surface looks lifted
    shadow: '0 1px 3px rgba(0,0,0,0.5), 0 8px 24px rgba(0,0,0,0.35)',
    shadowSmall: '0 1px 2px rgba(0,0,0,0.5), 0 3px 8px rgba(0,0,0,0.3)',
    imageFilter: 'invert(93.3%) grayscale(1)',
    keyboardFilter: 'invert(1) sepia(0) hue-rotate(40deg) grayscale(0.3)',
    speedLightness: '65%',
    text: {
      before: 'hsl(200, 10%, 40%)',
      focus: 'hsl(120, 70%, 70%)',
      after: 'hsl(200, 10%, 70%)',
      error: 'hsl(0, 85%, 70%)'
    },
    help: {
      heading: 'hsl(40, 80%, 70%)',
      on: 'hsl(140, 80%, 60%)',
      off: 'hsl(0, 85%, 65%)',
      value: 'hsl(200, 70%, 70%)'
    },
    input: {
      normal: createInputState('hsl(120, 15%, 25%)', 'hsl(120, 15%, 75%)'),
      disabled: createInputState(disabledDark, disabledDark),
      error: createInputState('hsl(350, 80%, 50%)', 'hsl(350, 80%, 20%)')
    }
  },
  light: {
    background: 'hsl(0, 0%, 95%)',
    borderColor: 'hsl(0, 0%, 70%)',
    shadow: '0 1px 3px rgba(0,0,0,0.25), 0 8px 24px rgba(0,0,0,0.2)',
    shadowSmall: '0 1px 2px rgba(0,0,0,0.3), 0 3px 8px rgba(0,0,0,0.2)',
    imageFilter: 'none',
    keyboardFilter: 'none',
    speedLightness: '40%',
    text: {
      before: 'hsl(200, 15%, 70%)',
      focus: 'hsl(150, 30%, 30%)',
      after: 'hsl(200, 15%, 40%)',
      error: 'hsl(350, 80%, 45%)'
    },
    help: {
      heading: 'hsl(30, 80%, 35%)',
      on: 'hsl(140, 70%, 30%)',
      off: 'hsl(0, 75%, 45%)',
      value: 'hsl(210, 70%, 40%)'
    },
    input: {
      normal: createInputState('hsl(150, 30%, 70%)', 'hsl(150, 30%, 20%)'),
      disabled: createInputState(disabledLight, disabledLight),
      error: createInputState('hsl(350, 80%, 60%)', 'hsl(350, 80%, 30%)')
    }
  }
};

export const THEME_NAMES = SCHEMA.theme.options;

const toVarName = (path) => '--kg-' + path.map((part) => part.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase())).join('-');

const flatten = (node, path = []) => Object.entries(node).flatMap(([key, value]) =>
  typeof value === 'object' ? flatten(value, [...path, key]) : [[toVarName([...path, key]), value]]);

export const applyTheme = () => setCssVars(Object.fromEntries(flatten(themes[getSetting('theme')])));

// Light theme only, and only once the backdrop is dark enough to make the block glare
export function getElementsFilter() {
  if (!isFloating() || getSetting('theme') !== 'light') return 'none';
  const excess = clamp((getSetting(dimmingPath()) - DIMMING_ELEMENTS_THRESHOLD) / (100 - DIMMING_ELEMENTS_THRESHOLD), 0, 1);
  return `brightness(${(1 - DIMMING_ELEMENTS_STRENGTH * excess).toFixed(2)})`;
}
