const DEFAULTS = {
  duration: 200,
  easing: 'ease'
};

// The latest animation of every element: a new slide replaces it instead of stacking on top
const running = new WeakMap();

const snapshot = (element) => {
  const { opacity, transform } = getComputedStyle(element);
  return { opacity, transform };
};

/**
 * Animate element sliding in/out along the vertical axis.
 * A new call interrupts the previous one and continues from the current pose, so repeated calls never jump.
 * @param {HTMLElement} element
 * @param {'in'|'out'} direction
 * @param {'up'|'down'} from
 * @param {object} [opts]
 * @param {number} [opts.distance=40]
 * @param {number} [opts.duration]
 * @param {string} [opts.easing]
 * @param {boolean} [opts.remove=false] - remove the element after sliding out
 * @param {string} [opts.baseTransform=''] - preserved transform (e.g. 'translateX(-50%)')
 * @returns {Promise<void>}
 */
export function slideVertical(element, direction, from, opts = {}) {
  if (!element) return Promise.resolve();
  const { distance = 40, duration = DEFAULTS.duration, easing = DEFAULTS.easing, remove = false, baseTransform = '' } = opts;
  const base = baseTransform ? baseTransform + ' ' : '';

  const hidden = { opacity: 0, transform: `${base}translateY(${from === 'up' ? -distance : distance}px)` };
  const shown = { opacity: 1, transform: `${base}translateY(0)` };
  const [start, end] = direction === 'in' ? [hidden, shown] : [shown, hidden];

  const previous = running.get(element);
  const origin = previous?.playState === 'running' ? snapshot(element) : start;
  previous?.cancel();

  element.style.pointerEvents = direction === 'in' ? '' : 'none';
  const animation = element.animate([origin, end], { duration, easing, fill: 'forwards' });
  running.set(element, animation);

  return animation.finished.then(
    () => {
      if (direction === 'in') animation.cancel();
      else if (remove) element.remove();
    },
    () => {} // interrupted by a newer slide, which owns the element now
  );
}

export const hideUp = (element, opts) => slideVertical(element, 'out', 'up', { remove: true, ...opts });
export const showFromUp = (element, opts) => slideVertical(element, 'in', 'up', opts);
export const hideDown = (element, opts) => slideVertical(element, 'out', 'down', { remove: true, ...opts });
export const showFromDown = (element, opts) => slideVertical(element, 'in', 'down', opts);
