/* Universal Store — icon set.
   Thirty-three line icons on a 24×24 grid, 2px stroke, round caps and joins.
   Drawn as inline SVG rather than a sprite file so they need no extra
   request, work offline from the app-shell cache, and inherit colour from
   whatever they sit in — stroke is currentColor, so a red button gets a
   red icon for free.

   Use UI.icon(name) from JS. In static markup, inline the same <svg> by
   hand with class="i" (see index.html) so the icon is painted before any
   script runs. */
(function (w) {
  const P = {
    "cart":
      '<path d="M2.9 4h1.5a1.3 1.3 0 0 1 1.27 1.02L6.4 7.3"/><path d="M6.4 7.3H20.4l-1.55 6.2a1.7 1.7 0 0 1-1.65 1.3H9.6a1.7 1.7 0 0 1-1.65-1.3Z"/><circle cx="9.4" cy="19.4" r="1.55" fill="currentColor" stroke="none"/><circle cx="16.4" cy="19.4" r="1.55" fill="currentColor" stroke="none"/>',
    "cart-plus":
      '<path d="M2.7 4h1.45a1.27 1.27 0 0 1 1.24 1L5.9 7.1"/><path d="M5.9 7.1h8.75l-1.1 5.95a1.7 1.7 0 0 1-1.67 1.35H9.05a1.7 1.7 0 0 1-1.67-1.35Z"/><circle cx="9.1" cy="19.3" r="1.55" fill="currentColor" stroke="none"/><circle cx="14.2" cy="19.3" r="1.55" fill="currentColor" stroke="none"/><circle cx="17.9" cy="8.2" r="4.45"/><path d="M17.9 5.85v4.7M15.55 8.2h4.7"/>',
    "search":
      '<circle cx="10.6" cy="10.6" r="6.8"/><path d="m15.55 15.55 5.05 5.05"/>',
    "x":
      '<path d="M5.6 5.6 18.4 18.4M18.4 5.6 5.6 18.4"/>',
    "moon":
      '<path d="M20.6 14.1A8.9 8.9 0 1 1 10.4 3.3a6.9 6.9 0 0 0 10.2 10.8Z"/>',
    "sun":
      '<circle cx="12" cy="12" r="4.6"/><path d="M12 2.3v2.3M12 19.4v2.3M5.15 5.15 6.77 6.77M17.23 17.23l1.62 1.62M2.3 12h2.3M19.4 12h2.3M5.15 18.85l1.62-1.62M17.23 6.77l1.62-1.62"/>',
    "grid":
      '<rect x="3.4" y="3.4" width="7.4" height="7.4" rx="2.2"/><rect x="13.2" y="3.4" width="7.4" height="7.4" rx="2.2"/><rect x="3.4" y="13.2" width="7.4" height="7.4" rx="2.2"/><rect x="13.2" y="13.2" width="7.4" height="7.4" rx="2.2"/>',
    "list":
      '<circle cx="4.1" cy="6.2" r="1.6" fill="currentColor" stroke="none"/><circle cx="4.1" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="4.1" cy="17.8" r="1.6" fill="currentColor" stroke="none"/><path d="M9.3 6.2h10.6M9.3 12h10.6M9.3 17.8h10.6" stroke-width="2.4"/>',
    "chevron-up":
      '<path d="m5.5 14.75 6.5-6.25 6.5 6.25"/>',
    "chevron-down":
      '<path d="m5.5 9.25 6.5 6.25 6.5-6.25"/>',
    "plus-circle":
      '<circle cx="12" cy="12" r="8.9"/><path d="M12 8.1v7.8M8.1 12h7.8"/>',
    "minus-circle":
      '<circle cx="12" cy="12" r="8.9"/><path d="M8.1 12h7.8"/>',
    "pencil":
      '<path d="m3.6 20.4 1.1-4.3L15.9 4.9a2.1 2.1 0 0 1 2.97 0l1.26 1.26a2.1 2.1 0 0 1 0 2.97L8.9 19.4l-4.3 1.1Z"/><path d="m14.3 6.5 3.2 3.2"/>',
    "trash":
      '<path d="M3.6 6.4h16.8"/><path d="M9.6 6.4V5a1.1 1.1 0 0 1 1.1-1.1h2.6A1.1 1.1 0 0 1 14.4 5v1.4"/><path d="m5.7 6.4.87 12.55a2 2 0 0 0 2 1.85h6.86a2 2 0 0 0 2-1.85L18.3 6.4"/><path d="M10.2 10.5v6.2M13.8 10.5v6.2"/>',
    "phone":
      '<path d="M21.6 16.9v2.8a1.9 1.9 0 0 1-2.07 1.9 18.8 18.8 0 0 1-8.2-2.92 18.5 18.5 0 0 1-5.7-5.7A18.8 18.8 0 0 1 2.71 4.75 1.9 1.9 0 0 1 4.6 2.7h2.8a1.9 1.9 0 0 1 1.9 1.63 12.2 12.2 0 0 0 .67 2.67 1.9 1.9 0 0 1-.43 2L8.34 10.2a15.2 15.2 0 0 0 5.7 5.7l1.2-1.2a1.9 1.9 0 0 1 2-.43 12.2 12.2 0 0 0 2.67.67 1.9 1.9 0 0 1 1.63 1.93Z"/>',

    /* Drawn to match the supplied set — same 24x24 grid, 2px stroke, round
       caps and joins — for the concepts the set did not cover. Swap any of
       these for supplied artwork by replacing the path data below. */
    "chart":
      '<path d="M3.6 20.4h16.8"/><path d="M6.6 20.4v-6.2M11.4 20.4V7.6M16.2 20.4v-9.4"/>',
    "receipt":
      '<path d="M5.4 3.6h13.2v17.2l-2.64-1.6-2.64 1.6-2.64-1.6-2.64 1.6L5.4 20.8Z"/><path d="M9 8.6h6M9 12.6h6"/>',
    "package":
      '<path d="M20.4 8.2v7.6a1.7 1.7 0 0 1-.87 1.48l-6.7 3.73a1.7 1.7 0 0 1-1.66 0l-6.7-3.73A1.7 1.7 0 0 1 3.6 15.8V8.2a1.7 1.7 0 0 1 .87-1.48l6.7-3.73a1.7 1.7 0 0 1 1.66 0l6.7 3.73A1.7 1.7 0 0 1 20.4 8.2Z"/><path d="m3.85 7.3 8.15 4.55 8.15-4.55M12 20.8v-8.95"/>',
    "card":
      '<rect x="2.8" y="5" width="18.4" height="14" rx="2.6"/><path d="M2.8 9.8h18.4"/><path d="M6.6 14.6h3.4"/>',
    "truck":
      '<path d="M2.8 6.4h10.4v9.6H2.8z"/><path d="M13.2 9.6h3.6l3.4 3.2v3.2h-7z"/><circle cx="7" cy="18" r="1.9"/><circle cx="16.6" cy="18" r="1.9"/><path d="M8.9 18h5.8M2.8 18h1.3M18.5 18h1.9"/>',
    "gear":
      '<circle cx="12" cy="12" r="3.2"/><path d="M12 2.6v3M12 18.4v3M4.34 4.34l2.12 2.12M17.54 17.54l2.12 2.12M2.6 12h3M18.4 12h3M4.34 19.66l2.12-2.12M17.54 6.46l2.12-2.12"/><circle cx="12" cy="12" r="7.2"/>',
    "ticket":
      '<path d="M3.6 9.2V7.4a1.6 1.6 0 0 1 1.6-1.6h13.6a1.6 1.6 0 0 1 1.6 1.6v1.8a2.8 2.8 0 0 0 0 5.6v1.8a1.6 1.6 0 0 1-1.6 1.6H5.2a1.6 1.6 0 0 1-1.6-1.6v-1.8a2.8 2.8 0 0 0 0-5.6Z"/><path d="M13.6 5.8v12.4"/>',
    "store":
      '<path d="M4 10.4V19a1.4 1.4 0 0 0 1.4 1.4h13.2A1.4 1.4 0 0 0 20 19v-8.6"/><path d="M3 9.6 5 4.4h14l2 5.2a2.6 2.6 0 0 1-4.5 2.2 2.6 2.6 0 0 1-4.5 0 2.6 2.6 0 0 1-4.5 0A2.6 2.6 0 0 1 3 9.6Z"/>',
    "check":
      '<path d="M3.8 12.6 9.4 18.2 20.4 6.4"/>',
    "warning":
      '<path d="M10.62 4.1 2.9 17.4a1.6 1.6 0 0 0 1.38 2.4h15.44a1.6 1.6 0 0 0 1.38-2.4L13.38 4.1a1.6 1.6 0 0 0-2.76 0Z"/><path d="M12 9.4v4.2"/><circle cx="12" cy="16.8" r="1.1" fill="currentColor" stroke="none"/>',
    "image":
      '<rect x="3.2" y="4.6" width="17.6" height="14.8" rx="2.2"/><circle cx="8.6" cy="9.8" r="1.6"/><path d="m3.6 16.4 4.4-4.2a1.8 1.8 0 0 1 2.5 0l6.1 5.9"/><path d="m14.6 14 1.7-1.6a1.8 1.8 0 0 1 2.5 0l1.6 1.5"/>',
    "camera":
      '<path d="M20.4 18.4a1.8 1.8 0 0 1-1.8 1.8H5.4a1.8 1.8 0 0 1-1.8-1.8V9.2a1.8 1.8 0 0 1 1.8-1.8h2.9l1.5-2.2h4.4l1.5 2.2h2.9a1.8 1.8 0 0 1 1.8 1.8Z"/><circle cx="12" cy="13.4" r="3.4"/>',
    "undo":
      '<path d="M3.6 8.6h11.2a4.8 4.8 0 0 1 0 9.6H8.2"/><path d="m7.4 4.6-3.8 4 3.8 4"/>',
    "arrow-left":
      '<path d="M20 12H4.4"/><path d="m10.4 5.6-6 6.4 6 6.4"/>',
    "drag":
      '<circle cx="9" cy="5.6" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="5.6" r="1.5" fill="currentColor" stroke="none"/><circle cx="9" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="9" cy="18.4" r="1.5" fill="currentColor" stroke="none"/><circle cx="15" cy="18.4" r="1.5" fill="currentColor" stroke="none"/>',
    "info":
      '<circle cx="12" cy="12" r="8.9"/><path d="M12 11.2v5"/><circle cx="12" cy="7.9" r="1.1" fill="currentColor" stroke="none"/>',
    "lock":
      '<rect x="4.4" y="10.4" width="15.2" height="10" rx="2.4"/><path d="M8.2 10.4V7.6a3.8 3.8 0 0 1 7.6 0v2.8"/>',
    "sparkle":
      '<path d="M12 3.4 13.9 9 19.5 10.9 13.9 12.8 12 18.4 10.1 12.8 4.5 10.9 10.1 9Z"/><path d="M18.4 16.4l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7Z"/>',
  };

  w.US_ICONS = P;
  w.US_ICON_NAMES = Object.keys(P);
})(window);
