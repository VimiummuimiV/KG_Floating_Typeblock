import { fetchGameText, getGameId } from './game.js';
import { FALL_STYLES, resolveGlyphs } from './matrix-presets.js';
import { getSetting } from './settings.js';
import { createElement, isFloating, randomItem, times } from './utils.js';

// Chance per step that a column past the edge starts over
const RESPAWN_CHANCE = 0.025;
const CELL_CLEAR_HEIGHT = 1.25;
// Brightness (of 255) below which a faded cell is not worth waiting for
const MIN_ERASE_LEVEL = 8;

// columns: falling streams { y, row, speed, dir, word, pos, prev }
// tokens:  every word of the current game text, loaded once per game; words: those long enough
// trail:   printed cells in order of age, erased once they have faded; step counts the frames drawn
// grid:    what the columns were built for (font size and fall style), a change rebuilds them
const matrix = {
  canvas: null,
  ctx: null,
  raf: null,
  columns: [],
  trail: [],
  step: 0,
  lastStep: 0,
  gameId: null,
  tokens: [],
  words: [],
  minLength: null,
  glyphs: [],
  grid: null
};

// All the tuning lives in the settings: { fontSize, stepInterval, opacity, trailFade, wordChance, ... }
const config = () => getSetting('matrix');

// The canvas is transparent: the glyphs have their own opacity, the dimming belongs to the backdrop alone
const shouldShowMatrix = () => isFloating() && getSetting('matrixEffect');

const getRows = (fontSize) => Math.floor(window.innerHeight / fontSize) || 50;

function createColumn(rows) {
  const { speed: [slowest, fastest], direction } = FALL_STYLES[config().fallStyle];
  return {
    y: Math.floor(Math.random() * rows) + 1,
    row: 0,
    speed: slowest + Math.random() * (fastest - slowest),
    dir: direction || (Math.random() < 0.5 ? 1 : -1),
    word: [],
    pos: 0,
    prev: null
  };
}

// ─── Words ───────────────────────────────────────────────────────────────────

// Whole text is requested once: the page itself reveals the words only as they get typed
const extractTokens = (text) => [...new Set(
  text.split(/\s+/).map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '')).filter(Boolean)
)];

function filterWords() {
  matrix.minLength = config().minWordLength;
  matrix.words = matrix.tokens.filter((word) => word.length >= matrix.minLength);
}

async function loadWords() {
  const gameId = getGameId();
  if (!gameId || matrix.gameId === gameId) return;
  matrix.gameId = gameId;
  try {
    matrix.tokens = extractTokens(await fetchGameText(gameId));
    filterWords();
  } catch {
    matrix.gameId = null;
  }
}

// A word of a rising column is laid out bottom to top, so it still reads top to bottom
const toLetters = (word, direction) => (direction < 0 ? [...word].reverse() : [...word]);

// ─── Canvas ──────────────────────────────────────────────────────────────────

// Makes everything printed so far a bit more transparent
function fade(alpha) {
  const { ctx } = matrix;
  ctx.globalCompositeOperation = 'destination-out';
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
  ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
  ctx.globalCompositeOperation = 'source-over';
}

// Resizing clears the canvas.
// Columns start at random vertical positions for a seamless (no initial wall) look.
// High-DPI handling keeps glyphs sharp under browser zoom / retina.
function resizeMatrix() {
  const { canvas, ctx } = matrix;
  if (!canvas) return;
  const { fontSize, fallStyle } = config();
  const dpr = window.devicePixelRatio || 1;
  const { innerWidth: width, innerHeight: height } = window;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = width + 'px';
  canvas.style.height = height + 'px';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.font = fontSize + 'px monospace';
  ctx.textAlign = 'center';
  const rows = getRows(fontSize);
  matrix.trail = [];
  matrix.columns = times(Math.floor(width / fontSize) || 1, () => createColumn(rows));
  matrix.grid = { fontSize, fallStyle };
}

function ensureCanvas() {
  if (matrix.canvas) return;
  matrix.canvas = createElement('canvas', { id: 'kg-matrix-canvas' });
  matrix.ctx = matrix.canvas.getContext('2d');
  document.body.appendChild(matrix.canvas);
  window.addEventListener('resize', resizeMatrix);
}

// Takes the settings that cannot be read live while drawing
function syncConfig() {
  const { fontSize, fallStyle, opacity, glyphSet, customGlyphs, digits, minWordLength } = config();
  matrix.canvas.style.opacity = opacity;
  matrix.glyphs = resolveGlyphs(glyphSet, customGlyphs, digits);
  if (matrix.minLength !== minWordLength) filterWords();
  if (matrix.grid?.fontSize !== fontSize || matrix.grid?.fallStyle !== fallStyle) resizeMatrix();
}

