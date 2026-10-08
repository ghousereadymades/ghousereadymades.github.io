/*
 * ============================================================
 *  GHOUSE READYMADES — STORE SETTINGS
 *  Edit this file to change phone number, shipping fee,
 *  YouTube channel, offer banner, etc. No coding needed.
 * ============================================================
 */
window.STORE = {
  name: { en: "Ghouse Readymades", ta: "கவுஸ் ரெடிமேட்ஸ்" },

  // WhatsApp number for orders and chat, with country code, digits only
  whatsapp: "918072877443",
  whatsappDisplay: "80728 77443",
  // Phone number for calls (shown on Contact page and footer)
  phone: "+918220461646",
  phoneDisplay: "82204 61646",

  // Shown in every WhatsApp order so you know it came from the website
  siteUrl: "ghousereadymades.github.io",

  address: {
    en: "Chidambaram Main Road, Lalpet – 608 303 (Near Govt. Higher Secondary School)",
    ta: "சிதம்பரம் மெயின் ரோடு, லால்பேட்டை – 608 303 (அரசு மேல்நிலைப் பள்ளி அருகில்)"
  },
  mapQuery: "Chidambaram Main Road, Lalpet, Tamil Nadu 608303",

  currency: "₹",

  // OFFER PRICE — while the offer is on, every product (with onOffer: true)
  // sells at this price and the regular price is shown struck out.
  //  - active:  true = offer running, false = regular prices everywhere
  //  - endsOn:  last day of the offer as "YYYY-MM-DD" (e.g. "2026-10-15").
  //             The offer switches off by itself after this day.
  //             Leave "" to run until you set active: false.
  offer: {
    active: false,
    price: 100,
    endsOn: ""
  },

  shipping: {
    fee: 50,                 // flat per order, anywhere in Tamil Nadu
    courier: "ST Courier",
    allowPickup: true        // allow "collect from shop" (no shipping fee)
  },

  // Payment options shown at checkout (details are shared on WhatsApp)
  payments: ["upi", "bank"],
  allowCOD: false,           // set true if you accept cash on delivery

  // YouTube: your channel. The site automatically plays your latest uploads.
  // Optional: add video IDs below to feature specific videos instead.
  // Video ID = the part after "v=" in https://www.youtube.com/watch?v=XXXXXXXXXXX
  youtube: {
    channelUrl: "https://www.youtube.com/channel/UCCQc9rO-cJLVHudexjUz8rg",
    videos: [
      // { id: "XXXXXXXXXXX", title: { en: "New jacket collection", ta: "புதிய ஜாக்கெட் கலெக்ஷன்" } },
    ]
  },

  // Optional top banner for a YouTube / festival offer. Leave text empty to hide.
  offerBanner: {
    en: "",
    ta: ""
  },

  // Social media (leave "" to hide)
  instagram: "https://www.instagram.com/gouse_readymades/",
  facebook: "https://www.facebook.com/share/1DbG8ZxKdr/",
  whatsappGroup: "https://chat.whatsapp.com/ILBhrlZVVRd8Ge8y3qoh5h"
};
