/* Buildings: expand / collapse the upgrade path of a card (buttons: .tog inside .card.upg); a link to #building opens that card */
(function () {
  function setOpen(card, open) {
    card.classList.toggle('open', open);
    var b = card.querySelectorAll('.tog'); for (var i = 0; i < b.length; i++) b[i].setAttribute('aria-expanded', open ? 'true' : 'false');
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('.tog') : null; if (!t) return;
    var card = t.closest('.card'); if (!card) return;
    var open = !card.classList.contains('open'); setOpen(card, open);
    if (!open) { var r = card.getBoundingClientRect(); if (r.top < 120) window.scrollTo({ top: window.scrollY + r.top - 120 }); }
  });
  function fromHash() {
    var id = decodeURIComponent((location.hash || '').slice(1)); var el = id && document.getElementById(id);
    if (el && el.classList.contains('upg')) setOpen(el, true);
  }
  window.addEventListener('hashchange', fromHash); fromHash();
})();
/* Search: every word must be found; results link to the card / row on its page.  Nothing found in this language -> the other languages are searched and the results get a <XX> tag */
(function () {
  var cfg = document.getElementById('sr-cfg'); if (!cfg) return;
  var lang = cfg.getAttribute('data-lang'), base = cfg.getAttribute('data-base'), labels = JSON.parse(cfg.getAttribute('data-labels') || '{}');
  var q = document.getElementById('sr-q'), list = document.getElementById('sr-list'), cnt = document.getElementById('sr-count'), more = document.getElementById('sr-more'), hint = document.getElementById('sr-hint');
  var PAGE = 60, timer = null, shown = 0, hits = [], cache = {}, others = [], token = 0, restore = null, KEY = 'sa2wiki_search';
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ q: q.value, shown: shown, y: window.pageYOffset || 0 })); } catch (e) {} }
  var codes = [].map.call(document.querySelectorAll('details.lang a[data-code]'), function (a) { return a.getAttribute('data-code'); });
  var order = ['en'].concat(codes.filter(function (c) { return c !== 'en'; }));
  function fold(s) { s = (s || '').toLowerCase(); try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) {} return s; }
  function load(code, done) {
    if (window.SA2_IDX && window.SA2_IDX[code]) return done();
    var sc = document.createElement('script'); sc.src = base + 'index_' + code + '.js'; sc.onload = sc.onerror = done; document.head.appendChild(sc);
  }
  function prep(code) {
    if (cache[code]) return cache[code];
    return cache[code] = ((window.SA2_IDX || {})[code] || []).map(function (r) { return { s: r[0], id: r[1], t: r[2], x: r[3], h: fold(r[2] + ' ' + r[3]), ft: fold(r[2]) }; });
  }
  function search(rows, v, words) {
    var out = [];
    for (var i = 0; i < rows.length; i++) {
      var d = rows[i], sc = 0, ok = true, tm = true;
      for (var k = 0; k < words.length; k++) { if (d.h.indexOf(words[k]) < 0) { ok = false; break; } if (d.ft.indexOf(words[k]) >= 0) sc += 10; else { sc += 1; tm = false; } }
      if (!ok) continue;
      if (d.ft.indexOf(v) === 0) sc += 60; else if (d.ft.indexOf(v) > 0) sc += 30;
      out.push([sc, i, d, tm]);
    }
    return out;
  }
  function snippet(d, w) {
    var p = fold(d.x).indexOf(w); if (p < 0 || d.x.length <= 140) return d.x.slice(0, 140);
    var a = Math.max(0, p - 50); return (a ? '…' : '') + d.x.slice(a, a + 140);
  }
  function run() {
    var my = ++token, v = fold(q.value).trim(); list.innerHTML = ''; more.hidden = true; shown = 0; hits = [];
    try { history.replaceState(null, '', v ? '?q=' + encodeURIComponent(q.value.trim()) : location.pathname); } catch (e) {}
    if (v.length < 2) { cnt.textContent = ''; hint.hidden = false; return; }
    hint.hidden = true; var words = v.split(/\s+/), mine = prep(lang), res = search(mine, v, words);
    res.sort(function (a, b) { return b[0] - a[0] || a[1] - b[1]; });
    var mineHits = res.map(function (r) { return { d: r[2], tags: [], local: null }; });
    if (res.some(function (r) { return r[3]; })) { hits = mineHits; cnt.textContent = cfg.getAttribute('data-count').replace('{n}', hits.length); page(words[0]); return; }
    cnt.textContent = cfg.getAttribute('data-other-loading');
    var todo = order.filter(function (c) { return c !== lang; }), left = todo.length;
    todo.forEach(function (c) { load(c, function () { if (--left === 0 && my === token) fallback(v, words, todo, mineHits); }); });
  }
  function fallback(v, words, todo, mineHits) {
    var byKey = {}, list_ = [], mineBy = {}; prep(lang).forEach(function (d) { mineBy[d.s + '#' + d.id] = d; });
    todo.forEach(function (c) {
      search(prep(c), v, words).forEach(function (r) {
        if (mineHits.length && !r[3]) return;       // this language has body-text results already: from the others only names count
        var d = r[2], key = d.s + '#' + d.id, e = byKey[key];
        if (!e) { e = byKey[key] = { sc: r[0], d: d, tags: [], titles: {}, local: mineBy[key] || null, ord: list_.length }; list_.push(e); }
        if (!e.titles[d.t]) { e.titles[d.t] = 1; e.tags.push(c.toUpperCase()); }
        if (r[0] > e.sc) { e.sc = r[0]; }
      });
    });
    list_.sort(function (a, b) { return b.sc - a.sc || a.ord - b.ord; });
    var tagged = list_.map(function (e) { return { d: e.d, tags: e.tags, local: e.local }; });
    hits = tagged.concat(mineHits.filter(function (h) { return !tagged.some(function (t) { return t.d.s === h.d.s && t.d.id === h.d.id; }); }));
    cnt.textContent = !hits.length ? cfg.getAttribute('data-none') : (mineHits.length ? cfg.getAttribute('data-count').replace('{n}', hits.length) : cfg.getAttribute('data-other').replace('{n}', hits.length)); page(words[0]);
  }
  function page(w) {
    w = w || fold(q.value).trim().split(/\s+/)[0]; var end = Math.min(hits.length, shown + PAGE);
    for (var i = shown; i < end; i++) {
      var h = hits[i], d = h.d, li = document.createElement('li'), a = document.createElement('a'), b = document.createElement('b'), t = document.createElement('span'), p = document.createElement('p');
      a.href = '../' + d.s + '/index.html#' + encodeURIComponent(d.id);
      if (h.tags.length) { var lt = document.createElement('span'); lt.className = 'ltag'; lt.textContent = '<' + h.tags.join('/') + '>'; a.appendChild(lt); }
      b.textContent = d.t; a.appendChild(b);
      if (h.local && h.local.t && h.local.t !== d.t) { var lo = document.createElement('span'); lo.className = 'loc'; lo.textContent = '→ ' + h.local.t; a.appendChild(lo); }
      t.className = 'tag'; t.textContent = labels[d.s] || d.s; a.appendChild(t);
      if (h.tags.length && h.local && h.local.x) {       // found through another language: the text of both languages
        var l1 = document.createElement('span'), l2 = document.createElement('span'), p2 = document.createElement('p');
        l1.className = l2.className = 'ltag sm'; l1.textContent = '<' + h.tags[0] + '>'; l2.textContent = '<' + lang.toUpperCase() + '>';
        p.appendChild(l1); p.appendChild(document.createTextNode(snippet(d, w))); a.appendChild(p);
        p2.appendChild(l2); p2.appendChild(document.createTextNode(h.local.x.slice(0, 140))); a.appendChild(p2);
      } else { p.textContent = snippet(d, w); a.appendChild(p); }
      li.appendChild(a); list.appendChild(li);
    }
    shown = end; more.hidden = shown >= hits.length;
    if (restore) {                                   // coming back to the page: show as many results as before and scroll to where you were
      var r = restore; restore = null;
      while (shown < r.shown && shown < hits.length) page(w);
      if (r.y) window.scrollTo(0, r.y);
    }
  }
  more.addEventListener('click', function () { page(); save(); });
  list.addEventListener('click', save);
  window.addEventListener('pagehide', save); document.addEventListener('visibilitychange', function () { if (document.hidden) save(); });
  q.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(function () { run(); save(); }, 120); });
  cnt.textContent = cfg.getAttribute('data-loading');
  load(lang, function () {
    cnt.textContent = ''; var m = /[?&]q=([^&]*)/.exec(location.search);
    if (m) { try { q.value = decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch (e) {} }
    else { try { var sv = JSON.parse(localStorage.getItem(KEY) || 'null'); if (sv && sv.q) { q.value = sv.q; restore = { shown: sv.shown || 0, y: sv.y || 0 }; } } catch (e) {} }
    run(); if (!restore) q.focus();
  });
})();
/* sticky filter bars sit right under the header: measure how tall the header is */
(function () {
  var h = document.querySelector('header.top'); if (!h) return;
  function m() { document.documentElement.style.setProperty('--hdr', h.offsetHeight + 'px'); }
  m(); window.addEventListener('resize', m);
})();
/* Fractals: filter buttons (category + how to get; a card must match both) */
(function () {
  var grid = document.getElementById('frc-grid'); if (!grid) return;
  var sel = { cat: '', how: '' };
  function apply() {
    var cards = grid.querySelectorAll('.card.frc'), shown = 0;
    for (var i = 0; i < cards.length; i++) {
      var c = cards[i], ok = (!sel.cat || c.getAttribute('data-cat') === sel.cat) && (!sel.how || c.getAttribute('data-how') === sel.how);
      c.hidden = !ok; if (ok) shown++;
    }
    var n = document.querySelector('.none'); if (n) n.hidden = shown > 0;
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.chip[data-f]') : null; if (!b) return;
    var g = b.getAttribute('data-f'); sel[g] = b.getAttribute('data-v');
    var all = document.querySelectorAll('.chip[data-f="' + g + '"]'); for (var i = 0; i < all.length; i++) all[i].classList.toggle('on', all[i] === b);
    apply();
  });
})();
/* Items: type row + sub type row (the sub type row of the chosen type is shown; a card must match both) */
(function () {
  var grid = document.getElementById('it-grid'); if (!grid) return;
  var sel = { it: '', is: '' }, cards = [].slice.call(grid.querySelectorAll('.card.itm')), rows = [].slice.call(document.querySelectorAll('.subrow'));
  function apply() {
    var shown = 0;
    for (var i = 0; i < cards.length; i++) { var c = cards[i], ok = (!sel.it || c.getAttribute('data-t') === sel.it) && (!sel.is || c.getAttribute('data-s') === sel.is); c.hidden = !ok; if (ok) shown++; }
    for (i = 0; i < rows.length; i++) rows[i].hidden = !(sel.it && rows[i].getAttribute('data-for') === sel.it);
    var n = document.querySelector('.none'); if (n) n.hidden = shown > 0;
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.chip[data-f="it"],.chip[data-f="is"]') : null; if (!b) return;
    var g = b.getAttribute('data-f'); sel[g] = b.getAttribute('data-v'); if (g === 'it') sel.is = '';
    var all = document.querySelectorAll('.chip[data-f="it"],.chip[data-f="is"]');
    for (var i = 0; i < all.length; i++) { var gg = all[i].getAttribute('data-f'); all[i].classList.toggle('on', all[i].getAttribute('data-v') === sel[gg]); }
    apply();
  });
  apply();
})();
/* Modification pages: two filter rows.  Compatible with (data-c on the card) and slot (data-s); the slot buttons only show slots that exist for the chosen option; the counts follow the filters */
(function () {
  var grid = document.getElementById('mod-grid'); if (!grid) return;
  var sel = { mc: '', ms: '' }, cards = [].slice.call(grid.querySelectorAll('.card.mod'));
  function has(c, att, v) { return !v || (' ' + c.getAttribute(att) + ' ').indexOf(' ' + v + ' ') >= 0; }
  function ok(c, skip) { return (skip === 'mc' || has(c, 'data-c', sel.mc)) && (skip === 'ms' || has(c, 'data-s', sel.ms)); }
  function apply() {
    var chips = document.querySelectorAll('.chip[data-f="mc"],.chip[data-f="ms"]'), i, k;
    for (i = 0; i < chips.length; i++) {
      var b = chips[i], g = b.getAttribute('data-f'), v = b.getAttribute('data-v'), n = 0;
      for (k = 0; k < cards.length; k++) if (ok(cards[k], g) && has(cards[k], g === 'mc' ? 'data-c' : 'data-s', v)) n++;
      b.querySelector('small').textContent = n; b.hidden = v !== '' && n === 0;
      if (b.hidden && sel[g] === v) { sel[g] = ''; }
    }
    for (i = 0; i < chips.length; i++) { var gg = chips[i].getAttribute('data-f'); chips[i].classList.toggle('on', chips[i].getAttribute('data-v') === sel[gg]); }
    var shown = 0;
    for (k = 0; k < cards.length; k++) { var show = ok(cards[k]); cards[k].hidden = !show; if (show) shown++; }
    var secs = grid.querySelectorAll('.mod-tier');
    for (i = 0; i < secs.length; i++) { secs[i].hidden = !secs[i].querySelector('.card.mod:not([hidden])'); }
    var nn = document.querySelector('.none'); if (nn) nn.hidden = shown > 0;
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.chip[data-f="mc"],.chip[data-f="ms"]') : null; if (!b) return;
    sel[b.getAttribute('data-f')] = b.getAttribute('data-v'); apply(); apply();
  });
})();
/* Characters: the buttons show one character; a link to #ch-<name> opens that character; the portrait buttons swap the big picture */
(function () {
  var wrap = document.querySelector('.chrs'); if (!wrap) return;
  var arts = [].slice.call(wrap.querySelectorAll('.chr')), chips = [].slice.call(document.querySelectorAll('.chip[data-f="ch"]'));
  function show(k) {
    var found = false;
    arts.forEach(function (a) { var on = a.getAttribute('data-ch') === k; a.classList.toggle('on', on); if (on) found = true; });
    if (!found && arts.length) { k = arts[0].getAttribute('data-ch'); arts[0].classList.add('on'); }
    chips.forEach(function (c) { c.classList.toggle('on', c.getAttribute('data-v') === k); });
  }
  function fromHash() { var m = /^#ch-(.+)$/.exec(location.hash); show(m ? decodeURIComponent(m[1]) : (arts[0] ? arts[0].getAttribute('data-ch') : '')); }
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('.chip[data-f="ch"]') : null;
    if (b) { var k = b.getAttribute('data-v'); show(k); try { history.replaceState(null, '', '#ch-' + k); } catch (_) {} return; }
    var t = e.target.closest ? e.target.closest('.chr-th') : null; if (!t) return;
    var a = t.closest('.chr'), img = a.querySelector('.chr-stage img');
    if (img) { img.src = t.getAttribute('data-src'); img.alt = t.getAttribute('data-alt') || ''; }
    [].forEach.call(a.querySelectorAll('.chr-th'), function (x) { x.classList.toggle('on', x === t); });
  });
  window.addEventListener('hashchange', fromHash); fromHash();
})();
/* language selector: closes on outside click / Escape and remembers the choice (used by the redirect on the very first page) */
(function () {
  var d = document.querySelector('details.lang');
  if (!d) return;
  document.addEventListener('click', function (e) { if (d.open && !d.contains(e.target)) d.open = false; });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') d.open = false; });
  d.querySelectorAll('a[data-code]').forEach(function (a) {
    a.addEventListener('click', function () { try { localStorage.setItem('sa2wiki_lang', a.getAttribute('data-code')); } catch (e) {} });
  });
})();
