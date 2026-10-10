const SALE_KINDS = new Set(['booking', 'subscription', 'earlybird_subscription', 'card', 'event']);
const GROUPS = new Set(['tfb', 'bsv', 'par', 'ext', 'unknown']);
const CASH_KINDS = new Set(['payment', 'refund', 'fee', 'payout']);
const CATEGORIES = new Set(['booking', 'subscription', 'earlybird_subscription', 'card', 'provider_fee', 'payout', 'unknown']);
const SCOPES = new Set(['padel', 'provider', 'unassigned']);
const TOTAL_KEYS = ['sales_cents', 'sale_cash_cents', 'credit_used_cents', 'payments_cents', 'refunds_cents', 'fees_cents', 'payouts_cents'];
const COUNT_KEYS = ['unverified_sale_count', 'unlinked_payment_count', 'unsupported_currency_count', 'unassigned_movement_count', 'unknown_group_count'];

function fail(detail) { throw new Error(`Ungueltige MIS-Finanzquelle: ${detail}`); }
function integer(value, label, positive = false) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value)) fail(label);
  const result = BigInt(value);
  if (positive && result === 0n) fail(label);
  return result;
}
function signed(value, label) {
  if (typeof value !== 'string' || !/^(0|-?[1-9][0-9]*)$/.test(value)) fail(label);
  return BigInt(value);
}
function date(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail('Datum');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) fail('Datum');
  return value;
}
function member(set, value, label) { if (!set.has(value)) fail(label); return value; }
function text(value, label) {
  if (typeof value !== 'string' || !value.trim() || /[\r\n\u0000]/.test(value)) fail(label);
  return value;
}
function boolean(value, label) { if (typeof value !== 'boolean') fail(label); return value; }

