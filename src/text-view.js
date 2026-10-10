import { getSetting, setSetting } from './settings.js';
import { byId, clamp, createElement } from './utils.js';

const PROGRESS_BAR_ID = 'kg-progress-bar';

// ─── Text visibility (both modes) ────────────────────────────────────────────

function getLineHeight() {
  const typeFocus = byId('typefocus');
  if (!typeFocus) return 0;
  const lineHeight = parseFloat(window.getComputedStyle(typeFocus).lineHeight);
  return lineHeight > 0 ? lineHeight : typeFocus.offsetHeight;
}

// Lines the whole text takes at the current width. The height set by the line-by-line mode is lifted for
// the measurement: scrollHeight never drops below the element's own height, so it could not shrink otherwise.
function getMaxLines() {
  const typeText = byId('typetext');
  const lineHeight = getLineHeight();
  if (!typeText || lineHeight <= 0) return 1;
  const { style } = typeText;
  const [height, priority] = [style.getPropertyValue('height'), style.getPropertyPriority('height')];
  style.removeProperty('height');
  const lines = Math.max(1, Math.round(typeText.scrollHeight / lineHeight));
  if (height) style.setProperty('height', height, priority);
  return lines;
}

// Inline properties that cut the text block to N lines (also work in native mode)
const PARTIAL_MODE_PROPERTIES = ['height', 'overflow', 'position'];

function updateTextVisibility() {
  const typeText = byId('typetext');
  const typeFocus = byId('typefocus');
  if (!typeText || !typeFocus) return;

  if (!getSetting('isPartialMode')) {
    PARTIAL_MODE_PROPERTIES.forEach((property) => typeText.style.removeProperty(property));
    return;
  }

  const lineHeight = getLineHeight();
  if (lineHeight <= 0) return;
  // The saved value is a limit: the block never shows more lines than the text has at this width,
  // and the saved value comes back by itself when the text gets longer again (narrower block)
  const visibleLines = clamp(getSetting('visibleLines'), 1, getMaxLines());
  const visibleHeight = visibleLines * lineHeight;
  typeText.style.setProperty('height', `${visibleHeight}px`, 'important');
  typeText.style.setProperty('overflow', 'hidden', 'important');
  typeText.style.setProperty('position', 'relative', 'important');
  const maxScroll = typeText.scrollHeight - visibleHeight;
  const targetScroll = visibleLines === 1 ? typeFocus.offsetTop : Math.min(typeFocus.offsetTop, maxScroll);
  typeText.scrollTop = Math.max(0, targetScroll);
}

// Steps from the lines actually shown, so the wheel always changes what is on screen.
// At the end of the text the saved limit is left alone. Returns the shown count (null outside the mode).
export function adjustVisibleLines(step) {
  if (!getSetting('isPartialMode')) return null;
  const maxLines = getMaxLines();
  const current = clamp(getSetting('visibleLines'), 1, maxLines);
  const next = clamp(current + step, 1, maxLines);
  if (next !== current) setSetting('visibleLines', next);
  return next;
}

// ─── Progress bar (both modes) ───────────────────────────────────────────────

// Site hides decoy characters in display:none spans, count only displayed text
function getVisibleText(node) {
  if (node.nodeType === Node.TEXT_NODE) return node.nodeValue;
  if (node.nodeType !== Node.ELEMENT_NODE || node.style.display === 'none') return '';
  return [...node.childNodes].map(getVisibleText).join('');
}

function getCommonPrefixLength(a, b) {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

// Share of typed text: finished words + correctly typed start of the current word.
// Characters after the first mismatch are ignored, so errors never add progress.
function getTypingProgress() {
  const textOf = (id) => {
    const element = byId(id);
    return element ? getVisibleText(element) : '';
  };
  const before = textOf('beforefocus');
  const focus = textOf('typefocus');
  const total = before.length + focus.length + textOf('afterfocus').length;
  if (!total) return 0;
  const input = byId('inputtext');
  // A disabled input holds the site placeholder, not typed text
  const typed = input && !input.classList.contains('disabled') ? input.value : '';
  return (before.length + getCommonPrefixLength(typed, focus)) / total;
}

function isTextClipped() {
  const typeText = byId('typetext');
  return !!typeText && typeText.scrollHeight > typeText.clientHeight + 1;
}

const setProgress = (bar) => { bar.firstElementChild.style.transform = `scaleX(${getTypingProgress()})`; };

function ensureProgressBar() {
  let bar = byId(PROGRESS_BAR_ID);
  if (bar) return bar;
  const inputBlock = byId('inputtextblock');
  if (!inputBlock) return null;
  bar = createElement('div', { id: PROGRESS_BAR_ID }, createElement('div'));
  setProgress(bar);
  inputBlock.before(bar);
  return bar;
}

// Shown only when enabled and part of the text is hidden beyond the edge
export function updateProgressBar() {
  const bar = ensureProgressBar();
  if (!bar) return;
  bar.hidden = !(getSetting('showProgress') && isTextClipped());
  setProgress(bar);
}

// Text layout changed: re-apply visibility and everything that depends on it
export function refreshTextView() {
  updateTextVisibility();
  updateProgressBar();
}

// Typing moves the progress bar between DOM updates (inside a word).
// Runs in the next frame, after the site has handled the same key press.
let progressFrame = 0;
export function scheduleProgressUpdate() {
  if (progressFrame) return;
  progressFrame = requestAnimationFrame(() => {
    progressFrame = 0;
    updateProgressBar();
  });
}