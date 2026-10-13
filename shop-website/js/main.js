/* ==========================================================
   main.js - central config, shared header/footer, WhatsApp,
   image fallbacks, scroll reveal, contact form.
   EDIT THE CONFIG BELOW. Everything else updates automatically.
   ========================================================== */
const CONFIG = {
  name: "Shop Name",                         // PLACEHOLDER
  tagline: "Good things for everyday life",       // PLACEHOLDER
  description: "A friendly local shop with quality products at fair prices.", // PLACEHOLDER
  whatsapp: "237679145342",                       // PLACEHOLDER: country code + number, digits only
  phone: "+237 679 145 342",                      // PLACEHOLDER
  email: "bennybarrett346@gmail.com",                // PLACEHOLDER
  address: "Street name, Neighbourhood, City",    // PLACEHOLDER
  currency: "FCFA",
  apiUrl: "/api/contact",                         // contact form endpoint (see server/server.js)
  hours: [                                        // PLACEHOLDER
    ["Monday - Friday", "8:00 - 18:00"],
    ["Saturday", "9:00 - 17:00"],
    ["Sunday", "Closed"]
  ],
  social: { Instagram: "#", Facebook: "#", TikTok: "#" } // PLACEHOLDER: replace "#" with your page URLs
};

document.documentElement.classList.add("js");

