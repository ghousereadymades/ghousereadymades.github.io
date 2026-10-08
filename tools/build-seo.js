#!/usr/bin/env node
/*
 * SEO builder — run after changing products, prices or shop details:
 *
 *     node tools/build-seo.js
 *
 * It reads js/config.js, js/products.js and js/i18n.js and writes:
 *   - the SEO <head> (title, description, Open Graph, JSON-LD) and
 *     pre-rendered content into index.html
 *   - product/<id>/index.html     one crawlable page per product
 *   - category/<id>/index.html    one crawlable page per category
 *   - sitemap.xml
 * Every generated page loads the same app, which then takes over.
 * No npm packages needed — only Node.js.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
const write = (f, s) => {
  const full = path.join(ROOT, f);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, s);
};

/* ---------- load the shop data exactly as the browser does ---------- */
const ctx = { window: {} };
vm.createContext(ctx);
["js/config.js", "js/products.js", "js/i18n.js", "js/art.js"].forEach((f) => vm.runInContext(read(f), ctx, { filename: f }));
const W = ctx.window;
const S = W.STORE, PRODUCTS = W.PRODUCTS, CATS = W.CATEGORIES.filter((c) => c.id !== "all"), EN = W.I18N.en;

const BASE = "https://" + S.siteUrl.replace(/\/+$/, "") + "/";
const TODAY = new Date().toISOString().slice(0, 10);
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const abs = (p) => BASE + p;
const productPath = (p) => "product/" + p.id + "/";
const categoryPath = (c) => "category/" + c.id + "/";
const catOf = (p) => CATS.find((c) => c.id === p.cat);
const exists = (f) => fs.existsSync(path.join(ROOT, f));

/* ---------- pricing (same rules as js/app.js) ---------- */
function offerEnd() { return S.offer && S.offer.endsOn ? new Date(S.offer.endsOn + "T23:59:59") : null; }
function offerOn() {
  if (!S.offer || !S.offer.active) return false;
  const end = offerEnd();
  return !end || isNaN(end) || Date.now() <= end.getTime();
}
function priceOf(p) {
  if (offerOn() && p.onOffer !== false) return S.offer.price;
  return p.regularPrice > 0 ? p.regularPrice : null;
}
const money = (n) => "₹" + n;

function productImages(p) {
  const list = (p.images || []).map(abs);
  if (exists("images/og/" + p.id + ".jpg")) list.push(abs("images/og/" + p.id + ".jpg"));
  return list.length ? list : [abs("images/og-image.png")];
}
function ogImage(p) {
  if (p && exists("images/og/" + p.id + ".jpg")) return { url: abs("images/og/" + p.id + ".jpg"), w: 1200, h: 630 };
  if (p && p.images && p.images.length) return { url: abs(p.images[0]), w: 800, h: 800 };
  return { url: abs("images/og-image.png"), w: 1200, h: 630 };
}

/* ---------- shared JSON-LD ---------- */
const sameAs = [S.youtube && S.youtube.channelUrl, S.instagram, S.facebook].filter(Boolean);
const store = {
  "@type": "ClothingStore",
  "@id": BASE + "#store",
  name: S.name.en,
  alternateName: S.name.ta,
  url: BASE,
  logo: abs("images/icon-512.png"),
  image: [abs("images/og-image.png"), abs("images/price-list.jpg")],
  telephone: S.phone,
  priceRange: "₹",
  currenciesAccepted: "INR",
  paymentAccepted: "UPI, Bank transfer" + (S.allowCOD ? ", Cash" : ""),
  address: {
    "@type": "PostalAddress",
    streetAddress: "Chidambaram Main Road, Near Govt. Higher Secondary School",
    addressLocality: "Lalpet",
    addressRegion: "Tamil Nadu",
    postalCode: "608303",
    addressCountry: "IN"
  },
  areaServed: { "@type": "State", name: "Tamil Nadu" },
  contactPoint: [{
    "@type": "ContactPoint",
    contactType: "sales",
    telephone: "+" + S.whatsapp,
    availableLanguage: ["Tamil", "English"],
    url: "https://wa.me/" + S.whatsapp
  }],
  sameAs: sameAs
};
const website = { "@type": "WebSite", "@id": BASE + "#website", name: S.name.en, alternateName: S.name.ta, url: BASE, inLanguage: ["ta", "en"], publisher: { "@id": BASE + "#store" } };
function breadcrumb(items) {
  return { "@type": "BreadcrumbList", itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it[0], item: abs(it[1]) })) };
}
function productLd(p) {
  const price = priceOf(p), c = catOf(p);
  const ld = {
    "@type": "Product",
    "@id": abs(productPath(p)) + "#product",
    name: p.en,
    alternateName: p.ta,
    sku: p.code,
    description: p.desc.en + " " + p.desc.ta,
    image: productImages(p),
    category: c ? c.en : undefined,
    brand: { "@type": "Brand", name: S.name.en },
    url: abs(productPath(p))
  };
  if (price != null) {
    ld.offers = {
      "@type": "Offer",
      url: abs(productPath(p)),
      price: price,
      priceCurrency: "INR",
      availability: "https://schema.org/" + (p.inStock ? "InStock" : "OutOfStock"),
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": BASE + "#store" },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: { "@type": "MonetaryAmount", value: S.shipping.fee, currency: "INR" },
        shippingDestination: { "@type": "DefinedRegion", addressCountry: "IN", addressRegion: "TN" }
      }
    };
    if (offerOn() && S.offer.endsOn && p.onOffer !== false) ld.offers.priceValidUntil = S.offer.endsOn;
  }
  return ld;
}
const ldScript = (graph) => '  <script type="application/ld+json">' + JSON.stringify({ "@context": "https://schema.org", "@graph": graph }) + "</script>\n";