// ─── Drawing ─────────────────────────────────────────────────────────────────

const paint = ({ ch, x, y }, color) => {
  matrix.ctx.fillStyle = color;
  matrix.ctx.fillText(ch, x, y);
};

function clearCell({ x, y }, size) {
  matrix.ctx.clearRect(x - size / 2, y - size, size, size * CELL_CLEAR_HEIGHT);
}

// A column prints a whole word letter by letter along its way, otherwise random glyphs.
// Words come only from the game text (API).
function drawGlyph(column, index, row, settings) {
  const { glyphs, words, columns } = matrix;
  const { fontSize: size, fallStyle, wordChance, glyphColor, wordColor, headColor, brightHead } = settings;

  if (!column.word.length && words.length && Math.random() < wordChance) {
    column.word = toLetters(randomItem(words), column.dir);
    column.pos = 0;
  }
  const letter = column.word[column.pos];
  const color = letter ? wordColor : glyphColor;
  const slot = (index + Math.floor(row * FALL_STYLES[fallStyle].drift)) % columns.length;
  const cell = {
    ch: letter ?? randomItem(glyphs),
    x: (slot + columns.length) % columns.length * size + size / 2,
    y: row * size,
    color,
    step: matrix.step
  };
  matrix.trail.push(cell);
  if (letter && ++column.pos >= column.word.length) column.word = [];

  if (!brightHead) {
    column.prev = null;
    paint(cell, color);
    return;
  }
  // The previous cell gives up the head color
  if (column.prev) {
    clearCell(column.prev, size);
    paint(column.prev, column.prev.color);
  }
  paint(cell, headColor);
  column.prev = cell;
}

// Fading stalls: a pixel too faint to change by rounding in 8 bits stays forever, and the fainter
// the fade step the brighter that level is. Left alone these leftovers pile up into gray smudges,
// so every cell is erased once it has faded down to that level.
function eraseFaded({ fontSize, trailFade }) {
  const { trail, step } = matrix;
  const level = Math.max(0.5 / trailFade, MIN_ERASE_LEVEL);
  const lifetime = Math.log(level / 255) / Math.log(1 - trailFade);
  let expired = 0;
  while (expired < trail.length && step - trail[expired].step > lifetime) clearCell(trail[expired++], fontSize);
  trail.splice(0, expired);
}

function stepMatrix() {
  const settings = config();
  const rows = getRows(settings.fontSize);
  matrix.step++;
  fade(settings.trailFade);
  eraseFaded(settings);
  matrix.columns.forEach((column, index) => {
    column.y += column.dir * column.speed;
    const row = Math.floor(column.y);
    if (row !== column.row) {
      column.row = row;
      drawGlyph(column, index, row, settings);
    }
    const isOutside = column.dir > 0 ? row > rows : row < 1;
    if (isOutside && Math.random() < RESPAWN_CHANCE) {
      Object.assign(column, { y: column.dir > 0 ? 1 : rows, word: [], prev: null });
    }
  });
}

function matrixFrame(now) {
  if (!shouldShowMatrix()) {
    stopMatrixAnimation();
    return;
  }
  if (now - matrix.lastStep >= config().stepInterval) {
    matrix.lastStep = now;
    stepMatrix();
  }
  matrix.raf = requestAnimationFrame(matrixFrame);
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

function startMatrixAnimation() {
  ensureCanvas();
  matrix.grid = null;
  loadWords();
  matrix.canvas.style.display = 'block';
  matrix.lastStep = 0;
  matrix.raf = requestAnimationFrame(matrixFrame);
}

function stopMatrixAnimation() {
  cancelAnimationFrame(matrix.raf);
  matrix.raf = null;
  if (matrix.canvas) matrix.canvas.style.display = 'none';
}

// Start, stop or re-tune: called on entering the floating mode and whenever a matrix setting changes
export function updateMatrixEffect() {
  if (!shouldShowMatrix()) {
    stopMatrixAnimation();
    return;
  }
  if (!matrix.raf) startMatrixAnimation();
  syncConfig();
}

// The words cache is kept
export function destroyMatrix() {
  stopMatrixAnimation();
  window.removeEventListener('resize', resizeMatrix);
  matrix.canvas?.remove();
  Object.assign(matrix, { canvas: null, ctx: null, columns: [], trail: [], grid: null });
}