/* ---------- helpers ---------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const formatPrice = n => new Intl.NumberFormat("en-US").format(n) + " " + CONFIG.currency;

/** Only allow safe link targets from CONFIG (blocks javascript: URLs). */
const safeUrl = u => /^(https?:\/\/|mailto:|tel:|#)/i.test(String(u).trim()) ? String(u).trim() : "#";

/** Reusable WhatsApp link builder. */
function waLink(message) {
  const number = String(CONFIG.whatsapp || "").replace(/\D/g, "");
  return "https://wa.me/" + number + "?text=" + encodeURIComponent(message);
}
/** Standard order message for a product. */
function productMessage(p) {
  return "Hello! I'm interested in buying " + p.name + " for " + formatPrice(p.price) + ". Is it currently available?";
}

/** Inline SVG placeholder used when an image file is missing. */
function placeholder(label, seed) {
  const h = [35, 230, 260, 190][(seed || 0) % 4];
  const svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 600'><defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>" +
    "<stop offset='0' stop-color='hsl(" + h + " 65% 36%)'/><stop offset='1' stop-color='hsl(" + (h + 50) + " 55% 16%)'/></linearGradient></defs>" +
    "<rect width='800' height='600' fill='url(#g)'/><circle cx='640' cy='130' r='130' fill='white' fill-opacity='.08'/>" +
    "<text x='400' y='315' fill='white' fill-opacity='.85' font-family='sans-serif' font-size='40' text-anchor='middle'>" + esc(label) + "</text></svg>";
  return "data:image/svg+xml," + encodeURIComponent(svg);
}
/** Swap a broken image (one that has data-ph="label") for a placeholder. */
function fallback(img) {
  if (img.dataset.ph === undefined || img.dataset.fb) return;   // no label, or already swapped (avoids loops)
  img.dataset.fb = "1";
  img.src = placeholder(img.dataset.ph, img.alt.length);
}
document.addEventListener("error", e => { if (e.target.tagName === "IMG") fallback(e.target); }, true);
/** Catch images that failed before this script ran. */
function fixImages(root) {
  (root || document).querySelectorAll("img[data-ph]").forEach(img => {
    if (img.complete && img.naturalWidth === 0 && !img.src.startsWith("data:")) fallback(img);
  });
}

/* ---------- icons ---------- */
const ICONS = {
  star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1"/>',
  shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  chat: '<path d="M4 5h16v11H9l-5 4z"/>',
  phone: '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 005 5L15 12l5 2v4a2 2 0 01-2 2A16 16 0 013 5a2 2 0 012-2z"/>',
  wa: '<path d="M3 21l1.6-4.7A8.5 8.5 0 1112 20.5a8.5 8.5 0 01-4-1z"/><path d="M9 8.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 .7a3.5 3.5 0 01-1.7-1.7l.7-1-1-2z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>',
  pin: '<path d="M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
};
const icon = n => '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[n] + "</svg>";

/* ---------- shared header + footer ---------- */
function buildChrome() {
  const page = location.pathname.split("/").pop() || "index.html";
  const nav = [["Home", "index.html"], ["Products", "products.html"], ["About", "about.html"], ["Contact", "contact.html"]];
  const n = esc(CONFIG.name);
  document.getElementById("site-header").innerHTML =
    '<div class="container nav"><a class="logo" href="index.html" aria-label="' + n + ' home"><span class="logo-mark">' + esc(CONFIG.name[0]) + "</span><span>" + n + "</span></a>" +
    '<button class="nav-toggle" aria-expanded="false" aria-controls="nav-links" aria-label="Open menu"><span></span><span></span><span></span></button>' +
    '<ul id="nav-links" class="nav-links">' +
    nav.map(l => '<li><a href="' + l[1] + '"' + (l[1] === page ? ' aria-current="page"' : "") + ">" + l[0] + "</a></li>").join("") +
    '<li><a class="btn btn-primary" data-wa href="#">WhatsApp</a></li></ul></div>';

  document.getElementById("site-footer").innerHTML =
    '<div class="container foot">' +
    '<div><a class="logo" href="index.html"><span class="logo-mark">' + esc(CONFIG.name[0]) + "</span><span>" + n + "</span></a><p class=\"foot-desc\">" + esc(CONFIG.description) + "</p>" +
    '<ul class="social">' +
    Object.entries(CONFIG.social).map(([k, v]) => '<li><a href="' + esc(safeUrl(v)) + '" target="_blank" rel="noopener noreferrer">' + esc(k) + "</a></li>").join("") + "</ul></div>" +
    "<div><h3>Quick links</h3><ul>" + nav.map(l => '<li><a href="' + l[1] + '">' + l[0] + "</a></li>").join("") + "</ul></div>" +
    "<div><h3>Contact</h3><ul><li>" + esc(CONFIG.address) + '</li><li><a data-tel href="#">' + esc(CONFIG.phone) + '</a></li><li><a href="mailto:' + esc(CONFIG.email) + '">' + esc(CONFIG.email) + '</a></li><li><a data-wa href="#">Chat on WhatsApp</a></li></ul></div>' +
    "<div><h3>Opening hours</h3><ul>" + CONFIG.hours.map(h => "<li><p>" + esc(h[0]) + ": " + esc(h[1]) + "</p></li>").join("") + "</ul></div></div>" +
    '<div class="container copy">&copy; ' + new Date().getFullYear() + " " + n + ". All rights reserved.</div>";

  /* floating WhatsApp button */
  const f = document.createElement("a");
  f.className = "wa-float"; f.setAttribute("data-wa", ""); f.setAttribute("aria-label", "Chat on WhatsApp"); f.href = "#";
  f.innerHTML = icon("wa");
  document.body.appendChild(f);

  /* mobile menu */
  const btn = document.querySelector(".nav-toggle"), list = document.getElementById("nav-links");
  const setMenu = open => { list.classList.toggle("open", open); btn.setAttribute("aria-expanded", open); btn.setAttribute("aria-label", open ? "Close menu" : "Open menu"); };
  btn.addEventListener("click", () => setMenu(!list.classList.contains("open")));
  document.addEventListener("keydown", e => { if (e.key === "Escape") setMenu(false); });
  list.addEventListener("click", e => { if (e.target.closest("a")) setMenu(false); });
}

/* ---------- bind config values into the page ---------- */
function bindConfig() {
  document.querySelectorAll("[data-cfg]").forEach(el => { el.textContent = CONFIG[el.dataset.cfg]; });
  document.querySelectorAll(".logo-mark:empty").forEach(el => { el.textContent = CONFIG.name[0]; });
  document.querySelectorAll("[data-wa]:not([target])").forEach(a => {
    a.href = waLink("Hello! I'd like to ask about your products.");
    a.target = "_blank"; a.rel = "noopener noreferrer";
  });
  document.querySelectorAll("[data-tel]").forEach(a => { a.href = "tel:" + CONFIG.phone.replace(/[^\d+]/g, ""); });
  document.querySelectorAll("[data-icon]").forEach(s => { s.innerHTML = icon(s.dataset.icon); });
  document.title = document.body.dataset.title + " | " + CONFIG.name;
}

/* ---------- scroll reveal (call again after rendering new content) ---------- */
let revealObserver;
function observeReveals() {
  if (!("IntersectionObserver" in window)) { document.querySelectorAll(".reveal").forEach(e => e.classList.add("in")); return; }
  revealObserver = revealObserver || new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); revealObserver.unobserve(e.target); } });
  }, { threshold: .12 });
  document.querySelectorAll(".reveal:not(.in)").forEach(el => revealObserver.observe(el));
}

