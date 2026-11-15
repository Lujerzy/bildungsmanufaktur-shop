(function () {
  'use strict';
  var KEY = 'bm-warenkorb';
  function lesen() { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; } }
  function schreiben(items) { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch (e) {} zaehler(); }
  function zaehler() {
    var n = lesen().length;
    document.querySelectorAll('.cart-count').forEach(function (el) { el.textContent = n; el.setAttribute('data-n', n); });
  }

  // In den Warenkorb
  document.addEventListener('click', function (ev) {
    var b = ev.target.closest('[data-add]');
    if (!b) return;
    ev.preventDefault();
    var lic = document.querySelector('input[name=lizenz]:checked');
    var items = lesen().filter(function (x) { return x.id !== b.dataset.add; });
    items.push({ id: b.dataset.add, lizenz: lic ? lic.value : 'Einzellizenz' });
    schreiben(items);
    window.location.href = '/warenkorb.html';
  });

  // Startseiten-Filter
  var bar = document.querySelector('[data-filterbar]');
  if (bar) {
    bar.addEventListener('click', function (ev) {
      var p = ev.target.closest('.pill'); if (!p) return;
      bar.querySelectorAll('.pill').forEach(function (x) { x.setAttribute('aria-pressed', x === p ? 'true' : 'false'); });
      var f = p.dataset.f;
      document.querySelectorAll('[data-grid] .card').forEach(function (c) {
        var tags = c.dataset.tags.split(' ');
        c.hidden = !(f === 'alle' || tags.indexOf(f) >= 0);
      });
    });
  }

  // Materialien-Filter
  var side = document.querySelector('[data-filters]');
  if (side) {
    var tg = side.querySelector('.ftoggle'); if (tg && window.matchMedia('(max-width:720px)').matches) tg.open = false;
    var params = new URLSearchParams(location.search);
    var st = { stufe: params.get('stufe') || 'alle', preis: 'alle', fach: [], art: [], saison: [] };
    if (params.get('saison')) st.saison.push('1');
    if (params.get('fach')) st.fach.push(params.get('fach'));
    if (params.get('art')) st.art.push(params.get('art'));
    if (params.get('preis')) st.preis = params.get('preis');
    var q = (params.get('q') || '').trim().toLowerCase();
    if (q) { var si = document.getElementById('q'); if (si) si.value = params.get('q'); }
    function anwenden() {
      side.querySelectorAll('.pill').forEach(function (p) {
        var g = p.dataset.g, v = p.dataset.v, on;
        if (g === 'stufe' || g === 'preis') on = st[g] === v; else on = st[g].indexOf(v) >= 0;
        p.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      var n = 0;
      document.querySelectorAll('[data-grid] .card').forEach(function (c) {
        var ok = (st.stufe === 'alle' || c.dataset.stufe.split(' ').indexOf(st.stufe) >= 0) &&
          (st.saison.length === 0 || c.dataset.saison === '1') &&
          (st.fach.length === 0 || st.fach.indexOf(c.dataset.fach) >= 0) &&
          (st.preis === 'alle' || c.dataset.preis === st.preis) &&
          (st.art.length === 0 || st.art.indexOf(c.dataset.art) >= 0) &&
          (!q || c.textContent.toLowerCase().indexOf(q) >= 0);
        c.hidden = !ok; if (ok) n++;
      });
      document.querySelector('[data-count]').textContent = n === 1 ? '1 Material' : n + ' Materialien';
      document.querySelector('[data-empty]').hidden = n !== 0;
    }
    side.addEventListener('click', function (ev) {
      var p = ev.target.closest('.pill');
      if (p) {
        var g = p.dataset.g, v = p.dataset.v;
        if (g === 'stufe' || g === 'preis') st[g] = v;
        else { var i = st[g].indexOf(v); if (i >= 0) st[g].splice(i, 1); else st[g].push(v); }
        anwenden();
      }
      if (ev.target.closest('[data-reset]')) { st = { stufe: 'alle', preis: 'alle', fach: [], art: [], saison: [] }; q = ''; anwenden(); }
    });
    anwenden();
  }

  // Produkt-Galerie
  var main = document.querySelector('[data-main]');
  if (main) {
    document.querySelectorAll('[data-thumb]').forEach(function (t) {
      t.addEventListener('click', function () {
        main.src = t.dataset.thumb; main.alt = t.getAttribute('aria-label');
        document.querySelectorAll('[data-thumb]').forEach(function (x) { x.setAttribute('aria-pressed', x === t ? 'true' : 'false'); });
      });
    });
  }

  // Warenkorb-Seite
  var list = document.querySelector('[data-cart]');
  if (list) {
    var katalog = window.BM_KATALOG || {};
    function euro(x) { return x.toFixed(2).replace('.', ',') + ' €'; }
    function zeichnen() {
      var items = lesen(), summe = 0;
      list.innerHTML = '';
      document.querySelector('[data-cart-empty]').hidden = items.length > 0;
      items.forEach(function (it) {
        var m = katalog[it.id]; if (!m) return;
        var d = document.createElement('div'); d.className = 'ci';
        d.innerHTML = '<img src="' + m.img + '" alt="">' +
          '<div class="t"><a href="/material/' + it.id + '.html"></a><span class="small muted"></span>' +
          '<button type="button" class="linkbtn small">Entfernen</button></div><span class="price"></span>';
        d.querySelector('a').textContent = m.titel;
        d.querySelector('.small.muted').textContent = m.stufe + ' · ' + it.lizenz + ' · PDF-Download';
        var p = it.lizenz === 'Schullizenz' ? m.schul : m.preis; summe += p;
        d.querySelector('.price').textContent = euro(p);
        d.querySelector('button').addEventListener('click', function () { schreiben(lesen().filter(function (x) { return x.id !== it.id; })); zeichnen(); });
        list.appendChild(d);
      });
      var n = items.length;
      document.querySelector('[data-cart-n]').textContent = n === 1 ? '1 Material' : n + ' Materialien';
      document.querySelectorAll('[data-cart-sum]').forEach(function (el) { el.textContent = euro(summe); });
    }
    zeichnen();
  }

  // Kasse
  var kasse = document.querySelector('[data-checkout]');
  if (kasse) {
    kasse.addEventListener('click', function () {
      var msg = document.querySelector('[data-checkout-msg]');
      var mail = document.querySelector('[data-mail]').value.trim();
      var ok = document.querySelector('[data-consent]').checked;
      var items = lesen();
      function fehler(t) { msg.textContent = t; msg.style.color = '#C0392B'; }
      if (!items.length) return fehler('Dein Warenkorb ist leer.');
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) return fehler('Bitte gib deine E-Mail-Adresse ein.');
      if (!ok) return fehler('Bitte bestätige den Hinweis zum Widerrufsrecht.');
      kasse.disabled = true; kasse.textContent = 'Einen Moment …';
      fetch('/api/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items, email: mail, zustimmung: ok }) })
        .then(function (r) { return r.json(); })
        .then(function (d) { if (d.url) { window.location.href = d.url; } else { throw new Error(d.fehler || 'Fehler'); } })
        .catch(function (e) { kasse.disabled = false; kasse.textContent = 'Zahlungspflichtig bestellen'; fehler(e.message || 'Die Bezahlung konnte nicht gestartet werden.'); });
    });
  }

  zaehler();
})();
