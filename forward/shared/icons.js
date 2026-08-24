const paths = {
  search:
    '<circle cx="11" cy="11" r="7"></circle><path d="m21 21-4.3-4.3"></path>',
  play: '<path d="m9 7 8 5-8 5z" fill="currentColor" stroke="none"></path>',
  pause: '<path d="M9 7v10M15 7v10"></path>',
  stop: '<rect x="7" y="7" width="10" height="10" rx="1.5" fill="currentColor" stroke="none"></rect>',
  volume:
    '<path d="M11 5 6.5 9H3v6h3.5l4.5 4V5Z"></path><path d="M15 9a4 4 0 0 1 0 6M18 6a8 8 0 0 1 0 12"></path>',
  reset:
    '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"></path><path d="M3 3v5h5"></path>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"></path>',
  panel:
    '<rect x="3" y="5" width="18" height="14" rx="2.5"></rect><path d="M14 5v14M6 12h5M9 9l2 3-2 3"></path>',
  close: '<path d="m7 7 10 10M17 7 7 17"></path>',
  chevron: '<path d="m9 18 6-6-6-6"></path>',
  "chevron-left": '<path d="m15 18-6-6 6-6"></path>',
  "chevron-right": '<path d="m9 18 6-6-6-6"></path>',
  check: '<path d="m5 12 4 4L19 6"></path>',
  lock: '<rect x="6" y="10" width="12" height="9" rx="2"></rect><path d="M8 10V7a4 4 0 0 1 8 0v3"></path>',
  gear: '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"></path>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"></path>',
  crown: '<path d="m4 8 4 4 4-7 4 7 4-4-2 11H6z"></path>',
  book: '<path d="M4 5.5A3.5 3.5 0 0 1 7.5 2H12v17H7.5A3.5 3.5 0 0 0 4 22V5.5Z"></path><path d="M20 5.5A3.5 3.5 0 0 0 16.5 2H12v17h4.5A3.5 3.5 0 0 1 20 22V5.5Z"></path>',
  warning:
    '<path d="M12 3 2.5 20h19L12 3Z"></path><path d="M12 9v5M12 17h.01"></path>',
  share:
    '<circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"></path>',
  replay:
    '<path d="M21 12a9 9 0 1 1-3-6.7L21 8"></path><path d="M21 3v5h-5"></path>',
  // THE CAPTURE STAR (v1.129.8). ONE silhouette, two states: the stroke stays on in both, so
  // the change reads as *fill arriving* rather than as the glyph resizing. Filled means "in at
  // least one of your lists" — see `_starHTML` in neural/src/app.src.jsx, which this mirrors.
  star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>',
  "star-filled":
    '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" fill="currentColor"></polygon>',
};

export function icon(name, size = 16) {
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths[name] || paths.chevron}</svg>`;
}
