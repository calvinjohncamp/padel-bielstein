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
  function status(entry) { return (entry.sample ? 'MUSTERDATEN' : entry.test_mode ? 'TESTBETRIEB' : 'Archivierte App-Daten')
    +(entry.version?' · Version '+entry.version:''); }
  function filename(entry, weather, ext) {
    return 'padel-bielstein-' + (weather ? 'reklamationen-' : 'buchungsliste-') + entry.month.slice(0, 7)
      + (entry.sample ? '-muster' : entry.test_mode ? '-testbetrieb' : '')+(entry.version?'-v'+entry.version:'') + '.' + ext;
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
    if(entry.finance && !weather) {
      const cents=n=>{
        if(n>BigInt(Number.MAX_SAFE_INTEGER) || n<-BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Finanzbetrag zu groß für PDF.');
        return money(Number(n)/100);
      };
      pdf.addPage();pdf.setFont('Manrope','bold');pdf.setFontSize(13);pdf.text('Finanzabstimmung '+window.PBMIS.monthLabel(entry.month),8,13);
      const f=entry.finance,c=entry.credit;
      pdf.autoTable({startY:23,margin:{left:8,right:8},styles:{font:'Manrope',fontSize:9,cellPadding:2},
        head:[['Nachweis','EUR / Anzahl']],body:[
          ['Zahlungseingänge Padel',cents(f.totals.payments_cents)],['Tatsächliche Kartenrückzahlungen',cents(f.totals.refunds_cents)],
          ['Cash nach Kartenrückzahlungen',cents(f.netCash)],['Providergebühren (kein weiterer Umsatz)',cents(f.totals.fees_cents)],
          ['Providerauszahlungen (Bankabgleich offen)',cents(f.totals.payouts_cents)],['Beleg-Cash-Zuordnungsdifferenz',cents(f.difference)],
          ['Spielguthaben Anfang',c.opening===null?'Unbekannt':cents(c.opening)],['Spielguthaben Ende',c.closing===null?'Unbekannt':cents(c.closing)],
          ['Geschenkkarten noch nicht beansprucht',c.gifts===null?'Unbekannt':cents(c.gifts)],
          ['Offene Regenreklamationen zum Monatsende',String(entry.weather_accounting.open.length)],
          ['Alte Regenreklamationen ohne vollständigen Nachweis',String(entry.weather_accounting.legacy_unknown_count)],
          ['Guthabennachweise / Historienlücken',c.gapCount.toString()],['Ungeklärte Zahlungszuordnungen',f.controls.unlinked_payment_count.toString()]],
        headStyles:{fillColor:'#1C1A17'},columnStyles:{1:{halign:'right'}}});
      pdf.setFont('Manrope','normal');pdf.setFontSize(8);
      pdf.text('Kein bestätigter Bankabgleich oder steuerlicher Abschluss. Vereinsausgaben und Kiosk nicht enthalten.',8,pdf.lastAutoTable.finalY+8);
    }
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
    // Totals remain fixed snapshot values, exactly like the immutable source archive.
    if (data.rows.length) sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: lastDetail, column: count } };
    sheet.pageSetup.printArea = 'A1:' + sheet.getCell(sheet.rowCount, count).address;
    if(entry.finance && !weather) {
      const numeric=s=>{const n=Number(String(s).replace(',','.'));if(!Number.isFinite(n) || Math.abs(n*100)>Number.MAX_SAFE_INTEGER) throw new Error('Excel-Betrag zu groß.');return n;};
      const add=(name,matrix,amountColumns=[])=>{
        const tab=book.addWorksheet(name,{views:[{state:'frozen',ySplit:1}],pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:0,printTitlesRow:'1:1'}});
        tab.columns=matrix[0].map(()=>({width:22}));
        matrix.forEach((row,i)=>tab.addRow(row.map((v,c)=>i>0 && amountColumns.includes(c) && /^-?\d+,\d{2}$/.test(String(v))?numeric(v):v)));
        tab.eachRow((row)=>row.eachCell(cell=>{cell.font={name:'Arial',size:10,bold:row.number===1};cell.alignment={wrapText:true,vertical:'middle'};
          if(typeof cell.value==='number') cell.numFmt='#,##0.00';}));
        tab.getRow(1).height=32;tab.pageSetup.printArea='A1:'+tab.getCell(tab.rowCount,matrix[0].length).address;
      };
      add('Cash-Nachweise',entry.cash_matrix,[6,7]);add('Guthaben-Nachweise',entry.credit_matrix,[4]);
      add('Reklamationen',parse(entry.report_data.weather_accounting_csv),[5]);
      add('Abo-Laufzeiten',[['Beleg','Verkaufstag','Start','Ende (exklusiv)','Laufzeit Monate','Bezahlt EUR'],
        ...entry.finance.sales.filter(s=>['subscription','earlybird_subscription'].includes(s.kind)).map(s=>[s.receipt,s.day,s.terms.starts_on,s.terms.ends_on,s.terms.term_months,money(Number(s.cash)/100).replace(/\./g,'')])],[5]);
      add('Abschlusskontrolle',[['Merkmal','Wert'],['Archivversion',entry.version],['Archiv-Prüfsumme',entry.sha256],
        ['Vollständigkeit Stripe-Historie','Nicht freigegeben'],['Bankabgleich','Offen'],['Vereinsausgaben / Kiosk','Nicht enthalten'],
        ['Cash-Zuordnungsdifferenz EUR',Number(entry.finance.difference)/100],['Offene Wetteransprüche',entry.weather_accounting.open.length],
        ['Alte Regenreklamationen ohne vollständigen Nachweis',entry.weather_accounting.legacy_unknown_count]]);
    }
    const buffer = await book.xlsx.writeBuffer();
    return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  function yearMatrix(summary) {
    const amount=n=>{if(n>BigInt(Number.MAX_SAFE_INTEGER) || n<-BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Jahresbetrag zu groß für Export.');return Number(n)/100;};
    const row=(label,t)=>[label,amount(t.payments_cents),amount(t.refunds_cents),amount(t.payments_cents-t.refunds_cents),
      amount(t.credit_used_cents),amount(t.fees_cents),amount(t.payouts_cents)];
    return [['Monat','Zahlungseingänge EUR','Kartenrückzahlungen EUR','Cash danach EUR','Guthaben genutzt EUR','Providergebühren EUR','Auszahlungen EUR'],
      ...summary.rows.map(r=>r.available?row(r.month,r.totals):[r.month,'Fehlt','Fehlt','Fehlt','Fehlt','Fehlt','Fehlt']),row('JAHRESSUMME vorhandene Monate',summary.totals)];
  }
  function yearCreditMatrix(summary) {
    const value=n=>{
      if(n===null || n===undefined) return 'Unbekannt';
      if(n>BigInt(Number.MAX_SAFE_INTEGER) || n<-BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Guthabenbetrag zu groß für Export.');
      return Number(n)/100;
    };
    return [['Monat','Guthaben gewährt EUR','Guthaben genutzt EUR','Endbestand EUR','Unbeanspruchte Geschenke EUR','Offene Regenansprüche'],
      ...(summary.creditRows || []).map(r=>r.available?[r.month,value(r.granted),value(r.used),value(r.closing),value(r.gifts),r.openClaims]:[r.month,...Array(5).fill('Fehlt')]),
      ['Jahresbewegung / Stand 31.12.',value(summary.creditTotals?.granted),value(summary.creditTotals?.used),value(summary.creditTotals?.closing),value(summary.creditTotals?.gifts),summary.creditTotals?.openClaims ?? 'Unbekannt']];
  }
  async function yearPdf(summary) {
    const matrix=yearMatrix(summary),PDF=await pdfLibrary(),pdf=new PDF({orientation:'landscape',unit:'mm',format:'a4'});
    for(const [weight,style] of [['400','normal'],['700','bold']]) {pdf.addFileToVFS('Manrope-'+weight+'.ttf',await font(weight));pdf.addFont('Manrope-'+weight+'.ttf','Manrope',style);}
    pdf.setFont('Manrope','bold');pdf.setFontSize(14);pdf.text('PADEL BIELSTEIN · Jahresübersicht '+summary.year,8,13);
    pdf.setFont('Manrope','normal');pdf.setFontSize(9);pdf.text(summary.sample?'MUSTERDATEN':summary.testMode?'TESTBETRIEB':'Archivierte App-Daten',8,20);
    pdf.autoTable({head:[matrix[0]],body:matrix.slice(1).map(r=>r.map(v=>typeof v==='number'?money(v):v)),startY:27,tableWidth:281,
      margin:{left:8,right:8},styles:{font:'Manrope',fontSize:8.5,cellPadding:2,overflow:'linebreak'},headStyles:{fillColor:'#1C1A17'},
      columnStyles:{0:{cellWidth:59},1:{cellWidth:37},2:{cellWidth:37},3:{cellWidth:37},4:{cellWidth:37},5:{cellWidth:37},6:{cellWidth:37}}});
    const y=pdf.lastAutoTable.finalY+9;pdf.text('Vorhanden: '+summary.rows.filter(r=>r.available).length+'/12 Monate. Fehlende Monate sind keine Nullumsätze.',8,y);
    pdf.text('App-Zahlungsübersicht, kein steuerlicher Jahresabschluss. Vereinsausgaben, Kiosk und Bankabgleich nicht enthalten.',8,y+6);
    if(summary.archiveVersions?.length) pdf.text(pdf.splitTextToSize('Archivstände: '+summary.archiveVersions.map(v=>v.month.slice(0,7)+' v'+v.version).join(' · '),281),8,y+12);
    if(summary.creditRows?.length) {
      pdf.addPage();pdf.setFont('Manrope','bold');pdf.setFontSize(13);pdf.text('Guthaben und offene Ansprüche '+summary.year,8,13);
      const credit=yearCreditMatrix(summary);
      pdf.autoTable({head:[credit[0]],body:credit.slice(1).map(r=>r.map((v,i)=>typeof v==='number' && i<5?money(v):v)),startY:24,
        margin:{left:8,right:8},tableWidth:281,styles:{font:'Manrope',fontSize:8.5,cellPadding:2},headStyles:{fillColor:'#1C1A17'}});
      const cy=pdf.lastAutoTable.finalY+9;pdf.setFont('Manrope','normal');pdf.setFontSize(9);
      pdf.text('Nur bestätigte Guthabenbewegungen. Keine zusätzlichen Zahlungseingänge.',8,cy);
      pdf.text('Bestände und offene Ansprüche werden nicht summiert. Der Jahresendstand benötigt einen Dezemberabschluss.',8,cy+6);
    }
    return pdf.output('blob');
  }
  async function yearWorkbook(summary) {
    await script('assets/vendor/exceljs/exceljs-4.4.0.min.js');const book=new window.ExcelJS.Workbook();book.creator='Padel Bielstein';
    const tab=book.addWorksheet('Jahr '+summary.year,{views:[{state:'frozen',ySplit:1}],pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:1}});
    tab.columns=[{width:40},...Array.from({length:6},()=>({width:23}))];
    yearMatrix(summary).forEach(r=>tab.addRow(r));
    tab.addRow([summary.sample?'MUSTERDATEN':summary.testMode?'TESTBETRIEB':'Archivierte App-Daten']);
    tab.addRow(['App-Zahlungsübersicht. Kein steuerlicher Jahresabschluss. Vereinsausgaben und Kiosk nicht enthalten.']);
    tab.eachRow(row=>{row.height=30;row.eachCell(cell=>{cell.font={name:'Arial',size:10,bold:row.number===1 || row.number===14};cell.alignment={wrapText:true};if(typeof cell.value==='number')cell.numFmt='#,##0.00';});});
    const refs=book.addWorksheet('Archivstände');refs.addRow(['Monat','Version','Archivkennung','Prüfsumme']);
    (summary.archiveVersions || []).forEach(v=>refs.addRow([v.month,v.version,v.id,v.sha256]));refs.columns=[{width:16},{width:12},{width:40},{width:68}];
    if(summary.creditRows?.length) {
      const credits=book.addWorksheet('Guthaben und Ansprüche',{pageSetup:{paperSize:9,orientation:'landscape',fitToPage:true,fitToWidth:1,fitToHeight:1}});
      credits.columns=[{width:40},...Array.from({length:5},()=>({width:24}))];
      yearCreditMatrix(summary).forEach(row=>credits.addRow(row));
      credits.addRow(['Bestände und offene Ansprüche nicht summieren. Jahresendstand nur aus Dezemberabschluss.']);
      credits.eachRow(row=>{row.height=30;row.eachCell((cell,i)=>{cell.font={name:'Arial',size:10,bold:row.number===1 || row.number===14};cell.alignment={wrapText:true};if(i>1 && i<6 && typeof cell.value==='number')cell.numFmt='#,##0.00';});});
      credits.pageSetup.printArea='A1:F15';
    }
    tab.pageSetup.printArea='A1:G16';tab.pageSetup.printTitlesRow='1:1';
    return new Blob([await book.xlsx.writeBuffer()],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  window.PBMISExport = { financeData, financePdf, financeWorkbook, managementPdf, showPdf, download, filename, yearMatrix,yearCreditMatrix,yearPdf,yearWorkbook };
})();
