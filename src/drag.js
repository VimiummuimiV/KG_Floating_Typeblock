import { addListener } from './utils.js';

/**
 * Mouse drag shared by the block, the backdrop and the panels.
 * The session keeps the pointer start, plus whatever onStart returns, and onMove gets the offset from the start.
 * mousedown is cancelled, so the typing input keeps its focus while something is dragged.
 * @param {object} options
 * @param {HTMLElement} options.element - where the drag starts
 * @param {Function} [options.on] - listener registrar (a scope's `on`), plain addEventListener by default
 * @param {(event: MouseEvent) => boolean} [options.canStart]
 * @param {(event: MouseEvent) => object} [options.onStart] - state captured at the drag start
 * @param {(dx: number, dy: number, start: object) => void} options.onMove
 * @param {() => void} [options.onEnd]
 * @param {string} [options.cursor] - shown over the draggable parts of the element
 */
export function createDrag({ element, on = addListener, canStart = () => true, onStart = () => ({}), onMove, onEnd, cursor }) {
  let session = null;

  on(element, 'mousedown', (event) => {
    if (event.button !== 0 || !canStart(event)) return;
    session = { x: event.clientX, y: event.clientY, ...onStart(event) };
    document.body.style.userSelect = 'none';
    event.preventDefault();
  });

  on(document, 'mousemove', (event) => {
    if (session) {
      onMove(event.clientX - session.x, event.clientY - session.y, session);
      event.preventDefault();
    } else if (cursor && element.contains(event.target)) {
      element.style.cursor = canStart(event) ? cursor : 'default';
    }
  });

  on(document, 'mouseup', (event) => {
    if (!session || event.button !== 0) return;
    session = null;
    document.body.style.userSelect = '';
    element.style.cursor = '';
    onEnd?.();
  });

  if (cursor) on(element, 'mouseleave', () => { if (!session) element.style.cursor = ''; });
}