// All arithmetic stays in integer cents, including aggregates above JS safe integer limits.
export function validateVerifiedFinanceSource(source, expected) {
  if (!source || source.version !== 2 || source.status !== 'verified_activity_source'
    || source.complete !== false || source.coverage !== 'not_proven'
    || source.timezone !== 'Europe/Berlin' || source.kiosk_included !== false
    || source.weather_changes_cash !== false) fail('Vertrag/Abdeckungsstatus');
  const from = date(source.from), to = date(source.to);
  if (from > to || !expected || source.account_id !== expected.accountId
    || source.livemode !== expected.livemode || from !== expected.from || to !== expected.to) fail('Konto/Modus/Zeitraum');
  text(source.account_id, 'Konto');
  boolean(source.livemode, 'Modus');
  if (typeof source.known_at !== 'string' || !Number.isFinite(Date.parse(source.known_at))) fail('Wissensstand');
  if (!Array.isArray(source.sales) || !Array.isArray(source.cash) || !source.totals || !source.controls) fail('Listen/Kontrollen');
  const totals = Object.fromEntries(TOTAL_KEYS.map(key => [key, 0n]));
  const receipts = new Set(), cashKeys = new Set();
  let unverified = 0n, unknown = 0n, currency = 0n, unassigned = 0n;
  const sales = source.sales.map(row => {
    const receipt = text(row.receipt, 'Beleg');
    if (receipts.has(receipt)) fail('Doppelter Beleg');
    receipts.add(receipt);
    const day = date(row.day);
    if (day < from || day > to) fail('Beleg ausserhalb Zeitraum');
    const kind = member(SALE_KINDS, row.kind, 'Verkaufsart');
    const group = member(GROUPS, row.group, 'Kundengruppe');
    const person = integer(row.person, 'Pseudonym', true).toString();
    const total = integer(row.total_cents, 'Belegbetrag');
    const cash = integer(row.cash_cents, 'Belegzahlung');
    const credit = integer(row.credit_cents, 'Guthabennutzung');
    if (total !== cash + credit || kind !== 'booking' && credit !== 0n) fail('Belegaufteilung');
    const verified = boolean(row.verified, 'Belegnachweis');
    if (!row.terms || typeof row.terms !== 'object' || Array.isArray(row.terms)) fail('Leistung');
    if (!verified) unverified++;
    else { totals.sales_cents += total; totals.sale_cash_cents += cash; totals.credit_used_cents += credit; }
    if (group === 'unknown') unknown++;
    // Explicit fields only: private identifiers accidentally added by an RPC cannot travel onwards.
    const terms = Object.fromEntries(['day','starts_on','ends_on','hour_start','weekday','duration','court','term_months',
      'card_type','card_size','balance_cents','is_gift'].filter(key => Object.hasOwn(row.terms, key)).map(key => [key, row.terms[key]]));
    for (const key of ['day','starts_on','ends_on']) if (terms[key] != null) date(terms[key]);
    for (const [key,min,max] of [['hour_start',8,21],['weekday',0,6],['duration',1,14],['court',1,2],['term_months',1,120],['card_size',1,100000]]) {
      if (terms[key] != null && (!Number.isInteger(terms[key]) || terms[key] < min || terms[key] > max)) fail('Leistung '+key);
    }
    if (terms.hour_start != null && terms.duration != null && terms.hour_start + terms.duration > 22) fail('Leistung ausserhalb Spielzeit');
    if (terms.balance_cents != null) {
      if (typeof terms.balance_cents === 'number' && Number.isSafeInteger(terms.balance_cents) && terms.balance_cents >= 0) terms.balance_cents=String(terms.balance_cents);
      integer(terms.balance_cents,'Kartenwert');
    }
    if (terms.is_gift != null) boolean(terms.is_gift,'Geschenkkarte');
    if (terms.card_type != null) member(new Set(['balance','hours']),terms.card_type,'Kartenart');
    if (row.terms.slots != null) {
      if (!Array.isArray(row.terms.slots)) fail('Eventslots');
      const seen = new Set();
      terms.slots = row.terms.slots.map(slot => {
        if (!slot || ![1,2].includes(slot.court) || !Number.isInteger(slot.hour) || slot.hour < 8 || slot.hour > 21) fail('Eventslot');
        const key = slot.court+'-'+slot.hour;
        if (seen.has(key)) fail('Doppelter Eventslot'); seen.add(key);
        return { court: slot.court, hour: slot.hour };
      });
    }
    return { receipt, day, kind, group, person, total, cash, credit, verified, terms };
  });
  const cash = source.cash.map(row => {
    const day = date(row.day);
    if (day < from || day > to) fail('Geldbewegung ausserhalb Zeitraum');
    if (typeof row.currency !== 'string' || !/^[a-z]{3}$/.test(row.currency)) fail('Waehrung');
    const scope = member(SCOPES, row.scope, 'Bereich');
    const category = member(CATEGORIES, row.category, 'Geldkategorie');
    const kind = member(CASH_KINDS, row.kind, 'Geldart');
    const amount = integer(row.amount_cents, 'Geldbetrag', true);
    const count = integer(row.count, 'Anzahl', true);
    const key = JSON.stringify([day, row.currency, scope, category, kind]);
    if (cashKeys.has(key)) fail('Doppelte Geldsumme');
    cashKeys.add(key);
    if (row.currency !== 'eur') currency += count;
    if (scope === 'unassigned') unassigned += count;
    if (row.currency === 'eur' && scope === 'padel' && kind === 'payment') totals.payments_cents += amount;
    if (row.currency === 'eur' && scope === 'padel' && kind === 'refund') totals.refunds_cents += amount;
    if (row.currency === 'eur' && scope === 'provider' && kind === 'fee') totals.fees_cents += amount;
    if (row.currency === 'eur' && scope === 'provider' && kind === 'payout') totals.payouts_cents += amount;
    return { day, currency: row.currency, scope, category, kind, amount, count };
  });
  for (const key of TOTAL_KEYS) if (integer(source.totals[key], key) !== totals[key]) fail(`Summe ${key}`);
  const controls = Object.fromEntries(COUNT_KEYS.map(key => [key, integer(source.controls[key], key)]));
  if (controls.unverified_sale_count !== unverified || controls.unknown_group_count !== unknown
    || controls.unsupported_currency_count !== currency || controls.unassigned_movement_count !== unassigned) fail('Kontrollsummen');
  const difference = totals.payments_cents - totals.sale_cash_cents;
  if (signed(source.controls.cash_difference_cents, 'Zahlungsdifferenz') !== difference
    || source.controls.historical_coverage_proven !== false || source.controls.credit_balances_proven !== false) fail('Abstimmung/Finalitaet');
  return {
    from, to, accountId: source.account_id, livemode: source.livemode, knownAt: source.known_at,
    sales, cash, totals, controls, difference,
    netCash: totals.payments_cents - totals.refunds_cents,
    final: false, creditBalance: null, coverageProven: false,
    hasExceptions: COUNT_KEYS.some(key => controls[key] !== 0n) || difference !== 0n,
  };
}

