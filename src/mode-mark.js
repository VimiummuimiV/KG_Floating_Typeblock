import { hasModeSettings } from './settings.js';
import { byId, createElement } from './utils.js';

const MARK_ID = 'kg-mode-mark';

// Small gray dot in the top right corner of the text block while this game mode has its own saved settings
export function updateModeMark() {
  const mark = byId(MARK_ID);
  const typeBlock = byId('typeblock');
  if (!typeBlock || !hasModeSettings()) return mark?.remove();
  if (!mark) typeBlock.appendChild(createElement('span', { id: MARK_ID, title: 'Свои настройки режима' }));
}
