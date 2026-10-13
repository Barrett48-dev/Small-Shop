/* ==========================================================
   products.js - product data, catalogue, filters, search, modal.
   TO ADD A PRODUCT: copy one object in PRODUCTS, give it a new
   unique id, and drop its photo in assets/images/products/.
   Leave image as "" to show a placeholder.
   tags: "new" = New Arrivals filter, "popular" = Popular filter.
   ========================================================== */
const PRODUCTS = [
  { id: 1, name: "Everyday Backpack", category: "Accessories", price: 18000, image: "", images: [], description: "Roomy, water-resistant backpack for work or school.", details: "[Replace] Padded straps, laptop sleeve and two side pockets. Available in black and grey.", available: true, featured: true, tags: ["popular"] },
  { id: 2, name: "Ceramic Mug Set", category: "Home & Living", price: 7500, image: "", images: [], description: "Set of four glazed mugs, dishwasher safe.", details: "[Replace] Four 300 ml mugs with a smooth glaze. Microwave and dishwasher safe.", available: true, featured: true, tags: ["new"] },
  { id: 3, name: "Wireless Earbuds", category: "Accessories", price: 22000, image: "", images: [], description: "Clear sound and up to 20 hours of battery with the case.", details: "[Replace] Bluetooth 5.3, charging case, three sizes of ear tips.", available: true, featured: true, tags: ["popular", "new"] },
  { id: 4, name: "Cotton Throw Blanket", category: "Home & Living", price: 12000, image: "", images: [], description: "Soft woven blanket for the sofa or bed.", details: "[Replace] 130 x 170 cm, 100% cotton, machine washable.", available: true, featured: true, tags: [] },
  { id: 5, name: "Leather Wallet", category: "Accessories", price: 9500, image: "", images: [], description: "Slim wallet with six card slots and a coin pocket.", details: "[Replace] Genuine leather, six card slots, one note compartment.", available: false, featured: true, tags: ["popular"] },
  { id: 6, name: "Desk Lamp", category: "Home & Living", price: 15000, image: "", images: [], description: "Dimmable LED lamp with a flexible neck.", details: "[Replace] Three brightness levels, USB powered, warm and cool light.", available: true, featured: true, tags: ["new"] },
  { id: 7, name: "Water Bottle 1L", category: "Accessories", price: 6000, image: "", images: [], description: "Insulated steel bottle that keeps drinks cold all day.", details: "[Replace] Double-wall stainless steel, leak-proof lid.", available: true, featured: false, tags: [] },
  { id: 8, name: "Storage Baskets (3)", category: "Home & Living", price: 11000, image: "", images: [], description: "Woven baskets in three sizes for tidy shelves.", details: "[Replace] Hand-woven, nesting design, sizes S, M and L.", available: true, featured: false, tags: [] }
];

/* Filter buttons. Use { tag } or { category }; edit freely. */
const FILTERS = [
  { label: "All" },
  { label: "New Arrivals", tag: "new" },
  { label: "Popular", tag: "popular" },
  { label: "Accessories", category: "Accessories" },
  { label: "Home & Living", category: "Home & Living" }
];

/* ---------- rendering ---------- */
const imgOf = p => p.image || placeholder(p.name, p.id);

function cardHTML(p) {
  return '<article class="product reveal">' +
    '<img src="' + esc(imgOf(p)) + '" data-ph="' + esc(p.name) + '" alt="' + esc(p.name) + '" loading="lazy" width="800" height="600">' +
    '<div class="p-body"><p class="cat">' + esc(p.category) + "</p><h3>" + esc(p.name) + "</h3>" +
    '<p class="desc">' + esc(p.description) + "</p>" +
    '<p class="meta"><strong class="price">' + formatPrice(p.price) + "</strong>" +
    '<span class="stock ' + (p.available ? "in" : "out") + '">' + (p.available ? "\u2713 In stock" : "\u2715 Out of stock") + "</span></p>" +
    '<div class="btn-row"><a class="btn btn-ghost" href="products.html#product-' + p.id + '" data-view="' + p.id + '" aria-label="View ' + esc(p.name) + '">View Product</a>' +
    '<a class="btn btn-primary" href="' + waLink(productMessage(p)) + '" target="_blank" rel="noopener noreferrer" aria-label="Order ' + esc(p.name) + ' on WhatsApp">Order on WhatsApp</a></div></div></article>';
}

