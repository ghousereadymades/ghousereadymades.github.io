/* Ghouse Readymades — storefront app (static, no server) */
(function () {
  "use strict";

  var S = window.STORE, PRODUCTS = window.PRODUCTS, CATS = window.CATEGORIES, I18N = window.I18N;
  var byId = {};
  PRODUCTS.forEach(function (p) { byId[p.id] = p; });

  /* ---------- pricing: offer price vs regular price ---------- */
  function offerEnd() { return S.offer && S.offer.endsOn ? new Date(S.offer.endsOn + "T23:59:59") : null; }
  function offerOn() {
    if (!S.offer || !S.offer.active) return false;
    var end = offerEnd();
    return !end || isNaN(end) || Date.now() <= end.getTime();
  }
  function priceOf(p) {
    if (offerOn() && p.onOffer !== false) return S.offer.price;
    return p.regularPrice > 0 ? p.regularPrice : null;
  }
  function wasOf(p) { var pr = priceOf(p); return pr != null && p.regularPrice > pr ? p.regularPrice : null; }
  function buyable(p) { return p.inStock; }

  /* ---------- helpers ---------- */
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  };
  var db = {
    get: function (k, d) { try { var v = localStorage.getItem("gr_" + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem("gr_" + k, JSON.stringify(v)); } catch (e) { /* storage unavailable */ } }
  };

  var state = {
    lang: db.get("lang", "ta"),
    cart: db.get("cart", []),
    wish: db.get("wish", []),
    recent: db.get("recent", []),
    orders: db.get("orders", []),
    customer: db.get("customer", null),
    sort: "featured"
  };
  state.cart = state.cart.filter(function (i) { return byId[i.id] && buyable(byId[i.id]); });

  function t(k, vars, lang) {
    var L = I18N[lang || state.lang] || I18N.en;
    var s = L[k] != null ? L[k] : (I18N.en[k] != null ? I18N.en[k] : k);
    if (S.offer) s = s.split("{price}").join(S.offer.price);
    if (vars) Object.keys(vars).forEach(function (x) { s = s.split("{" + x + "}").join(vars[x]); });
    return s;
  }
  function loc(obj, lang) { return obj ? (obj[lang || state.lang] || obj.en || "") : ""; }
  function pname(p, lang) { return p[lang || state.lang] || p.en; }
  function altName(p) { return state.lang === "ta" ? p.en : p.ta; }
  function offerKey(k) { return offerOn() ? k : k + "Off"; }
  function priceHtml(p, big) {
    var pr = priceOf(p), was = wasOf(p);
    if (pr == null) return '<span class="price price--ask">' + t("p.priceWa") + '</span>';
    return big ? (was ? '<s>' + money(was) + '</s>' : "") + '<b>' + money(pr) + '</b>'
               : '<span class="price">' + (was ? '<s>' + money(was) + '</s>' : "") + money(pr) + '</span>';
  }
  function offerEndsText() {
    var end = offerEnd(); if (!end || isNaN(end)) return "";
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var days = Math.round((new Date(end.getFullYear(), end.getMonth(), end.getDate()) - today) / 864e5);
    if (days <= 0) return t("offer.endsToday");
    var d = end.toLocaleDateString(state.lang === "ta" ? "ta-IN" : "en-IN", { day: "numeric", month: "short" });
    return t("offer.ends", { date: d }) + (days <= 7 ? " · " + t("offer.left", { n: days }) : "");
  }
  function money(n) { return S.currency + Number(n).toLocaleString("en-IN"); }
  function optLabel(k, lang) { return loc(window.OPTION_LABELS[k] || { en: k }, lang); }
  function optVal(v, lang) { return (lang || state.lang) === "ta" ? (window.OPTION_VALUES_TA[v] || v) : v; }
  function colorById(id) { return window.COLORS.filter(function (c) { return c.id === id; })[0] || window.COLORS[0]; }
  function waLink(text) { return "https://wa.me/" + S.whatsapp + "?text=" + encodeURIComponent(text); }
  function pageUrl(hash) { return "https://" + S.siteUrl + "/" + (hash || ""); }
  function productUrl(p) { return pageUrl("product/" + p.id + "/"); }
  function media(p, cls) {
    if (p.images && p.images.length)
      return '<img class="' + (cls || "") + '" src="' + esc(p.images[0]) + '" alt="' + esc(pname(p)) + '" loading="lazy">';
    return window.productArt(p);
  }

  /* ---------- toast ---------- */
  var toastTimer;
  function toast(msg, action) {
    var el = $("#toast");
    el.innerHTML = '<span>' + esc(msg) + '</span>' + (action ? '<a href="' + action.href + '">' + esc(action.label) + '</a>' : "");
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 2800);
  }

  /* ---------- cart ---------- */
  function lineKey(id, opts) {
    return id + "|" + Object.keys(opts || {}).sort().map(function (k) { return k + "=" + opts[k]; }).join("&");
  }
  function saveCart() { db.set("cart", state.cart); updateBadges(); renderDrawer(); }
  function addToCart(id, opts, qty) {
    var key = lineKey(id, opts);
    var line = state.cart.filter(function (l) { return l.key === key; })[0];
    if (line) line.qty = Math.min(99, line.qty + qty);
    else state.cart.push({ key: key, id: id, opts: opts || {}, qty: qty });
    saveCart();
    bump();
  }
  function setQty(key, qty) {
    state.cart = state.cart.map(function (l) { if (l.key === key) l.qty = qty; return l; }).filter(function (l) { return l.qty > 0; });
    saveCart();
  }
  function count() { return state.cart.reduce(function (a, l) { return a + l.qty; }, 0); }
  function subtotal() { return state.cart.reduce(function (a, l) { return a + l.qty * (priceOf(byId[l.id]) || 0); }, 0); }
  function unpriced() { return state.cart.reduce(function (a, l) { return a + (priceOf(byId[l.id]) == null ? l.qty : 0); }, 0); }
  function moneyOr(v) { return v == null || isNaN(v) ? t("p.priceTbc") : money(v); }
  function shippingFor(method) { return count() && method !== "pickup" ? S.shipping.fee : 0; }
  function perItem(n, sub) { return Math.round((sub + S.shipping.fee) / n); }
  function bump() {
    ["#cartBtn", ".bnav__cart"].forEach(function (s) {
      var el = $(s); if (!el) return;
      el.classList.remove("bump"); void el.offsetWidth; el.classList.add("bump");
    });
  }
  function updateBadges() {
    var n = count();
    [["#cartCount", n], ["#bnavCount", n], ["#wishCount", state.wish.length]].forEach(function (b) {
      var el = $(b[0]); el.textContent = b[1]; el.hidden = !b[1];
    });
  }
  function optsText(opts, lang) {
    return Object.keys(opts || {}).sort(function (a, b) { return (a === "color") - (b === "color"); }).map(function (k) {
      var v = k === "color" ? loc(colorById(opts[k]), lang) : optVal(opts[k], lang);
      return optLabel(k, lang) + ": " + v;
    }).join(" · ");
  }

  /* ---------- wishlist / recent ---------- */
  function toggleWish(id) {
    var i = state.wish.indexOf(id);
    if (i > -1) { state.wish.splice(i, 1); toast(t("wish.removed")); }
    else { state.wish.unshift(id); toast(t("wish.added"), { href: "#/wishlist", label: t("nav.wishlist") }); }
    db.set("wish", state.wish);
    updateBadges();
    $$('[data-wish="' + id + '"]').forEach(function (b) {
      b.setAttribute("aria-pressed", state.wish.indexOf(id) > -1);
      if (b.dataset.label) b.querySelector("span").textContent = state.wish.indexOf(id) > -1 ? t("p.wishRemove") : t("p.wishAdd");
    });
    if (currentRoute === "wishlist") render();
  }
  function pushRecent(id) {
    state.recent = [id].concat(state.recent.filter(function (x) { return x !== id; })).slice(0, 8);
    db.set("recent", state.recent);
  }

  /* ---------- components ---------- */
  var heart = '<svg viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3.3 5 6.8 5c2 0 3.4 1.1 4.2 2.4h2C13.8 6.1 15.2 5 17.2 5c3.5 0 5.6 3.6 4.3 6.8C19.5 16.4 12 21 12 21z"/></svg>';
  var waIcon = '<svg viewBox="0 0 32 32" class="wa-i"><path fill="currentColor" d="M16 3a13 13 0 0 0-11.2 19.6L3 29l6.6-1.7A13 13 0 1 0 16 3zm0 23.7a10.7 10.7 0 0 1-5.5-1.5l-.4-.2-3.9 1 1-3.8-.3-.4A10.7 10.7 0 1 1 16 26.7zm5.9-8c-.3-.2-1.9-1-2.2-1-.3-.1-.5-.2-.7.1l-1 1.3c-.2.2-.4.2-.7.1a8.8 8.8 0 0 1-4.4-3.8c-.3-.6.3-.5 1-1.8.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6a1.2 1.2 0 0 0-.9.4 3.7 3.7 0 0 0-1.1 2.7 6.4 6.4 0 0 0 1.3 3.4 14.7 14.7 0 0 0 5.7 5c2.1.9 2.9 1 4 .8.6-.1 1.9-.8 2.2-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.3-.6-.4z"/></svg>';

  var igIcon = '<svg viewBox="0 0 24 24" class="soc-i" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>';
  var fbIcon = '<svg viewBox="0 0 24 24" class="soc-i"><path fill="currentColor" d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.5-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.8 1.4-3.8 3.9v2.3H7.9v3h2.6V21z"/></svg>';
  var ytIcon = '<svg viewBox="0 0 24 24" class="soc-i"><path fill="currentColor" d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3z"/></svg>';
  function groupCta() {
    if (!S.whatsappGroup) return "";
    return '<div class="group-cta"><div><b>📢 ' + t("group.title") + '</b><span>' + t("group.sub") + '</span></div>' +
      '<a class="btn btn--wa" target="_blank" rel="noopener" href="' + esc(S.whatsappGroup) + '">' + waIcon + t("group.btn") + '</a></div>';
  }
  function socialButtons() {
    return (S.instagram ? '<a class="btn btn--ig" target="_blank" rel="noopener" href="' + esc(S.instagram) + '">' + igIcon + 'Instagram</a>' : "") +
      (S.facebook ? '<a class="btn btn--fb" target="_blank" rel="noopener" href="' + esc(S.facebook) + '">' + fbIcon + 'Facebook</a>' : "");
  }

  function card(p) {
    var inWish = state.wish.indexOf(p.id) > -1;
    return '<article class="card' + (p.inStock ? "" : " is-out") + '" style="--h:' + p.tint + '">' +
      '<a class="card__media" href="#/p/' + p.id + '" aria-label="' + esc(pname(p)) + '">' + media(p) +
      '<span class="card__tag">' + esc(loc(p.tag)) + '</span>' +
      (offerOn() && p.onOffer !== false && p.inStock ? '<span class="card__offer">' + t("offer.badge") + (wasOf(p) ? ' −' + Math.round((1 - priceOf(p) / wasOf(p)) * 100) + '%' : "") + '</span>' : "") +
      (p.inStock ? "" : '<span class="card__out">' + t("card.soldout") + '</span>') + '</a>' +
      '<button class="card__wish" type="button" data-wish="' + p.id + '" aria-pressed="' + inWish + '" aria-label="' + t("p.wishAdd") + '">' + heart + '</button>' +
      '<div class="card__body">' +
      '<a class="card__name" href="#/p/' + p.id + '">' + esc(pname(p)) + '</a>' +
      '<div class="card__alt">' + esc(altName(p)) + '</div>' +
      '<div class="card__row">' +
      priceHtml(p) +
      (buyable(p) ? '<button class="btn-add" type="button" data-quick="' + p.id + '"><b>+</b> ' + t("card.add") + '</button>'
        : '<span class="muted small">' + t("card.soldout") + '</span>') +
      '</div></div></article>';
  }
  function grid(list) { return '<div class="grid">' + list.map(card).join("") + '</div>'; }

  /* Option picker (used on product page and quick-add sheet) */
  var pickers = {};
  function defaultSel(p) {
    var sel = {};
    p.options.forEach(function (o) { if (o.values.length === 1) sel[o.key] = o.values[0]; });
    if (p.colors) sel.color = "any";
    return sel;
  }
  function pickerHtml(scope, p) {
    var pk = pickers[scope] = { id: p.id, sel: defaultSel(p), qty: 1 };
    var h = "";
    p.options.forEach(function (o) {
      h += '<div class="opt" data-optgroup="' + o.key + '"><div class="opt__label">' + optLabel(o.key) +
        ' <span class="opt__err" hidden>' + t("p.choose", { opt: optLabel(o.key) }) + '</span></div><div class="chips">' +
        o.values.map(function (v) {
          return '<button type="button" class="chip' + (pk.sel[o.key] === v ? " on" : "") + '" data-scope="' + scope + '" data-opt="' + o.key + '" data-val="' + esc(v) + '">' + esc(optVal(v)) + '</button>';
        }).join("") + '</div></div>';
    });
    if (p.colors) {
      h += '<div class="opt"><div class="opt__label">' + optLabel("color") + ': <b class="opt__cur" data-colorname="' + scope + '">' + esc(loc(colorById(pk.sel.color))) + '</b></div><div class="swatches">' +
        window.COLORS.map(function (c) {
          return '<button type="button" class="sw' + (pk.sel.color === c.id ? " on" : "") + '" data-scope="' + scope + '" data-opt="color" data-val="' + c.id + '" title="' + esc(loc(c)) + '" aria-label="' + esc(loc(c)) + '" style="--c:' + c.hex + '"></button>';
        }).join("") + '</div><p class="hint">' + t("p.colorNote") + '</p></div>';
    }
    h += '<div class="opt"><div class="opt__label">' + t("p.qty") + '</div>' +
      '<div class="stepper"><button type="button" data-step="-1" data-scope="' + scope + '" aria-label="-">−</button><output data-qty="' + scope + '">1</output><button type="button" data-step="1" data-scope="' + scope + '" aria-label="+">+</button></div></div>';
    return h;
  }
  function pickerValid(scope, root) {
    var pk = pickers[scope], p = byId[pk.id], ok = true;
    var first = null;
    p.options.forEach(function (o) {
      var g = $('[data-optgroup="' + o.key + '"]', root);
      var missing = !pk.sel[o.key];
      if (g) {
        $(".opt__err", g).hidden = !missing;
        g.classList.remove("shake"); g.classList.toggle("opt--missing", missing);
        if (missing) { void g.offsetWidth; g.classList.add("shake"); }
      }
      if (missing && !first) first = [o, g];
    });
    if (first) {
      toast("⚠️ " + t("p.choose", { opt: optLabel(first[0].key) }));
      if (first[1]) first[1].scrollIntoView({ behavior: "smooth", block: "center" });
      ok = false;
    }
    return ok;
  }
  function pickerCommit(scope, root) {
    if (!pickerValid(scope, root)) return false;
    var pk = pickers[scope];
    addToCart(pk.id, Object.assign({}, pk.sel), pk.qty);
    return true;
  }

  /* ---------- views ---------- */
  var currentRoute = "home";
  var views = {};

  views.home = function () {
    var featured = PRODUCTS.slice(0, 8);
    var collage = ["readymade-jacket", "palazzo-pant", "burqa-shawl"].map(function (id, i) {
      var p = byId[id];
      return '<a class="float-card f' + i + '" href="#/p/' + id + '" style="--h:' + p.tint + '">' + media(p) + '<span>' + esc(pname(p)) + '</span></a>';
    }).join("");
    var catCards = CATS.filter(function (c) { return c.id !== "all"; }).map(function (c) {
      var p = PRODUCTS.filter(function (x) { return x.cat === c.id; })[0];
      var n = PRODUCTS.filter(function (x) { return x.cat === c.id; }).length;
      return '<a class="cat" href="#/shop?cat=' + c.id + '" style="--h:' + p.tint + '"><span class="cat__art">' + media(p) + '</span><b>' + esc(loc(c)) + '</b><small>' + t("cart.items", { n: n }) + '</small></a>';
    }).join("");

    return '' +
      '<section class="hero">' +
        '<div class="hero__text">' +
          '<p class="kicker">' + t("hero.kicker") + '</p>' +
          '<h1><span>' + t(offerOn() ? "hero.title1" : "hero.off1") + '</span> <em>' + t(offerOn() ? "hero.title2" : "hero.off2") + '</em></h1>' +
          (offerOn() && offerEndsText() ? '<p class="offer-ends">⏰ ' + offerEndsText() + '</p>' : "") +
          '<p class="hero__sub">' + t("hero.sub") + '</p>' +
          '<div class="hero__cta"><a class="btn btn--primary btn--lg" href="#/shop">' + t(offerKey("hero.cta")) + ' →</a>' +
          '<a class="btn btn--wa btn--lg" target="_blank" rel="noopener" href="' + waLink(t("wa.hello")) + '">' + waIcon + t("hero.cta2") + '</a></div>' +
          '<ul class="trust"><li>🛍️ ' + t("hero.trust1") + '</li><li>🚚 ' + t("hero.trust2") + '</li><li>💬 ' + t("hero.trust3") + '</li></ul>' +
        '</div>' +
        '<div class="hero__art">' +
          (offerOn() ? '<div class="stamp"><span>' + t("hero.stamp1") + '</span><b>' + money(S.offer.price) + '</b><span>' + t("hero.stamp2") + '</span></div>'
                     : '<div class="stamp stamp--ship"><span>' + t("hero.stampOff1") + '</span><b>' + money(S.shipping.fee) + '</b><span>' + t("hero.stampOff2") + '</span></div>') +
          collage +
        '</div>' +
      '</section>' +

      '<section class="section"><div class="sec-head"><h2>' + t("cats.title") + '</h2></div><div class="cats">' + catCards + '</div></section>' +

      '<section class="section"><div class="sec-head"><h2>' + t(offerKey("featured.title")) + '</h2><a class="link" href="#/shop">' + t("featured.all") + ' →</a></div>' +
        (offerOn() ? '<p class="stock-pill">⏳ ' + t("stock.note") + '</p>' : "") + grid(featured) +
        '<div class="center"><a class="btn btn--ghost" href="#/shop">' + t("featured.all") + ' (' + PRODUCTS.length + ') →</a></div></section>' +

      '<section class="section ship">' +
        '<div class="ship__text"><h2>' + t("ship.title") + '</h2><p>' + t("ship.sub") + '</p>' +
          (offerOn() ? '<label class="ship__range"><input type="range" min="1" max="10" value="3" id="shipRange" aria-label="items"></label>' +
          '<div class="ship__out" id="shipOut"></div>' : "") + '</div>' +
        '<div class="ship__truck" aria-hidden="true"><div class="truck"><span>ST COURIER</span></div><div class="road"></div></div>' +
      '</section>' +

      '<section class="section"><div class="sec-head"><h2>' + t("how.title") + '</h2></div><ol class="steps">' +
        [1, 2, 3].map(function (i) { return '<li><span class="steps__n">' + i + '</span><b>' + t("how." + i + "t") + '</b><p>' + t("how." + i + "d") + '</p></li>'; }).join("") +
      '</ol></section>' +

      youtubeSection() +
      (S.whatsappGroup ? '<section class="section">' + groupCta() + '</section>' : "") +

      '<section class="section poster' + (offerOn() ? "" : " poster--noimg") + '"><div class="poster__text"><h2>' + t(offerOn() ? "poster.title" : "why.title") + '</h2>' + (offerOn() ? '<p>' + t("poster.sub") + '</p>' : "") +
        '<ul class="why">' + [1, 2, 3, 4].map(function (i) { var k = i === 1 && !offerOn() ? "Off" : ""; return '<li><b>' + t("why." + i + "t" + k) + '</b><span>' + t("why." + i + "d" + k) + '</span></li>'; }).join("") + '</ul>' +
        '<a class="btn btn--primary" href="#/shop">' + t(offerKey("hero.cta")) + ' →</a></div>' +
        (offerOn() ? '<figure class="poster__img"><img src="images/price-list.jpg" alt="Ghouse Readymades offer price list" loading="lazy" width="1123" height="1600"></figure>' : "") +
      '</section>' +

      faqSection(true);
  };

  function youtubeSection() {
    var vids = (S.youtube && S.youtube.videos) || [];
    var body;
    if (vids.length) {
      body = '<div class="yt-grid">' + vids.map(function (v) {
        return '<button type="button" class="yt-lite" data-yt="' + esc(v.id) + '" style="background-image:url(https://i.ytimg.com/vi/' + esc(v.id) + '/hqdefault.jpg)"><span class="yt-play"></span><span class="yt-title">' + esc(loc(v.title)) + '</span></button>';
      }).join("") + '</div>';
    } else {
      var ch = /\/channel\/UC([\w-]+)/.exec(S.youtube.channelUrl || "");
      var screen = '<div class="yt-screen">' + media(byId["fancy-jacket"]) + '<span class="yt-play"></span>' + (offerOn() ? '<span class="yt-price">' + money(S.offer.price) + '</span>' : "") +
        (ch ? '<span class="yt-latest">▶ ' + t("yt.latest") + '</span>' : "") + '</div>';
      body = ch ? '<button type="button" class="yt-mock yt-mock--btn" data-ytlist="UU' + esc(ch[1]) + '" aria-label="' + esc(t("yt.latest")) + '">' + screen + '</button>'
                : '<div class="yt-mock" aria-hidden="true">' + screen + '</div>';
    }
    return '<section class="section yt"><div class="yt__text"><span class="yt__logo">▶ YouTube</span><h2>' + t("yt.title") + '</h2><p>' + t("yt.sub") + '</p>' +
      '<ul class="ticks"><li>' + t("yt.p1") + '</li><li>' + t("yt.p2") + '</li><li>' + t("yt.p3") + '</li></ul>' +
      '<div class="yt__btns"><a class="btn btn--yt" href="' + esc(S.youtube.channelUrl) + '?sub_confirmation=1" target="_blank" rel="noopener">🔔 ' + t("yt.sub_btn") + '</a>' +
      '<a class="btn btn--ghost" href="' + esc(S.youtube.channelUrl) + '" target="_blank" rel="noopener">▶ ' + t("yt.btn") + '</a></div></div>' + body + '</section>';
  }

  function faqSection(withContact) {
    return '<section class="section faq"><div class="sec-head"><h2>' + t("faq.title") + '</h2></div>' +
      [1, 2, 3, 4, 5, 6].map(function (i) { return '<details><summary>' + t("faq.q" + i) + '</summary><p>' + t("faq.a" + i) + '</p></details>'; }).join("") +
      (withContact ? '<div class="faq__cta"><a class="btn btn--wa" target="_blank" rel="noopener" href="' + waLink(t("wa.hello")) + '">' + waIcon + t("about.chat") + '</a><a class="btn btn--ghost" href="tel:' + S.phone + '">📞 ' + S.phoneDisplay + '</a></div>' : "") +
      '</section>';
  }

  function searchMatch(p, q) {
    if (!q) return true;
    var hay = [p.en, p.ta, p.keywords, p.code, p.cat, loc(p.tag, "en"), loc(p.tag, "ta")].join(" ").toLowerCase();
    return q.toLowerCase().split(/\s+/).every(function (w) { return hay.indexOf(w) > -1; });
  }

  views.shop = function (parts, qs) {
    var cat = qs.get("cat") || "all", q = (qs.get("q") || "").trim();
    var list = PRODUCTS.filter(function (p) { return (cat === "all" || p.cat === cat) && searchMatch(p, q); });
    if (state.sort !== "featured") {
      list = list.slice().sort(function (a, b) { return pname(a).localeCompare(pname(b), state.lang); });
      if (state.sort === "za") list.reverse();
    }
    var chips = CATS.map(function (c) {
      return '<a class="chip' + (c.id === cat ? " on" : "") + '" href="#/shop?cat=' + c.id + (q ? "&q=" + encodeURIComponent(q) : "") + '" data-nav-soft>' + esc(loc(c)) + '</a>';
    }).join("");
    return '<section class="section">' +
      '<div class="sec-head"><h1>' + (q ? esc(t("shop.searchFor", { q: q })) : cat !== "all" ? esc(loc(CATS.filter(function (c) { return c.id === cat; })[0] || CATS[0])) : t("shop.title")) + '</h1>' +
        (q ? '<a class="link" href="#/shop">' + t("shop.clear") + ' ×</a>' : "") + '</div>' +
      '<div class="toolbar"><div class="chips chips--scroll">' + chips + '</div>' +
        '<label class="sort">' + t("shop.sort") + ' <select id="sortSel">' +
        ["featured", "az", "za"].map(function (s) { return '<option value="' + s + '"' + (state.sort === s ? " selected" : "") + '>' + t("sort." + s) + '</option>'; }).join("") +
        '</select></label></div>' +
      '<p class="muted">' + t("shop.results", { n: list.length }) + (offerOn() && list.some(function (p) { return p.onOffer !== false; }) ? ' · ⏳ ' + t("stock.note") : "") + '</p>' +
      (list.length ? grid(list) : '<div class="empty"><p>' + t("shop.empty") + '</p><a class="btn btn--primary" href="#/shop">' + t("shop.clear") + '</a></div>') +
      '</section>';
  };

  views.p = function (parts) {
    var p = byId[parts[1]];
    if (!p) return '<section class="section empty"><p>' + t("p.notFound") + '</p><a class="btn btn--primary" href="#/shop">' + t("nav.shop") + '</a></section>';
    pushRecent(p.id);
    var inWish = state.wish.indexOf(p.id) > -1;
    var imgs = (p.images || []);
    var gallery = imgs.length > 1
      ? '<div class="thumbs">' + imgs.map(function (src, i) { return '<button type="button" data-thumb="' + esc(src) + '" class="' + (i ? "" : "on") + '"><img src="' + esc(src) + '" alt=""></button>'; }).join("") + '</div>' : "";
    var cat = CATS.filter(function (c) { return c.id === p.cat; })[0];
    var related = PRODUCTS.filter(function (x) { return x.cat === p.cat && x.id !== p.id; })
      .concat(PRODUCTS.filter(function (x) { return x.cat !== p.cat; })).slice(0, 4);
    var recent = state.recent.filter(function (id) { return id !== p.id && byId[id]; }).slice(0, 4).map(function (id) { return byId[id]; });
    var enquiry = (priceOf(p) == null ? t("wa.enquiryNoPrice", { name: pname(p) + " [" + p.code + "]" }) : t("wa.enquiry", { name: pname(p) + " [" + p.code + "]", price: priceOf(p) })) + "\n" + productUrl(p);

    return '<nav class="crumbs"><a href="#/">' + t("nav.home") + '</a> / <a href="#/shop?cat=' + p.cat + '">' + esc(loc(cat)) + '</a> / <span>' + esc(pname(p)) + '</span></nav>' +
      '<section class="pdp" style="--h:' + p.tint + '">' +
        '<div class="pdp__gallery"><div class="pdp__main" id="pdpMain">' + media(p) + '<span class="card__tag">' + esc(loc(p.tag)) + '</span></div>' + gallery + '</div>' +
        '<div class="pdp__info" id="pdpInfo">' +
          '<p class="muted small">' + t("p.code") + ': ' + p.code + ' · ' + esc(loc(cat)) + '</p>' +
          '<h1>' + esc(pname(p)) + '</h1><p class="pdp__alt">' + esc(altName(p)) + '</p>' +
          '<div class="pdp__price">' + priceHtml(p, true) +
            (offerOn() && p.onOffer !== false ? '<span class="stock-pill">🎉 ' + t("offer.badge") + (offerEndsText() ? " · " + offerEndsText() : " · " + t("stock.note")) + '</span>' : "") + '</div>' +
          (wasOf(p) ? '<p class="save">' + t("p.regular") + ': <s>' + money(wasOf(p)) + '</s> · <b>' + t("p.save", { v: wasOf(p) - priceOf(p) }) + '</b></p>' : "") +
          '<p class="pdp__desc">' + esc(loc(p.desc)) + '</p>' +
          (buyable(p) ? pickerHtml("page", p) : p.inStock ? '<p><a class="btn btn--wa btn--lg" target="_blank" rel="noopener" href="' + waLink(enquiry) + '">' + waIcon + t("p.askPriceWa") + '</a></p>' : '<p class="soldout">' + t("card.soldout") + '</p>') +
          (p.options.some(function (o) { return o.key === "size" && o.values.length > 1; }) ? '<p class="hint"><a target="_blank" rel="noopener" href="' + waLink(enquiry + "\nSize?") + '">📏 ' + t("p.sizeHelp") + '</a></p>' : "") +
          (buyable(p) ? '<div class="pdp__buy"><button class="btn btn--primary btn--lg" type="button" id="addBtn">' + t("p.addToCart") + '</button>' +
            '<button class="btn btn--dark btn--lg" type="button" id="buyBtn">' + t("p.buyNow") + ' →</button></div>' : "") +
          '<div class="pdp__row">' +
            '<a class="btn btn--wa-ghost" target="_blank" rel="noopener" href="' + waLink(enquiry) + '">' + waIcon + t("p.askWa") + '</a>' +
            '<button class="btn btn--ghost" type="button" data-wish="' + p.id + '" data-label="1" aria-pressed="' + inWish + '">' + heart + '<span>' + (inWish ? t("p.wishRemove") : t("p.wishAdd")) + '</span></button>' +
            '<button class="btn btn--ghost" type="button" data-share="' + p.id + '">↗ ' + t("p.share") + '</button>' +
          '</div>' +
          '<ul class="assure"><li>🚚 ' + t("p.shipNote") + '</li><li>💳 ' + t("p.payNote") + '</li><li>🏬 ' + t("p.shopNote") + '</li></ul>' +
        '</div>' +
      '</section>' +
      (buyable(p) ? '<div class="pdp-sticky" id="pdpSticky"><div><b>' + moneyOr(priceOf(p)) + '</b><small>' + esc(pname(p)) + '</small></div><button class="btn btn--primary" type="button" data-sticky-add>' + t("p.addToCart") + '</button></div>' : "") +
      '<section class="section"><div class="sec-head"><h2>' + t("p.related") + '</h2></div>' + grid(related) + '</section>' +
      (recent.length ? '<section class="section"><div class="sec-head"><h2>' + t("p.recent") + '</h2></div>' + grid(recent) + '</section>' : "");
  };

  function cartLines(compact) {
    return state.cart.map(function (l) {
      var p = byId[l.id];
      return '<div class="line" style="--h:' + p.tint + '">' +
        '<a class="line__img" href="#/p/' + p.id + '">' + media(p) + '</a>' +
        '<div class="line__info"><a href="#/p/' + p.id + '" class="line__name">' + esc(pname(p)) + '</a>' +
          '<div class="muted small">' + esc(optsText(l.opts)) + '</div>' +
          '<div class="line__row"><div class="stepper stepper--sm"><button type="button" data-line="' + esc(l.key) + '" data-d="-1" aria-label="-">−</button><output>' + l.qty + '</output><button type="button" data-line="' + esc(l.key) + '" data-d="1" aria-label="+">+</button></div>' +
          '<b>' + moneyOr(priceOf(p) == null ? null : l.qty * priceOf(p)) + '</b></div>' +
          (compact ? "" : '<button class="link small" type="button" data-remove="' + esc(l.key) + '">' + t("cart.remove") + '</button>') +
        '</div></div>';
    }).join("");
  }
  function totalsHtml(method) {
    var n = count(), sub = subtotal(), ship = shippingFor(method);
    return '<div class="totals">' +
      '<div><span>' + t("cart.subtotal") + ' (' + t("cart.items", { n: n }) + ')</span><span>' + money(sub) + '</span></div>' +
      '<div><span>' + t("cart.shipping") + (method === "pickup" ? "" : ' <small class="muted">' + S.shipping.courier + '</small>') + '</span><span>' + (ship ? money(ship) : t("free")) + '</span></div>' +
      '<div class="totals__grand"><span>' + t("cart.total") + '</span><span>' + money(sub + ship) + (unpriced() ? " +" : "") + '</span></div>' +
      (unpriced() ? '<p class="per-item">💬 ' + t("cart.tbcNote", { n: unpriced() }) + '</p>'
        : n > 1 && method !== "pickup" ? '<p class="per-item">🎉 ' + t("cart.perItem", { v: perItem(n, sub) }) + '</p>' : "") +
      '</div>';
  }
  function emptyCart() {
    return '<div class="empty"><div class="empty__bag">🛍️</div><h3>' + t("cart.empty") + '</h3><p>' + t(offerKey("cart.emptySub")) + '</p><a class="btn btn--primary" href="#/shop">' + t(offerKey("hero.cta")) + '</a></div>';
  }
  function upsell(limit) {
    var inCart = state.cart.map(function (l) { return l.id; });
    var list = PRODUCTS.filter(function (p) { return buyable(p) && inCart.indexOf(p.id) < 0; }).slice(0, limit);
    if (!list.length) return "";
    return '<div class="upsell"><h4>➕ ' + t("cart.upsell") + '</h4><div class="upsell__row">' + list.map(function (p) {
      return '<button type="button" class="mini" data-quick="' + p.id + '" style="--h:' + p.tint + '">' + media(p) + '<span>' + esc(pname(p)) + '</span><b>+ ' + (priceOf(p) == null ? t("card.add") : money(priceOf(p))) + '</b></button>';
    }).join("") + '</div></div>';
  }

  views.cart = function () {
    if (!state.cart.length) return '<section class="section">' + emptyCart() + '</section>';
    return '<section class="section cartpage"><div class="sec-head"><h1>' + t("cart.title") + '</h1></div>' +
      '<div class="cartpage__grid"><div>' + cartLines(false) + upsell(6) + '</div>' +
      '<aside class="summary">' + totalsHtml("courier") +
        '<a class="btn btn--primary btn--lg btn--block" href="#/checkout">' + t("cart.checkout") + ' →</a>' +
        '<a class="btn btn--ghost btn--block" href="#/shop">' + t("cart.continue") + '</a>' +
        '<p class="hint center">🔒 ' + t("co.secure") + '</p></aside></div></section>';
  };

  function renderDrawer() {
    var body = $("#drawerBody"), foot = $("#drawerFoot");
    if (!state.cart.length) { body.innerHTML = emptyCart(); foot.innerHTML = ""; return; }
    body.innerHTML = cartLines(true) + upsell(4);
    foot.innerHTML = totalsHtml("courier") +
      '<a class="btn btn--primary btn--lg btn--block" href="#/checkout" data-close-drawer>' + t("cart.checkout") + ' →</a>' +
      '<a class="btn btn--ghost btn--block" href="#/cart" data-close-drawer>' + t("cart.view") + '</a>';
  }

  /* ---------- checkout ---------- */
  var co = { method: "courier", payment: "upi" };

  function field(name, label, attrs, val) {
    return '<label class="field" data-field="' + name + '"><span>' + label + '</span><input name="' + name + '" ' + (attrs || "") + ' value="' + esc(val || "") + '"><em class="field__err"></em></label>';
  }
  function radio(group, value, title, sub, checked) {
    return '<label class="radio"><input type="radio" name="' + group + '" value="' + value + '"' + (checked ? " checked" : "") + '><span><b>' + title + '</b><small>' + sub + '</small></span></label>';
  }
  function paymentOptions() {
    if (co.method === "pickup") return [["shop", t("co.shopPay"), t("co.shopPaySub")], ["upi", t("co.upi"), t("co.upiSub")]];
    var o = [];
    if (S.payments.indexOf("upi") > -1) o.push(["upi", t("co.upi"), t("co.upiSub")]);
    if (S.payments.indexOf("bank") > -1) o.push(["bank", t("co.bank"), t("co.bankSub")]);
    if (S.allowCOD) o.push(["cod", t("co.cod"), t("co.codSub")]);
    return o;
  }

  views.checkout = function () {
    if (!state.cart.length) return '<section class="section">' + emptyCart() + '</section>';
    var c = state.customer || {};
    if (c.method && (c.method !== "pickup" || S.shipping.allowPickup)) co.method = c.method;
    var pays = paymentOptions();
    if (!pays.some(function (x) { return x[0] === co.payment; })) co.payment = pays[0][0];
    var districts = window.TN_DISTRICTS.map(function (d) {
      return '<option value="' + esc(d[0]) + '"' + (c.district === d[0] ? " selected" : "") + '>' + esc(state.lang === "ta" ? d[1] + " (" + d[0] + ")" : d[0]) + '</option>';
    }).join("");

    return '<section class="section checkout">' +
      '<div class="sec-head"><div><h1>' + t("co.title") + '</h1><p class="muted">' + t("co.sub") + '</p></div></div>' +
      '<div class="checkout__grid">' +
      '<form id="coForm" novalidate>' +
        '<fieldset><legend>' + t("co.method") + '</legend><div class="radios">' +
          radio("method", "courier", "🚚 " + t("co.courier"), t("co.courierSub"), co.method === "courier") +
          (S.shipping.allowPickup ? radio("method", "pickup", "🏬 " + t("co.pickup"), t("co.pickupSub"), co.method === "pickup") : "") +
        '</div></fieldset>' +
        '<fieldset><legend>' + t("co.details") + '</legend>' +
          '<div class="row2">' + field("name", t("co.name"), 'autocomplete="name" required maxlength="60"', c.name) +
          field("phone", t("co.phone"), 'type="tel" inputmode="numeric" autocomplete="tel" required maxlength="14"', c.phone) + '</div>' +
          '<div class="addr" id="addrBlock"' + (co.method === "pickup" ? " hidden" : "") + '>' +
            field("address", t("co.address"), 'autocomplete="street-address" maxlength="160"', c.address) +
            '<div class="row2">' + field("town", t("co.town"), 'autocomplete="address-level2" maxlength="60"', c.town) +
            '<label class="field" data-field="district"><span>' + t("co.district") + '</span><select name="district"><option value="">' + t("co.selectDistrict") + '</option>' + districts + '</select><em class="field__err"></em></label></div>' +
            '<div class="row2">' + field("pincode", t("co.pincode"), 'inputmode="numeric" autocomplete="postal-code" maxlength="6"', c.pincode) +
            field("alt", t("co.alt"), 'type="tel" inputmode="numeric" maxlength="14"', c.alt) + '</div>' +
            '<p class="pin-msg" id="pinMsg"></p>' +
            field("landmark", t("co.landmark"), 'maxlength="100"', c.landmark) +
          '</div>' +
        '</fieldset>' +
        '<fieldset><legend>' + t("co.payment") + '</legend><div class="radios" id="payRadios">' +
          pays.map(function (x) { return radio("payment", x[0], x[1], x[2], co.payment === x[0]); }).join("") +
        '</div></fieldset>' +
        '<label class="field"><span>' + t("co.notes") + '</span><textarea name="notes" rows="2" maxlength="300" placeholder="' + esc(t("co.notesPh")) + '"></textarea></label>' +
        '<label class="check"><input type="checkbox" name="remember"' + (state.customer === null || c.remember !== false ? " checked" : "") + '> ' + t("co.remember") + '</label>' +
      '</form>' +

      '<aside class="checkout__side">' +
        '<div class="summary"><h3>' + t("co.summary") + '</h3>' +
          '<div class="mini-lines">' + state.cart.map(function (l) {
            var p = byId[l.id];
            return '<div class="mline" style="--h:' + p.tint + '"><span class="mline__img">' + media(p) + '<i>' + l.qty + '</i></span><span><b>' + esc(pname(p)) + '</b><small>' + esc(optsText(l.opts)) + '</small></span><b>' + moneyOr(priceOf(p) == null ? null : l.qty * priceOf(p)) + '</b></div>';
          }).join("") + '</div>' +
          '<div id="coTotals">' + totalsHtml(co.method) + '</div>' +
          '<a href="#/cart" class="link small">✎ ' + t("cart.view") + '</a>' +
        '</div>' +

        '<div class="wa-card">' +
          '<div class="wa-card__head"><span class="wa-card__avatar">GR</span><div><b>' + esc(loc(S.name)) + '</b><small>+91 ' + (S.whatsappDisplay || S.phoneDisplay) + ' · ' + (state.lang === "ta" ? "லால்பேட்டை" : "Lalpet") + '</small></div>' + waIcon + '</div>' +
          '<div class="wa-card__chat"><p class="wa-card__label">' + t("co.waPreview") + '</p><div class="bubble" id="waBubble"></div></div>' +
          '<div class="wa-card__foot">' +
            '<button class="btn btn--wa btn--lg btn--block" type="button" id="sendWa">' + waIcon + t("co.send") + '</button>' +
            '<button class="btn btn--ghost btn--block small" type="button" id="copyOrder">⧉ ' + t("co.copy") + '</button>' +
            '<p class="hint center">🔒 ' + t("co.secure") + '</p>' +
          '</div>' +
        '</div>' +
      '</aside></div></section>' +
      '<div class="co-sticky"><div><small>' + t("cart.total") + '</small><b id="stickyTotal">' + money(subtotal() + shippingFor(co.method)) + '</b></div><button class="btn btn--wa" type="button" data-send>' + waIcon + t("co.send") + '</button></div>';
  };

  function formData() {
    var f = $("#coForm"); if (!f) return {};
    var d = {};
    ["name", "phone", "address", "town", "district", "pincode", "alt", "landmark", "notes"].forEach(function (k) { d[k] = (f.elements[k] && f.elements[k].value || "").trim(); });
    d.remember = f.elements.remember.checked;
    d.method = co.method; d.payment = co.payment;
    return d;
  }
  function cleanPhone(v) { v = (v || "").replace(/\D/g, ""); if (v.length === 12 && v.indexOf("91") === 0) v = v.slice(2); if (v.length === 11 && v[0] === "0") v = v.slice(1); return v; }

  function validate(d, show) {
    var errs = {};
    if (d.name.length < 2) errs.name = t("err.name");
    if (!/^[6-9]\d{9}$/.test(cleanPhone(d.phone))) errs.phone = t("err.phone");
    if (co.method !== "pickup") {
      if (d.address.length < 5) errs.address = t("err.address");
      if (d.town.length < 2) errs.town = t("err.town");
      if (!d.district) errs.district = t("err.district");
      if (!/^\d{6}$/.test(d.pincode)) errs.pincode = t("err.pincode");
    }
    if (show) {
      $$("#coForm [data-field]").forEach(function (el) {
        var k = el.dataset.field, e = errs[k];
        el.classList.toggle("has-err", !!e);
        $(".field__err", el).textContent = e || "";
      });
      var first = Object.keys(errs)[0];
      if (first) {
        var inp = $('#coForm [name="' + first + '"]');
        inp.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(function () { inp.focus({ preventScroll: true }); }, 350);
        toast(t("err.fix"));
      }
    }
    return errs;
  }

  function pinCheck() {
    var el = $("#pinMsg"), f = $("#coForm"); if (!el || !f) return;
    var v = f.elements.pincode.value.trim();
    el.className = "pin-msg";
    if (!v) { el.textContent = ""; return; }
    if (!/^\d{6}$/.test(v)) { el.textContent = v.length >= 6 ? t("co.pinBad") : ""; if (v.length >= 6) el.classList.add("bad"); return; }
    var n = +v.slice(0, 3);
    if (n >= 600 && n <= 643) { el.textContent = "✓ " + t("co.pinOk"); el.classList.add("ok"); }
    else if (v[0] === "6" || v[0] === "5") { el.textContent = "⚠ " + t("co.pinOutside"); el.classList.add("warn"); }
    else { el.textContent = t("co.pinBad"); el.classList.add("bad"); }
  }

  function newOrderId() {
    var d = new Date(), pad = function (n) { return (n < 10 ? "0" : "") + n; };
    return "GR" + String(d.getFullYear()).slice(2) + pad(d.getMonth() + 1) + pad(d.getDate()) + "-" + Math.floor(1000 + Math.random() * 9000);
  }

  function buildOrder(d, id) {
    var items = state.cart.map(function (l) {
      var p = byId[l.id];
      return { id: p.id, code: p.code, en: p.en, ta: p.ta, opts: l.opts, qty: l.qty, price: priceOf(p), was: wasOf(p) };
    });
    var sub = subtotal(), ship = shippingFor(d.method);
    return {
      id: id || newOrderId(), ts: Date.now(), lang: state.lang, items: items,
      count: count(), unpriced: unpriced(), subtotal: sub, shipping: ship, total: sub + ship,
      customer: { name: d.name, phone: cleanPhone(d.phone) || d.phone, alt: d.alt, address: d.address, town: d.town, district: d.district, pincode: d.pincode, landmark: d.landmark },
      method: d.method, payment: d.payment, notes: d.notes
    };
  }

  function fmtDate(ts) {
    return new Date(ts).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  function payLabel(k, L) {
    return { upi: t("co.upi", null, L), bank: t("co.bank", null, L), cod: t("co.cod", null, L), shop: t("co.shopPay", null, L) }[k] || k;
  }

  function orderMessage(o) {
    var L = o.lang || state.lang, T = function (k, v) { return t(k, v, L); };
    var line = "━━━━━━━━━━━━━━";
    var m = [T("msg.header"), T("msg.id") + ": *" + o.id + "*", T("msg.date") + ": " + fmtDate(o.ts), "", "*" + T("msg.items") + "*"];
    o.items.forEach(function (it, i) {
      m.push((i + 1) + ". " + (it[L] || it.en) + " [" + it.code + "]");
      var ot = optsText(it.opts, L);
      if (ot) m.push("    " + ot);
      m.push("    " + it.qty + " × " + (it.price == null ? T("msg.tbc") : money(it.price) + (it.was ? " (" + T("offer.badge") + ", " + T("p.regular") + " " + money(it.was) + ")" : "") + " = " + money(it.qty * it.price)));
    });
    m.push(line);
    m.push(T("msg.subtotal") + " (" + T("cart.items", { n: o.count }) + "): " + money(o.subtotal));
    m.push(T("msg.shipping") + (o.method === "pickup" ? "" : " (" + S.shipping.courier + ")") + ": " + (o.shipping ? money(o.shipping) : T("msg.free")));
    m.push("*" + T("msg.total") + ": " + money(o.total) + (o.unpriced ? " +" : "") + "*");
    if (o.unpriced) m.push("💬 " + T("msg.tbcNote", { n: o.unpriced }));
    m.push(line);
    var c = o.customer;
    m.push(T("msg.customer"));
    m.push(T("msg.name") + ": " + (c.name || "—"));
    m.push(T("msg.phone") + ": " + (c.phone || "—"));
    if (c.alt) m.push(T("msg.alt") + ": " + c.alt);
    if (o.method === "pickup") m.push(T("msg.method") + ": " + T("msg.pickup"));
    else {
      m.push(T("msg.address") + ": " + [c.address, c.town, c.district].filter(Boolean).join(", ") + (c.pincode ? " – " + c.pincode : ""));
      if (c.landmark) m.push(T("msg.landmark") + ": " + c.landmark);
      m.push(T("msg.method") + ": " + S.shipping.courier);
    }
    m.push(T("msg.payment") + ": " + payLabel(o.payment, L));
    if (o.notes) m.push(T("msg.notes") + ": " + o.notes);
    m.push("", T("msg.confirm"), "", T("msg.footer", { site: S.siteUrl }));
    return m.join("\n");
  }

  function waFormat(text) {
    return esc(text).replace(/\*([^*\n]+)\*/g, "<b>$1</b>").replace(/\n/g, "<br>");
  }

  function refreshCheckout() {
    if (currentRoute !== "checkout" || !$("#coForm")) return;
    var d = formData();
    var preview = buildOrder(d, "GR········");
    $("#waBubble").innerHTML = waFormat(orderMessage(preview)) + '<span class="bubble__time">' + new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) + ' ✓✓</span>';
    $("#coTotals").innerHTML = totalsHtml(co.method);
    $("#stickyTotal").textContent = money(preview.total);
    if (d.remember) db.set("customer", Object.assign({}, d, { notes: undefined }));
  }

  function submitOrder() {
    var d = formData();
    var errs = validate(d, true);
    if (Object.keys(errs).length) return;
    var order = buildOrder(d);
    var msg = orderMessage(order);
    state.orders.unshift(order);
    state.orders = state.orders.slice(0, 30);
    db.set("orders", state.orders);
    if (d.remember) { state.customer = Object.assign({}, d, { notes: undefined }); db.set("customer", state.customer); }
    else { state.customer = { remember: false }; db.set("customer", state.customer); }
    state.cart = []; saveCart();
    var win = window.open(waLink(msg), "_blank");
    location.hash = "#/success/" + order.id + (win ? "" : "?open=1");
  }

  views.success = function (parts, qs) {
    var o = state.orders.filter(function (x) { return x.id === parts[1]; })[0];
    if (!o) return '<section class="section empty"><p>' + t("ok.missing") + '</p><a class="btn btn--primary" href="#/shop">' + t("ok.shop") + '</a></section>';
    var link = waLink(orderMessage(o));
    if (qs.get("open")) setTimeout(function () { location.href = link; }, 400);
    return '<section class="section success">' +
      '<div class="success__card"><div class="confetti" aria-hidden="true"></div>' +
        '<div class="success__icon">' + waIcon + '</div>' +
        '<h1>' + t("ok.title") + '</h1><p>' + t("ok.sub") + '</p>' +
        '<p class="order-id">' + t("ok.id") + ': <b>' + o.id + '</b></p>' +
        '<a class="btn btn--wa btn--lg" target="_blank" rel="noopener" href="' + link + '">' + waIcon + t("ok.resend") + '</a>' +
        '<div class="bubble bubble--static">' + waFormat(orderMessage(o)) + '</div>' +
        '<h3>' + t("ok.next") + '</h3><ol class="next"><li>' + t("ok.n1") + '</li><li>' + t("ok.n2") + '</li><li>' + t("ok.n3") + '</li></ol>' +
        '<a class="btn btn--ghost" href="#/shop">' + t("ok.shop") + ' →</a>' +
      '</div>' + groupCta() + '</section>';
  };

  views.orders = function () {
    var list = state.orders;
    return '<section class="section"><div class="sec-head"><h1>' + t("orders.title") + '</h1></div><p class="muted small">' + t("orders.note") + '</p>' +
      (list.length ? '<div class="orders">' + list.map(function (o) {
        return '<article class="order"><div class="order__head"><b>' + o.id + '</b><span class="muted small">' + fmtDate(o.ts) + '</span></div>' +
          '<div class="order__items">' + o.items.map(function (it) { return '<span>' + esc(it[state.lang] || it.en) + ' × ' + it.qty + '</span>'; }).join("") + '</div>' +
          '<div class="order__foot"><b>' + money(o.total) + (o.unpriced ? " +" : "") + '</b><div>' +
          '<a class="btn btn--wa-ghost small" target="_blank" rel="noopener" href="' + waLink(orderMessage(o)) + '">' + waIcon + t("orders.resend") + '</a>' +
          '<button class="btn btn--ghost small" type="button" data-reorder="' + o.id + '">↻ ' + t("orders.reorder") + '</button></div></div></article>';
      }).join("") + '</div>' : '<div class="empty"><div class="empty__bag">🧾</div><p>' + t("orders.empty") + '</p><a class="btn btn--primary" href="#/shop">' + t("hero.cta") + '</a></div>') +
      '</section>';
  };

  views.wishlist = function () {
    var list = state.wish.filter(function (id) { return byId[id]; }).map(function (id) { return byId[id]; });
    return '<section class="section"><div class="sec-head"><h1>' + t("wish.title") + '</h1></div>' +
      (list.length ? grid(list) : '<div class="empty"><div class="empty__bag">♡</div><p>' + t("wish.empty") + '</p><a class="btn btn--primary" href="#/shop">' + t("hero.cta") + '</a></div>') +
      '</section>';
  };

  views.contact = function () {
    return '<section class="section contact"><div class="sec-head"><h1>' + t("about.title") + '</h1></div>' +
      '<div class="contact__grid"><div class="contact__card">' +
        '<h3>🏬 ' + t("about.shop") + '</h3><p><b>' + esc(loc(S.name)) + '</b><br>' + esc(loc(S.address)) + '</p>' +
        '<div class="contact__btns">' +
          '<a class="btn btn--wa" target="_blank" rel="noopener" href="' + waLink(t("wa.hello")) + '">' + waIcon + t("about.chat") + (S.whatsappDisplay ? ': ' + S.whatsappDisplay : "") + '</a>' +
          '<a class="btn btn--dark" href="tel:' + S.phone + '">📞 ' + t("about.call") + ': ' + S.phoneDisplay + '</a>' +
          '<a class="btn btn--ghost" target="_blank" rel="noopener" href="https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(S.mapQuery) + '">📍 ' + t("about.dir") + '</a>' +
          '<a class="btn btn--yt" target="_blank" rel="noopener" href="' + esc(S.youtube.channelUrl) + '">' + ytIcon + 'YouTube</a>' +
          socialButtons() +
          (S.whatsappGroup ? '<a class="btn btn--wa-ghost" target="_blank" rel="noopener" href="' + esc(S.whatsappGroup) + '">' + waIcon + t("group.btn") + '</a>' : "") +
        '</div></div>' +
        '<div class="map"><iframe title="Map" loading="lazy" referrerpolicy="no-referrer-when-downgrade" src="https://maps.google.com/maps?q=' + encodeURIComponent(S.mapQuery) + '&z=15&output=embed"></iframe></div>' +
      '</div></section>' + faqSection(false) +
      (offerOn() ? '<section class="section poster poster--solo"><figure class="poster__img"><img src="images/price-list.jpg" alt="Offer price list" loading="lazy" width="1123" height="1600"></figure></section>' : "");
  };

  /* ---------- quick-add sheet ---------- */
  function openSheet(id) {
    var p = byId[id]; if (!p || !buyable(p)) return;
    $("#sheetPanel").innerHTML =
      '<button class="x" type="button" data-close-sheet aria-label="Close">×</button>' +
      '<div class="sheet__head" style="--h:' + p.tint + '"><span class="sheet__img">' + media(p) + '</span><div><b>' + esc(pname(p)) + '</b><small>' + esc(altName(p)) + '</small>' + priceHtml(p) + '</div></div>' +
      '<div class="sheet__body">' + pickerHtml("sheet", p) + '</div>' +
      '<div class="sheet__foot"><button class="btn btn--primary btn--lg btn--block" type="button" id="sheetAdd">' + t("p.addToCart") + (priceOf(p) == null ? "" : ' · ' + money(priceOf(p))) + '</button>' +
      '<a class="link small" href="#/p/' + p.id + '" data-close-sheet>' + (state.lang === "ta" ? "முழு விவரம் பார்க்க →" : "See full details →") + '</a></div>';
    var sh = $("#sheet");
    sh.classList.add("open"); sh.setAttribute("aria-hidden", "false");
    document.body.classList.add("lock");
    setTimeout(function () { var b = $("#sheetAdd"); if (b) b.focus(); }, 50);
  }
  function closeSheet() {
    var sh = $("#sheet");
    sh.classList.remove("open"); sh.setAttribute("aria-hidden", "true");
    if (!$("#drawer").classList.contains("open")) document.body.classList.remove("lock");
  }
  function updateSheetPrice() {
    var pk = pickers.sheet, b = $("#sheetAdd");
    if (pk && b) b.textContent = t("p.addToCart") + (priceOf(byId[pk.id]) == null ? "" : " · " + money(pk.qty * priceOf(byId[pk.id])));
  }

  /* ---------- drawer ---------- */
  function openDrawer() {
    renderDrawer();
    $("#drawer").classList.add("open"); $("#drawer").setAttribute("aria-hidden", "false");
    $("#scrim").hidden = false; document.body.classList.add("lock");
  }
  function closeDrawer() {
    $("#drawer").classList.remove("open"); $("#drawer").setAttribute("aria-hidden", "true");
    $("#scrim").hidden = true; document.body.classList.remove("lock");
  }

  /* ---------- router ---------- */
  function parse() {
    var h = location.hash.replace(/^#/, "") || "/";
    var i = h.indexOf("?");
    var path = i > -1 ? h.slice(0, i) : h, qs = new URLSearchParams(i > -1 ? h.slice(i + 1) : "");
    return { parts: path.split("/").filter(Boolean), qs: qs };
  }
  var lastPath = "";
  function render() {
    var r = parse();
    var name = r.parts[0] || "home";
    if (!views[name]) name = "home";
    currentRoute = name;
    var app = $("#app");
    app.innerHTML = views[name](r.parts, r.qs);
    app.className = "route-" + name;
    var path = r.parts.join("/");
    if (path !== lastPath) { window.scrollTo(0, 0); }
    lastPath = path;
    $$(".bnav a").forEach(function (a) { a.classList.toggle("on", a.dataset.route === name || (name === "p" && a.dataset.route === "shop")); });
    $$(".hnav a").forEach(function (a) { a.classList.toggle("on", a.getAttribute("href") === "#/" + name); });
    afterRender(name);
    var titles = { shop: t("nav.shop"), cart: t("cart.title"), checkout: t("co.title"), wishlist: t("wish.title"), orders: t("orders.title"), contact: t("nav.about") };
    var base = loc(S.name) + " — " + (offerOn() ? t("offer.bar").replace("🎉 ", "") : t("ticker.1off"));
    var pp = name === "p" && byId[r.parts[1]];
    document.title = pp ? pname(pp) + (priceOf(pp) ? " " + money(priceOf(pp)) : "") + " | " + loc(S.name) : (titles[name] ? titles[name] + " | " + loc(S.name) : base);
  }

  function afterRender(name) {
    if (name === "home" && $("#shipRange")) {
      var rng = $("#shipRange");
      var upd = function () {
        var n = +rng.value, tot = n * S.offer.price + S.shipping.fee;
        $("#shipOut").innerHTML = '<div class="ship__n"><b>' + n + '</b> ' + (n > 1 ? t("ship.items") : t("ship.item")) + '</div>' +
          '<div class="ship__calc">' + n + ' × ' + money(S.offer.price) + ' + ₹' + S.shipping.fee + ' = <b>' + money(tot) + '</b></div>' +
          '<div class="ship__per"><b>' + money(perItem(n, n * S.offer.price)) + '</b> ' + t("ship.per") + '</div>';
        rng.style.setProperty("--p", ((n - 1) / 9 * 100) + "%");
      };
      rng.addEventListener("input", upd); upd();
    }
    if (name === "checkout" && $("#coForm")) {
      var f = $("#coForm");
      f.addEventListener("input", function (e) {
        if (e.target.name === "pincode") { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 6); pinCheck(); }
        var fl = e.target.closest("[data-field]");
        if (fl && fl.classList.contains("has-err")) { fl.classList.remove("has-err"); $(".field__err", fl).textContent = ""; }
        refreshCheckout();
      });
      f.addEventListener("change", function (e) {
        if (e.target.name === "method") {
          co.method = e.target.value;
          $("#addrBlock").hidden = co.method === "pickup";
          var pays = paymentOptions();
          if (!pays.some(function (x) { return x[0] === co.payment; })) co.payment = pays[0][0];
          $("#payRadios").innerHTML = pays.map(function (x) { return radio("payment", x[0], x[1], x[2], co.payment === x[0]); }).join("");
        }
        if (e.target.name === "payment") co.payment = e.target.value;
        if (e.target.name === "remember" && !e.target.checked) db.set("customer", { remember: false });
        refreshCheckout();
      });
      f.addEventListener("submit", function (e) { e.preventDefault(); submitOrder(); });
      pinCheck();
      refreshCheckout();
    }
    if (name === "p") {
      var sticky = $("#pdpSticky"), buy = $(".pdp__buy");
      if (sticky && buy && "IntersectionObserver" in window) {
        new IntersectionObserver(function (en) { sticky.classList.toggle("show", !en[0].isIntersecting && en[0].boundingClientRect.top < 0); }).observe(buy);
      }
    }
  }

  /* ---------- global events ---------- */
  document.addEventListener("click", function (e) {
    var el;
    if ((el = e.target.closest("[data-quick]"))) { e.preventDefault(); openSheet(el.dataset.quick); return; }
    if ((el = e.target.closest("[data-wish]"))) { e.preventDefault(); toggleWish(el.dataset.wish); return; }
    if ((el = e.target.closest("[data-opt]"))) {
      var pk = pickers[el.dataset.scope]; if (!pk) return;
      pk.sel[el.dataset.opt] = el.dataset.val;
      $$('[data-scope="' + el.dataset.scope + '"][data-opt="' + el.dataset.opt + '"]').forEach(function (b) { b.classList.toggle("on", b === el); });
      if (el.dataset.opt === "color") { var cn = $('[data-colorname="' + el.dataset.scope + '"]'); if (cn) cn.textContent = loc(colorById(el.dataset.val)); }
      var grp = el.closest("[data-optgroup]"); if (grp) { $(".opt__err", grp).hidden = true; grp.classList.remove("shake", "opt--missing"); }
      return;
    }
    if ((el = e.target.closest("[data-step]"))) {
      var p2 = pickers[el.dataset.scope]; if (!p2) return;
      p2.qty = Math.max(1, Math.min(99, p2.qty + (+el.dataset.step)));
      $('[data-qty="' + el.dataset.scope + '"]').textContent = p2.qty;
      if (el.dataset.scope === "sheet") updateSheetPrice();
      return;
    }
    if ((el = e.target.closest("[data-line]"))) {
      var line = state.cart.filter(function (l) { return l.key === el.dataset.line; })[0];
      if (line) { setQty(line.key, line.qty + (+el.dataset.d)); if (currentRoute === "cart" || currentRoute === "checkout") render(); }
      return;
    }
    if ((el = e.target.closest("[data-remove]"))) { setQty(el.dataset.remove, 0); render(); return; }
    if (e.target.closest("#addBtn") || e.target.closest("[data-sticky-add]")) {
      if (pickerCommit("page", $("#pdpInfo"))) toast("✓ " + t("cart.added"), { href: "#/checkout", label: t("cart.checkout") + " →" });
      return;
    }
    if (e.target.closest("#buyBtn")) { if (pickerCommit("page", $("#pdpInfo"))) location.hash = "#/checkout"; return; }
    if (e.target.closest("#sheetAdd")) {
      if (pickerCommit("sheet", $("#sheetPanel"))) {
        closeSheet();
        toast("✓ " + t("cart.added"), { href: "#/checkout", label: t("cart.checkout") + " →" });
        if (currentRoute === "cart") render();
      }
      return;
    }
    if (e.target.closest("[data-close-sheet]") || e.target === $("#sheet")) { closeSheet(); return; }
    if (e.target.closest("#cartBtn")) { openDrawer(); return; }
    if (e.target.closest("#drawerClose") || e.target === $("#scrim") || e.target.closest("[data-close-drawer]")) { closeDrawer(); return; }
    if (e.target.closest("#sendWa") || e.target.closest("[data-send]")) { submitOrder(); return; }
    if (e.target.closest("#copyOrder")) {
      var d = formData(); if (Object.keys(validate(d, true)).length) return;
      copy(orderMessage(buildOrder(d)), t("co.copied")); return;
    }
    if ((el = e.target.closest("[data-share]"))) { share(byId[el.dataset.share]); return; }
    if ((el = e.target.closest("[data-thumb]"))) {
      $("#pdpMain img").src = el.dataset.thumb;
      $$("[data-thumb]").forEach(function (b) { b.classList.toggle("on", b === el); });
      return;
    }
    if ((el = e.target.closest("[data-yt]"))) {
      el.outerHTML = '<div class="yt-frame"><iframe src="https://www.youtube-nocookie.com/embed/' + encodeURIComponent(el.dataset.yt) + '?autoplay=1&rel=0" title="YouTube" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>';
      return;
    }
    if ((el = e.target.closest("[data-ytlist]"))) {
      el.outerHTML = '<div class="yt-frame yt-frame--main"><iframe src="https://www.youtube-nocookie.com/embed/videoseries?list=' + encodeURIComponent(el.dataset.ytlist) + '&autoplay=1&rel=0" title="YouTube" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>';
      return;
    }
    if ((el = e.target.closest("[data-reorder]"))) {
      var o = state.orders.filter(function (x) { return x.id === el.dataset.reorder; })[0];
      if (o) { o.items.forEach(function (it) { if (byId[it.id] && buyable(byId[it.id])) addToCart(it.id, it.opts, it.qty); }); location.hash = "#/cart"; }
      return;
    }
    if ((el = e.target.closest("[data-suggest]"))) { $("#searchSuggest").hidden = true; $("#searchInput").value = ""; return; }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { closeSheet(); closeDrawer(); $("#searchSuggest").hidden = true; }
  });

  function copy(text, msg) {
    var done = function () { toast(msg); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, fallback);
    else fallback();
    function fallback() {
      var ta = document.createElement("textarea"); ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); done(); } catch (err) { /* ignore */ }
      ta.remove();
    }
  }
  function share(p) {
    var url = productUrl(p), text = priceOf(p) == null ? t("share.textNoPrice", { name: pname(p) }) : t("share.text", { name: pname(p), price: priceOf(p) });
    if (navigator.share) navigator.share({ title: pname(p), text: text, url: url }).catch(function () {});
    else window.open("https://wa.me/?text=" + encodeURIComponent(text + "\n" + url), "_blank");
  }

  /* sort select */
  document.addEventListener("change", function (e) {
    if (e.target.id === "sortSel") { state.sort = e.target.value; render(); }
  });

  /* search */
  var sInput = $("#searchInput"), sBox = $("#searchSuggest");
  sInput.addEventListener("input", function () {
    var q = sInput.value.trim();
    if (!q) { sBox.hidden = true; return; }
    var res = PRODUCTS.filter(function (p) { return searchMatch(p, q); }).slice(0, 6);
    sBox.innerHTML = res.length ? res.map(function (p) {
      return '<a href="#/p/' + p.id + '" data-suggest style="--h:' + p.tint + '"><span class="sg-img">' + media(p) + '</span><span><b>' + esc(pname(p)) + '</b><small>' + esc(altName(p)) + '</small></span><em>' + (priceOf(p) ? money(priceOf(p)) : "") + '</em></a>';
    }).join("") : '<p class="muted small">' + t("shop.empty") + '</p>';
    sBox.hidden = false;
  });
  sInput.addEventListener("blur", function () { setTimeout(function () { sBox.hidden = true; }, 200); });
  $("#searchForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var q = sInput.value.trim();
    sBox.hidden = true; sInput.blur();
    location.hash = "#/shop" + (q ? "?q=" + encodeURIComponent(q) : "");
  });

  /* language */
  function applyStatic() {
    document.documentElement.lang = state.lang;
    document.body.classList.toggle("is-ta", state.lang === "ta");
    $$("[data-i18n]").forEach(function (el) { el.textContent = t(el.dataset.i18n); });
    $$("[data-i18n-ph]").forEach(function (el) { el.placeholder = t(el.dataset.i18nPh); });
    var items = [1, 2, 3, 4, 5].map(function (i) { return "<span>✦ " + t("ticker." + i + (i === 1 && !offerOn() ? "off" : "")) + "</span>"; }).join("");
    $("#ticker").innerHTML = items + items;
    var offer = loc(S.offerBanner);
    if (offer) offer = "🎁 " + offer;
    else if (offerOn()) offer = t("offer.bar") + (offerEndsText() ? " ⏰ " + offerEndsText() : "");
    $("#offerBar").hidden = !offer; $("#offerBar").textContent = offer;
    $("#waFloat").href = waLink(t("wa.hello"));
    $("#footAddr").textContent = loc(S.address);
    $("#footPhone").textContent = "📞 +91 " + S.phoneDisplay; $("#footPhone").href = "tel:" + S.phone;
    if (S.whatsappDisplay) $("#footWa").innerHTML = '<a target="_blank" rel="noopener" href="' + waLink(t("wa.hello")) + '">' + waIcon + ' WhatsApp: +91 ' + S.whatsappDisplay + '</a>';
    var soc = '<a target="_blank" rel="noopener" href="' + esc(S.youtube.channelUrl) + '">' + ytIcon + ' YouTube</a>' +
      (S.instagram ? '<a target="_blank" rel="noopener" href="' + esc(S.instagram) + '">' + igIcon + ' Instagram</a>' : "") +
      (S.facebook ? '<a target="_blank" rel="noopener" href="' + esc(S.facebook) + '">' + fbIcon + ' Facebook</a>' : "") +
      '<a target="_blank" rel="noopener" href="' + waLink(t("wa.hello")) + '">' + waIcon + ' WhatsApp</a>' +
      (S.whatsappGroup ? '<a target="_blank" rel="noopener" href="' + esc(S.whatsappGroup) + '">' + waIcon + ' ' + t("group.short") + '</a>' : "");
    $("#socials").innerHTML = soc;
  }
  $("#langBtn").addEventListener("click", function () {
    state.lang = state.lang === "ta" ? "en" : "ta";
    db.set("lang", state.lang);
    applyStatic(); render(); renderDrawer();
  });

  /* header shadow on scroll */
  window.addEventListener("scroll", function () { $("#header").classList.toggle("scrolled", window.scrollY > 10); }, { passive: true });


  $("#year").textContent = new Date().getFullYear();
  window.addEventListener("hashchange", function () { closeDrawer(); closeSheet(); render(); });
  applyStatic();
  updateBadges();
  renderDrawer();
  render();

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); });
  }
})();
