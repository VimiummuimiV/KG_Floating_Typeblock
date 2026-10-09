export function createMatrixController({
  getSetting,
  isFloatingMode,
  addEvent,
  getGameId,
  fetchGameText,
  randomItem,
  createElement
}) {
  // ─── Constants ───────────────────────────────────────────────────────────
  const MATRIX = {
    fontSize: 16,
    stepInterval: 60,
    opacity: 0.6,
    trailFade: 0.03,
    wordChance: 0.01,
    minWordLength: 3,
    glyphColor: '#0F0',
    wordColor: '#CFC',
    glyphs: 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン'
  };

  // columns: falling streams { y, word, pos }
  // words:   cache of the current game text, loaded once per game
  const matrix = {
    canvas: null,
    ctx: null,
    raf: null,
    columns: [],
    lastStep: 0,
    gameId: null,
    words: []
  };

  // The effect brings its own dark base, so it is independent of the backdrop dimming level
  const shouldShowMatrix = () => isFloatingMode() && getSetting('matrixEffect');

  const createMatrixColumn = (maxY = 50) => ({
    y: Math.floor(Math.random() * maxY) + 1,
    word: '',
    pos: 0
  });

  // Whole text is requested once: the page itself reveals the words only as they get typed
  function extractWords(text) {
    const words = text.split(/\s+/).map(word => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''));
    return [...new Set(words.filter(word => word.length >= MATRIX.minWordLength))];
  }

  async function loadMatrixWords() {
    const gameId = getGameId();
    if (!gameId || matrix.gameId === gameId) return;
    matrix.gameId = gameId;
    try {
      matrix.words = extractWords(await fetchGameText(gameId));
    } catch {
      matrix.gameId = null;
    }
  }

  function fadeMatrix(alpha) {
    const { ctx } = matrix;
    const width = window.innerWidth;
    const height = window.innerHeight;
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fillRect(0, 0, width, height);
  }

  // Resizing clears the canvas, so the dark base is painted again.
  // Columns start at random vertical positions for a seamless (no initial wall) look.
  // High-DPI handling keeps glyphs sharp under browser zoom / retina.
  function resizeMatrix() {
    const { canvas } = matrix;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const width = window.innerWidth;
    const height = window.innerHeight;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    matrix.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const maxY = Math.floor(height / MATRIX.fontSize) || 50;
    matrix.columns = Array.from(
      { length: Math.floor(width / MATRIX.fontSize) || 1 },
      () => createMatrixColumn(maxY)
    );
    fadeMatrix(1);
  }

  function ensureMatrixCanvas() {
    if (matrix.canvas) return;
    matrix.canvas = createElement('canvas', { id: 'kg-matrix-canvas' });
    Object.assign(matrix.canvas.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      zIndex: '1999',
      pointerEvents: 'none',
      opacity: MATRIX.opacity
    });
    matrix.ctx = matrix.canvas.getContext('2d');
    document.body.appendChild(matrix.canvas);
    addEvent(window, 'resize', resizeMatrix);
  }

  // A column prints a whole word letter by letter top to bottom, otherwise random glyphs.
  // Words come only from the game text (API); glyphs stay pure katakana (no digits).
  function stepMatrix() {
    const { ctx, columns, words } = matrix;
    fadeMatrix(MATRIX.trailFade);
    ctx.font = MATRIX.fontSize + 'px monospace';
    const height = window.innerHeight;
    for (let index = 0; index < columns.length; index++) {
      // A missing column is created on the spot, so a stale or sparse array can never break the animation
      const column = columns[index] ??= createMatrixColumn(Math.floor(height / MATRIX.fontSize) || 50);
      if (!column.word && words.length && Math.random() < MATRIX.wordChance) {
        Object.assign(column, { word: randomItem(words), pos: 0 });
      }
      const isWord = !!column.word;
      ctx.fillStyle = isWord ? MATRIX.wordColor : MATRIX.glyphColor;
      ctx.fillText(
        isWord ? column.word[column.pos] : randomItem(MATRIX.glyphs),
        index * MATRIX.fontSize,
        column.y * MATRIX.fontSize
      );

      const wraps = column.y * MATRIX.fontSize > height && Math.random() > 0.975;
      column.y = wraps ? 1 : column.y + 1;
      if (wraps || (isWord && ++column.pos >= column.word.length)) column.word = '';
    }
  }

  function matrixFrame(now) {
    if (!shouldShowMatrix()) {
      stopMatrixAnimation();
      return;
    }
    if (now - matrix.lastStep >= MATRIX.stepInterval) {
      matrix.lastStep = now;
      stepMatrix();
    }
    matrix.raf = requestAnimationFrame(matrixFrame);
  }

  function startMatrixAnimation() {
    if (matrix.raf) return;
    ensureMatrixCanvas();
    resizeMatrix();
    loadMatrixWords();
    matrix.canvas.style.display = 'block';
    matrix.lastStep = 0;
    matrix.raf = requestAnimationFrame(matrixFrame);
  }

  function stopMatrixAnimation() {
    cancelAnimationFrame(matrix.raf);
    matrix.raf = null;
    if (matrix.canvas) matrix.canvas.style.display = 'none';
  }

  function updateMatrixEffect() {
    if (shouldShowMatrix()) startMatrixAnimation();
    else stopMatrixAnimation();
  }

  // The resize listener is already removed by removeEvents on exit; the words cache is kept
  function destroyMatrix() {
    stopMatrixAnimation();
    matrix.canvas?.remove();
    Object.assign(matrix, { canvas: null, ctx: null, columns: [] });
  }

  return { updateMatrixEffect, destroyMatrix };
}
