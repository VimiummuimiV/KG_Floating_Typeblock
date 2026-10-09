const DEFAULTS = {
  duration: 200,
  easing: 'ease'
};

/**
 * Animate element sliding in/out along the vertical axis.
 * @param {HTMLElement} element
 * @param {'in'|'out'} direction
 * @param {'up'|'down'} from
 * @param {object} [opts]
 * @param {number} [opts.distance=40]
 * @param {number} [opts.duration]
 * @param {string} [opts.easing]
 * @param {boolean} [opts.remove=false]
 * @param {string} [opts.baseTransform=''] - preserved transform (e.g. 'translateX(-50%)')
 * @returns {Promise<void>}
 */
export function slideVertical(element, direction, from, opts = {}) {
  if (!element) return Promise.resolve();
  const distance = opts.distance ?? 40;
  const duration = opts.duration ?? DEFAULTS.duration;
  const easing = opts.easing ?? DEFAULTS.easing;
  const remove = opts.remove === true;
  const base = opts.baseTransform ? opts.baseTransform + ' ' : '';

  const hiddenY = from === 'up' ? -distance : distance;
  const fromState = direction === 'in'
    ? { opacity: 0, transform: `${base}translateY(${hiddenY}px)` }
    : { opacity: 1, transform: `${base}translateY(0)` };
  const toState = direction === 'in'
    ? { opacity: 1, transform: `${base}translateY(0)` }
    : { opacity: 0, transform: `${base}translateY(${hiddenY}px)` };

  element.style.pointerEvents = direction === 'in' ? '' : 'none';
  Object.assign(element.style, fromState);

  return element.animate([fromState, toState], { duration, easing, fill: 'forwards' }).finished
    .then(() => {
      if (direction === 'out' && remove) element.remove();
      else if (direction === 'in') {
        element.style.opacity = '';
        element.style.transform = '';
      }
    })
    .catch(() => {
      if (direction === 'out' && remove && element.isConnected) element.remove();
    });
}

export function hideUp(element, opts) {
  return slideVertical(element, 'out', 'up', { remove: true, ...opts });
}

export function showFromUp(element, opts) {
  return slideVertical(element, 'in', 'up', opts);
}

export function hideDown(element, opts) {
  return slideVertical(element, 'out', 'down', { remove: true, ...opts });
}

export function showFromDown(element, opts) {
  return slideVertical(element, 'in', 'down', opts);
}