function render(el, list, emptyMsg) {
  el.innerHTML = list.length ? list.map(cardHTML).join("") : '<div class="glass empty"><p>' + emptyMsg + "</p></div>";
  fixImages(el);
  observeReveals();
}

/* ---------- home page: featured ---------- */
const featuredEl = document.getElementById("featured-grid");
if (featuredEl) render(featuredEl, PRODUCTS.filter(p => p.featured).slice(0, 6), "No featured products yet.");

/* ---------- products page ---------- */
const gridEl = document.getElementById("product-grid");
if (gridEl) {
  const state = { q: "", filter: 0 };
  const search = document.getElementById("search"), chips = document.getElementById("filters"), count = document.getElementById("count");

  chips.innerHTML = FILTERS.map((f, i) => '<button class="chip" type="button" data-i="' + i + '" aria-pressed="' + (i === 0) + '">' + esc(f.label) + "</button>").join("");

  function update() {
    const f = FILTERS[state.filter], q = state.q.trim().toLowerCase();
    const list = PRODUCTS.filter(p =>
      (!f.tag || (p.tags || []).includes(f.tag)) &&
      (!f.category || p.category === f.category) &&
      (!q || (p.name + " " + p.description + " " + p.category).toLowerCase().includes(q)));
    render(gridEl, list, "No products match your search. Try another word or choose All.");
    count.textContent = list.length + (list.length === 1 ? " product" : " products");
  }
  search.addEventListener("input", () => { state.q = search.value; update(); });
  chips.addEventListener("click", e => {
    const b = e.target.closest(".chip"); if (!b) return;
    state.filter = +b.dataset.i;
    chips.querySelectorAll(".chip").forEach(c => c.setAttribute("aria-pressed", c === b));
    update();
  });
  update();

  /* ---------- product details modal ---------- */
  const modal = document.getElementById("product-modal"), mainImg = document.getElementById("pm-img");
  function openProduct(id) {
    const p = PRODUCTS.find(x => x.id === id); if (!p) return;
    const pics = [imgOf(p)].concat(p.images || []);
    const show = (src, i) => {
      mainImg.removeAttribute("data-fb"); mainImg.dataset.ph = p.name;
      mainImg.src = src; mainImg.alt = p.name + (pics.length > 1 ? " - photo " + (i + 1) : "");
      document.querySelectorAll("#pm-thumbs button").forEach((b, j) => b.setAttribute("aria-current", j === i));
    };
    document.getElementById("pm-thumbs").innerHTML = pics.length > 1
      ? pics.map((s, i) => '<button type="button" aria-label="Show photo ' + (i + 1) + '"><img src="' + esc(s) + '" data-ph="' + esc(p.name) + '" alt=""></button>').join("") : "";
    document.querySelectorAll("#pm-thumbs button").forEach((b, i) => b.addEventListener("click", () => show(pics[i], i)));
    show(pics[0], 0);
    document.getElementById("pm-cat").textContent = p.category;
    document.getElementById("pm-title").textContent = p.name;
    document.getElementById("pm-price").textContent = formatPrice(p.price);
    document.getElementById("pm-stock").innerHTML = '<span class="stock ' + (p.available ? "in" : "out") + '">' + (p.available ? "\u2713 In stock" : "\u2715 Out of stock") + "</span>";
    document.getElementById("pm-desc").textContent = p.details || p.description;
    document.getElementById("pm-wa").href = waLink(productMessage(p));
    if (!modal.open) modal.showModal();
    document.body.classList.add("modal-open");
    fixImages(modal);
    history.replaceState(null, "", "#product-" + id);
  }
  const closeModal = () => modal.open && modal.close();
  gridEl.addEventListener("click", e => {
    const a = e.target.closest("[data-view]");
    if (a) { e.preventDefault(); openProduct(+a.dataset.view); }
  });
  document.getElementById("pm-close").addEventListener("click", closeModal);
  document.getElementById("pm-back").addEventListener("click", closeModal);
  modal.addEventListener("click", e => { if (e.target === modal) closeModal(); });
  modal.addEventListener("close", () => { document.body.classList.remove("modal-open"); history.replaceState(null, "", location.pathname); });

  /* open directly from a link such as products.html#product-3 */
  const m = location.hash.match(/^#product-(\d+)$/);
  if (m) openProduct(+m[1]);
}
