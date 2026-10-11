import { ICONS } from './icons.js';
import { hasModeSettings } from './settings.js';
import { byId, createElement } from './utils.js';

const MARK_ID = 'kg-mode-mark';

// Badge on the edge of the block while this game mode has its own saved settings
export function updateModeMark() {
  const mark = byId(MARK_ID);
  const mainBlock = byId('main-block');
  if (!mainBlock || !hasModeSettings()) return mark?.remove();
  if (!mark) mainBlock.appendChild(createElement('span', { id: MARK_ID, innerHTML: ICONS.saved, title: 'Свои настройки режима' }));
}
