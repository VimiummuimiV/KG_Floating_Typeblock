export const svgIcon = (content) => `
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${content}</svg>`;

export const ICONS = {
  saved: svgIcon(`
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
    <polyline points="17 21 17 13 7 13 7 21"></polyline>
    <polyline points="7 3 7 8 15 8"></polyline>`),

  partial: svgIcon(`
    <line x1="17" y1="10" x2="3" y2="10"></line>
    <line x1="21" y1="6" x2="3" y2="6"></line>
    <line x1="21" y1="14" x2="3" y2="14"></line>
    <line x1="17" y1="18" x2="3" y2="18"></line>`),

  alignment: svgIcon(`
    <path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"></path>`),

  stats: svgIcon(`
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>`),

  progress: svgIcon(`
    <rect x="2" y="9" width="20" height="6" rx="3"></rect>
    <line x1="6" y1="12" x2="12" y2="12"></line>`),

  // User-defined matrix icon — do not change
  matrix: svgIcon(`
    <path d="M5 3v3m0 3v4m0 3v5"/>
    <path d="M10 6v4m0 3v3m0 3v2" opacity=".6"/>
    <path d="M15 3v5m0 3v3m0 3v4"/>
    <path d="M20 7v3m0 3v4m0 3v1" opacity=".6"/>
  `),

  sun: svgIcon(`
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/>
    <line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/>
    <line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`),

  moon: svgIcon(`
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`),

  autoEnter: svgIcon(`
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>
    <polyline points="10 17 15 12 10 7"/>
    <line x1="15" y1="12" x2="3" y2="12"/>`),

  chevronUp: svgIcon(`
    <polyline points="18 15 12 9 6 15"/>`),

  help: svgIcon(`
    <circle cx="12" cy="12" r="10"/>
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>`),

  play: svgIcon(`
    <polygon points="6 3 20 12 6 21 6 3" fill="currentColor" stroke="none"/>`)
};
