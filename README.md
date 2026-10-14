# Shop Website

## Run it
Run `npm start` and open http://localhost:3000 (see "Contact form and backend" below). Opening `index.html` directly works for browsing, but the contact form needs the server.

## Change shop details (one place)
Open `js/main.js` and edit the `CONFIG` block: name, tagline, WhatsApp number (digits only, with country code), phone, email, address, opening hours, social links, currency. Header, footer, contact page and every WhatsApp link update automatically. Every placeholder is marked `PLACEHOLDER` or `[Replace]`.

## Add or edit products
Open `js/products.js`. Copy an object in `PRODUCTS`, give it a unique `id`, and fill in the fields. Put photos in `assets/images/products/` and set `image: "assets/images/products/name.jpg"`. Extra photos go in `images: []`. Leave `image` empty to show a placeholder. Edit the `FILTERS` array to change the category buttons.

## Images
Replace these files with your own (placeholders show until you do):
`assets/images/hero/hero.jpg`, `assets/images/shop/shop.jpg`, `assets/images/shop/about.jpg`. Use compressed JPG or WebP, about 1200 px wide.

## Text on pages
Page copy for Home, About and Contact lives in the HTML files. Replace text marked `[Replace]`.

## Map
In `contact.html`, replace the map placeholder with the Google Maps embed `<iframe>`.

## Contact form and backend
The contact form posts to a small Node server (`server/server.js`, Node 18+, no packages needed). Messages are saved in `data/messages.json` and the seller reads them at `/admin`.

1. Copy `.env.example` to `.env` and set `ADMIN_PASSWORD` (10+ characters; the inbox stays off if it is missing, short, or still the example).
2. Run `npm start` and open http://localhost:3000. Customers use the contact page; the seller logs in at http://localhost:3000/admin.
3. Optional email alerts: fill in the `SMTP_*` lines in `.env` and run `npm install` (installs nodemailer).

Settings in `.env`: `SITE_URL`, `RETENTION_DAYS`, `MAX_MESSAGES`, `CONTACT_LIMIT`, `TRUST_PROXY`, `FORCE_HTTPS` (all explained in `.env.example`).

## Security
What is built in:
- **Seller login:** password checked on the server, then a random session in an HttpOnly, SameSite=Strict cookie (Secure over HTTPS). The password is never stored in the browser. Sessions last 8 hours. 8 wrong passwords lock a visitor out for 15 minutes, and failed logins are logged.
- **Cross-site protection:** the API only accepts JSON from your own site (Origin and Sec-Fetch-Site checks, set `SITE_URL` once live), so other websites cannot post to your form or inbox.
- **Browser protections:** strict Content-Security-Policy (no inline scripts or styles, nothing loaded from other sites except an optional Google Maps frame), HSTS over HTTPS, no framing, no sniffing, and a locked-down Permissions-Policy.
- **Abuse limits:** 5 messages per visitor per 10 minutes, 60 per hour overall, a hidden bot trap, a size limit, duplicate suppression, and a storage cap.
- **Safe output:** everything customers type is shown as plain text in the inbox, never as HTML. Emails cannot be hijacked with line breaks.
- **Private files:** only listed file types are served; `server/`, `tests/`, `data/`, `.env` and hidden files cannot be downloaded. Message files are created readable by the server user only.
- **Privacy:** set `RETENTION_DAYS` to delete old messages automatically.

What you must do when going live:
1. Run the site behind HTTPS. The easiest way is a reverse proxy such as Caddy (automatic certificates) in front of `npm start`. Then set `TRUST_PROXY=1`, `FORCE_HTTPS=1` and `SITE_URL=https://your-domain`.
2. Use a long, unique `ADMIN_PASSWORD` and never share or commit `.env`.
3. Keep Node updated and back up `data/messages.json`.
4. If you add a Google Maps embed, it already works with the policy (only `https://www.google.com` frames are allowed).
5. Add any new external script, font or image host to the policy in `secureHeaders()` in `server/server.js`, otherwise browsers will block it.

## Tests
`npm test` runs 19 backend tests (headers, hidden files, validation, cross-site blocking, rate limits, login, lockout, HTTPS settings).

## Notes
- The header and footer are built by `js/main.js`, so all pages stay consistent.
- Product cards are rendered from the `PRODUCTS` array. Product details open in a native `<dialog>` modal and can be linked as `products.html#product-3`.
- Animations respect `prefers-reduced-motion`.