/* ---------- <head> block ---------- */
function head(o) {
  const img = o.image;
  return (o.base ? '  <base href="' + o.base + '">\n' : "") +
    "  <title>" + esc(o.title) + "</title>\n" +
    '  <meta name="description" content="' + esc(o.description) + '">\n' +
    '  <meta name="robots" content="index, follow, max-image-preview:large">\n' +
    '  <link rel="canonical" href="' + esc(o.url) + '">\n' +
    '  <meta name="geo.region" content="IN-TN">\n' +
    '  <meta name="geo.placename" content="Lalpet, Cuddalore, Tamil Nadu">\n' +
    '  <meta property="og:site_name" content="' + esc(S.name.en + " | " + S.name.ta) + '">\n' +
    '  <meta property="og:type" content="' + (o.type || "website") + '">\n' +
    '  <meta property="og:title" content="' + esc(o.ogTitle || o.title) + '">\n' +
    '  <meta property="og:description" content="' + esc(o.description) + '">\n' +
    '  <meta property="og:url" content="' + esc(o.url) + '">\n' +
    '  <meta property="og:image" content="' + esc(img.url) + '">\n' +
    '  <meta property="og:image:width" content="' + img.w + '">\n' +
    '  <meta property="og:image:height" content="' + img.h + '">\n' +
    '  <meta property="og:image:alt" content="' + esc(o.ogTitle || o.title) + '">\n' +
    '  <meta property="og:locale" content="ta_IN">\n' +
    '  <meta property="og:locale:alternate" content="en_IN">\n' +
    (o.price != null ? '  <meta property="product:price:amount" content="' + o.price + '">\n  <meta property="product:price:currency" content="INR">\n' : "") +
    '  <meta name="twitter:card" content="summary_large_image">\n' +
    '  <meta name="twitter:title" content="' + esc(o.ogTitle || o.title) + '">\n' +
    '  <meta name="twitter:description" content="' + esc(o.description) + '">\n' +
    '  <meta name="twitter:image" content="' + esc(img.url) + '">\n' +
    ldScript(o.ld);
}

/* ---------- pre-rendered content (shown to crawlers / before JS runs) ---------- */
function thumb(p, size) {
  if (p.images && p.images.length)
    return '<img src="' + esc(p.images[0]) + '" alt="' + esc(p.en + " – " + p.ta + " – " + S.name.en) + '" width="' + size + '" height="' + size + '" loading="lazy">';
  return W.productArt(p).replace("<svg ", '<svg width="' + size + '" height="' + size + '" ');
}
function priceText(p) { const pr = priceOf(p); return pr == null ? "Price on WhatsApp · விலை WhatsApp-ல்" : money(pr) + (offerOn() && p.onOffer !== false ? " (offer price)" : ""); }
function productList(list) {
  return '<ul class="seo-list">' + list.map((p) =>
    '<li><a href="' + productPath(p) + '">' + thumb(p, 96) + "<span><b>" + esc(p.en) + "</b> · " + esc(p.ta) + "<br>" + esc(priceText(p)) + "</span></a></li>").join("") + "</ul>";
}
const shopInfo =
  "<h2>How to order · எப்படி ஆர்டர் செய்வது</h2>" +
  "<p>Add items to your cart and send the order to us on WhatsApp (+91 " + esc(S.whatsappDisplay || S.phoneDisplay) + "). Shipping is a flat ₹" + S.shipping.fee +
  " per order anywhere in Tamil Nadu by " + esc(S.shipping.courier) + ". Pay by UPI after we confirm your order.</p>" +
  "<p>பொருட்களைக் கார்ட்டில் சேர்த்து WhatsApp-ல் ஆர்டர் அனுப்புங்கள். தமிழ்நாடு முழுவதும் ST கொரியர் மூலம் ஒரு ஆர்டருக்கு ₹" + S.shipping.fee + " மட்டுமே ஷிப்பிங்.</p>" +
  "<h2>Visit our shop · எங்கள் கடை</h2><p>" + esc(S.address.en) + "<br>" + esc(S.address.ta) + "<br>Phone: +91 " + esc(S.phoneDisplay) + "</p>";

