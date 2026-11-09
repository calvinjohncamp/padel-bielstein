window.PBClubArt = window.PBClubArt || {};
// TFB-Kiosk – gezeichnete Produktbilder als Platzhalter, bis echte Fotos da sind.
// Jede Zeichnung bekommt die Produktfarbe; Linien nutzen die Textfarbe des Themas.
(function () {
  const line = 'var(--ink)';
  const glass = 'rgba(255,255,255,.55)';


  // Länglicher Schokoriegel in Folie: gezackte Enden statt Striche, Logo-Feld in der Mitte.
  function riegel(wrap, label, labelStroke) {
    return `
      <g transform="rotate(-14 32 32)">
        <path d="M11 24.5L5 22.5l2.2 3.4L4 28.6l3 2.6-3 2.6 3 2.6-3.2 2.7 2.2 3.4 6-2z" fill="${wrap}" stroke="${line}" stroke-width="2.4" stroke-linejoin="round"/>
        <path d="M53 24.5l6-2-2.2 3.4 3.2 2.7-3 2.6 3 2.6-3 2.6 3.2 2.7-2.2 3.4-6-2z" fill="${wrap}" stroke="${line}" stroke-width="2.4" stroke-linejoin="round"/>
        <rect x="10" y="22.5" width="44" height="19" rx="5" fill="${wrap}" stroke="${line}" stroke-width="3"/>
        <path d="M14 26h36" stroke="rgba(255,255,255,.28)" stroke-width="2" stroke-linecap="round"/>
        <path d="M19 26.8h30l-4.6 10.4H14.4z" fill="${label}" stroke="${labelStroke}" stroke-width="2.2" stroke-linejoin="round"/>
      </g>`;
  }

  // Echtes PBClubArt.-Zeichen in Weiß (aus brand-data.js) – nur für Vereinsartikel wie Kappe und Shirt.
  function brandMark(x, y, w, extra = '') {
    if (!PBClubArt.brandMarkWhite) return `<text x="${x + w / 2}" y="${y + w / 4}" text-anchor="middle" font-size="${w / 3}" font-weight="800" fill="#FFFDF5" font-family="system-ui"${extra}>TFB</text>`;
    const h = w / (PBClubArt.brandMarkRatio || 2.7);
    return `<image href="${PBClubArt.brandMarkWhite}" x="${x}" y="${y}" width="${w}" height="${h.toFixed(2)}"${extra}/>`;
  }

  // Schlanke 0,5-l-Flasche der Erzquell Brauerei: Flasche, Halsfolie, Oval-Etikett, Ring, zwei Schriftstriche.
  function erzquell(bottle, foil, label, ring, marks, word = '') {
    return `
      <path d="M28.5 4h7v13c0 3.5 5.5 6 5.5 13v24a5 5 0 0 1-5 5h-8a5 5 0 0 1-5-5V30c0-7 5.5-9.5 5.5-13z" fill="${bottle}" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M28.5 4h7v12.5h-7z" fill="${foil}" stroke="${line}" stroke-width="2.4" stroke-linejoin="round"/>
      ${word ? `<rect x="25" y="27" width="14" height="28" rx="1" fill="${label}" stroke="${line}" stroke-width="2"/>
        ${[...word].map((letter, i) => `<text x="32" y="${41 - (word.length - 1) * 2.4 + i * 4.8}" dominant-baseline="central" text-anchor="middle" font-family="system-ui" font-size="4.7" font-weight="800" fill="#2A2D2E">${letter}</text>`).join('')}` : `
      <ellipse cx="32" cy="41.5" rx="7.4" ry="11" fill="${label}" stroke="${line}" stroke-width="2.4"/>
      <ellipse cx="32" cy="41.5" rx="5" ry="8" fill="none" stroke="${ring}" stroke-width="1.6"/>
      <path d="M29.6 39.5h4.8M29.2 43.5h5.6" stroke="${marks}" stroke-width="2" stroke-linecap="round"/>`}
      <path d="M26 27c-.9 1.5-1.3 3-1.3 5" stroke="rgba(255,255,255,.35)" stroke-width="2.5" stroke-linecap="round" fill="none"/>`;
  }
  function waterBottle(c, apple = false) {
    return `<path d="M28 9.5h8v8c0 4 6 5.5 6 11.5v26a4 4 0 0 1-4 4H26a4 4 0 0 1-4-4V29c0-6 6-7.5 6-11.5z" fill="${c}" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
      <rect x="27" y="7.5" width="10" height="5" rx="1.5" fill="${line}"/>
      ${apple ? `<rect x="22" y="29" width="20" height="20" rx="1" fill="#FFFFFF" stroke="${line}" stroke-width="2.2"/>
        <g transform="translate(32 39) scale(.75) translate(-32 -39)">
        <path d="M32 36c-5-4-9 0-7 5 1 4 4 6 7 4 3 2 6 0 7-4 2-5-2-9-7-5z" fill="${c}" stroke="${line}" stroke-width="1.4" stroke-linejoin="round"/>
        <path d="M32 36v-3" stroke="${line}" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M33 34c0-3 3-4 5-3-1 3-3 4-5 3z" fill="#63874A"/>
        <path d="M27 38c-1 1-1 2-.5 3" fill="none" stroke="#FFFFFF" stroke-width="1.2" stroke-linecap="round"/></g>` : `
      <path d="M22 32h20v13.5H22z" fill="#FFFFFF" stroke="${line}" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M32 34l.9 2 2.2-.5-1.3 1.8 1.3 1.8-2.2-.5-.9 2-.9-2-2.2.5 1.3-1.8-1.3-1.8 2.2.5z" fill="#D2202F"/>
      <path d="M23.1 42.2c3-1.9 6.2 1.4 8.9-.1 2.9-1.6 6-1.4 8.9.2v2.1H23.1z" fill="#4FBFB0"/>`}
      <path d="${apple ? 'M25.3 52v3' : 'M25.3 49v6'}M25.6 22c-1 1.6-1.5 3.4-1.5 5" stroke="rgba(255,255,255,.75)" stroke-width="2.2" stroke-linecap="round" fill="none"/>`;
  }

  function labeledBottle(c, label, labelColor = '#FFFFFF') {
    return `<path d="M28 5h8v13c0 5 7 7 7 15v22a5 5 0 0 1-5 5H26a5 5 0 0 1-5-5V33c0-8 7-10 7-15z" fill="${c}" stroke="${line}" stroke-width="3"/>
      <path d="M27 4h10v5H27z" fill="${line}"/>
      <rect x="21" y="34" width="22" height="15" rx="2" fill="${labelColor}" stroke="${line}" stroke-width="2"/>
      <text x="32" y="43.5" text-anchor="middle" font-family="system-ui" font-size="5" font-weight="800" fill="#2A2D2E">${label}</text>
      <path d="M25 25v6M25 52v4" stroke="${glass}" stroke-width="2" stroke-linecap="round"/>`;
  }
  const bread = `<path d="M37 45c-2-8 3-13 10-13s12 5 10 13l-2 10H39z" fill="#E4BD79" stroke="${line}" stroke-width="2.5"/><path d="M43 37l-2 5m9-5-2 5" stroke="#A77C40" stroke-width="2" stroke-linecap="round"/>`;
  const sausageMeal = (c, grilled = false) => `<ellipse cx="32" cy="50" rx="28" ry="10" fill="#FFFFFF" stroke="${line}" stroke-width="2"/>
    <path d="M13 48c-6-9-3-22 6-27 6-3 11 4 6 8-6 4-6 10-2 15 4 6-5 10-10 4z" fill="${c}" stroke="${line}" stroke-width="3"/>
    ${grilled ? '<path d="M19 25l5 3m-9 2 6 2m-7 5 6 1m-5 5 6-1" stroke="#74452C" stroke-width="2" stroke-linecap="round"/>' : ''}${bread}`;

  const shapes = {
    flutlicht: c => `<path d="M32 27v31M24 59h16" fill="none" stroke="${line}" stroke-width="3" stroke-linecap="round"/>
      <rect x="13" y="10" width="38" height="18" rx="3" fill="#F4F1EA" stroke="${line}" stroke-width="3"/>
      <g fill="${c}" stroke="${line}" stroke-width="1.5"><rect x="18" y="14" width="11" height="10" rx="1"/><rect x="35" y="14" width="11" height="10" rx="1"/></g>
      <path d="M12 33l-5 6M23 34l-2 8M41 34l2 8M52 33l5 6" stroke="${c}" stroke-width="2.5" stroke-linecap="round"/>`,
    tennisspieler: c => `<circle cx="29" cy="10" r="5" fill="#F0CBA5" stroke="${line}" stroke-width="2.5"/>
      <path d="M25 20l9-1 4 15-13 3-5-8z" fill="${c}" stroke="${line}" stroke-width="2.5" stroke-linejoin="round"/>
      <path d="M23 23l-8 8-8-2M35 23l9 6 7-7" fill="none" stroke="${line}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M25 37l-3 10-9 10M35 36l7 10 8 9" fill="none" stroke="${line}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M9 59h8M47 58h8" stroke="${line}" stroke-width="3" stroke-linecap="round"/>
      <g transform="rotate(25 53 15)"><ellipse cx="53" cy="12" rx="6" ry="8" fill="#FFFFFF" stroke="${line}" stroke-width="2"/><path d="M50 7v10M53 5v14M56 7v10M48 10h10M48 14h10" stroke="${c}" stroke-width=".8"/><path d="M53 20v8" stroke="${line}" stroke-width="2.5" stroke-linecap="round"/></g>
      <circle cx="9" cy="17" r="2.5" fill="#E9C857"/>`,
    'koelsch-flasche': c => erzquell(c, '#E9B949', '#F4F1EA', '#C4553A', '#E9B949'),
    'weizen-flasche': c => labeledBottle(c, 'WEIZEN', '#EDD39B'),
    apfelschorle: c => waterBottle(c, true),
    fassbrause: c => erzquell(c, '#B6C85D', '#EAF1D6', '#2A2D2E', '#2A2D2E', 'FASS'),
    aperol: c => `<rect x="16" y="4" width="32" height="57" rx="5" fill="${c}" stroke="${line}" stroke-width="3"/>
      <path d="M17.5 19l29-4v18l-29 4z" fill="#244D87"/>
      <text x="32" y="29" transform="rotate(-8 32 26)" text-anchor="middle" font-family="system-ui" font-size="7" font-weight="900" fill="#FFD45B">APEROL</text>
      <text x="32" y="44" transform="rotate(-8 32 41)" text-anchor="middle" font-family="system-ui" font-size="7" font-weight="900" fill="#FFFFFF">SPRITZ</text>
      <path d="M21 49l22-3" stroke="rgba(255,255,255,.65)" stroke-width="1"/>
      <ellipse cx="32" cy="5" rx="16" ry="3" fill="#D9DDE0" stroke="${line}" stroke-width="2"/><ellipse cx="32" cy="5" rx="4" ry="1.2" fill="none" stroke="${line}"/>
      <path d="M22 11v5" stroke="${glass}" stroke-width="2" stroke-linecap="round"/>`,
    wein: c => `<path d="M28 3h8v22c0 5 7 5 7 13v18a4 4 0 0 1-4 4H25a4 4 0 0 1-4-4V38c0-8 7-8 7-13z" fill="${c}" stroke="${line}" stroke-width="3"/>
      <path d="M28 3h8v14h-8z" fill="#3F6652" stroke="${line}" stroke-width="2"/><rect x="22" y="39" width="20" height="14" fill="#FAFAF5" stroke="${line}" stroke-width="2"/>
      <path d="M27 44h10m-8 4h6" stroke="#3F6652" stroke-width="2" stroke-linecap="round"/>`,
    'wurst-brot': c => sausageMeal(c),
    'grillwurst-brot': c => sausageMeal(c, true),
    grillfleisch: c => `<ellipse cx="32" cy="50" rx="28" ry="10" fill="#FFFFFF" stroke="${line}" stroke-width="2"/>
      <path d="M8 34l-1-4 3-4 4-1 3-3 5 2 4-1 3 4 4 1 1 5 3 3-2 5 1 3-5 4-4-1-4 3-5-2-4 1-4-4 1-4z" fill="${c}" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M14 29l13 14m-7-16 11 12m-18-3 8 9" stroke="#67362C" stroke-width="2.5" stroke-linecap="round"/>${bread}`,
    // Gerolsteiner Gourmet-Flasche: klares Glas, türkiser Verschluss, weißes Etikett mit rotem Stern und türkiser Welle
    gerolsteiner: c => waterBottle(c),
    // Erzquell-Flasche (Golden Malz, Sportsfreund, Radler): gleiche Form, gleiche Etikettlage, nur andere Farben
    malz: (c) => erzquell(c, '#E8B22B', '#F2C230', '#B5462F', '#6B3E1E'),
    sportsfreund: (c) => erzquell(c, '#1F3A6E', '#F4F1EA', '#1F3A6E', '#C8202F'),
    radler: (c) => erzquell(c, '#F4F1EA', '#F4F1EA', '#2E7D32', '#F2C230'),
    padel: (c) => `
      <g transform="rotate(-32 32 32)">
        <path d="M32 4c9.5 0 15 6.5 15 15.5 0 8-3.8 14.6-9 18.2L35 42h-6l-3-4.3c-5.2-3.6-9-10.2-9-18.2C17 10.5 22.5 4 32 4z" fill="${c}" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
        <g fill="${line}" opacity=".55">
          <circle cx="27" cy="13" r="1.4"/><circle cx="32" cy="12" r="1.4"/><circle cx="37" cy="13" r="1.4"/>
          <circle cx="24.5" cy="18.5" r="1.4"/><circle cx="29.5" cy="18" r="1.4"/><circle cx="34.5" cy="18" r="1.4"/><circle cx="39.5" cy="18.5" r="1.4"/>
          <circle cx="27" cy="23.5" r="1.4"/><circle cx="32" cy="23.5" r="1.4"/><circle cx="37" cy="23.5" r="1.4"/>
          <circle cx="29.5" cy="28.5" r="1.4"/><circle cx="34.5" cy="28.5" r="1.4"/>
        </g>
        <path d="M29 42h6v16a3 3 0 0 1-6 0z" fill="#2A2D2E" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
        <path d="M29.5 46l5-2M29.5 50l5-2M29.5 54l5-2" stroke="#FFFDF5" stroke-width="1.3" opacity=".6"/>
        <path d="M30 60c-3 3-3 5 2 5s5-2 2-5" fill="none" stroke="${line}" stroke-width="2" stroke-linecap="round"/>
      </g>`,
    // Snickers: braune Folie, blaues Logo-Feld mit weißem Rand
    snickers: () => riegel('#4A2A1A', '#1F5FB0', '#FFFDF5'),
    // Mars: schwarze Folie, rotes Logo-Feld mit goldenem Rand
    mars: () => riegel('#151515', '#D2202F', '#E8B22B'),
    // Red Bull: blau-silbernes Karo
    redbull: () => `
      <path d="M21 10h22v45a3 3 0 0 1-3 3H24a3 3 0 0 1-3-3z" fill="#C9CED6"/>
      <path d="M21 10h11v23H21z" fill="#1E3A8A"/>
      <path d="M32 33h11v22a3 3 0 0 1-3 3h-8z" fill="#1E3A8A"/>
      <path d="M22 6h20l1 4H21z" fill="#D9D4CA" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M21 10h22v45a3 3 0 0 1-3 3H24a3 3 0 0 1-3-3z" fill="none" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M25 14v12" stroke="rgba(255,255,255,.55)" stroke-width="2.5" stroke-linecap="round"/>`,
    // Hotdog: Würstchen im Brötchen mit Senf
    hotdog: (c) => `
      <g transform="rotate(-10 32 34)">
        <rect x="9" y="21" width="46" height="18" rx="9" fill="#E7B46A" stroke="${line}" stroke-width="3"/>
        <rect x="4" y="26" width="56" height="11" rx="5.5" fill="${c}" stroke="${line}" stroke-width="3"/>
        <path d="M12 30c2.5-3 4.5 3 7 0s4.5 3 7 0 4.5 3 7 0 4.5 3 7 0 4.5 3 7 0" fill="none" stroke="#F2C230" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M8 35h48v2a9 9 0 0 1-9 9H17a9 9 0 0 1-9-9z" fill="#D9A05A" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
        <path d="M15 40h22" stroke="#F3D7A6" stroke-width="2.5" stroke-linecap="round"/>
      </g>`,
    kranz: (c) => `
      <path d="M32 3v40" stroke="${line}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="32" cy="6.5" r="4" fill="none" stroke="${line}" stroke-width="3"/>
      <g opacity=".75"><rect x="13.5" y="19" width="9" height="27" rx="1.5" fill="${c}" stroke="${line}" stroke-width="2.4"/><path d="M12.5 20c0-3 2-4 5.5-4s5.5 1 5.5 4z" fill="#FFFDF5" stroke="${line}" stroke-width="2.2" stroke-linejoin="round"/></g><g opacity=".75"><rect x="27.5" y="19" width="9" height="27" rx="1.5" fill="${c}" stroke="${line}" stroke-width="2.4"/><path d="M26.5 20c0-3 2-4 5.5-4s5.5 1 5.5 4z" fill="#FFFDF5" stroke="${line}" stroke-width="2.2" stroke-linejoin="round"/></g><g opacity=".75"><rect x="41.5" y="19" width="9" height="27" rx="1.5" fill="${c}" stroke="${line}" stroke-width="2.4"/><path d="M40.5 20c0-3 2-4 5.5-4s5.5 1 5.5 4z" fill="#FFFDF5" stroke="${line}" stroke-width="2.2" stroke-linejoin="round"/></g>
      <g opacity="1"><rect x="6.5" y="25" width="9" height="29" rx="1.5" fill="${c}" stroke="${line}" stroke-width="2.4"/><path d="M5.5 26c0-3 2-4 5.5-4s5.5 1 5.5 4z" fill="#FFFDF5" stroke="${line}" stroke-width="2.2" stroke-linejoin="round"/></g><g opacity="1"><rect x="20.5" y="25" width="9" height="29" rx="1.5" fill="${c}" stroke="${line}" stroke-width="2.4"/><path d="M19.5 26c0-3 2-4 5.5-4s5.5 1 5.5 4z" fill="#FFFDF5" stroke="${line}" stroke-width="2.2" stroke-linejoin="round"/></g><g opacity="1"><rect x="34.5" y="25" width="9" height="29" rx="1.5" fill="${c}" stroke="${line}" stroke-width="2.4"/><path d="M33.5 26c0-3 2-4 5.5-4s5.5 1 5.5 4z" fill="#FFFDF5" stroke="${line}" stroke-width="2.2" stroke-linejoin="round"/></g><g opacity="1"><rect x="48.5" y="25" width="9" height="29" rx="1.5" fill="${c}" stroke="${line}" stroke-width="2.4"/><path d="M47.5 26c0-3 2-4 5.5-4s5.5 1 5.5 4z" fill="#FFFDF5" stroke="${line}" stroke-width="2.2" stroke-linejoin="round"/></g>
      <path d="M4 54c0 4 13 6 28 6s28-2 28-6" fill="none" stroke="${line}" stroke-width="3" stroke-linecap="round"/>`,
    stange: (c) => `
      <path d="M23 13h18v41a3 3 0 0 1-3 3H26a3 3 0 0 1-3-3z" fill="${c}" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M21 14c-1-5 3-8 6-7 2-3 8-3 10 0 3-1 7 2 6 7z" fill="#FFFDF5" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M28 20v30" stroke="${glass}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="35" cy="30" r="1.3" fill="#FFFDF5" opacity=".8"/><circle cx="33" cy="40" r="1" fill="#FFFDF5" opacity=".8"/><circle cx="36" cy="46" r="1.2" fill="#FFFDF5" opacity=".8"/>`,
    weizen: (c) => `
      <path d="M21 13h22c0 7-3 11-3 17 0 6 5 9 5 17v6a4 4 0 0 1-4 4H23a4 4 0 0 1-4-4v-6c0-8 5-11 5-17 0-6-3-10-3-17z" fill="${c}" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M19 14c-1-6 4-9 8-8 3-3 9-3 11 0 4-1 8 3 6 8z" fill="#FFFDF5" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M26 20c0 4 2 7 2 10" stroke="${glass}" stroke-width="3" stroke-linecap="round" fill="none"/>`,
    cola: (c) => `
      <path d="M28 4h8v7c0 3 5 5 5 11 0 4-3 6-3 9 0 3 4 5 4 10v13a5 5 0 0 1-5 5H27a5 5 0 0 1-5-5V41c0-5 4-7 4-10 0-3-3-5-3-9 0-6 5-8 5-11z" fill="${c}" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M23 36c6 3 12-3 18 0" fill="none" stroke="#FFFDF5" stroke-width="3" stroke-linecap="round"/>
      <rect x="27" y="2" width="10" height="5" rx="1.5" fill="${line}"/>
      <path d="M27 17c-1 2-2 3-2 5" stroke="${glass}" stroke-width="3" stroke-linecap="round" fill="none"/>`,
    slimcan: (c) => `
      <path d="M23 10h18v45a3 3 0 0 1-3 3H26a3 3 0 0 1-3-3z" fill="${c}" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M24 6h16l1 4H23z" fill="#D9D4CA" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M23 40l18-12v8L23 48z" fill="#E8B22B" stroke="${line}" stroke-width="2" stroke-linejoin="round"/>
      <path d="M27 16v14" stroke="${glass}" stroke-width="3" stroke-linecap="round"/>`,
    wafer: () => `
      <g transform="rotate(-10 32 34)">
        <rect x="13" y="21" width="38" height="34" rx="4" fill="#D9A45F" stroke="${line}" stroke-width="3"/>
        <rect x="13" y="17" width="38" height="34" rx="4" fill="#6B3E1E" stroke="${line}" stroke-width="3"/>
        <rect x="13" y="12" width="38" height="34" rx="4" fill="#E2B06A" stroke="${line}" stroke-width="3"/>
        <path d="M22.5 12v34M32 12v34M41.5 12v34M13 20.5h38M13 29h38M13 37.5h38" stroke="#B07A38" stroke-width="2"/>
        <rect x="13" y="12" width="38" height="34" rx="4" fill="none" stroke="${line}" stroke-width="3"/>
      </g>`,
    tube: (c) => `
      <path d="M20 12h24v42a4 4 0 0 1-4 4H24a4 4 0 0 1-4-4z" fill="${c}" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
      <ellipse cx="32" cy="11" rx="12" ry="4" fill="#E8E2D6" stroke="${line}" stroke-width="3"/>
      <circle cx="32" cy="34" r="8" fill="#FFF1DC" stroke="${line}" stroke-width="2"/>
      <path d="M24.6 30.5c.2-4.4 3.3-6.8 7.4-6.8s7.2 2.4 7.4 6.8c-1.9-1.5-4.6-2-7.4-.6-2.8-1.4-5.5-.9-7.4.6z" fill="${line}"/>
      <circle cx="29" cy="33.6" r="1.1" fill="${line}"/><circle cx="35" cy="33.6" r="1.1" fill="${line}"/>
      <path d="M24.5 38.5c3-3 5.5-2.2 7.5-.3 2-1.9 4.5-2.7 7.5.3-2 2.6-5 2.8-7.5 1-2.5 1.8-5.5 1.6-7.5-1z" fill="${line}"/>
      <path d="M27.5 44.5l4.5 2.3 4.5-2.3v5l-4.5-2.3-4.5 2.3z" fill="#D2202F" stroke="${line}" stroke-width="1.5" stroke-linejoin="round"/>`,
    // Gummibär: runder Kopf und Ohren, breiter Po, Ärmchen und Beinchen als helle Bögen, freundliches Gesicht
    bear: (c) => {
      const b = '<circle cx="20.5" cy="11" r="6.3"/><circle cx="43.5" cy="11" r="6.3"/>'
        + '<ellipse cx="32" cy="19.5" rx="14" ry="11.5"/>'
        + '<ellipse cx="32" cy="36" rx="11.5" ry="8"/>'
        + '<circle cx="20" cy="38" r="6.2"/><circle cx="44" cy="38" r="6.2"/>'
        + '<circle cx="23" cy="52" r="8.2"/><circle cx="41" cy="52" r="8.2"/>'
        + '<rect x="21" y="40" width="22" height="20" rx="4"/>';
      return `
        <g fill="${line}" stroke="${line}" stroke-width="6" stroke-linejoin="round">${b}</g>
        <g fill="${c}">${b}</g>
        <path d="M22.6 31.5c-4.6 2.6-5.4 9.2-1.2 12.6M41.4 31.5c4.6 2.6 5.4 9.2 1.2 12.6" fill="none" stroke="#FFFDF5" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M21.5 48.5c4 .4 6.6 3.4 6.6 8M42.5 48.5c-4 .4-6.6 3.4-6.6 8" fill="none" stroke="#FFFDF5" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M16.6 11.2c.2-2.4 1.6-4 3.6-4.6" fill="none" stroke="#FFFDF5" stroke-width="2.2" stroke-linecap="round" opacity=".85"/>
        <circle cx="26.8" cy="17.5" r="1.9" fill="${line}"/><circle cx="37.2" cy="17.5" r="1.9" fill="${line}"/>
        <ellipse cx="32" cy="21.6" rx="2.5" ry="1.8" fill="${line}"/>
        <path d="M28.6 24.2c1.2 1.8 2.4 1.8 3.4.4 1 1.4 2.2 1.4 3.4-.4" fill="none" stroke="${line}" stroke-width="1.6" stroke-linecap="round"/>`;
    },
    sausage: (c) => `
      <ellipse cx="32" cy="45" rx="27" ry="9" fill="#FFFDF5" stroke="${line}" stroke-width="3"/>
      <g transform="rotate(-8 32 34)">
        <rect x="9" y="33" width="46" height="11" rx="5.5" fill="${c}" stroke="${line}" stroke-width="3"/>
        <rect x="11" y="22" width="44" height="11" rx="5.5" fill="${c}" stroke="${line}" stroke-width="3"/>
        <path d="M16 26c3-2 5 2 8 0s5 2 8 0 5 2 8 0 5 2 8 0" fill="none" stroke="#E8B22B" stroke-width="2.5" stroke-linecap="round"/>
        <path d="M16 37h30" stroke="${glass}" stroke-width="2.5" stroke-linecap="round"/>
      </g>`,
    cone: (c) => `
      <path d="M20 28h24L32 60z" fill="#E3B26B" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M24 32l13 13M30 32l9 9M40 32L27 45M34 32l-9 9M28 44l6 6M36 44l-6 6" fill="none" stroke="#B8894C" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M18 29c-2-9 4-17 14-17s16 8 14 17z" fill="#FFF4DD" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M23 23c0-4 3-7 7-7" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
      <circle cx="29" cy="23" r="1.2" fill="${c}"/><circle cx="36" cy="19" r="1.2" fill="${c}"/><circle cx="39" cy="25" r="1.1" fill="${c}"/>`,
    beer: (c) => `
      <path d="M17 18h24v34a5 5 0 0 1-5 5H22a5 5 0 0 1-5-5z" fill="${c}"/>
      <path d="M41 25h5a6 6 0 0 1 6 6v8a6 6 0 0 1-6 6h-5" fill="none" stroke="${line}" stroke-width="3"/>
      <path d="M17 18h24v34a5 5 0 0 1-5 5H22a5 5 0 0 1-5-5z" fill="none" stroke="${line}" stroke-width="3"/>
      <path d="M14 18c0-5 4-8 8-7 2-4 9-5 12-1 4-2 10 1 9 7-1 3-4 4-6 3H19c-3 1-5-0-5-2z" fill="#FFFDF5" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M24 28v20M31 28v20" stroke="${glass}" stroke-width="3" stroke-linecap="round"/>`,
    bottle: (c) => `
      <path d="M27 6h10v12c0 3 6 6 6 13v24a4 4 0 0 1-4 4H25a4 4 0 0 1-4-4V31c0-7 6-10 6-13z" fill="${c}" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
      <rect x="21" y="34" width="22" height="14" fill="#FFFDF5" stroke="${line}" stroke-width="3"/>
      <path d="M26 6h12" stroke="${line}" stroke-width="4" stroke-linecap="round"/>
      <path d="M26 24c-2 2-2 4-2 6" stroke="${glass}" stroke-width="3" stroke-linecap="round"/>`,
    water: (c) => `
      <path d="M26 5h12v6c4 2 7 6 7 12v31a5 5 0 0 1-5 5H24a5 5 0 0 1-5-5V23c0-6 3-10 7-12z" fill="${c}" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M19 30h26M19 44h26" stroke="${line}" stroke-width="3"/>
      <path d="M24 34v6" stroke="${glass}" stroke-width="3" stroke-linecap="round"/>
      <rect x="25" y="3" width="14" height="5" rx="1.5" fill="${line}"/>`,
    can: (c) => `
      <path d="M19 12h26v42a4 4 0 0 1-4 4H23a4 4 0 0 1-4-4z" fill="${c}" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M21 8h22l2 4H19z" fill="#D9D4CA" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M19 27c9 5 17-5 26 0" fill="none" stroke="#FFFDF5" stroke-width="3"/>
      <path d="M24 33v15" stroke="${glass}" stroke-width="3" stroke-linecap="round"/>`,
    cup: (c) => `
      <path d="M13 26h32v12a14 14 0 0 1-14 14h-4a14 14 0 0 1-14-14z" fill="#FFFDF5" stroke="${line}" stroke-width="3"/>
      <path d="M45 30h3a6 6 0 0 1 0 12h-4" fill="none" stroke="${line}" stroke-width="3"/>
      <path d="M15 30h28" stroke="${c}" stroke-width="5"/>
      <path d="M8 56h42" stroke="${line}" stroke-width="3" stroke-linecap="round"/>
      <path d="M23 9c-3 4 3 6 0 11M31 7c-3 4 3 7 0 12" fill="none" stroke="${line}" stroke-width="2.5" stroke-linecap="round" opacity=".55"/>`,
    bar: (c) => riegel(c, '#FFFDF5', 'rgba(0,0,0,.18)'),
    bag: (c) => `
      <path d="M16 10c6 2 26 2 32 0l-2 6c3 10 3 22 0 32l2 6c-6-2-26-2-32 0l2-6c-3-10-3-22 0-32z" fill="${c}" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
      <ellipse cx="32" cy="32" rx="9" ry="7" fill="#F2D06B" stroke="${line}" stroke-width="2.5"/>`,
    ball: (c) => `
      <circle cx="32" cy="32" r="21" fill="${c}" stroke="${line}" stroke-width="3"/>
      <path d="M15 19c9 6 9 20 0 26M49 19c-9 6-9 20 0 26" fill="none" stroke="#FFFDF5" stroke-width="3"/>`,
    grip: (c) => `
      <rect x="12" y="20" width="40" height="24" rx="12" fill="${c}" stroke="${line}" stroke-width="3"/>
      <path d="M26 20.5l-4.5 23M33 20.5l-4.5 23M40 20.5l-4.5 23M46 22l-3.5 20.5" stroke="${line}" stroke-width="2" stroke-linecap="round" opacity=".5"/>`,
    shirt: (c) => `
      <path d="M22 9l-13 8 5 10 6-3v31h24V24l6 3 5-10-13-8c-2 4-6 6-10 6s-8-2-10-6z" fill="${c}" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
      ${brandMark(23.5, 27, 17)}`,
    cap: (c) => `
      <path d="M15 42c-1-15 9.5-26.5 23-26.5S59.5 26 59 41c-9 2.6-34.5 3.2-44 1z" fill="${c}" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
      <path d="M38 15.5c-5.5 5-8.4 14-8.6 27.6M38 15.5c5.8 5.4 9 14.3 9.6 26.8" fill="none" stroke="${line}" stroke-width="1.6" opacity=".45"/>
      <path d="M17.5 40.5C11 40.6 4.6 42.6 3.4 45.4c-.9 2.3 5.3 3.4 14.2 2.4 8.6-1 15-3.2 18.6-5.4-6.4.1-12.9-.6-18.7-1.9z" fill="${c}" stroke="${line}" stroke-width="3" stroke-linejoin="round"/>
      <circle cx="38" cy="15.5" r="2.4" fill="${c}" stroke="${line}" stroke-width="2"/>
      ${brandMark(17.5, 27.5, 13.5, ' transform="rotate(-6 24 30)"')}`,
  };

  // Auswahl im Admin: Schlüssel und Bezeichnung jedes Symbols.
  PBClubArt.artKinds = [
    ['flutlicht', 'Flutlicht'], ['tennisspieler', 'Tennisspieler'],
    ['koelsch-flasche', 'Zunftkölsch-Flasche'], ['weizen-flasche', 'Weizenflasche'], ['apfelschorle', 'Apfelschorle'], ['fassbrause', 'Fassbrause'],
    ['aperol', 'Aperol-Dose'], ['wein', 'Weinflasche'], ['wurst-brot', 'Wurst mit Brot'], ['grillfleisch', 'Grillfleisch mit Brot'],
    ['grillwurst-brot', 'Grillwurst mit Brot'],
    ['stange', 'Kölschglas'], ['kranz', 'Kölschkranz'], ['weizen', 'Weizenglas'], ['beer', 'Bierkrug'], ['bottle', 'Bierflasche'], ['malz', 'Malzbier'], ['sportsfreund', 'Sportsfreund'], ['radler', 'Radler'],
    ['cola', 'Cola-Flasche'], ['gerolsteiner', 'Gerolsteiner'], ['water', 'Wasserflasche'], ['can', 'Dose'], ['slimcan', 'Schlanke Dose'],
    ['redbull', 'Red Bull'], ['cup', 'Tasse'], ['bar', 'Riegel'], ['snickers', 'Snickers'], ['mars', 'Mars'],
    ['wafer', 'Waffel (quadratisch)'], ['bag', 'Chipstüte'], ['tube', 'Chipsdose'],
    ['bear', 'Gummibär'], ['hotdog', 'Hotdog'], ['sausage', 'Würstchen'], ['cone', 'Eis'], ['ball', 'Ball'], ['padel', 'Padel-Schläger'], ['grip', 'Griffband'],
    ['shirt', 'Shirt'], ['cap', 'Cap'],
  ];

  PBClubArt.art = function (kind, color) {
    const draw = shapes[kind] || shapes.bottle;
    return `<svg class="art" viewBox="0 0 64 64" aria-hidden="true">${draw(color || '#C8553D')}</svg>`;
  };

  // Strichliste: echte Striche, jeder fünfte quer durch das Bündel.
  // Leicht verwackelt, damit es nach Kuli auf Papier aussieht – aber stabil je Zeile.
  PBClubArt.strokes = function (count, seedText = '') {
    let s = 0;
    for (const ch of seedText) s = (s * 31 + ch.charCodeAt(0)) >>> 0;
    const jitter = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296 - 0.5);
    const bundles = [];
    for (let left = count; left > 0; left -= 5) {
      const n = Math.min(5, left);
      let paths = '';
      for (let i = 0; i < Math.min(n, 4); i++) {
        const x = 4 + i * 6 + jitter() * 1.4;
        paths += `<path d="M${x.toFixed(1)} ${(4 + jitter() * 1.5).toFixed(1)} L${(x + jitter() * 1.6).toFixed(1)} ${(24 + jitter() * 1.5).toFixed(1)}"/>`;
      }
      if (n === 5) paths += `<path d="M0 ${(19 + jitter() * 2).toFixed(1)} L${(28 + jitter()).toFixed(1)} ${(8 + jitter() * 2).toFixed(1)}"/>`;
      const w = n === 5 ? 30 : 4 + n * 6;
      bundles.push(`<svg class="bundle" viewBox="0 0 ${w} 28" style="width:${w}px">${paths}</svg>`);
    }
    return bundles.join('');
  };
})();
