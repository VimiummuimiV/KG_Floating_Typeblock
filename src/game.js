import { byId } from './utils.js';

export const getGameId = () => new URL(location.href).searchParams.get('gmid');

export async function fetchGameText(gameId) {
  const body = new URLSearchParams({ need_text: '1' });
  const res = await fetch(`${location.origin}/g/${gameId}.info`, { method: 'POST', body });
  return (await res.json()).text?.text ?? '';
}

const getTypeClass = (element) => [...element.classList].find((name) => name.startsWith('gametype-'));

// Key of the game mode; vocabularies are told apart by their id
export function getModeKey() {
  const description = byId('gamedesc');
  if (!description) return null;
  const modeClass = [...description.querySelectorAll('[class^="gametype-"]')].map(getTypeClass).find(Boolean);
  if (!modeClass) return null;
  if (modeClass === 'gametype-voc') {
    const href = description.querySelector('.gametype-voc a[href*="/vocs/"]')?.href;
    const id = href?.match(/\/vocs\/(\d+)/)?.[1];
    if (id) return `${modeClass}-${id}`;
  }
  return modeClass;
}

const isShown = (id) => {
  const element = byId(id);
  return !!element && element.style.display !== 'none';
};

// During waiting/race opens the replay of the current game
export function openReplay() {
  if (document.body.classList.contains('latest-games-registered')) return;
  if (!isShown('waiting') && !isShown('racing')) return;
  const gameId = getGameId();
  if (gameId) location.href = `https://klavogonki.ru/g/${gameId}.replay`;
}
