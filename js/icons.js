/* Universal Store — icon set.
   Fifteen line icons on a 24×24 grid, 2px stroke, round caps and joins.
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
  };

  w.US_ICONS = P;
  w.US_ICON_NAMES = Object.keys(P);
})(window);
