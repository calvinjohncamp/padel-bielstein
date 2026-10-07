/*  Padel Bielstein · MIS-Bericht (Stand Claude v22)
 *
 *  Berechnet aus den Rohdaten von public.admin_mis_report_data (oder den
 *  Musterdaten assets/mis/mis-musterdaten.json) den 5-seitigen Bericht und die
 *  KPI-Kacheln fuer den Admin-Tab. 1:1-Uebertragung von tools/mis-claude/build_report.py.
 *  Definitionen: 00 START HIER/MIS_PROJEKTGEDAECHTNIS.md
 *
 *  Rohdaten:
 *    bookings: [Spieltag, Verkaufstag, Startstunde, Dauer, Platz, bezahlt_ct, davon_guthaben_ct, person, gruppe, intern]
 *    subs:     [Verkaufstag, Start, Ende, Wochentag(0=So), Startstunde, Dauer, Platz, Preis_ct, person, gruppe, fruehbucher]
 *    cards:    [Verkaufstag, Preis_ct, person, gruppe]
 *    weather:  [Tag, Ausfall_Platz1, Ausfall_Platz2, Regenstunden]   (nur Musterdaten)
 */
(function () {
  'use strict';

  const MON = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const WD_DE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
  const ABO = '#1C1A17', EIN = '#FF5A36', VER = '#A59D92', FREI = '#EFE9DC', INK = '#1C1A17', MUT = '#7A7368', LINE = '#E2DACB', GREY = '#D3CBBE';
  const WET = 'url(#wh)', WETCSS = 'repeating-linear-gradient(135deg,#C9C1B4 0 2px,#E6E0D5 2px 5px)';
  const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21];

  // ---------- Datum (Tageszahl seit 1970, UTC) ----------
  const DAY = 86400000;
  const dn = (iso) => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY);
  const dmake = (y, m, d) => Math.round(Date.UTC(y, m - 1, d) / DAY);
  const ymd = (n) => { const t = new Date(n * DAY); return [t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()]; };
  const wdMon = (n) => (n + 3) % 7;          // 0 = Montag (wie Python weekday)
  const wdSun = (n) => (n + 4) % 7;          // 0 = Sonntag (wie JS getDay / subscriptions.weekday)
  const ymAdd = (y, m, k) => { const t = y * 12 + m - 1 + k; return [Math.floor(t / 12), t % 12 + 1]; };
  const mstart = (y, m) => dmake(y, m, 1);
  const mend = (y, m) => { const [y2, m2] = ymAdd(y, m, 1); return dmake(y2, m2, 1) - 1; };
  const isoWeek = (n) => { const t = new Date(n * DAY); const d = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - d + 3); const f = new Date(Date.UTC(t.getUTCFullYear(), 0, 4)); return 1 + Math.round(((t - f) / DAY - 3 + ((f.getUTCDay() + 6) % 7)) / 7); };
  const p2 = (v) => String(v).padStart(2, '0');
  const dd = (n, withYear) => { const [y, m, d] = ymd(n); return `${p2(d)}.${p2(m)}.` + (withYear ? y : ''); };

  // ---------- Format ----------
  const nf = {};
  const de = (v, nd = 0) => { nf[nd] = nf[nd] || new Intl.NumberFormat('de-DE', { minimumFractionDigits: nd, maximumFractionDigits: nd }); return nf[nd].format(v); };
  const eur = (v) => de(v) + ' €';
  const pct = (v, nd = 0) => de(v, nd) + ' %';
  const f1 = (v) => v.toFixed(1), f2 = (v) => v.toFixed(2);
  function dl(cur, prev, pp = false, neutral = false) {
    if (!prev) return '<span class="dn">neu</span>';
    const dv = pp ? cur - prev : (cur / prev - 1) * 100;
    const txt = (dv >= 0 ? '+' : '−') + de(Math.abs(dv), pp ? 1 : 0) + (pp ? ' PP' : ' %');
    if (Math.abs(dv) < 0.5) return pp ? `<span class="dn">■ ${txt}</span>` : '<span class="dn">■ ±0 %</span>';
    if (neutral) return `<span class="dn">${dv > 0 ? '▲' : '▼'} ${txt}</span>`;
    return `<span class="${dv > 0 ? 'up' : 'down'}">${dv > 0 ? '▲' : '▼'} ${txt}</span>`;
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function ticks(v) {
    if (!(v > 0)) return [4, 4];
    const e = Math.pow(10, Math.floor(Math.log10(v / 4)));
    for (const st of [1, 2, 2.5, 5, 10, 20]) { const n = Math.ceil(v / (st * e)); if (n <= 5) return [st * e * n, n]; }
    return [v, 4];
  }

  // =====================================================================
  //  Modell
  // =====================================================================
  function buildModel(raw, opts) {
    const sample = !!opts.sample;
    const TODAY = dn(raw.today || opts.today);
    const END = TODAY - 1;
    const Y1 = 365;

    const live = [], verein = [];
    for (const b of raw.bookings || []) {
      // Geldbetraege intern in Cent (ganze Zahlen), Ausgabe in Euro
      const row = { date: dn(b[0]), sale: dn(b[1]), h: b[2], dur: b[3], court: b[4], paidC: b[5] || 0, creditC: b[6] || 0, person: b[7], grp: b[8] };
      row.directC = row.paidC - row.creditC;
      if (b[9]) verein.push(row); else live.push(row);
    }
    const abos = (raw.subs || []).map((a) => ({ sale: dn(a[0]), start: dn(a[1]), end: dn(a[2]), wdSun: a[3], h: a[4], dur: a[5], court: a[6], priceC: a[7] || 0, holder: a[8], grp: a[9], eb: !!a[10] }));
    for (const a of abos) { a.wd = (a.wdSun + 6) % 7; a.price = a.priceC / 100; }   // 0 = Montag
    const cards = (raw.cards || []).map((c) => ({ sale: dn(c[0]), amountC: c[1] || 0, person: c[2], grp: c[3] }));
    const hasWeather = Array.isArray(raw.weather) && raw.weather.length > 0;
    const wlost = new Map(), rainh = new Map();
    for (const w of raw.weather || []) { const d = dn(w[0]); wlost.set(d, [w[1], w[2]]); rainh.set(d, w[3]); }
    const lostDay = (d, c) => { const v = wlost.get(d); return v ? (c ? v[c - 1] : v[0] + v[1]) : 0; };

    // Unbekannte Personen (Gastbuchung ohne Konto) zaehlen je Vorgang einzeln
    let anon = 0; const pkey = (p) => (p === null || p === undefined ? 'g' + (anon++) : p);

    function aboHours(a, s, e, court) {
      if (court && a.court !== court) return 0;
      const s2 = Math.max(s, a.start), e2 = Math.min(e, a.end);
      if (s2 > e2) return 0;
      let n = 0; for (let d = s2; d <= e2; d++) if (wdMon(d) === a.wd) n++;
      return n * a.dur;
    }

    function K(s, e) {
      const r = { days: e - s + 1 }; r.cap = 28 * r.days;
      let u_bu = 0, u_cred = 0, u_gut = 0, u_abo = 0, h_ein = 0, h_abo = 0, h_ver = 0, h_wet = 0, n_abo = 0, n_abo_h = 0;
      const buy = new Set();
      for (const b of live) {
        if (b.sale >= s && b.sale <= e) { u_bu += b.directC; u_cred += b.creditC; if (b.directC > 0) buy.add(pkey(b.person)); }
        if (b.date >= s && b.date <= e) h_ein += b.dur;
      }
      for (const c of cards) if (c.sale >= s && c.sale <= e) { u_gut += c.amountC; buy.add(pkey(c.person)); }
      for (const a of abos) {
        if (a.sale >= s && a.sale <= e) { u_abo += a.priceC; n_abo++; n_abo_h += a.dur; buy.add(pkey(a.holder)); }
        h_abo += aboHours(a, s, e);
      }
      for (const v of verein) if (v.date >= s && v.date <= e) h_ver += v.dur;
      for (let d = s; d <= e; d++) h_wet += lostDay(d);
      Object.assign(r, { u_bu: u_bu / 100, u_cred: u_cred / 100, u_gut: u_gut / 100, u_ein: (u_bu + u_gut) / 100, u_abo: u_abo / 100, h_ein, h_abo, h_ver, h_wet, n_abo, n_abo_h });
      r.u = (u_bu + u_gut + u_abo) / 100;
      r.h_bel = h_ein + h_abo + h_ver;
      r.h_frei = r.cap - r.h_bel - h_wet;
      r.ausl = r.h_bel / r.cap * 100;
      const act = abos.filter((a) => a.start <= e && e <= a.end);
      r.abo_act = act.length; r.abo_wk = act.reduce((t, a) => t + a.dur, 0);
      r.abo_1 = act.filter((a) => a.dur === 1).length; r.abo_2 = act.filter((a) => a.dur === 2).length;
      r.p_buy = buy.size;
      return r;
    }

    const S30 = END - 29, E30 = END, S12 = END - Y1 + 1;
    const W = { '30': K(S30, E30), '30v': K(S30 - Y1, E30 - Y1), '12': K(S12, END), '12v': K(S12 - Y1, END - Y1) };
    const [ey, em] = ymd(END);
    const MONTHS = []; for (let k = 0; k < 24; k++) MONTHS.push(ymAdd(ey, em, k - 23));
    const M = MONTHS.map(([y, m]) => K(mstart(y, m), Math.min(mend(y, m), END)));

    // Tageswerte (Seite 1)
    function dayVals(d) {
      let ha = 0, he = 0, hv = 0, ua = 0, ub = 0; const pers = new Set();
      for (const a of abos) { if (a.start <= d && d <= a.end && a.wd === wdMon(d)) ha += a.dur; if (a.sale === d) { ua += a.priceC; pers.add(pkey(a.holder)); } }
      for (const b of live) { if (b.date === d) he += b.dur; if (b.sale === d) { ub += b.directC; if (b.directC > 0) pers.add(pkey(b.person)); } }
      for (const c of cards) if (c.sale === d) { ub += c.amountC; pers.add(pkey(c.person)); }
      ua /= 100; ub /= 100;
      for (const v of verein) if (v.date === d) hv += v.dur;
      const rh = hasWeather ? 2 * (rainh.get(d) || 0) : null;
      return { d, ha, he, hv, rh, bel: ha + he + hv, ua, ub, uv: 0, u: Math.round((ua + ub) * 100) / 100, pers };
    }
    function aggDays(rows) {
      const r = { ha: 0, he: 0, hv: 0, rh: 0, bel: 0, ua: 0, ub: 0, uv: 0, u: 0 };
      const pers = new Set();
      for (const x of rows) { for (const k of Object.keys(r)) r[k] += x[k] || 0; x.pers.forEach((p) => pers.add(p)); }
      r.pers = pers; r.n = rows.length; r.ausl = rows.length ? r.bel / (28 * rows.length) * 100 : 0;
      if (!hasWeather) r.rh = null;
      return r;
    }
    const today = dayVals(TODAY);
    const days30 = []; for (let k = 0; k < 30; k++) days30.push(dayVals(END - k));
    // Vorjahr: exakt derselbe Zeitraum 365 Tage frueher (Admin-Kacheln)
    const todayV = dayVals(TODAY - Y1);
    const days30v = []; for (let k = 0; k < 30; k++) days30v.push(dayVals(END - Y1 - k));

    // Kumuliert (taggenau)
    function cumulDaily(s) {
      const out = new Array(365).fill(0); const idx = (d) => d - s;
      for (const b of live) { const i = idx(b.sale); if (i >= 0 && i < 365) out[i] += b.directC; }
      for (const c of cards) { const i = idx(c.sale); if (i >= 0 && i < 365) out[i] += c.amountC; }
      for (const a of abos) { const i = idx(a.sale); if (i >= 0 && i < 365) out[i] += a.priceC; }
      for (let i = 1; i < 365; i++) out[i] += out[i - 1];
      return out.map((v) => v / 100);
    }
    const cc = cumulDaily(S12), cp = cumulDaily(S12 - Y1);

    // Finanzen: letzter abgeschlossener Monat
    const [ty, tm] = ymd(TODAY);
    const [fy, fm] = ymAdd(ty, tm, -1);
    const FMONTHS = []; for (let k = 0; k < 12; k++) FMONTHS.push(ymAdd(fy, fm, k - 11));
    function fin(s, e) {
      const r = K(s, e);
      let earned = 0;
      for (const a of abos) { const tot = a.end - a.start + 1; const s2 = Math.max(s, a.start), e2 = Math.min(e, a.end); if (s2 <= e2) earned += a.price * (e2 - s2 + 1) / tot; }
      const g = { tfb: 0, bsv: 0, par: 0, ext: 0 };
      let ntx = 0;
      for (const b of live) if (b.sale >= s && b.sale <= e) { g[b.grp in g ? b.grp : 'ext'] += b.directC; ntx++; }
      for (const k of Object.keys(g)) g[k] /= 100;
      ntx += r.n_abo + Math.round(r.u_gut / 50);
      return { r, used: r.u_cred, cards: r.u_gut, z: r.u, earned: Math.round(earned), g_tfb: g.tfb, g_bsv: g.bsv, g_par: g.par, g_ext: g.ext,
        fee: Math.round(r.u * 0.015 + ntx * 0.25), refund: Math.round(r.u_bu * 0.004) };
    }
    const F = fin(mstart(fy, fm), mend(fy, fm)), Fv = fin(mstart(fy - 1, fm), mend(fy - 1, fm));
    const FY = fin(dmake(fy, 1, 1), mend(fy, fm)), FYv = fin(dmake(fy - 1, 1, 1), mend(fy - 1, fm));
    function rapAt(day) {
      let v = 0;
      for (const a of abos) if (a.sale <= day) { const tot = a.end - a.start + 1; const rem = a.end - Math.max(day, a.start - 1); v += a.price * Math.max(0, Math.min(tot, rem)) / tot; }
      return Math.round(v);
    }
    const FM = FMONTHS.map(([y, m]) => ({ y, m, f: fin(mstart(y, m), mend(y, m)) }));

    // Details
    const courts = [1, 2].map((c) => ({ c, w30: courtShare(c, S30, E30), w12: courtShare(c, S12, END) }));
    function courtShare(c, s, e) {
      const cap = 14 * (e - s + 1);
      let ha = 0, he = 0, hv = 0, hw = 0;
      for (const a of abos) ha += aboHours(a, s, e, c);
      for (const b of live) if (b.court === c && b.date >= s && b.date <= e) he += b.dur;
      for (const v of verein) if (v.court === c && v.date >= s && v.date <= e) hv += v.dur;
      for (let d = s; d <= e; d++) hw += lostDay(d, c);
      return { cap, ha, he, hv, hw };
    }
    const s3 = END - 91; const cnt = {}; const wdn = [0, 0, 0, 0, 0, 0, 0];
    for (let d = s3; d <= END; d++) wdn[wdMon(d)]++;
    const addCnt = (wd, h, dur) => { for (let k = 0; k < dur; k++) { const key = wd + '-' + (h + k); cnt[key] = (cnt[key] || 0) + 1; } };
    for (const b of live) if (b.date >= s3 && b.date <= END) addCnt(wdMon(b.date), b.h, b.dur);
    for (const a of abos) for (let d = Math.max(s3, a.start); d <= Math.min(END, a.end); d++) if (wdMon(d) === a.wd) addCnt(a.wd, a.h, a.dur);
    for (const v of verein) if (v.date >= s3 && v.date <= END) addCnt(wdMon(v.date), v.h, v.dur);
    const dailyDetail = []; for (let d = S30; d <= E30; d++) { const x = dayVals(d); x.hw = lostDay(d); dailyDetail.push(x); }

    const fs = raw.finance_sample || null;
    return { sample, archiveLabel: opts.archiveLabel || null, testMode: !!raw.test_mode, hasWeather, TODAY, END, S30, E30, S12, W, MONTHS, M, today, days30, todayV, days30v, aggDays,
      cc, cp, fy, fm, F, Fv, FY, FYv, FM, rapEnd: rapAt(mend(fy, fm)), rapBeg: rapAt(mstart(fy, fm) - 1), courts, cnt, wdn, dailyDetail, fs };
  }

  // =====================================================================
  //  SVG-Bausteine
  // =====================================================================
  function donut(parts, size, c1, c2) {
    const tot = parts.reduce((t, p) => t + Math.max(0, p[1]), 0) || 1;
    const r = size / 2, ri = r * 0.62, cx = r, cy = r;
    const s = [`<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`];
    let a0 = -Math.PI / 2;
    const P = (rr, a) => [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
    for (const [, v, col] of parts) {
      if (v <= 0) continue;
      const a1 = a0 + v / tot * 2 * Math.PI;
      if (v / tot > 0.9999) {
        s.push(`<circle cx="${cx}" cy="${cy}" r="${(r + ri) / 2}" fill="none" stroke="${col}" stroke-width="${r - ri}"/>`);
      } else {
        const large = a1 - a0 > Math.PI ? 1 : 0;
        const [x0, y0] = P(r, a0), [x1, y1] = P(r, a1), [x2, y2] = P(ri, a1), [x3, y3] = P(ri, a0);
        s.push(`<path d="M${f2(x0)},${f2(y0)} A${r},${r} 0 ${large} 1 ${f2(x1)},${f2(y1)} L${f2(x2)},${f2(y2)} A${ri},${ri} 0 ${large} 0 ${f2(x3)},${f2(y3)} Z" fill="${col}" stroke="#fff" stroke-width="1.5"/>`);
        const frac = v / tot;
        if (frac > 0.07) {
          const [tx, ty] = P((r + ri) / 2, (a0 + a1) / 2);
          s.push(`<text x="${f1(tx)}" y="${f1(ty + 3.5)}" text-anchor="middle" class="dpct" fill="${col === FREI || col === WET ? INK : '#fff'}">${Math.round(frac * 100)} %</text>`);
        }
      }
      a0 = a1;
    }
    s.push(`<text x="${cx}" y="${cy - 2}" text-anchor="middle" class="dc1${size < 140 ? ' s' : ''}">${c1}</text><text x="${cx}" y="${cy + 14}" text-anchor="middle" class="dc2">${c2}</text></svg>`);
    return s.join('');
  }

  function mlabels(s, MONTHS, L, bw, T, ph) {
    let prevY = null;
    for (let p = 0; p < 24; p++) {
      const i = 23 - p, [y, m] = MONTHS[i], x = L + p * bw + bw / 2;
      s.push(`<text x="${f1(x)}" y="${T + ph + 12}" text-anchor="middle" class="ax${i >= 12 ? ' b' : ''}">${MON[m - 1]}${i === 23 ? ' lfd.' : ''}</text>`);
      if (y !== prevY) s.push(`<text x="${f1(x)}" y="${T + ph + 24}" text-anchor="middle" class="ax yr">${y}</text>`);
      prevY = y;
    }
  }

  function stack24(MONTHS, series, w, h, fmtAxis, topLabels, fixed) {
    const L = 40, R = 10, T = fixed ? 44 : 18, B = 30, pw = w - L - R, ph = h - T - B;
    const tot = []; for (let i = 0; i < 24; i++) tot.push(series.reduce((t, sr) => t + sr[1][i], 0));
    const [mx, NT] = fixed || ticks(Math.max(...tot) * 1.08);
    const bw = pw / 24;
    const s = [`<svg viewBox="0 0 ${w} ${h}" class="chart">`];
    s.push(`<rect x="${f1(L)}" y="${T - (fixed ? 42 : 14)}" width="${f1(12 * bw)}" height="${ph + (fixed ? 42 : 14)}" fill="#FBF8F0"/>`);
    for (let k = 0; k <= NT; k++) {
      const y = T + ph - ph * k / NT;
      s.push(`<line x1="${L}" y1="${f1(y)}" x2="${w - R}" y2="${f1(y)}" stroke="${LINE}" stroke-width=".8"/><text x="${L - 5}" y="${f1(y + 3)}" text-anchor="end" class="ax">${fmtAxis(mx * k / NT)}</text>`);
    }
    for (let p = 0; p < 24; p++) {
      const i = 23 - p, x = L + p * bw + bw * 0.15; let yb = T + ph;
      for (const [, vals, col] of series) { const hh = mx ? vals[i] / mx * ph : 0; s.push(`<rect x="${f1(x)}" y="${f1(yb - hh)}" width="${f1(bw * 0.7)}" height="${f1(hh)}" fill="${col}"/>`); yb -= hh; }
      if (topLabels) {
        if (fixed) {
          const pill = i >= 12 ? INK : '#EFE9DE', tc = i >= 12 ? '#fff' : INK;
          s.push(`<rect x="${f1(x - bw * 0.06)}" y="${T - 24}" width="${f1(bw * 0.82)}" height="14" rx="3" fill="${pill}"/>`);
          s.push(`<text x="${f1(x + bw * 0.35)}" y="${T - 14}" text-anchor="middle" class="tl8" style="fill:${tc}">${topLabels[i]}</text>`);
        } else {
          s.push(`<text x="${f1(x + bw * 0.35)}" y="${f1(yb - 3)}" text-anchor="middle" class="tl8">${topLabels[i]}</text>`);
        }
      }
    }
    const yt = fixed ? T - 32 : T - 4;
    s.push(`<text x="${f1(L + 6 * bw)}" y="${yt}" text-anchor="middle" class="ax b">letzte 12 Monate ←</text><text x="${f1(L + 18 * bw)}" y="${yt}" text-anchor="middle" class="ax">Vorjahr</text>`);
    if (fixed) s.push(`<text x="${L - 5}" y="${T - 14}" text-anchor="end" class="ax b">Auslastung</text>`);
    mlabels(s, MONTHS, L, bw, T, ph);
    s.push('</svg>');
    return s.join('');
  }

  // =====================================================================
  //  Seiten
  // =====================================================================
  function render(md) {
    const { W, M, MONTHS } = md;
    const w30 = W['30'], w30v = W['30v'], w12 = W['12'], w12v = W['12v'];
    const lab30 = `${dd(md.S30)}–${dd(md.E30, true)}`, lab30s = `${dd(md.S30)}–${dd(md.E30)}`;
    const lab12 = `${dd(md.S12, true)} – ${dd(md.END, true)}`;
    const fd = (n) => { const [y, m, d] = ymd(n); return `${WD_DE[wdMon(n)]}, ${p2(d)}.${p2(m)}.`; };
    const badge = (md.archiveLabel ? `<span class="demo">ARCHIV · ${esc(md.archiveLabel)}</span>` : '')
      + (md.sample ? '<span class="demo">MUSTERBERICHT · erfundene Zahlen</span>'
      : md.testMode ? '<span class="demo">TESTBETRIEB · Testdaten</span>' : '');
    const KEY = `<div class="key"><span><i style="background:${ABO}"></i>Abos</span><span><i style="background:${EIN}"></i>Buchungen</span><span><i style="background:${VER}"></i>Verein (ohne Umsatz)</span><span><i style="background:${WETCSS}"></i>Wetter (nicht bespielbar)</span><span><i style="background:${FREI};border:1px solid #D8D0C0"></i>frei</span></div>`;
    const head = (title, sub, today) => `<header><div class="brand"><span>PADEL</span><span class="bs">BIELSTEIN</span><span class="sep">|</span><span class="mis">Management-Information</span></div>
<div class="meta">${badge}Stand: ${md.archiveLabel ? 'Monatsende ' + dd(md.END, true) : fd(md.TODAY) + ymd(md.TODAY)[0]} · Tageswerte</div></header>
<div class="ttl"><div class="tl1"><h1>${title}</h1>${today ? `<span class="tbox">${today}</span>` : ''}${sub ? `<p>${sub}</p>` : ''}</div>
<div class="chips"><span class="chip c30">Letzte 30 Tage<b>${lab30}</b></span><span class="chip c12">Letzte 12 Monate<b>${lab12}</b></span></div></div>`;
    const foot = (n, note) => `<footer><span>${note || 'Umsatz = nach Verkaufsdatum (was verkauft wurde) · Platzbelegung = nach Spieltag (wann gespielt wird) · 2 Plätze × 14 h (8–22 Uhr) = 28 h je Tag'}</span><span>Tennisfreunde Bielstein e. V. · vertraulich · Seite ${n} von 5</span></footer>`;
    const noWx = md.hasWeather ? '' : ' (noch nicht erfasst)';

    // ---------- Seite 1: Tagesübersicht ----------
    const tilesHtml = renderTiles(md);
    const num = (v, unit = '') => (v ? `${de(v)}${unit}` : '<span class="z">–</span>');
    const bar = (p) => `<span class="ab"><i style="width:${Math.min(100, p).toFixed(0)}%"></i></span><span class="ap">${pct(p)}</span>`;
    const rh = (v) => (v === null ? '<span class="z">–</span>' : v);
    const drow = (x, cls) => {
      const we = wdMon(x.d) >= 5 ? ' we' : '';
      const lab = x.d === md.TODAY ? '<span class="today">Heute</span>' : dd(x.d);
      return `<tr class="${cls}${we}"><td class="b">${WD_DE[wdMon(x.d)]}</td><td>${lab}</td>`
        + `<td class="n">${num(x.he)}</td><td class="n">${num(x.ha)}</td><td class="n">${num(x.hv)}</td>`
        + `<td class="n b rl">${x.bel} h</td><td class="aus">${bar(x.bel / 28 * 100)}</td>`
        + `<td class="n rl${x.rh ? ' b' : ' mu'}">${rh(x.rh)}</td>`
        + `<td class="n">${num(x.ub, ' €')}</td><td class="n">${num(x.ua, ' €')}</td><td class="n">${num(x.uv, ' €')}</td><td class="n b rl">${num(x.u, ' €')}</td>`
        + `<td class="n">${x.pers.size}</td></tr>`;
    };
    const srow = (lab, r, cls) => `<tr class="${cls}"><td colspan="2">${lab}</td><td class="n">${de(r.he)}</td><td class="n">${de(r.ha)}</td><td class="n">${de(r.hv)}</td>`
      + `<td class="n rl">${de(r.bel)} h</td><td class="aus">${bar(r.ausl)}</td><td class="n rl">${r.rh === null ? '–' : de(r.rh)}</td>`
      + `<td class="n">${eur(r.ub)}</td><td class="n">${eur(r.ua)}</td><td class="n">${eur(r.uv)}</td><td class="n rl">${eur(r.u)}</td><td class="n">${r.pers.size}</td></tr>`;
    let rows0 = ''; let wk = null; let grp = [];
    const flush = (g) => {
      if (!g.length) return '';
      const lo = g[g.length - 1].d, hi = g[0].d;
      return g.map((x) => drow(x, x.d === md.TODAY ? 'trow' : '')).join('')
        + srow(`Summe KW ${isoWeek(g[0].d)} <span class="kwd">${p2(ymd(lo)[2])}.–${dd(hi)}</span>`, md.aggDays(g), 'wk');
    };
    for (const x of [md.today, ...md.days30]) { const k = isoWeek(x.d); if (k !== wk && grp.length) { rows0 += flush(grp); grp = []; } wk = k; grp.push(x); }
    rows0 += flush(grp);
    const all30 = md.aggDays(md.days30);
    rows0 += srow('Summe 30 Tage', all30, 'tot');
    const pg1 = `<section class="page">${head('Tagesübersicht', '', `Heute · ${fd(md.TODAY)}${ymd(md.TODAY)[0]}`)}
<div class="dts">${tilesHtml}</div>
<div class="panel tday"><table class="day">
<colgroup><col style="width:4%"><col style="width:6%"><col style="width:7.2%"><col style="width:6.6%"><col style="width:6.6%"><col style="width:7.2%"><col style="width:14%"><col style="width:6.4%"><col class="ce" style="width:9.6%"><col class="ce" style="width:8.4%"><col class="ce" style="width:6.2%"><col class="ce" style="width:9.2%"><col style="width:8.6%"></colgroup>
<thead><tr><th colspan="2">Tag</th><th class="n">Buchung <u>h</u></th><th class="n">Abo <u>h</u></th><th class="n">TFB <u>h</u></th><th class="n rl">Σ <u>h</u></th><th class="c">Auslastung <u>%</u></th><th class="n rl">Ausfall <u>h</u></th><th class="n">Buchung* <u>€</u></th><th class="n">Abo <u>€</u></th><th class="n">TFB <u>€</u></th><th class="n rl">Σ <u>€</u></th><th class="n">Personen</th></tr></thead>
<tbody>${rows0}</tbody></table></div>
${foot(1, 'Heute = ganzer Tag laut App · * inkl. Guthaben/Gutscheine · Abos voll am Verkaufstag · TFB = Verein · Personen = Käufer mit Umsatz, je Woche/Monat einmal gezählt' + (md.hasWeather ? '' : ' · Wetter-Ausfall wird noch nicht erfasst'))}</section>`;

    // ---------- Seite 2: Umsatz ----------
    const P30 = `<span class="ph p30">Letzte 30 Tage<em>${lab30}</em></span>`, P12 = `<span class="ph p12">Letzte 12 Monate<em>${lab12}</em></span>`;
    const umsatzCol = (k, kv, ph) => {
      const r = W[k], rv = W[kv];
      return `<div class="dcol">${ph}${donut([['Abos', r.u_abo, ABO], ['Buchungen', r.u_ein, EIN]], 122, eur(r.u), 'Umsatz')}
<table class="leg"><tr><td><i style="background:${ABO}"></i>Abos</td><td class="n">${eur(r.u_abo)}</td></tr>
<tr><td><i style="background:${EIN}"></i>Buchungen*</td><td class="n">${eur(r.u_ein)}</td></tr>
<tr class="vjb"><td>Umsatz</td><td class="n">${eur(r.u)}</td></tr>
<tr class="vjl"><td>Vorjahr ${eur(rv.u)}</td><td class="n">${dl(r.u, rv.u)}</td></tr></table></div>`;
    };
    const cumulSvg = (() => {
      const w = 560, h = 240, L = 36, R = 70, T = 10, B = 20, pw = w - L - R, ph = h - T - B;
      const [mx, NT] = ticks(Math.max(...md.cc, ...md.cp, 1) * 1.05); const st = pw / 364;
      const s = [`<svg viewBox="0 0 ${w} ${h}" class="chart">`];
      for (let k = 0; k <= NT; k++) { const y = T + ph - ph * k / NT; s.push(`<line x1="${L}" y1="${f1(y)}" x2="${L + pw}" y2="${f1(y)}" stroke="${LINE}" stroke-width=".8"/><text x="${L - 4}" y="${f1(y + 3)}" text-anchor="end" class="ax">${de(mx * k / NT / 1000)}k</text>`); }
      for (const [vals, col, wd, lab] of [[md.cp, GREY, 2.2, '12 Monate davor'], [md.cc, INK, 2.6, 'letzte 12 Monate']]) {
        const pts = vals.map((v, i) => [L + i * st, T + ph - v / mx * ph]);
        const sel = pts.filter((_, i) => i % 2 === 0).concat([pts[pts.length - 1]]);
        const poly = sel.map(([x, y]) => `${f1(x)},${f1(y)}`).join(' ');
        if (col === INK) s.push(`<polygon points="${L},${T + ph} ${poly} ${f1(pts[pts.length - 1][0])},${T + ph}" fill="${EIN}" opacity=".10"/>`);
        s.push(`<polyline points="${poly}" fill="none" stroke="${col}" stroke-width="${wd}" stroke-linejoin="round"/>`);
        const [x, y] = pts[pts.length - 1];
        s.push(`<circle cx="${f1(x)}" cy="${f1(y)}" r="3.5" fill="${col}"/>`);
        s.push(`<text x="${f1(x + 7)}" y="${f1(y - 1)}" class="endv" style="fill:${col === INK ? INK : MUT}">${de(vals[vals.length - 1] / 1000, 1)}k €</text><text x="${f1(x + 7)}" y="${f1(y + 10)}" class="ax">${lab}</text>`);
      }
      for (let k = 0; k < 365; k++) { const [, m, d] = ymd(md.S12 + k); if (d === 1) { const x = L + k * st; s.push(`<text x="${f1(x)}" y="${h - 5}" text-anchor="middle" class="ax">${MON[m - 1]}</text><line x1="${f1(x)}" y1="${T + ph}" x2="${f1(x)}" y2="${T + ph + 3}" stroke="${MUT}"/>`); } }
      s.push('</svg>');
      return s.join('');
    })();
    const cuCur = md.cc[364], cuPrev = md.cp[364];
    const uChart = stack24(MONTHS, [['Abos', M.map((m) => m.u_abo), ABO], ['Buchungen', M.map((m) => m.u_ein), EIN]], 1000, 128,
      (v) => de(v / 1000) + 'k', M.map((m) => de(m.u / 1000, 1)));
    const aboChart = (() => {
      const w = 540, h = 126, L = 56, T = 4, ph = 68, bw = (w - L - 2) / 12, base = T + ph;
      const cur = M.slice(12), prv = M.slice(0, 12);
      const mx = Math.max(...M.map((m) => m.abo_wk), 1) * 1.05;
      const s = [`<svg viewBox="0 0 ${w} ${h}" class="trend">`, `<line x1="${L}" y1="${base}" x2="${w - 2}" y2="${base}" stroke="${LINE}"/>`];
      for (let p = 0; p < 12; p++) {
        const i = 11 - p, x = L + p * bw, hp = prv[i].abo_wk / mx * ph, hc = cur[i].abo_wk / mx * ph;
        s.push(`<rect x="${f1(x + bw * 0.12)}" y="${f1(base - hp)}" width="${f1(bw * 0.76)}" height="${f1(hp)}" fill="${GREY}" rx="1"/>`);
        s.push(`<rect x="${f1(x + bw * 0.26)}" y="${f1(base - hc)}" width="${f1(bw * 0.48)}" height="${f1(hc)}" fill="${ABO}" rx="1"/>`);
        s.push(`<text x="${f1(x + bw / 2)}" y="${base + 11}" text-anchor="middle" class="tv7">${MON[MONTHS[12 + i][1] - 1]}${i === 11 ? ' lfd.' : ''}</text>`);
        for (const [key, yy] of [['abo_act', base + 26], ['abo_wk', base + 40]]) {
          const v = cur[i][key], pv = (i ? cur[i - 1] : prv[11])[key];
          s.push(v !== pv ? `<text x="${f1(x + bw / 2)}" y="${yy}" text-anchor="middle" class="tvc">${v > pv ? '▲' : '▼'}${v}</text>`
            : `<text x="${f1(x + bw / 2)}" y="${yy}" text-anchor="middle" class="tvn">${v}</text>`);
        }
      }
      s.push(`<text x="0" y="${base + 26}" class="tvl">Abos</text><text x="0" y="${base + 40}" class="tvl">Std./Woche</text></svg>`);
      return s.join('');
    })();
    const [, , tyear] = [0, 0, ymd(md.TODAY)[0]];
    const pg2 = `<section class="page">${head('Umsatz', 'Was haben wir eingenommen – aus Abos und aus Buchungen?')}
<div class="u1 u1b">
 <div class="panel"><h2>Umsatz nach Herkunft</h2><div class="dons">${umsatzCol('30', '30v', P30)}${umsatzCol('12', '12v', P12)}</div><p class="star">* Buchungen inkl. verkaufter Guthaben und Gutscheine. Mit Guthaben bezahlte Buchungen zählen nicht noch einmal.</p></div>
 <div class="panel"><h2>Umsatz aufsummiert <small>letzte 12 Monate im Vergleich zu den 12 Monaten davor</small></h2>${cumulSvg}
  <div class="big-d">${cuPrev ? `${dl(cuCur, cuPrev)} <span>${cuCur >= cuPrev ? 'mehr' : 'weniger'} Umsatz als im Jahr davor (${eur(Math.abs(cuCur - cuPrev))})</span>` : '<span>Noch kein Vorjahreszeitraum vorhanden.</span>'}</div></div>
</div>
<div class="panel"><h2>Umsatz je Monat <small>in Tausend € · <i class="sw" style="background:${ABO}"></i>Abos <i class="sw" style="background:${EIN}"></i>Buchungen* · links die letzten 12 Monate (neuester Monat zuerst), rechts Vorjahr</small></h2>${uChart}</div>
<div class="drvs4">
 <div class="drv abol" style="border-top-color:${ABO}"><h3>Abos</h3>
  <div class="ah"><span class="ph p0 s">Heute aktiv · ${dd(md.TODAY, true)}</span>
   <div class="anum"><div><b>${w30.abo_act}</b><em>Abos</em></div><div class="sl">/</div><div><b>${w30.abo_wk}</b><em>Std. pro Woche</em></div></div></div>
  <div class="ah vjb2"><span class="ph pv s">Vorjahr · ${dd(md.TODAY - 365, true)}</span>
   <div class="anum"><div><b>${w30v.abo_act}</b><em>${dl(w30.abo_act, w30v.abo_act)}</em></div><div class="sl">/</div><div><b>${w30v.abo_wk}</b><em>${dl(w30.abo_wk, w30v.abo_wk)}</em></div></div></div></div>
 <div class="drv span2" style="border-top-color:${ABO}"><h3>Abo-Entwicklung <small>12 Monate · <i class="sw" style="background:${ABO}"></i>Std./Woche <i class="sw" style="background:${GREY}"></i>Vorjahr · <b class="cc">▲▼</b> ggü. Vormonat</small></h3>${aboChart}</div>
 <div class="drv" style="border-top-color:${EIN}"><h3>Stunden &amp; Personen <small>(Stunden: nur echte Buchungen mit Umsatz, hier keine Abos)</small></h3>
  <table class="sp"><tr><th></th><th><span class="ph p30 s">30 Tage</span></th><th><span class="ph p12 s">12 Monate</span></th></tr>
  <tr><td>Gebuchte<br>Stunden</td><td><b>${de(w30.h_ein)} h</b><em>${dl(w30.h_ein, w30v.h_ein)}</em></td><td><b>${de(w12.h_ein)} h</b><em>${dl(w12.h_ein, w12v.h_ein)}</em></td></tr>
  <tr><td>Buchende<br>Personen</td><td><b>${de(w30.p_buy)}</b><em>${dl(w30.p_buy, w30v.p_buy)}</em></td><td><b>${de(w12.p_buy)}</b><em>${dl(w12.p_buy, w12v.p_buy)}</em></td></tr></table>
  <div class="spn">Pfeil = ggü. Vorjahr · Personen = verschiedene Käufer mit Umsatz, Mehrfachbuchungen einer Person = 1 Person</div></div>
</div>
${foot(2, 'Umsatz = am Tag des Verkaufs gezählt · Buchungen = stundenweise gebuchte Plätze, Abos = feste Wochentermine')}</section>`;

    // ---------- Seite 3: Platzbelegung ----------
    const belegBlock = (k, kv, ph) => {
      const r = W[k], rv = W[kv], d = r.days;
      const row = (lab, col, v) => `<tr><td><i style="background:${col === WET ? WETCSS : col}${col === FREI ? ';border:1px solid #D8D0C0' : ''}"></i>${lab}</td><td class="n">${de(v)} h</td><td class="n mu">${de(v / d, 1)} h/Tag</td></tr>`;
      return `<div class="bblk">${ph}<div class="bside">${donut([['Abos', r.h_abo, ABO], ['Buchungen', r.h_ein, EIN], ['Verein', r.h_ver, VER], ['Wetter', r.h_wet, WET], ['frei', r.h_frei, FREI]], 170, pct(r.ausl), 'Auslastung')}
<table class="leg"><tr class="cap"><td>verfügbar</td><td class="n">${de(r.cap)} h</td><td class="n mu">28,0 h/Tag</td></tr>
${row('Abos', ABO, r.h_abo)}${row('Buchungen', EIN, r.h_ein)}${row('Verein', VER, r.h_ver)}
<tr class="sumb"><td>belegt</td><td class="n">${de(r.h_bel)} h</td><td class="n mu">${de(r.h_bel / d, 1)} h/Tag</td></tr>
${row('Wetter (nicht bespielbar)' + noWx, WET, r.h_wet)}${row('frei', FREI, r.h_frei)}
<tr class="vjb"><td>Auslastung ${pct(r.ausl)}</td><td class="n" colspan="2"><span class="mu">Vorjahr ${pct(rv.ausl)}</span> ${dl(r.ausl, rv.ausl, true)}</td></tr></table></div></div>`;
    };
    const bChart = stack24(MONTHS, [['Abos', M.map((m) => m.h_abo / m.days), ABO], ['Buchungen', M.map((m) => m.h_ein / m.days), EIN], ['Verein', M.map((m) => m.h_ver / m.days), VER], ['Wetter', M.map((m) => m.h_wet / m.days), WET], ['frei', M.map((m) => m.h_frei / m.days), FREI]],
      1000, 275, (v) => de(v) + ' h', M.map((m) => pct(m.ausl)), [28, 4]);
    const KEYB = `<span class="kk"><i style="background:${ABO}"></i>Abos <i style="background:${EIN}"></i>Buchungen <i style="background:${VER}"></i>Verein <i style="background:${WETCSS}"></i>Wetter (nicht bespielbar) <i style="background:${FREI};border:1px solid #D8D0C0"></i>frei</span>`;
    const pg3 = `<section class="page">${head('Platzbelegung', 'Wie viele Stunden standen zur Verfügung – und wofür wurden sie genutzt?')}
<div class="panel"><h2>Verfügbare Stunden <small>2 Plätze × 14 Stunden = 28 Stunden pro Tag</small></h2><div class="b2">${belegBlock('30', '30v', P30)}${belegBlock('12', '12v', P12)}</div>
<div class="abo-line">Abos heute: <b>${w30.abo_act} aktive Abos</b> belegen <b>${w30.abo_wk} Stunden pro Woche</b> (${w30.abo_1} × 1 Std., ${w30.abo_2} × 2 Std.) · Verein = Training, Kurse und Veranstaltungen ohne Umsatz · Wetter (nicht bespielbar) = laut Wetter-App und nicht belegt${noWx}</div></div>
<div class="panel"><h2>Platzbelegung je Monat <small>Ø Stunden pro Tag · jeder Balken = 28 Stunden · links die letzten 12 Monate (neuester zuerst), rechts Vorjahr</small>${KEYB}</h2>${bChart}</div>
${foot(3, 'Platzbelegung = am Spieltag gezählt · Auslastung = belegte Stunden ÷ verfügbare Stunden · gezählt wird, was gebucht ist')}</section>`;

    // ---------- Seite 4: Details ----------
    const courtBar = (x) => {
      const w = 440, parts = [[x.ha, ABO], [x.he, EIN], [x.hv, VER], [x.hw, WET], [x.cap - x.ha - x.he - x.hv - x.hw, FREI]];
      let px = 0; const out = [`<svg viewBox="0 0 ${w} 20" class="cb">`];
      for (const [v, col] of parts) { const ww = v / x.cap * w; out.push(`<rect x="${f1(px)}" y="0" width="${f1(ww)}" height="20" fill="${col}"/>`); if (ww > 26) out.push(`<text x="${f1(px + ww / 2)}" y="13.5" text-anchor="middle" class="sb" fill="${col === FREI || col === WET ? INK : '#fff'}">${Math.round(v / x.cap * 100)} %</text>`); px += ww; }
      out.push('</svg>');
      return [out.join(''), Math.round((x.ha + x.he + x.hv) / x.cap * 100)];
    };
    let crt = '';
    for (const [lab, key] of [['Letzte 30 Tage', 'w30'], ['Letzte 12 Monate', 'w12']]) {
      crt += `<div class="ct">${lab}</div>`;
      for (const c of md.courts) { const [svg, a] = courtBar(c[key]); crt += `<div class="crow"><span>Platz ${c.c}</span>${svg}<b>${a} %</b></div>`; }
    }
    const heat = (() => {
      const w = 520, h = 200, L = 26, T = 16, cw = (w - L) / 14, ch = (h - T - 4) / 7;
      const s = [`<svg viewBox="0 0 ${w} ${h}" class="chart">`];
      HOURS.forEach((hh, j) => s.push(`<text x="${f1(L + j * cw + cw / 2)}" y="${T - 4}" text-anchor="middle" class="ax">${hh}</text>`));
      for (let i = 0; i < 7; i++) {
        s.push(`<text x="${L - 5}" y="${f1(T + i * ch + ch / 2 + 3)}" text-anchor="end" class="ax${i >= 5 ? ' b' : ''}">${WD_DE[i]}</text>`);
        HOURS.forEach((hh, j) => {
          const v = md.wdn[i] ? (md.cnt[i + '-' + hh] || 0) / (2 * md.wdn[i]) * 100 : 0;
          s.push(`<rect x="${f1(L + j * cw + 1)}" y="${f1(T + i * ch + 1)}" width="${f1(cw - 2)}" height="${f1(ch - 2)}" rx="2" fill="rgba(255,90,54,${(0.07 + v / 100 * 0.93).toFixed(2)})"/>`);
          s.push(`<text x="${f1(L + j * cw + cw / 2)}" y="${f1(T + i * ch + ch / 2 + 3)}" text-anchor="middle" class="hm" fill="${v > 60 ? '#fff' : INK}">${Math.round(v)}</text>`);
        });
      }
      s.push('</svg>');
      return s.join('');
    })();
    const daily = (() => {
      const w = 1040, h = 184, L = 30, T = 22, B = 34, pw = w - L - 6, ph = h - T - B, n = md.dailyDetail.length, bw = pw / n;
      const s = [`<svg viewBox="0 0 ${w} ${h}" class="chart">`];
      for (const v of [0, 7, 14, 21, 28]) { const y = T + ph - v / 28 * ph; s.push(`<line x1="${L}" y1="${f1(y)}" x2="${w - 6}" y2="${f1(y)}" stroke="${LINE}"/><text x="${L - 4}" y="${f1(y + 3)}" text-anchor="end" class="ax">${v} h</text>`); }
      md.dailyDetail.forEach((x, i) => {
        const px = L + i * bw + bw * 0.15; let yb = T + ph;
        s.push(`<rect x="${f1(px)}" y="${f1(T)}" width="${f1(bw * 0.7)}" height="${f1(ph)}" fill="${FREI}"/>`);
        for (const [v, col] of [[x.ha, ABO], [x.he, EIN], [x.hv, VER], [x.hw, WET]]) { const hh = v / 28 * ph; s.push(`<rect x="${f1(px)}" y="${f1(yb - hh)}" width="${f1(bw * 0.7)}" height="${f1(hh)}" fill="${col}"/>`); yb -= hh; }
        s.push(`<text x="${f1(px + bw * 0.35)}" y="${T - 6}" text-anchor="middle" class="dlab">${x.bel}</text>`);
        s.push(`<text x="${f1(px + bw * 0.35)}" y="${T + ph + 12}" text-anchor="middle" class="ax${wdMon(x.d) >= 5 ? ' b' : ''}">${ymd(x.d)[2]}.</text>`);
        s.push(`<text x="${f1(px + bw * 0.35)}" y="${T + ph + 21}" text-anchor="middle" class="ax">${'MDMDFSS'[wdMon(x.d)]}</text>`);
      });
      s.push('</svg>');
      return s.join('');
    })();
    const pg4 = `<section class="page">${head('Details – Plätze, Wochentage, Uhrzeiten', 'Vertiefung für Rückfragen: Platz 1 und Platz 2, Stoßzeiten, Tagesverlauf')}
${KEY}
<div class="g2">
 <div class="panel"><h2>Platz 1 und Platz 2 <small>Anteil der Stunden · Zahl rechts = belegt</small></h2>${crt}
 <p class="note">Abos und Vereinsnutzung sind festen Plätzen zugeordnet; Buchungen verteilen sich auf den jeweils freien Platz.</p></div>
 <div class="panel"><h2>Auslastung nach Tagen und Tageszeiten <small>belegte Stunden in % · letzte 3 Monate · Wochentag × Startzeit</small></h2>${heat}</div>
</div>
<div class="panel mt"><h2>Letzte 30 Tage – Tag für Tag <small>28 Stunden je Tag: belegt, wetterbedingt nicht bespielbar oder frei${noWx}</small></h2>${daily}</div>
${foot(4)}</section>`;

    // ---------- Seite 5: Finanzen ----------
    const { F, Fv, FY, FYv, fy, fm } = md;
    const fs = md.sample ? md.fs : null;
    const mName = MON[fm - 1], mLast = p2(ymd(mend(fy, fm))[2]);
    const fr = (lbl, get, cls = '', sign = 1, live = true) => {
      const cell = (x) => (live ? (sign < 0 ? '−' : '') + eur(get(x)) : '<span class="z">–</span>');
      return `<tr class="${cls}"><td>${lbl}</td><td class="n b">${cell(F)}</td><td class="n mu">${cell(Fv)}</td><td class="n b">${cell(FY)}</td><td class="n mu">${cell(FYv)}</td></tr>`;
    };
    const ftab = [
      fr('<b class="abc">A</b>Buchungen (direkt bezahlt)', (x) => x.r.u_bu),
      fr('<span class="ind">davon TFB-Mitglieder</span>', (x) => x.g_tfb, 'sub'),
      fr('<span class="ind">davon BSV-Mitglieder</span>', (x) => x.g_bsv, 'sub'),
      fr('<span class="ind">davon Partner</span>', (x) => x.g_par, 'sub'),
      fr('<span class="ind">davon Externe</span>', (x) => x.g_ext, 'sub'),
      fr('<b class="abc">B</b>Guthaben / Gutscheine verkauft', (x) => x.r.u_gut),
      fr('<b class="abc">C</b>Abos (Verkauf)', (x) => x.r.u_abo),
      fr('= Umsatz gesamt (A + B + C) <span class="sm2">= Zahlungseingang, wie Seite 2</span>', (x) => x.r.u, 'sum'),
      fr('− Rückzahlungen', (x) => x.refund, '', -1, !!fs),
      fr('− Stripe-Gebühren', (x) => x.fee, '', -1, !!fs),
      fr('Nachrichtlich: mit Guthaben bezahlte Buchungen (kein zusätzlicher Umsatz)', (x) => x.used, 'info'),
    ].join('');
    let flow, gEnd = null, gBeg = null, checks;
    if (fs) {
      const ob = fs.stripe_open_cents / 100, cb = fs.stripe_close_cents / 100;
      const payout = ob + F.z - F.refund - F.fee - cb;
      gBeg = fs.credit_open_cents / 100; gEnd = gBeg + F.cards + fs.credit_storno_cents / 100 - F.used;
      flow = `<div class="flow"><div><span>Bestand 01.${p2(fm)}.</span><b>${eur(ob)}</b></div><div class="op">+</div><div><span>Zahlungseingang</span><b>${eur(F.z)}</b></div><div class="op">−</div><div><span>Rückzahlungen + Gebühren</span><b>${eur(F.refund + F.fee)}</b></div><div class="op">−</div><div class="hl"><span>Aufs Vereinskonto überwiesen</span><b>${eur(payout)}</b></div><div class="op">=</div><div><span>Bestand ${mLast}.${p2(fm)}.</span><b>${eur(cb)}</b></div></div>`;
      checks = [['ok', 'Jede Zahlung einer Buchung, einem Abo oder einer Wertkarte zugeordnet'], ['ok', 'Stripe = App: Differenz 0,00 €'], ['ok', `Überweisungen von Stripe auf dem Vereinskonto gefunden (${eur(payout)})`], ['ok', 'Belegnummern lückenlos'], ['warn', '1 Rückzahlung noch zu prüfen (24 €)'], ['todo', 'Freigabe durch Kassierer']];
    } else {
      flow = '<p class="note">Stripe-Bestände, Gebühren, Rückzahlungen und Überweisungen werden angebunden, sobald der Kassierer die Anforderungen festgelegt hat (siehe MIS-Projektgedächtnis, Schritt 3).</p>';
      checks = [['todo', 'Zuordnung aller Stripe-Zahlungen – Anbindung folgt'], ['todo', 'Abgleich Stripe = App – Anbindung folgt'], ['todo', 'Überweisungen / Bankabgleich – Anbindung folgt'], ['todo', 'Belegnummern für Abos und Guthaben – folgt'], ['todo', 'Freigabe durch Kassierer']];
    }
    const chk = checks.map(([k, t]) => `<tr><td class="ic ${k}">${k === 'ok' ? '✓' : k === 'warn' ? '!' : '○'}</td><td>${t}</td></tr>`).join('');
    const mrows = md.FM.map(({ y, m, f }) => `<tr><td>${MON[m - 1]} ${y}</td><td class="n">${eur(f.r.u_ein)}</td><td class="n">${eur(f.r.u_abo)}</td><td class="n b">${eur(f.r.u)}</td><td class="n">${eur(f.earned)}</td><td class="n">${eur(f.r.u_gut)}</td></tr>`).join('');
    const fbNote = fs && fs.freibad_ytd_cents ? `Im Umsatz aus Buchungen enthalten: Freibad-Aufschlag ${eur(fs.freibad_ytd_cents / 100)} (Jan–${mName} ${fy}), gesondert abzurechnen. ` : 'Freibad-Aufschlag wird noch nicht gesondert ausgewiesen. ';
    const pg5 = `<section class="page">${head('Finanzen – für Kassierer und Steuerberater', `Monatsabschluss ${['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'][fm - 1]} ${fy}: vom Umsatz zum Geld auf dem Vereinskonto${fs ? '' : ' · ENTWURF'}`)}
<div class="g21b">
 <div class="panel"><h2>Vom Umsatz zum Zahlungseingang</h2>
  <table class="fin"><thead><tr><th></th><th class="n">${mName} ${fy}</th><th class="n">${mName} ${fy - 1}</th><th class="n">Jan–${mName} ${fy}</th><th class="n">Jan–${mName} ${fy - 1}</th></tr></thead><tbody>${ftab}</tbody></table>
  <p class="note">${fbNote}Kiosk ist nicht enthalten und wird nach Freigabe getrennt gezeigt.</p>
  <h2 class="mt">Geld bei Stripe im ${['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'][fm - 1]}</h2>
  ${flow}
 </div>
 <div class="panel"><h2>Für den Jahresabschluss</h2>
  <table class="cmp"><tbody>
   <tr><td>Abo-Umsatz periodengerecht (${mName})<em>auf ${['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'][fm - 1]} entfallender Anteil aller laufenden Abos</em></td><td class="n b">${eur(F.earned)}</td></tr>
   <tr><td>Abo-Vorauszahlungen ${mLast}.${p2(fm)}.<em>bezahlt, Leistung noch offen (Vormonat ${eur(md.rapBeg)})</em></td><td class="n b">${eur(md.rapEnd)}</td></tr>
   <tr><td>Spielguthaben-Bestand ${mLast}.${p2(fm)}.<em>Verpflichtung gegenüber Kunden${gBeg !== null ? ` (Vormonat ${eur(gBeg)})` : ' – Anbindung folgt'}</em></td><td class="n b">${gEnd !== null ? eur(gEnd) : '–'}</td></tr>
  </tbody></table>
  <h2 class="mt">Abschluss-Prüfung</h2><table class="chk">${chk}</table>
  <h2 class="mt">Monatswerte – letzte 12 Monate</h2><table class="mt12"><thead><tr><th>Monat</th><th class="n">Buchungen*</th><th class="n">Abos</th><th class="n">Umsatz</th><th class="n">Abo period.</th><th class="n">davon Guthaben</th></tr></thead><tbody>${mrows}</tbody></table>
  <div class="export">Für den Steuerberater: Buchungsliste (CSV, DATEV-fähig) · Belegliste · Stripe-Auszug · Kennzahlen (Excel). Werte getrennt nach Kundengruppe (TFB, BSV, Partner, Externe) und A/B/C; Konten und Umsatzsteuer legt der Steuerberater fest.</div>
 </div>
</div>
${foot(5, 'Umsatz = Zahlungseingang: Abos + direkt bezahlte Buchungen + verkaufte Guthaben/Gutscheine · mit Guthaben bezahlte Buchungen zählen nicht doppelt')}</section>`;

    return { pages: pg1 + pg2 + pg3 + pg4 + pg5, tilesHtml };
  }

  function renderTiles(md, which = 'cur') {
    const fd = (n, y) => { const [yy, m, d] = ymd(n); return `${WD_DE[wdMon(n)]}, ${p2(d)}.${p2(m)}.${y ? yy : ''}`; };
    const kv = (v, unit) => (v ? de(v) + unit : '–');
    const ag = md.aggDays;
    const prevYear = which === 'prev';
    const T = prevYear ? md.TODAY - 365 : md.TODAY;
    const sets = prevYear
      ? [ag([md.todayV]), ag([md.days30v[0]]), ag(md.days30v.slice(0, 7)), ag(md.days30v)]
      : [ag([md.today]), ag([md.days30[0]]), ag(md.days30.slice(0, 7)), ag(md.days30)];
    const D30 = prevYear ? md.days30v : md.days30;
    const vj = '';
    const heads = [
      `<span class="ph ${prevYear ? 'pv' : 'pd'} s">Heute${vj} · ${fd(T, prevYear)}</span>`,
      `<span class="ph ${prevYear ? 'pv' : 'pd2'} s">Gestern${vj} · ${fd(D30[0].d, prevYear)}</span>`,
      `<span class="ph ${prevYear ? 'pv' : 'p7'} s">Letzte 7 Tage${vj} · ${dd(D30[6].d)}–${dd(D30[0].d, prevYear)}</span>`,
      `<span class="ph ${prevYear ? 'pv' : 'p30'} s">Letzte 30 Tage${vj} · ${dd(D30[29].d)}–${dd(D30[0].d, prevYear)}</span>`,
    ];
    if (which === 'dev') {
      const cur = [ag([md.today]), ag([md.days30[0]]), ag(md.days30.slice(0, 7)), ag(md.days30)];
      const prv = [ag([md.todayV]), ag([md.days30v[0]]), ag(md.days30v.slice(0, 7)), ag(md.days30v)];
      const names = ['Heute', 'Gestern', 'Letzte 7 Tage', 'Letzte 30 Tage'];
      const signed = (v, fmt, unit) => {
        const cls = Math.abs(v) < 0.05 ? 'dn' : v > 0 ? 'up' : 'down';
        return `<span class="${cls}">${v > 0 ? '+' : v < 0 ? '−' : '±'}${fmt(Math.abs(v))}${unit}</span>`;
      };
      return cur.map((c, i) => {
        const p = prv[i];
        return `<div class="dt dev"><span class="ph pdev s">${names[i]} · ggü. Vorjahr</span>`
          + '<table class="kt"><tr><th></th><th>Abweichung</th><th>in %</th></tr>'
          + `<tr><td class="kl">Auslastung</td><td>${signed(c.ausl - p.ausl, (v) => de(v, 1), ' PP')}</td><td></td></tr>`
          + `<tr><td class="kl">Stunden</td><td>${signed(c.bel - p.bel, (v) => de(v), ' h')}</td><td>${dl(c.bel, p.bel)}</td></tr>`
          + `<tr class="sg"><td class="kl">Umsatz</td><td><b>${signed(c.u - p.u, (v) => de(v), ' €')}</b></td><td>${dl(c.u, p.u)}</td></tr></table></div>`;
      }).join('');
    }
    const tile = (headHtml, r) => {
      const row = (lab, col, h, u) => `<tr><td class="kl"><i style="background:${col}"></i>${lab}</td><td>${kv(h, ' h')}</td><td>${kv(u, ' €')}</td></tr>`;
      return `<div class="dt">${headHtml}<table class="kt"><tr><th></th><th>Stunden</th><th>Umsatz</th></tr>`
        + row('Buchung', EIN, r.he, r.ub) + row('Abo', ABO, r.ha, r.ua) + row('TFB', VER, r.hv, r.uv)
        + `<tr class="sg"><td class="kl"><span class="sgl">Σ</span><span class="au">${pct(r.ausl)}</span></td><td><b>${de(r.bel)} h</b></td><td><b>${eur(r.u)}</b></td></tr></table></div>`;
    };
    return sets.map((r, i) => tile(heads[i], r)).join('');
  }

  // =====================================================================
  //  Oeffentliche Schnittstelle
  // =====================================================================
  // ---------- Monatsarchiv (Musterdaten: virtuell aus den Musterdaten erzeugt) ----------
  const MONTH_DE = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const isoOf = (n) => { const [y, m, d] = ymd(n); return `${y}-${p2(m)}-${p2(d)}`; };
  const GROUP_LABEL = { tfb: 'TFB-Mitglied', bsv: 'BSV-Mitglied', par: 'Partner', ext: 'Extern' };
  const money = (c) => (c / 100).toFixed(2).replace('.', ',');
  function monthLabel(monthIso) { const [y, m] = monthIso.split('-').map(Number); return `${MONTH_DE[m - 1]} ${y}`; }
  function archiveRaw(raw, monthIso) {
    const [y, m] = monthIso.split('-').map(Number); const today = mend(y, m) + 1;
    const sold = (d) => dn(d) < today;   // Stand: Einfrieren in der Nacht nach Monatsende
    return {
      ...raw, today: isoOf(today), archive_month: monthIso,
      bookings: raw.bookings.filter((b) => sold(b[1])),   // bis Monatsende verkauft; Spieltag darf spaeter liegen
      subs: raw.subs.filter((a) => sold(a[0])),
      cards: raw.cards.filter((c) => sold(c[0])),
      weather: (raw.weather || []).filter((w) => dn(w[0]) <= today),
    };
  }
  function archiveCsv(raw, monthIso) {
    const [y, m] = monthIso.split('-').map(Number); const s = mstart(y, m), e = mend(y, m);
    const rows = [];
    for (const b of raw.bookings) { const v = dn(b[1]); if (!b[9] && v >= s && v <= e) rows.push({ v, art: 'Buchung', d: dn(b[0]), h: b[2], c: b[4], dur: b[3], g: b[8], brutto: b[5], guth: b[6] }); }
    for (const a of raw.subs) { const v = dn(a[0]); if (v >= s && v <= e) rows.push({ v, art: a[10] ? 'Abo (2 Jahre)' : 'Abo', d: dn(a[1]), h: a[4], c: a[6], dur: a[5], g: a[9], brutto: a[7], guth: 0 }); }
    for (const c of raw.cards) { const v = dn(c[0]); if (v >= s && v <= e) rows.push({ v, art: 'Guthaben/Gutschein', d: null, g: c[3], brutto: c[1], guth: 0 }); }
    rows.sort((x, z) => x.v - z.v || x.art.localeCompare(z.art));
    let nr = 0;
    const lines = rows.map((r) => [r.art === 'Buchung' ? `B-${y}-${p2(m)}-${String(++nr).padStart(4, '0')}` : '', dd(r.v, true), r.art,
      r.d === null ? '' : dd(r.d, true), r.d === null ? '' : `${p2(r.h)}:00`, r.d === null ? '' : String(r.c), r.d === null ? '' : String(r.dur),
      GROUP_LABEL[r.g] || 'Extern', money(r.brutto), money(r.guth), money(r.brutto - r.guth)].join(';'));
    const head = 'Belegnummer;Verkaufsdatum;Art;Spieltag/Start;Uhrzeit;Platz;Stunden;Kundengruppe;Betrag brutto EUR;davon Guthaben EUR;Zahlungseingang EUR';
    return { csv: [head, ...lines].join('\r\n'), summary: { belege: rows.length, zahlungseingang_cents: rows.reduce((t, r) => t + r.brutto - r.guth, 0) } };
  }
  function sampleArchiveList(raw) {
    const today = dn(raw.today); const [ty, tm] = ymd(today); const first = Math.min(...raw.bookings.map((b) => dn(b[1])));
    const out = [];
    for (let k = 1; k <= 12; k++) {
      const [y, m] = ymAdd(ty, tm, -k); if (mend(y, m) < first) break;
      const monthIso = `${y}-${p2(m)}-01`;
      out.push({ month: monthIso, as_of: isoOf(mend(y, m)), created_at: isoOf(mend(y, m) + 1) + 'T00:45:00', test_mode: true, sample: true, summary: archiveCsv(raw, monthIso).summary });
    }
    return out;
  }

  const PATTERN = '<svg width="0" height="0" style="position:absolute"><defs><pattern id="wh" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)"><rect width="5" height="5" fill="#E6E0D5"/><rect width="2" height="5" fill="#C2BAAD"/></pattern></defs></svg>';

  window.PBMIS = {
    version: 'v22',
    buildModel,
    /** Vollstaendiges HTML-Dokument des 5-seitigen Berichts */
    reportDocument(md, css, fontsHref) {
      const { pages } = render(md);
      return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>MIS Padel Bielstein · ${esc(dd(md.TODAY, true))}</title>`
        + (fontsHref ? `<link rel="stylesheet" href="${esc(fontsHref)}">` : '')
        + `<style>${css}</style></head><body>${PATTERN}${pages}</body></html>`;
    },
    /** 4 KPI-Kacheln fuer den Admin-Tab: which = 'cur' (aktuell), 'prev' (Vorjahr, gleicher Zeitraum), 'dev' (Abweichung) */
    tilesHtml(md, which) { return renderTiles(md, which || 'cur'); },
    monthLabel, archiveRaw, archiveCsv, sampleArchiveList,
  };
})();
