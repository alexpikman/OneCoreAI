import React from 'react';

const TABLER_PATHS: Record<string, string> = {
  dashboard: 'M4 4h6v6H4z M14 4h6v10h-6z M4 14h6v6H4z M14 18h6v2h-6z',
  message: 'M8 10h8 M8 14h5 M5 19l-1 2v-5a8 8 0 1 1 3 3z',
  terminal: 'm5 7 5 5-5 5 M13 17h6',
  world: 'M3 12a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M3.6 9h16.8 M3.6 15h16.8 M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18',
  folder: 'M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M3 10h18',
  tasks: 'M9 6h11 M9 12h11 M9 18h11 M4 6l1 1 2-2 M4 12l1 1 2-2 M4 18l1 1 2-2',
  workflow: 'M6 4v4 M18 16v4 M6 8a4 4 0 0 0 4 4h4a4 4 0 0 1 4 4 M18 4v4',
  files: 'M5 4h9l5 5v11H5z M14 4v5h5 M8 13h8 M8 17h8',
  history: 'M3 12a9 9 0 1 0 3-6.7L3 8 M3 3v5h5 M12 7v5l3 2',
  brain: 'M9 4a3 3 0 0 0-5 2 3 3 0 0 0 0 5 3 3 0 0 0 2 5 3 3 0 0 0 3 4z M15 4a3 3 0 0 1 5 2 3 3 0 0 1 0 5 3 3 0 0 1-2 5 3 3 0 0 1-3 4z M9 4v16 M15 4v16',
  journal: 'M4 6h.01 M8 6h12 M4 12h.01 M8 12h12 M4 18h.01 M8 18h12',
  alert: 'M12 8v4 M12 16h.01 M21 12a9 9 0 1 1-18 0a9 9 0 0 1 18 0',
  clipboard: 'M9 4h6l1 2h3v14H5V6h3z M9 11h6 M9 15h6',
  cloud: 'M7 18a4 4 0 1 1 1-7.9A5 5 0 0 1 18 9a4.5 4.5 0 0 1 0 9z',
  cpu: 'M9 9h6v6H9z M9 2v4 M15 2v4 M9 18v4 M15 18v4 M2 9h4 M2 15h4 M18 9h4 M18 15h4',
  laptop: 'M4 5h16v12H4z M2 20h20 M8 17l-1 3 M16 17l1 3',
  robot: 'M12 3v3 M8 10h.01 M16 10h.01 M8 15h8 M5 8h14v12H5z M3 11v6 M21 11v6',
  users: 'M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2 M10 11a4 4 0 1 0 0-8a4 4 0 0 0 0 8',
  book: 'M4 5a2 2 0 0 1 2-2h14v17H6a2 2 0 0 1-2-2z M4 5v13 M8 7h8 M8 11h8',
  github: 'M9 19c-4 1.5-4-2.5-6-3m12 6v-3.9a3.4 3.4 0 0 0-.9-2.7c3-.3 6.1-1.5 6.1-6.7a5.2 5.2 0 0 0-1.4-3.6 4.8 4.8 0 0 0-.1-3.6S17.5.7 14 3a13 13 0 0 0-7 0C3.5.7 2.3 1.5 2.3 1.5a4.8 4.8 0 0 0-.1 3.6A5.2 5.2 0 0 0 .8 8.7c0 5.2 3.1 6.4 6.1 6.7A3.4 3.4 0 0 0 6 18.1V22',
  docker: 'M3 13h18a7 7 0 0 1-7 7H9a6 6 0 0 1-6-7z M6 9h3v3H6z M10 9h3v3h-3z M10 5h3v3h-3z M14 9h3v3h-3z',
  puzzle: 'M8 4a2 2 0 1 1 4 0v2h4v5h2a2 2 0 1 1 0 4h-2v5h-5v-2a2 2 0 1 0-4 0v2H3v-6h2a2 2 0 1 0 0-4H3V6h5z',
  hook: 'M7 7a3 3 0 1 0-3 3 M17 7a3 3 0 1 1 3 3 M12 20a3 3 0 1 0 0-6 M7 9l3 5 M17 9l-3 5',
  plug: 'M9 7V3 M15 7V3 M7 7h10v4a5 5 0 0 1-10 0z M12 16v5',
  tool: 'M14 7a5 5 0 0 0-6 6L3 18l3 3 5-5a5 5 0 0 0 6-6l-3 3-3-3z',
  palette: 'M12 3a9 9 0 1 0 0 18h1a2 2 0 0 0 1.7-3.1 1.5 1.5 0 0 1 1.3-2.3H19a2 2 0 0 0 2-2A10 10 0 0 0 12 3z M7.5 10h.01 M10 7h.01 M15 7h.01',
  shield: 'M12 3 20 6v5c0 5-3.4 8-8 10-4.6-2-8-5-8-10V6z M8 12l3 3 5-6',
  lock: 'M5 11h14v10H5z M8 11V7a4 4 0 0 1 8 0v4',
  refresh: 'M20 7v5h-5 M4 17v-5h5 M5.6 9A7 7 0 0 1 18 6l2 6 M4 12l2 6a7 7 0 0 0 12.4-3',
  search: 'M10 10a7 7 0 1 0 0 .01 M21 21l-6-6',
  download: 'M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2 M7 11l5 5 5-5 M12 4v12',
  settings: 'M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8 M4 12h2 M18 12h2 M12 4v2 M12 18v2',
};

export const NavTablerIcon: React.FC<{ name: string; className?: string }> = ({ name, className }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.7"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d={TABLER_PATHS[name] ?? TABLER_PATHS.settings} />
  </svg>
);