export function financeDailyTotals(finance) {
  const days = new Map();
  for (const row of finance.cash) {
    if (row.currency !== 'eur') continue;
    if (!days.has(row.day)) days.set(row.day, { day: row.day, payments: 0n, refunds: 0n, fees: 0n, payouts: 0n });
    const day = days.get(row.day);
    if (row.scope === 'padel' && row.kind === 'payment') day.payments += row.amount;
    if (row.scope === 'padel' && row.kind === 'refund') day.refunds += row.amount;
    if (row.scope === 'provider' && row.kind === 'fee') day.fees += row.amount;
    if (row.scope === 'provider' && row.kind === 'payout') day.payouts += row.amount;
  }
  return [...days.values()].sort((a, b) => a.day.localeCompare(b.day)).map(day => ({ ...day, netCash: day.payments - day.refunds }));
}

export function financeEuro(cents) {
  if (typeof cents !== 'bigint') fail('Integer-Centbetrag erforderlich');
  const negative = cents < 0n;
  const value = negative ? -cents : cents;
  return `${negative ? '-' : ''}${(value / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${(value % 100n).toString().padStart(2, '0')}`;
}

export function financeYearSummary(year, monthlySources, expectedScope) {
  if (!Number.isInteger(year) || year < 2000 || year > 9999 || !Array.isArray(monthlySources)) fail('Jahreszeitraum');
  const months = new Map();
  for (const source of monthlySources) {
    const month = date(source.from).slice(0, 7);
    const number = Number(month.slice(5));
    const last = new Date(Date.UTC(year, number, 0)).toISOString().slice(0, 10);
    if (Number(month.slice(0, 4)) !== year || source.from !== `${month}-01` || source.to !== last || months.has(month)) fail('Monatsauswahl');
    months.set(month, validateVerifiedFinanceSource(source, { ...expectedScope, from: source.from, to: source.to }));
  }
  const totals = Object.fromEntries(TOTAL_KEYS.map(key => [key, 0n]));
  const rows = [], missingMonths = [];
  for (let number = 1; number <= 12; number++) {
    const month = `${year}-${String(number).padStart(2, '0')}`, finance = months.get(month);
    if (!finance) { missingMonths.push(month); rows.push({ month, available: false }); continue; }
    for (const key of TOTAL_KEYS) totals[key] += finance.totals[key];
    rows.push({ month, available: true, knownAt: finance.knownAt, totals: { ...finance.totals },
      netCash: finance.netCash, difference: finance.difference, hasExceptions: finance.hasExceptions, final: false });
  }
  // This is an app cash summary, never the club's tax/annual financial statement.
  return { year, rows, missingMonths, allMonthsAvailable: missingMonths.length === 0,
    totals, netCash: totals.payments_cents - totals.refunds_cents, final: false,
    creditBalance: null, externalExpensesIncluded: false, kioskIncluded: false };
}