function homeBody() {
  return '<div class="seo-pre">' +
    "<h1>" + esc(S.name.en) + " · " + esc(S.name.ta) + " – Readymade clothing shop in Lalpet</h1>" +
    "<p>Readymade jackets (blouses), patiala, leggings and palazzo pants, burqa shawls, face veils, hand &amp; leg socks, inskirts, pillow covers, kids wear, cotton nighties, lungis and bedsheets" +
    (offerOn() ? " — offer price ₹" + S.offer.price + " on readymades" : "") + ". Delivered across Tamil Nadu by ST Courier for ₹" + S.shipping.fee + " per order.</p>" +
    "<p>லால்பேட்டை கவுஸ் ரெடிமேட்ஸ் — ரெடிமேட் ஜாக்கெட், பட்டியாலா, லெக்கின்ஸ், பிளாஜோ பேன்ட், புர்கா ஷால், குழந்தைகள் உடை, நைட்டி, லுங்கி, பெட்ஷீட் மற்றும் பல. தமிழ்நாடு முழுவதும் டெலிவரி.</p>" +
    "<h2>Categories · வகைகள்</h2><ul>" + CATS.map((c) => '<li><a href="' + categoryPath(c) + '">' + esc(c.en) + " · " + esc(c.ta) + "</a></li>").join("") + "</ul>" +
    "<h2>Products · பொருட்கள்</h2>" + productList(PRODUCTS) + shopInfo + "</div>";
}
function categoryBody(c) {
  const list = PRODUCTS.filter((p) => p.cat === c.id);
  return '<div class="seo-pre"><nav class="crumbs"><a href="./">Home</a> / <span>' + esc(c.en) + "</span></nav>" +
    "<h1>" + esc(c.en) + " · " + esc(c.ta) + " – " + esc(S.name.en) + ", Lalpet</h1>" +
    "<p>" + list.length + " products. Order on WhatsApp, delivery across Tamil Nadu for ₹" + S.shipping.fee + " per order.</p>" +
    productList(list) + shopInfo + "</div>";
}
function productBody(p) {
  const c = catOf(p);
  const related = PRODUCTS.filter((x) => x.cat === p.cat && x.id !== p.id);
  const opts = p.options.map((o) => "<li>" + esc((W.OPTION_LABELS[o.key] || { en: o.key }).en) + ": " + o.values.map(esc).join(", ") + "</li>").join("");
  return '<div class="seo-pre"><nav class="crumbs"><a href="./">Home</a> / <a href="' + categoryPath(c) + '">' + esc(c.en) + "</a> / <span>" + esc(p.en) + "</span></nav>" +
    '<div class="seo-pdp">' + thumb(p, 360) + "<div>" +
    "<h1>" + esc(p.en) + " · " + esc(p.ta) + "</h1>" +
    '<p class="seo-price">' + esc(priceText(p)) + "</p>" +
    "<p>" + esc(p.desc.en) + "</p><p>" + esc(p.desc.ta) + "</p>" +
    (opts ? "<ul>" + opts + "</ul>" : "") +
    "<p>Product code: " + esc(p.code) + " · " + (p.inStock ? "In stock" : "Sold out") + "</p>" +
    '<p><a href="https://wa.me/' + S.whatsapp + "?text=" + encodeURIComponent("Hi! I'm interested in " + p.en + " [" + p.code + "]\n" + abs(productPath(p))) + '">Order / ask on WhatsApp</a></p>' +
    "</div></div>" +
    (related.length ? "<h2>More " + esc(c.en) + "</h2>" + productList(related) : "") + shopInfo + "</div>";
}