/* ---------- contact page ---------- */
function initContact() {
  const info = document.getElementById("contact-info");
  if (!info) return;
  info.innerHTML =
    '<li><span class="icon">' + icon("phone") + '</span><div>Phone<br><a data-tel href="#">' + esc(CONFIG.phone) + "</a></div></li>" +
    '<li><span class="icon">' + icon("wa") + '</span><div>WhatsApp<br><a data-wa href="#">Message us</a></div></li>' +
    '<li><span class="icon">' + icon("mail") + '</span><div>Email<br><a href="mailto:' + esc(CONFIG.email) + '">' + esc(CONFIG.email) + "</a></div></li>" +
    '<li><span class="icon">' + icon("pin") + "</span><div>Address<br>" + esc(CONFIG.address) + "</div></li>";
  document.getElementById("contact-hours").innerHTML = CONFIG.hours.map(h => "<li><span>" + esc(h[0]) + "</span><span>" + esc(h[1]) + "</span></li>").join("");
  bindConfig();

  const form = document.getElementById("contact-form");
  const rules = {
    name: v => v.trim().length < 2 ? "Enter your name." : "",
    email: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? "" : "Enter a valid email address, like name@example.com.",
    phone: v => v && !/^\+?[\d\s()-]{7,}$/.test(v) ? "Enter a valid phone number, or leave this empty." : "",
    message: v => v.trim().length < 10 ? "Write at least 10 characters." : ""
  };
  form.addEventListener("submit", async e => {
    e.preventDefault();
    let first = null;
    Object.keys(rules).forEach(k => {
      const field = form.elements[k], msg = rules[k](field.value);
      document.getElementById("e-" + (k === "message" ? "msg" : k)).textContent = msg;
      field.setAttribute("aria-invalid", msg ? "true" : "false");
      if (msg && !first) first = field;
    });
    if (first) return first.focus();
    const d = Object.fromEntries(new FormData(form));
    const body = d.message + "\n\nName: " + d.name + "\nEmail: " + d.email + (d.phone ? "\nPhone: " + d.phone : "");
    const btn = e.submitter || form.querySelector("button[value=send]");   // older Safari has no e.submitter
    if (btn.value === "wa") { window.open(waLink(body), "_blank", "noopener,noreferrer"); return; }
    const status = document.getElementById("form-status");
    btn.disabled = true; status.className = "status"; status.textContent = "Sending...";
    try {
      const res = await fetch(CONFIG.apiUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Your message could not be sent.");
      form.reset(); status.classList.add("ok");
      status.textContent = "Message sent. The shop will reply to " + d.email + " soon.";
    } catch (err) {
      status.classList.add("bad");
      status.textContent = (err instanceof TypeError ? "Could not reach the server." : err.message) + " You can send it on WhatsApp instead.";
    } finally { btn.disabled = false; }
  });
}

buildChrome();
bindConfig();
fixImages();
initContact();
observeReveals();
