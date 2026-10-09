export function createStatsController({
  createElement,
  getSetting,
  toggleSetting,
  clamp,
  updateIndicators
}) {
  const STATS_ID = 'kg-stats';
  const SPEED_SCALE = { maxSpeed: 1000, hueRange: 130, cells: 16 };
  const ERRORS_HIT_ANIMATION = [
    { transform: 'scale(1.3)', filter: 'brightness(1.6)' },
    { transform: 'scale(1)', filter: 'none' }
  ];
  const ERRORS_HIT_DURATION = 350;

  function createStatsElement() {
    const cells = [...Array(SPEED_SCALE.cells)].map(() =>
      createElement('div', { className: 'kg-speed-cell' })
    );
    return createElement('div', { id: STATS_ID },
      createElement('div', { className: 'kg-speed' },
        createElement('div', { className: 'kg-speed-readout' },
          createElement('span', { className: 'kg-speed-value', textContent: '0' }),
          createElement('span', { className: 'kg-speed-unit', textContent: 'скорость' })),
        createElement('div', { className: 'kg-speed-bar' }, ...cells)),
      createElement('div', { className: 'kg-errors' },
        createElement('span', { className: 'kg-errors-value', textContent: '0' }),
        createElement('span', { className: 'kg-errors-label', textContent: 'ошибки' })));
  }

  function ensureStatsElement() {
    let stats = document.getElementById(STATS_ID);
    if (stats) return stats;
    const mainBlock = document.getElementById('main-block');
    if (!mainBlock) return null;
    stats = createStatsElement();
    mainBlock.prepend(stats);
    return stats;
  }

  const removeStats = () => document.getElementById(STATS_ID)?.remove();

  const readNumber = (id) => Number.parseInt(document.getElementById(id)?.textContent, 10) || 0;

  function setText(element, value) {
    const text = String(value);
    if (element.textContent === text) return false;
    element.textContent = text;
    return true;
  }

  function updateStats() {
    if (!getSetting('showStats')) {
      removeStats();
      return;
    }
    const stats = ensureStatsElement();
    if (!stats) return;

    const speed = readNumber('speed-label');
    const errors = readNumber('errors-label');
    const ratio = clamp(speed / SPEED_SCALE.maxSpeed, 0, 1);
    stats.style.setProperty('--kg-speed-hue', Math.round((1 - ratio) * SPEED_SCALE.hueRange));
    setText(stats.querySelector('.kg-speed-value'), speed);

    const litCells = Math.round(ratio * SPEED_SCALE.cells);
    stats.querySelectorAll('.kg-speed-cell').forEach((cell, index) => {
      cell.classList.toggle('kg-speed-cell-lit', index < litCells);
    });

    const errorsBox = stats.querySelector('.kg-errors');
    const errorsValue = errorsBox.querySelector('.kg-errors-value');
    const previousErrors = Number(errorsValue.textContent);
    const alreadyShown = stats.dataset.kgReady === '1';
    if (setText(errorsValue, errors) && errors > previousErrors && alreadyShown) {
      // Animate only the number so the separator border does not scale
      errorsValue.animate(ERRORS_HIT_ANIMATION, ERRORS_HIT_DURATION);
    }
    stats.dataset.kgReady = '1';
    errorsBox.classList.toggle('kg-errors-active', errors > 0);
  }

  function toggleStats() {
    toggleSetting('showStats', 'Скорость и ошибки');
    updateStats();
    updateIndicators();
  }

  function getStatsCss(theme, isDark) {
    return `
      #${STATS_ID} {
        position: absolute !important;
        bottom: 100% !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        margin-bottom: 8px !important;
        display: flex !important;
        align-items: center !important;
        gap: 14px !important;
        padding: 6px 18px !important;
        border: 2px solid ${theme.borderColor} !important;
        border-radius: 999px !important;
        background-color: ${theme.background} !important;
        box-shadow: ${theme.shadow} !important;
        font-family: Tahoma, Arial, sans-serif !important;
        white-space: nowrap !important;
        user-select: none !important;
        --kg-speed-lightness: ${isDark ? '65%' : '40%'};
        color: hsl(var(--kg-speed-hue, 130) 70% var(--kg-speed-lightness)) !important;
        transition: color 0.25s !important;
      }

      #${STATS_ID} .kg-speed {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }

      #${STATS_ID} .kg-speed-readout,
      #${STATS_ID} .kg-errors {
        display: flex;
        align-items: baseline;
        gap: 5px;
      }

      #${STATS_ID} .kg-speed-value,
      #${STATS_ID} .kg-errors-value {
        font-size: 22px;
        font-weight: 700;
        line-height: 1;
        font-variant-numeric: tabular-nums;
      }

      #${STATS_ID} .kg-speed-value {
        min-width: 3ch;
        text-align: right;
      }

      #${STATS_ID} .kg-speed-unit,
      #${STATS_ID} .kg-errors-label {
        font-size: 12px;
        color: ${theme.text.after};
      }

      #${STATS_ID} .kg-speed-bar {
        display: flex;
        gap: 2px;
        width: 128px;
      }

      #${STATS_ID} .kg-speed-cell {
        flex: 1;
        height: 4px;
        border-radius: 1px;
        background-color: ${theme.borderColor};
      }

      #${STATS_ID} .kg-speed-cell-lit {
        background-color: currentColor;
      }

      #${STATS_ID} .kg-errors {
        padding-left: 14px;
        border-left: 2px solid ${theme.borderColor};
        color: ${theme.text.after};
      }

      #${STATS_ID} .kg-errors-value {
        transition: color 0.2s;
      }

      #${STATS_ID} .kg-errors-active .kg-errors-value {
        color: ${theme.text.error};
      }
    `;
  }

  return {
    updateStats,
    toggleStats,
    removeStats,
    getStatsCss,
    STATS_ID
  };
}