/* ---------- assemble pages from the index.html template ---------- */
let template = read("index.html");
function between(s, name, content) {
  const re = new RegExp("(<!--" + name + ":START-->)[\\s\\S]*?(<!--" + name + ":END-->)");
  if (!re.test(s)) throw new Error("Marker " + name + " missing in index.html");
  return s.replace(re, (m, a, b) => a + content + b);
}
function page(o) {
  let s = template;
  s = between(s, "SEO-HEAD", "\n" + head(o) + "  ");
  s = between(s, "SEO-BODY", o.body);
  s = between(s, "SEO-ROUTE", o.route ? '<script>if(!location.hash)history.replaceState(null,"",location.pathname+location.search+"' + o.route + '");</script>' : "");
  return s;
}

const cats = CATS.map((c) => c.en.toLowerCase()).join(", ");
const offerLine = offerOn() ? "Offer: readymades ₹" + S.offer.price + ". " : "";
const catOffer = (list) => offerOn() && list.some((p) => p.onOffer !== false) ? offerLine : "";

// Home
write("index.html", page({
  url: BASE,
  title: S.name.en + " Lalpet | Readymade Jackets, Pants, Burqa, Nighties, Lungis & Bedsheets | " + S.name.ta,
  ogTitle: S.name.en + " · " + S.name.ta + " — Lalpet",
  description: offerLine + "Readymade jackets, patiala, leggings, palazzo, burqa shawl, niqab, kids wear, nighties, lungis & bedsheets from Lalpet. ₹" + S.shipping.fee +
    " shipping per order across Tamil Nadu by ST Courier. Order on WhatsApp. ரெடிமேட் ஜாக்கெட், பேன்ட், புர்கா.",
  image: { url: abs("images/og-image.png"), w: 1200, h: 630 },
  ld: [store, website, {
    "@type": "ItemList", name: "Products",
    itemListElement: PRODUCTS.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: abs(productPath(p)), name: p.en }))
  }],
  body: homeBody()
}));

// Categories
CATS.forEach((c) => {
  const list = PRODUCTS.filter((p) => p.cat === c.id);
  write(categoryPath(c) + "index.html", page({
    base: "../../",
    url: abs(categoryPath(c)),
    title: c.en + " (" + c.ta + ") | " + S.name.en + " Lalpet",
    description: catOffer(list) + list.map((p) => p.en).join(", ") + " at " + S.name.en + ", Lalpet. ₹" + S.shipping.fee + " shipping across Tamil Nadu. Order on WhatsApp.",
    image: ogImage(list.find((p) => p.images && p.images.length) || list[0]),
    ld: [store, breadcrumb([["Home", ""], [c.en, categoryPath(c)]]), {
      "@type": "CollectionPage", name: c.en + " – " + S.name.en, url: abs(categoryPath(c)),
      mainEntity: { "@type": "ItemList", itemListElement: list.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: abs(productPath(p)), name: p.en })) }
    }],
    body: categoryBody(c),
    route: "#/shop?cat=" + c.id
  }));
});

// Products
PRODUCTS.forEach((p) => {
  const c = catOf(p), price = priceOf(p);
  write(productPath(p) + "index.html", page({
    base: "../../",
    type: "product",
    url: abs(productPath(p)),
    title: p.en + " (" + p.ta + ")" + (price != null ? " – " + money(price) : "") + " | " + S.name.en + " Lalpet",
    ogTitle: p.en + " · " + p.ta + (price != null ? " – " + money(price) : ""),
    description: (price != null ? money(price) + (offerOn() && p.onOffer !== false ? " offer price. " : ". ") : "") + p.desc.en +
      " ₹" + S.shipping.fee + " shipping across Tamil Nadu. Order on WhatsApp.",
    image: ogImage(p),
    price: price,
    ld: [store, breadcrumb([["Home", ""], [c.en, categoryPath(c)], [p.en, productPath(p)]]), productLd(p)],
    body: productBody(p),
    route: "#/p/" + p.id
  }));
});

// Sitemap (with product images)
const urls = [["", "1.0", []]]
  .concat(CATS.map((c) => [categoryPath(c), "0.8", []]))
  .concat(PRODUCTS.map((p) => [productPath(p), "0.9", (p.images || []).map(abs)]));
write("sitemap.xml",
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n' +
  urls.map(([u, pr, imgs]) => "  <url><loc>" + abs(u) + "</loc><lastmod>" + TODAY + "</lastmod><priority>" + pr + "</priority>" +
    imgs.map((i) => "<image:image><image:loc>" + i + "</image:loc></image:image>").join("") + "</url>").join("\n") + "\n</urlset>\n");

console.log("SEO pages built: 1 home, " + CATS.length + " categories, " + PRODUCTS.length + " products, sitemap with " + urls.length + " URLs.");
