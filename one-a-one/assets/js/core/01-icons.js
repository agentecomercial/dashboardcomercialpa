/* =========================================================================
   core/01-icons.js — Biblioteca de icones SVG (stroke, 24x24).
   Uso: App.icon('users')  ->  string SVG  |  App.iconEl('users') -> Element
   ========================================================================= */
(function (App) {
  'use strict';

  const P = {
    /* navegacao */
    home:        '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
    users:       '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    user:        '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    eye:         '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    chat:        '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-3.9-.9L3 21l1.9-4.6A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5Z"/>',
    handshake:   '<path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.9-3.9a2 2 0 0 1 0-2.8l.4-.4a2.8 2.8 0 0 0-4 0l-1 1a2 2 0 0 1-1.4.6H8.6a2 2 0 0 0-1.4.6L4 11.9"/><path d="m8 20 1.5-1.5"/><path d="M2 12.5 5.5 9"/>',
    target:      '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
    chart:       '<path d="M3 3v18h18"/><path d="m7 15 3.5-4.5 3 3L20 6"/>',
    barchart:    '<path d="M3 21h18"/><rect x="4" y="11" width="4" height="7" rx="1"/><rect x="10" y="6" width="4" height="12" rx="1"/><rect x="16" y="13" width="4" height="5" rx="1"/>',
    settings:    '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1Z"/>',
    clipboard:   '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6"/><path d="M9 16h4"/>',

    /* acoes */
    plus:        '<path d="M12 5v14"/><path d="M5 12h14"/>',
    minus:       '<path d="M5 12h14"/>',
    check:       '<path d="M20 6 9 17l-5-5"/>',
    checkCircle: '<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    x:           '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    edit:        '<path d="M11 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/><path d="M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4Z"/>',
    trash:       '<path d="M3 6h18"/><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/>',
    search:      '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>',
    filter:      '<path d="M3 5h18"/><path d="M7 12h10"/><path d="M10 19h4"/>',
    bell:        '<path d="M18 8a6 6 0 1 0-12 0c0 6-3 7-3 7h18s-3-1-3-7"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    calendar:    '<rect x="3" y="4.5" width="18" height="16.5" rx="2"/><path d="M8 2.5v4"/><path d="M16 2.5v4"/><path d="M3 10h18"/>',
    clock:       '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.5l3.5 2"/>',
    star:        '<path d="m12 3 2.7 5.7 6.3.9-4.5 4.4 1 6.2-5.5-2.9-5.5 2.9 1-6.2L3 9.6l6.3-.9Z"/>',
    flag:        '<path d="M4 21V4"/><path d="M4 4h10l-1.5 3.5L14 11H4"/>',
    alert:       '<path d="M12 3.5 2.5 20h19Z"/><path d="M12 9.5v4.5"/><path d="M12 17.5h.01"/>',
    info:        '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
    zap:         '<path d="M13 2 4.5 13.5H11l-1 8.5L19 10.5h-6.5Z"/>',
    fire:        '<path d="M12 22a7 7 0 0 0 7-7c0-4-3-6-3.5-9.5-2 1-2.5 3-2.5 4.5 0 0-1.5-1.5-1.5-4C9 8 5 10 5 15a7 7 0 0 0 7 7Z"/>',
    brain:       '<path d="M9.5 3a3 3 0 0 0-3 3 3 3 0 0 0-2 5.2A3 3 0 0 0 6 16.5a3 3 0 0 0 3.5 3V3Z"/><path d="M14.5 3a3 3 0 0 1 3 3 3 3 0 0 1 2 5.2 3 3 0 0 1-1.5 5.3 3 3 0 0 1-3.5 3V3Z"/>',
    trendUp:     '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    trendDown:   '<path d="m3 7 6 6 4-4 8 8"/><path d="M15 17h6v-6"/>',
    arrowRight:  '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
    arrowLeft:   '<path d="M19 12H5"/><path d="m11 18-6-6 6-6"/>',
    chevronRight:'<path d="m9 6 6 6-6 6"/>',
    chevronDown: '<path d="m6 9 6 6 6-6"/>',
    chevronLeft: '<path d="m15 6-6 6 6 6"/>',
    more:        '<circle cx="12" cy="5" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="12" cy="19" r="1.4"/>',
    menu:        '<path d="M3 6h18"/><path d="M3 12h18"/><path d="M3 18h18"/>',
    panelLeft:   '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
    sun:         '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m4.9 19.1 1.4-1.4"/><path d="m17.7 6.3 1.4-1.4"/>',
    moon:        '<path d="M21 13A9 9 0 0 1 11 3a7 7 0 1 0 10 10Z"/>',
    link:        '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
    paperclip:   '<path d="M21 12.5 12.5 21a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.7 3.7 0 0 1 5.2 5.2l-8.5 8.5a1.8 1.8 0 0 1-2.6-2.6l7.9-7.8"/>',
    image:       '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.8" cy="8.8" r="1.8"/><path d="m21 15.5-5-5L5.5 21"/>',
    file:        '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z"/><path d="M14 3v5h5"/>',
    download:    '<path d="M12 3v12"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M4 20h16"/>',
    upload:      '<path d="M12 16V4"/><path d="m7.5 8.5 4.5-4.5 4.5 4.5"/><path d="M4 20h16"/>',
    copy:        '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    print:       '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="2"/><path d="M6 14h12v7H6Z"/>',
    logout:      '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>',
    play:        '<path d="M6 4.5 19 12 6 19.5Z"/>',
    refresh:     '<path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/>',
    sparkles:    '<path d="m12 3 1.9 4.6L18.5 9.5 13.9 11.4 12 16l-1.9-4.6L5.5 9.5l4.6-1.9Z"/><path d="M18.5 15.5 19.4 18l2.1.9-2.1.9-.9 2.2-.9-2.2-2.1-.9 2.1-.9Z"/>',
    lightbulb:   '<path d="M9 18h6"/><path d="M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.6.5.9 1.1 1 1.7l.1.5h5l.1-.5c.1-.6.4-1.2 1-1.7A6 6 0 0 0 12 3Z"/>',
    phone:       '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.2a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2Z"/>',
    mail:        '<rect x="2" y="4.5" width="20" height="15" rx="2"/><path d="m2.5 6.5 9.5 6.5 9.5-6.5"/>',
    briefcase:   '<rect x="2.5" y="7" width="19" height="13" rx="2"/><path d="M8.5 7V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v2"/><path d="M2.5 12.5h19"/>',
    shield:      '<path d="M12 3 4.5 6v6c0 4.6 3.2 8.5 7.5 9.5 4.3-1 7.5-4.9 7.5-9.5V6Z"/><path d="m9.2 12 2 2 3.6-4"/>',
    layers:      '<path d="m12 2.5 9 5-9 5-9-5Z"/><path d="m3 12.5 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
    route:       '<circle cx="6" cy="19" r="3"/><circle cx="18" cy="5" r="3"/><path d="M9 19h5a4 4 0 0 0 0-8H10a4 4 0 0 1 0-8h5"/>',
    compass:     '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5.5-5.5 2 2-5.5Z"/>',
    inbox:       '<path d="M21 12h-6l-1.5 3h-3L9 12H3"/><path d="M5.5 4h13l2.5 8v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-6Z"/>',
    history:     '<path d="M3 12a9 9 0 1 0 2.6-6.4"/><path d="M3 4v5h5"/><path d="M12 7.5V12l3.5 2"/>',
    award:       '<circle cx="12" cy="9" r="6"/><path d="m8.5 14.5-1.5 7 5-3 5 3-1.5-7"/>',
    userPlus:    '<path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><path d="M19 8v6"/><path d="M22 11h-6"/>',
    grid:        '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/>',
    list:        '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3.5 6h.01"/><path d="M3.5 12h.01"/><path d="M3.5 18h.01"/>',
    smile:       '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0"/><path d="M9 9.5h.01"/><path d="M15 9.5h.01"/>',
    database:    '<ellipse cx="12" cy="5.5" rx="8" ry="3"/><path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>'
  };

  App.ICONS = P;

  App.icon = function (name, cls, size) {
    const d = P[name] || P.info;
    const st = size ? ' style="width:' + size + 'px;height:' + size + 'px;flex:0 0 ' + size + 'px"' : '';
    return '<svg class="ic ' + (cls || '') + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + st + '>' + d + '</svg>';
  };

  App.iconEl = function (name, cls, size) {
    const wrap = document.createElement('span');
    wrap.innerHTML = App.icon(name, cls, size);
    return wrap.firstChild;
  };
})(window.App);
