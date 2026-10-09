import { svgIcon, ICONS } from './icons.js';
import { hideUp, showFromUp } from './animations.js';

export function createButtonsController({
  themes,
  getCurrentTheme,
  isFloatingMode,
  getSetting,
  setSetting,
  getSettingsForMode,
  getCurrentModeKey,
  isPartialMode,
  toggleTextVisibilityMode,
  toggleInputAlignment,
  toggleStats,
  toggleProgressBar,
  toggleMatrixEffect,
  toggleTheme,
  toggleAutoEnterFloating,
  toggleCustomSettings,
  THEME_NAMES
}) {
  let numericIndicatorTimeout = null;
  let animating = false;

  // title/icon may be string or () => string
  // noOpacity: keep full opacity regardless of isActive
  const BUTTONS = [
    {
      id: 'kg-btn-saved',
      title: () => getSettingsForMode(getCurrentModeKey())
        ? 'Забыть настройки режима'
        : 'Запомнить настройки режима',
      isActive: () => !!getSettingsForMode(getCurrentModeKey()),
      toggle: () => toggleCustomSettings(),
      icon: ICONS.saved
    },
    {
      id: 'kg-btn-partial',
      title: 'Построчное отображение',
      isActive: isPartialMode,
      toggle: () => toggleTextVisibilityMode(),
      icon: ICONS.partial
    },
    {
      id: 'kg-btn-alignment',
      title: 'Выравнивание ввода',
      isActive: () => isFloatingMode() && getSetting('alignInputWithFocus'),
      toggle: () => toggleInputAlignment(),
      icon: ICONS.alignment
    },
    {
      id: 'kg-btn-stats',
      title: 'Скорость и ошибки',
      isActive: () => isFloatingMode() && getSetting('showStats'),
      toggle: () => toggleStats(),
      icon: ICONS.stats
    },
    {
      id: 'kg-btn-progress',
      title: 'Прогресс-бар',
      isActive: () => getSetting('showProgress'),
      toggle: () => toggleProgressBar(),
      icon: ICONS.progress
    },
    {
      id: 'kg-btn-matrix',
      title: 'Эффект матрицы',
      isActive: () => isFloatingMode() && getSetting('matrixEffect'),
      toggle: () => toggleMatrixEffect(),
      icon: ICONS.matrix
    },
    {
      id: 'kg-btn-theme',
      title: () => THEME_NAMES[getCurrentTheme()] || 'Тема',
      isActive: () => true,
      noOpacity: true,
      toggle: () => toggleTheme(),
      icon: () => getCurrentTheme() === 'dark' ? ICONS.moon : ICONS.sun
    },
    {
      id: 'kg-btn-autoenter',
      title: 'Автовход в плавающий режим',
      isActive: () => !!getSetting('autoEnterFloating'),
      toggle: () => toggleAutoEnterFloating(),
      icon: ICONS.autoEnter
    }
  ];

  function resolve(value) {
    return typeof value === 'function' ? value() : value;
  }

  function ensureShell() {
    const mainBlock = document.getElementById('main-block');
    if (!mainBlock) return null;

    let wrap = document.getElementById('kg-buttons-wrap');
    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'kg-buttons-wrap';
      Object.assign(wrap.style, {
        position: 'absolute',
        left: '0',
        right: '0',
        bottom: '-40px',
        zIndex: '1'
      });
      mainBlock.appendChild(wrap);
    }

    let shell = document.getElementById('kg-buttons');
    if (!shell) {
      shell = document.createElement('div');
      shell.id = 'kg-buttons';
      Object.assign(shell.style, {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        width: '100%'
      });
      wrap.appendChild(shell);
    }

    let left = document.getElementById('kg-buttons-left');
    if (!left) {
      left = document.createElement('div');
      left.id = 'kg-buttons-left';
      Object.assign(left.style, {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '8px'
      });
      shell.appendChild(left);
    }

    let right = document.getElementById('kg-buttons-right');
    if (!right) {
      right = document.createElement('div');
      right.id = 'kg-buttons-right';
      Object.assign(right.style, {
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 'auto'
      });
      shell.appendChild(right);
    }

    return { wrap, shell, left, right };
  }

  function applyButtonBaseStyles(span) {
    const theme = themes[getCurrentTheme()];
    if (!theme) return;
    const { text, background } = theme.input.normal;
    Object.assign(span.style, {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '28px',
      height: '28px',
      backgroundColor: background,
      color: text,
      stroke: text,
      cursor: 'pointer'
    });
    span.style.setProperty('border-radius', '0.2em', 'important');
    span.style.setProperty('box-shadow', theme.shadowSmall, 'important');
  }

  function syncButton(def, parent) {
    let span = document.getElementById(def.id);
    if (!span) {
      span = document.createElement('span');
      span.id = def.id;
      span.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        def.toggle();
      });
      parent.appendChild(span);
    } else if (span.parentElement !== parent) {
      parent.appendChild(span);
    }
    span.title = resolve(def.title);
    span.innerHTML = resolve(def.icon);
    applyButtonBaseStyles(span);
    span.style.opacity = def.noOpacity || def.isActive() ? '1' : '0.4';
  }

  function syncCollapseButton(right) {
    let span = document.getElementById('kg-btn-collapse');
    if (!span) {
      span = document.createElement('span');
      span.id = 'kg-btn-collapse';
      span.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleCollapse();
      });
      right.appendChild(span);
    }
    const open = getSetting('showButtons') !== false;
    // open → chevron up (hide upward); closed → chevron down (show downward)
    span.title = open ? 'Скрыть кнопки' : 'Показать кнопки';
    span.innerHTML = open ? ICONS.chevronUp : ICONS.chevronDown;
    applyButtonBaseStyles(span);
    span.style.opacity = '1';
  }

  async function toggleCollapse() {
    if (animating || !isFloatingMode()) return;
    const open = getSetting('showButtons') !== false;
    const parts = ensureShell();
    if (!parts) return;

    animating = true;
    if (open) {
      // Hide left group upward, then clear it
      setSetting('showButtons', false);
      await hideUp(parts.left, { distance: 36 });
      parts.left.replaceChildren();
      // Recreate empty left container (hideUp may have removed it)
      if (!document.getElementById('kg-buttons-left')) {
        const left = document.createElement('div');
        left.id = 'kg-buttons-left';
        Object.assign(left.style, {
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: '8px'
        });
        parts.shell.insertBefore(left, parts.right);
      }
    } else {
      setSetting('showButtons', true);
      const parts2 = ensureShell();
      BUTTONS.forEach((def) => syncButton(def, parts2.left));
      await showFromUp(parts2.left, { distance: 36 });
    }
    syncCollapseButton(ensureShell().right);
    animating = false;
  }

  function updateButtons() {
    if (!isFloatingMode()) {
      document.getElementById('kg-buttons-wrap')?.remove();
      return;
    }
    const { left, right } = ensureShell();
    const open = getSetting('showButtons') !== false;

    if (open) {
      BUTTONS.forEach((def) => syncButton(def, left));
      // Remove buttons that are no longer in the list
      [...left.children].forEach((child) => {
        if (!BUTTONS.some((d) => d.id === child.id) && child.id !== 'kg-numeric-indicator') {
          child.remove();
        }
      });
    } else {
      left.replaceChildren();
    }
    syncCollapseButton(right);
  }

  function ensureFontImport() {
    if (document.getElementById('kg-font-import')) return;
    const link = document.createElement('link');
    link.id = 'kg-font-import';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Quicksand:wght@300..700&display=swap';
    document.head.appendChild(link);
  }

  function showNumericIndicator(value, title = '', updateOnly = false) {
    if (getSetting('showButtons') === false) {
      document.getElementById('kg-numeric-indicator')?.remove();
      return;
    }
    let span = document.getElementById('kg-numeric-indicator');
    if (!span && updateOnly) return;
    const { left } = ensureShell() || {};
    if (!left) return;
    ensureFontImport();
    if (!span) {
      span = document.createElement('span');
      span.id = 'kg-numeric-indicator';
      left.appendChild(span);
    }
    span.title = title;
    applyButtonBaseStyles(span);
    Object.assign(span.style, {
      fontFamily: '"Quicksand", sans-serif',
      fontWeight: '600',
      fontSize: '1.1em',
      cursor: 'default'
    });
    span.innerText = String(value);
    if (updateOnly) return;
    clearTimeout(numericIndicatorTimeout);
    numericIndicatorTimeout = setTimeout(() => span.remove(), 3000);
  }

  return {
    updateButtons,
    showNumericIndicator,
    applyButtonBaseStyles,
    svgIcon
  };
}
