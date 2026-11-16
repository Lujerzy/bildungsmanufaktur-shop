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
    function norm(t) { return (t || '').toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[–-]/g, ' '); }
    var KL = { gs: ' klasse 1 2 3 4 grundschule ', sek: ' klasse 5 6 7 8 9 10 sek sekundarstufe ', ober: ' klasse 11 12 13 oberstufe ' };
    document.querySelectorAll('[data-grid] .card').forEach(function (c) {
      c._such = norm(c.textContent + ' ' + c.dataset.fach + ' ' + c.dataset.art + ' ' + c.dataset.stufe.split(' ').map(function (x) { return KL[x] || ''; }).join(' ') + (c.dataset.preis === 'gratis' ? ' gratis kostenlos' : '') + (c.dataset.art === 'Sparpaket' ? ' paket bundle' : ''));
    });
    var q = (params.get('q') || '').trim();
    var ls = document.querySelector('[data-livesuche]'), si = document.getElementById('q');
    if (ls) ls.value = q; if (si) si.value = q;
    function treffer(c) {
      if (!q) return true;
      return norm(q).split(/\s+/).filter(Boolean).every(function (w) { return c._such.indexOf(w) >= 0; });
    }
    function suche(v) {
      q = v.trim(); if (ls && ls.value !== v) ls.value = v; if (si && si.value !== v) si.value = v;
      var u = new URL(location.href); if (q) u.searchParams.set('q', q); else u.searchParams.delete('q'); history.replaceState(null, '', u);
      seite = 1; anwenden();
    }
    [ls, si].forEach(function (el) { if (el) el.addEventListener('input', function () { suche(el.value); }); });
    if (si && si.form) si.form.addEventListener('submit', function (e) { e.preventDefault(); suche(si.value); if (ls) ls.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
    var PRO = 24, seite = Math.max(1, parseInt(params.get('seite'), 10) || 1);
    var grid = document.querySelector('[data-grid]'), pager = document.createElement('nav');
    pager.className = 'pager'; pager.setAttribute('aria-label', 'Seiten'); grid.parentNode.insertBefore(pager, grid.nextSibling);
    function blaettern(seiten) {
      var u = new URL(location.href); if (seite > 1) u.searchParams.set('seite', seite); else u.searchParams.delete('seite'); history.replaceState(null, '', u);
      if (seiten < 2) { pager.innerHTML = ''; return; }
      var nr = [], h = '';
      for (var i = 1; i <= seiten; i++) if (i === 1 || i === seiten || Math.abs(i - seite) <= 1) nr.push(i);
      h += '<button type="button" data-s="' + (seite - 1) + '"' + (seite === 1 ? ' disabled' : '') + '>‹ Zurück</button>';
      nr.forEach(function (i, k) {
        if (k && i - nr[k - 1] > 1) h += '<span>…</span>';
        h += '<button type="button" data-s="' + i + '"' + (i === seite ? ' aria-current="page"' : '') + '>' + i + '</button>';
      });
      h += '<button type="button" class="weiter" data-s="' + (seite + 1) + '"' + (seite === seiten ? ' disabled' : '') + '>Weiter ›</button>';
      pager.innerHTML = h;
    }
    pager.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-s]'); if (!b || b.disabled) return;
      seite = parseInt(b.dataset.s, 10); anwenden();
      var top = document.querySelector('.results'); if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    function anwenden() {
      side.querySelectorAll('.pill').forEach(function (p) {
        var g = p.dataset.g, v = p.dataset.v, on;
        if (g === 'stufe' || g === 'preis') on = st[g] === v; else on = st[g].indexOf(v) >= 0;
        p.setAttribute('aria-pressed', on ? 'true' : 'false');
      });
      var n = 0, passt = [];
      document.querySelectorAll('[data-grid] .card').forEach(function (c) {
        var ok = (st.stufe === 'alle' || c.dataset.stufe.split(' ').indexOf(st.stufe) >= 0) &&
          (st.saison.length === 0 || c.dataset.saison === '1') &&
          (st.fach.length === 0 || st.fach.indexOf(c.dataset.fach) >= 0) &&
          (st.preis === 'alle' || c.dataset.preis === st.preis) &&
          (st.art.length === 0 || st.art.indexOf(c.dataset.art) >= 0) &&
          treffer(c);
        c.hidden = true; if (ok) { n++; passt.push(c); }
      });
      var seiten = Math.max(1, Math.ceil(n / PRO)); if (seite > seiten) seite = seiten;
      passt.slice((seite - 1) * PRO, seite * PRO).forEach(function (c) { c.hidden = false; });
      blaettern(seiten);
      document.querySelector('[data-count]').textContent = n === 1 ? '1 Material' : n + ' Materialien';
      document.querySelector('[data-empty]').hidden = n !== 0;
      var eh = document.querySelector('[data-empty] h2'), ep = document.querySelector('[data-empty] p');
      if (eh) { eh.textContent = q ? 'Nichts gefunden für „' + q + '“' : 'Hier wird gerade gebaut'; ep.textContent = q ? 'Probier ein anderes Wort – z. B. das Thema, das Fach oder „Klasse 5“. Oder setze die Filter zurück.' : 'Für diese Auswahl gibt es noch kein Material – das Angebot wächst jede Woche.'; }
    }
    side.addEventListener('click', function (ev) {
      var p = ev.target.closest('.pill');
      if (p) {
        var g = p.dataset.g, v = p.dataset.v;
        if (g === 'stufe' || g === 'preis') st[g] = v;
        else { var i = st[g].indexOf(v); if (i >= 0) st[g].splice(i, 1); else st[g].push(v); }
        seite = 1; anwenden();
      }
      if (ev.target.closest('[data-reset]')) { st = { stufe: 'alle', preis: 'alle', fach: [], art: [], saison: [] }; suche(''); }
    });
    anwenden();
  }


  // Newsletter-Formulare (Startseite, Danke-Seite, Gratis-Material, Newsletter-Seite)
  document.querySelectorAll('[data-nl]').forEach(function (f) {
    var o = f.parentNode.querySelector('[data-nl-ok]');
    var pe = new URLSearchParams(location.search).get('email'); if (pe && f.email) f.email.value = pe;
    f.addEventListener('submit', function (e) {
      e.preventDefault(); var b = f.querySelector('button'); b.disabled = true;
      fetch('/api/newsletter', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: f.email.value, website: f.website.value }) })
        .then(function (r) { return r.json(); })
        .then(function (d) { o.style.display = 'block'; if (d.ok) { f.style.display = 'none'; o.textContent = 'Fast geschafft! Bitte schau in dein Postfach (auch im Spam-Ordner) und bestätige die Anmeldung.'; } else { b.disabled = false; o.textContent = d.fehler || 'Das hat nicht geklappt.'; } })
        .catch(function () { b.disabled = false; o.style.display = 'block'; o.textContent = 'Das hat nicht geklappt. Bitte versuch es später noch einmal.'; });
    });
  });

  // Handy: Lupe öffnet das Suchfeld im Kopf
  var sb = document.querySelector('[data-suche]');
  if (sb) sb.addEventListener('click', function () {
    var h = document.querySelector('.site-head'), auf = h.classList.toggle('suche-offen');
    sb.setAttribute('aria-expanded', auf ? 'true' : 'false');
    if (auf) { var f = document.getElementById('q'); if (f) f.focus(); }
  });

  // Material-Karten: durch Deckblatt + Vorschauseiten wischen; am PC beim Drüberfahren automatisch
  document.querySelectorAll('.card .ctrack').forEach(function (tr) {
    var n = tr.children.length, dots = tr.parentNode.querySelector('.cdots'), t = null, i = 0;
    if (n < 2 || !dots) return;
    for (var k = 0; k < n; k++) dots.appendChild(document.createElement('i'));
    function mark(x) { i = x; [].forEach.call(dots.children, function (d, j) { d.className = j === x ? 'on' : ''; }); }
    mark(0);
    var to; tr.addEventListener('scroll', function () { clearTimeout(to); to = setTimeout(function () { mark(Math.round(tr.scrollLeft / tr.clientWidth)); }, 60); }, { passive: true });
    var pic = tr.parentNode, ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (window.matchMedia('(hover:hover)').matches && !ruhig) {
      pic.addEventListener('mouseenter', function () { clearInterval(t); t = setInterval(function () { var x = (i + 1) % n; tr.scrollTo({ left: x * tr.clientWidth, behavior: 'smooth' }); mark(x); }, 1100); });
      pic.addEventListener('mouseleave', function () { clearInterval(t); tr.scrollTo({ left: 0, behavior: 'smooth' }); mark(0); });
    }
  });

  // Produkt-Galerie: wischen (Handy), Pfeile + automatisches Weiterblättern (PC)
  var track = document.querySelector('[data-track]');
  if (track) {
    var slides = [].slice.call(track.children), thumbs = [].slice.call(document.querySelectorAll('[data-thumb]'));
    var dots = document.querySelector('[data-dots]'), idx = 0, timer = null, stop = false;
    if (dots && slides.length > 1) slides.forEach(function (_, i) { var b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', 'Bild ' + (i + 1)); b.onclick = function () { stop = true; geh(i); }; dots.appendChild(b); });
    function markiere(i) {
      idx = i;
      thumbs.forEach(function (t, j) { t.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
      if (dots) [].forEach.call(dots.children, function (d, j) { d.setAttribute('aria-current', j === i ? 'true' : 'false'); });
      var z = document.querySelector('[data-zaehler]'); if (z) z.textContent = (i + 1) + ' / ' + slides.length;
    }
    function geh(i) { i = (i + slides.length) % slides.length; track.scrollTo({ left: slides[i].offsetLeft - track.offsetLeft, behavior: 'smooth' }); markiere(i); }
    var t0; track.addEventListener('scroll', function () { clearTimeout(t0); t0 = setTimeout(function () { markiere(Math.round(track.scrollLeft / track.clientWidth)); }, 80); });
    thumbs.forEach(function (t, j) { t.addEventListener('click', function () { stop = true; geh(j); }); });
    var pv = document.querySelector('[data-prev]'), nx = document.querySelector('[data-next]');
    if (pv) pv.onclick = function () { stop = true; geh(idx - 1); };
    if (nx) nx.onclick = function () { stop = true; geh(idx + 1); };
    track.addEventListener('pointerdown', function () { stop = true; });
    var pc = window.matchMedia('(hover:hover) and (min-width:900px)').matches, ruhig = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (pc && !ruhig && slides.length > 1) {
      var box = track.closest('.slider'), pause = false;
      box.addEventListener('mouseenter', function () { pause = true; }); box.addEventListener('mouseleave', function () { pause = false; });
      timer = setInterval(function () { if (!stop && !pause && !document.hidden) geh(idx + 1); }, 3500);
    }
    markiere(0);
  }

  // Probeseite als PDF (Bild mit Wasserzeichen in eine A4-Seite)
  document.querySelectorAll('[data-probe]').forEach(function (b) {
    b.addEventListener('click', function () {
      var url = b.dataset.probe, name = b.dataset.name || 'Probeseite';
      Promise.all([fetch(url).then(function (r) { return r.arrayBuffer(); }), new Promise(function (ok) { var im = new Image(); im.onload = function () { ok(im); }; im.src = url; })]).then(function (r) {
        var jpg = new Uint8Array(r[0]), w = r[1].naturalWidth, h = r[1].naturalHeight;
        var PW = 595.28, PH = 841.89, sc = Math.min(PW / w, PH / h), dw = w * sc, dh = h * sc, dx = (PW - dw) / 2, dy = (PH - dh) / 2;
        var inhalt = 'q ' + dw.toFixed(2) + ' 0 0 ' + dh.toFixed(2) + ' ' + dx.toFixed(2) + ' ' + dy.toFixed(2) + ' cm /Im1 Do Q';
        var enc = new TextEncoder(), teile = [], off = [], len = 0;
        function add(x) { var u = typeof x === 'string' ? enc.encode(x) : x; teile.push(u); len += u.length; }
        add('%PDF-1.4\n');
        var objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
          '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PW + ' ' + PH + '] /Resources << /XObject << /Im1 4 0 R >> >> /Contents 5 0 R >>'];
        objs.forEach(function (o, i) { off.push(len); add((i + 1) + ' 0 obj\n' + o + '\nendobj\n'); });
        off.push(len); add('4 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + w + ' /Height ' + h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpg.length + ' >>\nstream\n'); add(jpg); add('\nendstream\nendobj\n');
        off.push(len); add('5 0 obj\n<< /Length ' + inhalt.length + ' >>\nstream\n' + inhalt + '\nendstream\nendobj\n');
        var xref = len, x = 'xref\n0 6\n0000000000 65535 f \n' + off.map(function (o) { return ('0000000000' + o).slice(-10) + ' 00000 n \n'; }).join('');
        add(x + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF');
        var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(teile, { type: 'application/pdf' })); a.download = name + '_Probeseite.pdf'; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
      });
    });
  });

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
