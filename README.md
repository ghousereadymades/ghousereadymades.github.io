# Ghouse Readymades · கவுஸ் ரெடிமேட்ஸ்

The online shop for **Ghouse Readymades**, Chidambaram Main Road, Lalpet – 608 303.
Each product has its own price. Products without a price yet can still be ordered, and the price is confirmed on WhatsApp. An optional offer price (for example ₹100) can be switched on in `js/config.js`; it is currently off. Shipping is a flat ₹50 per order anywhere in Tamil Nadu, by ST Courier.
Customers order on WhatsApp.

The site is plain HTML, CSS and JavaScript. It has no server and no build step, so it runs directly on **GitHub Pages**.

## Features

- **English + Tamil.** One tap switches the language, and the choice is remembered. Tamil is the default.
- **Catalogue of 20 products.** It has the 15 items from the shop price list, plus nighties, lungis and bedsheets. Customers can search in English or Tamil, filter by category and sort.
- **Product pages.** Customers pick size, age or type and a colour, and set the quantity. Each page has Buy now, Ask on WhatsApp, Share and Wishlist buttons, plus related and recently viewed products.
- **Quick-add popup.** Customers can add a product straight from the product grid.
- **Cart.** It shows the ₹50 flat shipping and how much each item costs once shipping is included (for example, 5 items work out to ₹110 each). It also suggests other products, which leaves the shipping fee unchanged.
- **Order page with a WhatsApp preview.** It shows the shop's profile in WhatsApp style and a live preview of the message. The customer taps once to send the full order to WhatsApp 80728 77443. Every message ends with:
  > 🌐 This order is placed through **ghousereadymades.github.io**
- **Checkout form.** The phone number and Tamil Nadu pincode are checked, all 38 districts plus Puducherry are listed, and customers can choose ST Courier or collect from the shop. The form can remember the customer's details.
- **Order IDs and order history.** Each order gets an ID (for example `GR260926-4821`). The *My Orders* page lets a customer resend an order on WhatsApp or order the same items again.
- **Other sections:**
  - YouTube section
  - Shop price-list poster
  - FAQ
  - Map and directions
  - Floating WhatsApp button
  - Bottom navigation bar on mobile
  - Can be installed as an app and works offline
  - Search engine data (SEO / structured data)

## Editing the shop (no coding needed)

| What to change | File |
|---|---|
| WhatsApp order number (`whatsapp`), call number (`phone`), shipping fee, YouTube link, offer banner, cash on delivery | `js/config.js` |
| Products, prices, sizes, sold out, photos | `js/products.js` |
| Any website text (English / Tamil) | `js/i18n.js` |

**Adding real product photos.** Upload the photo to the `images/products/` folder. Then add it to the product in `js/products.js` (one photo per product):

```js
images: ["images/products/readymade-jacket-1.jpg"],
```

Until you add a photo, the site shows a drawn picture of the product.

The current photos of the readymade jacket, patiala, leggings, palazzo, burqa shawl, kids wear, nighties, lungis and bedsheets are cropped from frames of the shop's own YouTube Shorts. Clear photos taken on a plain background will look even better. Replace them any time.

**YouTube.** The site is linked to your channel (`channelUrl` in `js/config.js`) and has a Subscribe button. The video box plays your channel's latest uploads automatically, so new videos appear on the site without any change. To feature specific videos instead, add their IDs to `videos` in `js/config.js`. The ID is the part after `v=` in the video link.

**Prices.** Set each product's `regularPrice` in `js/products.js` (for example `regularPrice: 250`).
- A product without a price shows **"Price on WhatsApp"**. Customers can still add it to the cart. Its line in the WhatsApp order says "price to be confirmed", and the total is marked with "+" and a note about how many prices need confirming.

**Offers (currently switched off).**
- In `js/products.js`, set each product's `regularPrice` (for example `regularPrice: 250`). During the offer, the site shows ~~₹250~~ **₹100**, an "OFFER −60%" badge and "You save ₹150".
- In `js/config.js`, the `offer` block controls the offer:
  - `active: true` runs the offer, and `active: false` switches every product back to its regular price.
  - `price` is the offer price (₹100).
  - `endsOn: "2026-10-15"` shows "Offer ends 15 Oct · 4 days left" and switches the offer off by itself after that day. Leave it `""` to run until you set `active: false`.
- To keep one product out of the offer, set `onOffer: false` for it.
- A product without a `regularPrice` shows "Ask price on WhatsApp" once the offer is off.
- While the offer is off, the ₹100 price-list poster, the ₹100 badges and the offer bar are hidden automatically.

**Social media.** In `js/config.js`, `instagram`, `facebook` and `whatsappGroup` hold your Instagram, Facebook page and WhatsApp group links. They appear in the footer and on the Contact page. The WhatsApp group also gets an "offer alerts" box on the home page and after each order. Set any of them to `""` to hide it.

**Showing a custom message at the top of the site.** In `js/config.js`, fill in the `offerBanner` text in English and Tamil. Leave it empty to show the automatic offer message (or nothing when no offer is running).

**Marking a product as sold out.** Set `inStock: false` for that product in `js/products.js`.

## SEO (Google search and link previews)

- **A real page for every product and category.** For example, `product/readymade-jacket/` and `category/pants/`. Each page has its own title and description, bilingual content, a share image and structured data (Product, Offer with price and shipping, BreadcrumbList, ClothingStore, WebSite). Google can index each product separately, and a product link shared on WhatsApp or Facebook shows the product picture and name.
- **The site uses these links.** The Share button and "Ask on WhatsApp" send the product page link.
- **`sitemap.xml`** lists every page, with product photos.
- **Rebuilding the pages.** The generated pages come from `js/config.js` and `js/products.js`. A GitHub Action (`.github/workflows/build-seo.yml`) rebuilds them automatically when those files change on `main`. To rebuild by hand, run `node tools/build-seo.js`. To remake the share images (this needs Playwright), run `node tools/build-og.js`.
- **Google Search Console.** Add the site at https://search.google.com/search-console as a *URL prefix* property: `https://ghousereadymades.github.io/`. Because this is the account's own root site, `robots.txt` is read here too. Verify it with the HTML-tag method by pasting the tag into `index.html`, then submit `sitemap.xml`.
- **Google Business Profile.** Setting up a free profile for the Lalpet shop (https://business.google.com) that links to this website helps the most for "readymade shop near me" searches.

## Publishing on GitHub Pages

The site is live at **https://ghousereadymades.github.io/** (Settings → Pages → `main`, `/ (root)`).
Any change merged into `main` goes live within a minute or two.

## Testing on your computer

```bash
python3 -m http.server 8000
# open http://localhost:8000
```
