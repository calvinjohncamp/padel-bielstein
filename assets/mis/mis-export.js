/* Local, on-demand PDF and workbook exports. No report data leaves the browser. */
(function () {
  'use strict';
  const pending = new Map();
  const money = n => n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function local(path) { return new URL(path, document.baseURI).href; }
  function script(path) {
    if (!pending.has(path)) pending.set(path, new Promise((resolve, reject) => {
      const el = document.createElement('script'); el.src = local(path);
      el.onload = resolve;
      el.onerror = () => { pending.delete(path); el.remove(); reject(new Error('Exportbibliothek konnte nicht geladen werden. Bitte erneut versuchen.')); };
      document.head.appendChild(el);
    }));
    return pending.get(path);
  }
  async function pdfLibrary() {
    await script('assets/vendor/jspdf/jspdf-4.2.1.min.js');
    await script('assets/vendor/jspdf-autotable/jspdf-autotable-5.0.8.min.js');
    return window.jspdf.jsPDF;
  }
  const fonts = new Map();
  async function font(name, family = 'manrope') {
    const key = family + name;
    if (!fonts.has(key)) fonts.set(key, (async () => {
      const res = await fetch(local('assets/vendor/fonts/' + family + '/' + family + '-' + name + '.ttf'));
      if (!res.ok) throw new Error('Berichtsschrift konnte nicht geladen werden.');
      const bytes = new Uint8Array(await res.arrayBuffer());
      let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return btoa(binary);
    })().catch(error => { fonts.delete(key); throw error; }));
    return fonts.get(key);
  }
  function financeData(matrix, weather, parse) {
    // The CSV routine owns validation and cent-exact totals for all formats.
    const full = parse(window.PBMIS.csvWithTotals(matrix, weather));
    const indices = weather ? [5] : [8, 9, 10];
    const convert = (r, grouped) => r.map((v, i) => indices.includes(i) ? Number((grouped ? v.replace(/\./g, '') : v).replace(',', '.')) : v);
    return { head: full[0], indices, rows: matrix.slice(1).map(r => convert(r, false)), totals: full.slice(-4).map(r => convert(r, true)) };
  }
  function title(entry, weather) {
    return (weather ? 'Reklamationen' : 'Buchungsliste') + ' ' + window.PBMIS.monthLabel(entry.month);
  }
  function status(entry) { return entry.sample ? 'MUSTERDATEN' : entry.test_mode ? 'TESTBETRIEB' : 'Archivierte App-Daten'; }
  function filename(entry, weather, ext) {
    return 'padel-bielstein-' + (weather ? 'reklamationen-' : 'buchungsliste-') + entry.month.slice(0, 7)
      + (entry.sample ? '-muster' : entry.test_mode ? '-testbetrieb' : '') + '.' + ext;
  }
  function download(blob, name) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
  }
  const pdfUrls = [];
  function showPdf(w, blob) {
    if (w.closed) throw new Error('Das Berichtsfenster wurde geschlossen.');
    const url = URL.createObjectURL(blob); pdfUrls.push(url); w.location.replace(url);
  }
  window.addEventListener('pagehide', () => pdfUrls.forEach(url => URL.revokeObjectURL(url)));
  async function managementPdf(html) {
    const PDF = await pdfLibrary();
    await script('assets/vendor/html2canvas/html2canvas-1.4.1.min.js');
    const frame = document.createElement('iframe');
    frame.style.cssText = 'position:fixed;left:-20000px;top:0;width:1123px;height:794px;border:0;pointer-events:none';
    const ready = new Promise((resolve, reject) => {
      frame.onload = resolve; frame.onerror = () => reject(new Error('Berichtsansicht konnte nicht erstellt werden.'));
    });
    frame.srcdoc = html; document.body.appendChild(frame);
    try {
      await ready; const doc = frame.contentDocument;
      await doc.fonts.ready;
      const fontCss = '@font-face{font-family:Manrope;src:url(data:font/ttf;base64,' + await font('400') + ')}'
        + '@font-face{font-family:Manrope;font-weight:700;src:url(data:font/ttf;base64,' + await font('700') + ')}'
        + '@font-face{font-family:"Space Grotesk";font-weight:700;src:url(data:font/ttf;base64,' + await font('700', 'space-grotesk') + ')}';
      // SVGs become isolated images in html2canvas; retain fonts, styles and patterns.
      const pattern = doc.querySelector('#wh');
      for (const svg of doc.querySelectorAll('.page svg')) {
        for (const node of svg.querySelectorAll('*')) {
          const style = frame.contentWindow.getComputedStyle(node);
          for (const property of ['font-family','font-size','font-weight','fill','stroke','stroke-width','text-anchor','opacity']) node.style.setProperty(property, style.getPropertyValue(property));
        }
        const style = doc.createElementNS('http://www.w3.org/2000/svg', 'style'); style.textContent = fontCss; svg.prepend(style);
        if (pattern) { const defs = doc.createElementNS('http://www.w3.org/2000/svg','defs'); defs.appendChild(pattern.cloneNode(true)); svg.prepend(defs); }
        if (svg.classList.contains('trend')) { svg.style.flexShrink = '0'; svg.style.height = 'auto'; }
      }
      const pages = [...doc.querySelectorAll('.page')];
      if (pages.length !== 5) throw new Error('Der Managementbericht muss fünf Seiten enthalten.');
      pages.forEach(page => { page.style.display = 'none'; });
      const pdf = new PDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
      pdf.setProperties({ title: doc.title, subject: 'Management-Information Padel Bielstein' });
      for (let i = 0; i < pages.length; i++) {
        pages[i].style.display = 'flex';
        // Long labels may expand a page. Fit the complete layout, never clip it.
        pages[i].style.height = 'auto'; pages[i].style.minHeight = '210mm'; pages[i].style.overflow = 'visible';
        for (const svg of pages[i].querySelectorAll('svg')) {
          const rect = svg.getBoundingClientRect();
          const box = svg.viewBox.baseVal;
          const height = svg.classList.contains('trend') && box.width ? rect.width * box.height / box.width : rect.height;
          svg.setAttribute('width', String(rect.width)); svg.setAttribute('height', String(height));
          svg.style.width = rect.width + 'px'; svg.style.height = height + 'px';
          const img = doc.createElement('img');
          img.style.cssText = svg.style.cssText + ';display:block;';
          img.style.marginTop = frame.contentWindow.getComputedStyle(svg).marginTop;
          img.width = Math.ceil(rect.width); img.height = Math.ceil(height);
          const xml = new XMLSerializer().serializeToString(svg);
          const bytes = new TextEncoder().encode(xml); let binary = '';
          for (let k = 0; k < bytes.length; k += 8192) binary += String.fromCharCode(...bytes.subarray(k, k + 8192));
          const loaded = new Promise((resolve, reject) => { img.onload = resolve; img.onerror = () => reject(new Error('Diagramm konnte nicht gerendert werden.')); });
          img.src = 'data:image/svg+xml;base64,' + btoa(binary);
          svg.replaceWith(img); await loaded;
        }
        // Rasterize the approved HTML at print resolution without redesigning it.
        const canvas = await window.html2canvas(pages[i], { scale: 3, backgroundColor: '#fff', logging: false, windowWidth: 1123 });
        if (i) pdf.addPage();
        const width = Math.min(297, 210 * canvas.width / canvas.height);
        const height = width * canvas.height / canvas.width;
        pdf.addImage(canvas.toDataURL('image/png'), 'PNG', (297 - width) / 2, (210 - height) / 2, width, height, undefined, 'FAST');
        canvas.width = canvas.height = 0;
        pages[i].style.display = 'none';
      }
      return pdf.output('blob');
    } finally { frame.remove(); }
  }
  async function financePdf(entry, matrix, weather, parse) {
    const data = financeData(matrix, weather, parse);
    const PDF = await pdfLibrary();
    const pdf = new PDF({ orientation: 'landscape', unit: 'mm', format: 'a4', compress: true });
    for (const [weight, style] of [['400', 'normal'], ['700', 'bold']]) {
      pdf.addFileToVFS('Manrope-' + weight + '.ttf', await font(weight));
      pdf.addFont('Manrope-' + weight + '.ttf', 'Manrope', style);
    }
    pdf.setProperties({ title: title(entry, weather) + ' | Padel Bielstein' });
    const widths = weather ? [29, 36, 39, 33, 38, 25, 81] : [31, 22, 36, 24, 14, 12, 14, 53, 25, 25, 25];
    const heads = data.head.map(h => h.replace(/ EUR$/, '\nEUR').replace('Verkaufsdatum', 'Verkaufs-\ndatum').replace('Stunden', 'Dauer\nh').replace('Betrag brutto', 'Betrag\nbrutto').replace(/davon Guthaben/i, 'davon\nGuthaben').replace('Zahlungseingang', 'Zahlungs-\neingang'));
    const body = data.rows.map(r => r.map((v, i) => data.indices.includes(i) ? money(v) : v));
    data.totals.forEach(r => body.push(weather ? r.map((v, i) => data.indices.includes(i) ? money(v) : v)
      : [{ content: r[2], colSpan: 8 }, ...r.slice(8).map(money)]));
    pdf.autoTable({ head: [heads], body, startY: 29, margin: { top: 29, bottom: 15, left: 8, right: 8 },
      tableWidth: 281, showHead: 'everyPage', rowPageBreak: 'avoid',
      styles: { font: 'Manrope', fontSize: 8.8, cellPadding: { top: 0.4, bottom: 0.4, left: 1, right: 1 }, overflow: 'linebreak', textColor: '#1C1A17', lineColor: '#E7E1D6', lineWidth: 0.1 },
      headStyles: { fillColor: '#1C1A17', textColor: '#FFFFFF', fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: '#F7F7F5' },
      columnStyles: Object.fromEntries(widths.map((w, i) => [i, { cellWidth: w, halign: data.indices.includes(i) ? 'right' : 'left' }])),
      didParseCell: hook => {
        if (hook.section === 'body' && hook.row.index >= data.rows.length) {
          hook.cell.styles.fontStyle = 'bold'; hook.cell.styles.fillColor = '#FFE0D7';
        }
      },
      didDrawPage: hook => {
        pdf.setFont('Manrope', 'bold'); pdf.setFontSize(13); pdf.setTextColor('#1C1A17');
        pdf.text('PADEL BIELSTEIN', 8, 11); pdf.setFontSize(10); pdf.text(title(entry, weather), 8, 18);
        pdf.setFont('Manrope', 'normal'); pdf.setFontSize(8); pdf.text(status(entry), 289, 11, { align: 'right' });
        pdf.setDrawColor('#FF5A36'); pdf.setLineWidth(0.8); pdf.line(8, 23, 289, 23);
        pdf.setTextColor('#77716A'); pdf.setFontSize(7);
        pdf.text('Archivierte Monatsdaten. Kein bestätigter Bankabgleich. Kiosk nicht enthalten.', 8, 203);
        pdf.text('Seite ' + hook.pageNumber, 289, 203, { align: 'right' });
      }
    });
    return pdf.output('blob');
  }
  async function financeWorkbook(entry, matrix, weather, parse) {
    const data = financeData(matrix, weather, parse);
    await script('assets/vendor/exceljs/exceljs-4.4.0.min.js');
    const book = new window.ExcelJS.Workbook(); book.creator = 'Padel Bielstein'; book.calcProperties.fullCalcOnLoad = true;
    const sheet = book.addWorksheet(weather ? 'Reklamationen' : 'Buchungsliste', {
      views: [{ state: 'frozen', ySplit: 5, showGridLines: false }],
      pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0,
        printTitlesRow: '1:5', margins: { left: 0.25, right: 0.25, top: 0.3, bottom: 0.3, header: 0.1, footer: 0.1 } },
      headerFooter: { oddFooter: 'Padel Bielstein&P / &N' }
    });
    const count = data.head.length;
    sheet.columns = (weather ? [17, 23, 23, 20, 30, 18, 45] : [16, 14, 18, 17, 10, 9, 9, 22, 18, 18, 18]).map(width => ({ width }));
    sheet.mergeCells(1, 1, 1, count); sheet.getCell('A1').value = 'PADEL BIELSTEIN'; sheet.getRow(1).height = 25;
    sheet.mergeCells(2, 1, 2, count); sheet.getCell('A2').value = title(entry, weather);
    sheet.mergeCells(3, 1, 3, count); sheet.getCell('A3').value = status(entry) + '. Archivierte Monatsdaten. Kein bestätigter Bankabgleich. Kiosk nicht enthalten.';
    sheet.getRow(3).height = 22;
    sheet.getRow(5).values = data.head.map(h => h.replace(' EUR', '\nEUR')); sheet.getRow(5).height = 35;
    data.rows.forEach(values => {
      const row = sheet.addRow(values); row.height = 30;
      for (const index of weather ? [0] : [1, 3]) {
        const value = String(values[index]);
        const de = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
        const iso = de ? `${de[3]}-${de[2]}-${de[1]}` : /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
        if (iso) { row.getCell(index + 1).value = new Date(iso + 'T00:00:00Z'); row.getCell(index + 1).numFmt = 'dd.mm.yyyy'; }
      }
    });
    const lastDetail = 5 + data.rows.length;
    data.totals.forEach(values => { const row = sheet.addRow(values); row.height = 36; });
    sheet.eachRow(row => row.eachCell({ includeEmpty: true }, (cell, i) => {
      cell.font = { name: 'Arial', size: row.number === 1 ? 16 : row.number === 2 ? 12 : 10, color: { argb: 'FF1C1A17' }, bold: row.number <= 2 || row.number === 5 || row.number > lastDetail };
      cell.alignment = { vertical: 'middle', wrapText: true, horizontal: data.indices.includes(i - 1) && row.number >= 5 ? 'right' : 'left' };
      if (row.number === 5) { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1C1A17' } }; cell.font.color = { argb: 'FFFFFFFF' }; }
      else if (row.number > lastDetail && row.number > 5) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE0D7' } };
      else if (row.number > 5 && row.number % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F7F5' } };
      if (row.number > 5 && data.indices.includes(i - 1)) cell.numFmt = '#,##0.00';
    }));
    if (!weather) for (let row = lastDetail + 1; row <= sheet.rowCount; row++) {
      const label = sheet.getCell(row, 3).value;
      sheet.getCell(row, 3).value = null; sheet.mergeCells(row, 1, row, 8); sheet.getCell(row, 1).value = label;
    }
    // Totals remain fixed snapshot values, exactly like the signed source archive.
    if (data.rows.length) sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: lastDetail, column: count } };
    sheet.pageSetup.printArea = 'A1:' + sheet.getCell(sheet.rowCount, count).address;
    const buffer = await book.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  window.PBMISExport = { financeData, financePdf, financeWorkbook, managementPdf, showPdf, download, filename };
})();