const CSV_HEAD = ['Belegnummer','Verkaufsdatum','Art','Spieltag/Start','Uhrzeit','Platz','Stunden','Kundengruppe','Betrag brutto EUR','davon Guthaben EUR','Zahlungseingang EUR'];
const GROUP_LABELS = { tfb: 'TFB-Mitglied', bsv: 'BSV-Mitglied', par: 'Partner', ext: 'Extern', unknown: 'Historische Gruppe unbekannt' };
const euroImport = cents => financeEuro(cents).replace(/\./g, '');
export function financeCsv(matrix) {
  const cell = value => {
    let text = String(value ?? '');
    if (/^[=+@\t\r]/.test(text) || /^-[^0-9]/.test(text)) text = "'" + text;
    return /[;"\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  };
  return matrix.map(row => row.map(cell).join(';')).join('\r\n');
}
export function financeBookingMatrix(finance) {
  if (finance.sales.some(row => !row.verified)) fail('Belegnachweise muessen vor Buchungslistenexport geklaert werden');
  return [CSV_HEAD, ...finance.sales.map(row => {
    const t = row.terms, slots = t.slots || [];
    const label = { booking: 'Buchung', subscription: 'Abo', earlybird_subscription: 'Abo (2 Jahre)', card: t.card_type==='hours'?'Historische Stundenkarte':'Guthaben/Gutschein', event: 'Event' }[row.kind];
    return [row.receipt, row.day, label, t.day || t.starts_on || '',
      t.hour_start == null ? slots.length ? [...new Set(slots.map(s => s.hour))].sort((a,b) => a-b).map(h => `${h}:00`).join(', ') : '' : `${t.hour_start}:00`,
      t.court ?? (slots.length ? [...new Set(slots.map(s => s.court))].sort().join(', ') : ''),
      t.duration ?? (slots.length || ''), GROUP_LABELS[row.group], euroImport(row.total), euroImport(row.credit), euroImport(row.cash)];
  })];
}
export function financeCashMatrix(finance) {
  return [['Tag','Waehrung','Bereich','Kategorie','Vorgang','Anzahl','Betrag EUR / sonst Minor Units','Cash-Wirkung Padel EUR'],
    ...finance.cash.map(row => [row.day,row.currency,row.scope,row.category,row.kind,row.count.toString(),row.currency==='eur'?euroImport(row.amount):row.amount.toString(),
      row.currency === 'eur' && row.scope === 'padel' && ['payment','refund'].includes(row.kind) ? euroImport(row.kind === 'refund' ? -row.amount : row.amount) : '']),
    ['SUMME Padel EUR','eur','padel','','', '',euroImport(finance.totals.payments_cents),euroImport(finance.netCash)],
    ['Rueckzahlungen EUR','eur','padel','', 'refund','',euroImport(finance.totals.refunds_cents),''],
    ['Providergebuehren EUR','eur','provider','', 'fee','',euroImport(finance.totals.fees_cents),''],
    ['Providerauszahlungen EUR','eur','provider','', 'payout','',euroImport(finance.totals.payouts_cents),'']];
}
export function financeCreditData(source) {
  if (!source || !Array.isArray(source.rows) || typeof source.balance_proven !== 'boolean') fail('Guthabennachweise');
  const gapCount = integer(source.history_gap_count, 'Guthabenluecken');
  if (source.balance_proven !== (gapCount === 0n)) fail('Guthabenabdeckung');
  const seen = new Set();
  const rows = source.rows.map(row => {
    const reference = text(row.reference, 'Guthabenreferenz');
    if (seen.has(reference)) fail('Doppelte Guthabenreferenz'); seen.add(reference);
    return { reference, receipt: row.receipt || '', kind: text(row.kind, 'Guthabenart'), day: date(row.day),
      amount: signed(row.amount_cents, 'Guthabenbetrag'), verified: boolean(row.verified, 'Guthabennachweis') };
  });
  const opening = source.balance_proven ? signed(source.opening_cents, 'Guthabenanfang') : null;
  const closing = source.balance_proven ? signed(source.closing_cents, 'Guthabenende') : null;
  const gifts = source.balance_proven ? integer(source.gift_unclaimed_cents, 'Unbeanspruchte Geschenkkarten') : null;
  if (!source.balance_proven && [source.opening_cents,source.closing_cents,source.gift_unclaimed_cents].some(v => v !== null)) fail('Erfundener Guthabenbestand');
  if (source.balance_proven && (rows.some(r => !r.verified) || opening + rows.reduce((sum,row) => sum + row.amount,0n) !== closing)) fail('Guthabensaldo');
  return { rows, opening, closing, gifts, gapCount, proven: source.balance_proven,
    granted: rows.filter(r => r.verified && r.amount > 0n).reduce((sum,row) => sum + row.amount,0n),
    used: -rows.filter(r => r.verified && r.amount < 0n).reduce((sum,row) => sum + row.amount,0n) };
}
export function financeCreditMatrix(credit) {
  return [['Tag','Belegbezug','Guthabenreferenz','Art','Betrag EUR','Nachweis'],
    ...credit.rows.map(row => [row.day,row.receipt,row.reference,row.kind,euroImport(row.amount),row.verified ? 'Bestaetigt' : 'Ungeklaert']),
    ['ANFANGSBESTAND','','','',credit.opening === null ? 'Unbekannt' : euroImport(credit.opening),''],
    ['END BESTAND','','','',credit.closing === null ? 'Unbekannt' : euroImport(credit.closing),''],
    ['GESCHENKE NOCH NICHT BEANSPRUCHT','','','',credit.gifts === null ? 'Unbekannt' : euroImport(credit.gifts),'']];
}
export function financeWeatherMatrix(source) {
  if (!source || !Array.isArray(source.open) || !Array.isArray(source.events)) fail('Reklamationsnachweise');
  integer(source.legacy_unknown_count, 'Alte ungepruefte Reklamationen');
  const rows = source.events.map(row => [row.receipt || '',date(row.play_day),'',text(row.at, 'Reklamationszeit'),
    member(new Set(['reported','credit_granted','rejected','credit_unverified']),row.kind,'Reklamationsart'),
    euroImport(integer(row.amount_cents,'Reklamationsbetrag')),
    row.kind === 'credit_granted' && row.verified === true ? 'Spielguthaben, keine Barauszahlung' : 'Keine bestaetigte Geldbuchung']);
  if (source.events.some(row => row.kind === 'credit_granted' && row.verified !== true)) fail('Gutschrift ohne Nachweis');
  for (const row of source.open) rows.push([row.receipt || '',date(row.play_day),'',source.cutoff_exclusive,'open_at_cutoff',
    euroImport(integer(row.requested_cents,'Offener Anspruch')),'Nur beantragt, keine Buchung']);
  return [['Belegbezug','Spieltag','Verkaufstag','Zeitpunkt','Vorgang','Betrag EUR','Zahlungswirkung'],...rows];
}
export function financeArchive(entry, scope) {
  const f = entry.financial_source;
  const finance = validateVerifiedFinanceSource(f, { ...scope, from: entry.month, to: entry.as_of });
  const credit = financeCreditData(entry.credit_source);
  if (credit.rows.some(row => row.day < entry.month || row.day > entry.as_of)) fail('Guthaben ausserhalb Archivmonat');
  const weatherMatrix = financeWeatherMatrix(entry.weather_accounting);
  const exportError=finance.sales.some(row=>!row.verified)?'Belegnachweise muessen vor Buchungslistenexport geklaert werden.':null;
  return { ...entry, finance, credit, cash_matrix: financeCashMatrix(finance), credit_matrix: financeCreditMatrix(credit),export_error:exportError,
    csv: exportError?null:financeCsv(financeBookingMatrix(finance)), report_data: { ...entry.report_data, weather_accounting_csv: financeCsv(weatherMatrix) } };
}

export function financeYearArchives(year, entries, scope) {
  const archives = entries.map(entry => financeArchive(entry,scope));
  const summary = financeYearSummary(year,entries.map(entry => entry.financial_source),scope);
  const start = archives.find(entry => entry.month === `${year}-01-01`);
  const end = archives.find(entry => entry.month === `${year}-12-01`);
  summary.creditRows = summary.rows.map(row => {
    const entry = archives.find(entry => entry.month.slice(0,7) === row.month);
    return { month:row.month, available:!!entry, granted:entry?.credit.granted ?? null, used:entry?.credit.used ?? null,
      closing:entry?.credit.closing ?? null, gifts:entry?.credit.gifts ?? null,
      openClaims:entry ? entry.weather_accounting.open.length : null, gapCount:entry?.credit.gapCount ?? null };
  });
  summary.creditTotals = { granted:archives.reduce((sum,e) => sum+e.credit.granted,0n), used:archives.reduce((sum,e) => sum+e.credit.used,0n),
    opening:start?.credit.opening ?? null, closing:end?.credit.closing ?? null, gifts:end?.credit.gifts ?? null,
    openClaims:end ? end.weather_accounting.open.length : null };
  summary.archiveVersions = entries.map(entry => ({ month:entry.month,version:entry.version,id:entry.id,sha256:entry.sha256 }));
  return summary;
}
