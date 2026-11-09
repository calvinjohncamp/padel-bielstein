/* Local, reversible font experiment. No account settings or server writes. */
(function () {
  'use strict';
  if (window.PBTypographyPreview) return;
  const key = 'pb_typography_preview_v1';
  const styleUrl = new URL('assets/typography-preview/switcher.css?v=20261109-type-1', document.baseURI).href;
  const fontUrl = 'https://joern-kaemper.de/assets/shared-kiosk/20261109-shared-1/fonts.css';
  const contexts = new Map();
  const watchedFrames = new WeakSet();
  const ownIds = new Set(['pb-type-styles', 'pb-type-fonts']);
  let selected = 'padel';
  try { if (localStorage.getItem(key) === 'tfb') selected = 'tfb'; } catch (_) {}

  // CSS family variables preserve each original declaration's specificity and
  // importance. Their fallbacks reproduce the original Padel font stack.
  function mapFamily(style) {
    for (const [property, role] of [['--font', 'body'], ['--font-sans', 'body'], ['--font-display', 'display'], ['--serif', 'display'], ['--hand', 'body']]) {
      const value = style.getPropertyValue(property);
      if (value && !value.includes('--pb-type-')) style.setProperty(property, 'var(--pb-type-' + role + ', ' + value + ')', style.getPropertyPriority(property));
    }
    const family = style.getPropertyValue('font-family');
    if (!family || family.includes('--pb-type-')) return;
    let next = family
      .replace(/(["'])Space Grotesk\1|\bSpace Grotesk\b/gi, 'var(--pb-type-display, "Space Grotesk")')
      .replace(/(["'])Manrope\1|\bManrope\b/gi, 'var(--pb-type-body, "Manrope")');
    if (next === family && !/var\(|TFB |monospace|icons?|Font Awesome|Material Symbols/i.test(family)) {
      if (/Georgia|Iowan|Times|(?:^|[,\s])serif(?:\s|,|$)/i.test(family)) next = 'var(--pb-type-display, ' + family + ')';
      else if (/Arial|Helvetica|system-ui|BlinkMacSystemFont|Segoe UI|Roboto|Inter|Satoshi|General Sans|sans-serif/i.test(family)) next = 'var(--pb-type-body, ' + family + ')';
    }
    if (next !== family) style.setProperty('font-family', next, style.getPropertyPriority('font-family'));
  }
  function rewriteRules(rules) {
    for (const rule of rules) {
      if (rule.type === 5) continue; // @font-face names must never be rewritten.
      if (rule.style) mapFamily(rule.style);
      if (rule.cssRules) rewriteRules(rule.cssRules);
    }
  }
  function rewriteSheets(doc) {
    for (const sheet of doc.styleSheets) {
      if (ownIds.has(sheet.ownerNode?.id)) continue;
      try { rewriteRules(sheet.cssRules); } catch (_) { /* Cross-origin styles remain untouched. */ }
    }
  }
  function link(doc, id, href) {
    if (doc.getElementById(id)) return;
    const el = doc.createElement('link'); el.id = id; el.rel = 'stylesheet'; el.href = href;
    doc.head.append(el);
  }
  function watchFrame(frame) {
    if (watchedFrames.has(frame)) return;
    watchedFrames.add(frame);
    const attach = () => {
      try {
        const child = frame.contentDocument;
        if (child?.head && child.body && child.location.href !== 'about:blank') attachDocument(child);
      } catch (_) { /* Payment and other cross-origin frames are not part of the app. */ }
    };
    frame.addEventListener('load', attach);
    attach();
  }
  function scan(node) {
    if (node.nodeType !== 1) return;
    if (node.hasAttribute('style')) mapFamily(node.style);
    for (const el of node.querySelectorAll('[style]')) mapFamily(el.style);
    if (node.matches('iframe')) watchFrame(node);
    for (const frame of node.querySelectorAll('iframe')) watchFrame(frame);
  }
  function apply(doc) {
    doc.documentElement.classList.toggle('pb-tfb-type', selected === 'tfb');
  }
  function attachDocument(doc) {
    if (contexts.has(doc)) { apply(doc); return; }
    contexts.set(doc, true);
    link(doc, 'pb-type-styles', styleUrl);
    link(doc, 'pb-type-fonts', fontUrl);
    rewriteSheets(doc); scan(doc.documentElement); apply(doc);
    const Observer = doc.defaultView.MutationObserver;
    const observer = new Observer(records => {
      let sheetsChanged = false;
      for (const record of records) {
        if (record.type === 'attributes') mapFamily(record.target.style);
        else {
          for (const node of record.addedNodes) {
            scan(node);
            if (node.nodeType === 1 && (node.matches('style,link[rel="stylesheet"]') || node.querySelector('style,link[rel="stylesheet"]'))) sheetsChanged = true;
          }
          if (record.target.nodeType === 1 && record.target.matches('style')) sheetsChanged = true;
        }
      }
      if (sheetsChanged) rewriteSheets(doc);
    });
    observer.observe(doc.documentElement, {subtree:true, childList:true, attributes:true, attributeFilter:['style']});
    doc.addEventListener('load', event => {
      if (event.target?.matches?.('link[rel="stylesheet"]')) rewriteSheets(doc);
    }, true);
    contexts.set(doc, observer);
  }
  function refreshControls() {
    for (const button of document.querySelectorAll('#pbTypographySwitch [data-type-choice]')) {
      button.setAttribute('aria-pressed', String(button.dataset.typeChoice === selected));
    }
  }
  function choose(value, persist = true) {
    selected = value === 'tfb' ? 'tfb' : 'padel';
    for (const [doc, observer] of contexts) {
      try {
        if (doc !== document && !doc.defaultView?.frameElement?.isConnected) { observer.disconnect(); contexts.delete(doc); continue; }
        apply(doc);
      } catch (_) { contexts.delete(doc); }
    }
    refreshControls();
    if (persist) { try { localStorage.setItem(key, selected); } catch (_) {} }
    // Embedded app panels can change height when their font metrics change.
    for (const doc of contexts.keys()) {
      try { doc.defaultView.dispatchEvent(new doc.defaultView.Event('resize')); } catch (_) {}
    }
  }
  function start() {
    attachDocument(document);
    const header = document.getElementById('heroHeader');
    if (!header) return;
    header.classList.add('pb-type-header');
    const control = document.createElement('div'); control.id = 'pbTypographySwitch';
    control.setAttribute('role', 'group'); control.setAttribute('aria-label', 'Schriften vergleichen');
    control.innerHTML = '<span>Schriften</span><div class="pb-type-options"><button type="button" data-type-choice="padel" aria-pressed="true" title="Bisherige Padel-Schriften">Padel</button><button type="button" data-type-choice="tfb" aria-pressed="false" title="TFB-Schriften ausprobieren">TFB</button></div>';
    control.addEventListener('click', event => {
      event.stopPropagation();
      const button = event.target.closest('[data-type-choice]');
      if (button) choose(button.dataset.typeChoice);
    });
    header.insertBefore(control, document.getElementById('appbarAuth') || document.getElementById('appbarUser'));
    refreshControls();
  }
  window.PBTypographyPreview = {choose, get selected() { return selected; }};
  addEventListener('storage', event => { if (event.key === key || event.key === null) choose(event.newValue === 'tfb' ? 'tfb' : 'padel', false); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
