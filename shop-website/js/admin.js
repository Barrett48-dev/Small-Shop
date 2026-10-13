/* admin.js - seller inbox. Logs in through /api/login (HttpOnly cookie);
   the password is never stored in the browser. */
(function () {
  const login = document.getElementById("login"), inbox = document.getElementById("inbox"),
        list = document.getElementById("msg-list"), count = document.getElementById("inbox-count"),
        err = document.getElementById("login-err");

  const api = (url, opt) => fetch(url, Object.assign({ credentials: "same-origin" }, opt, { headers: { "Content-Type": "application/json" } }))
    .then(async r => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw Object.assign(new Error(d.error || "Request failed."), { status: r.status });
      return d;
    });
  const show = ok => { login.hidden = ok; inbox.hidden = !ok; };

  function card(m) {
    const digits = (m.phone || "").replace(/\D/g, "");
    return '<article class="glass msg' + (m.read ? "" : " unread") + '" data-id="' + esc(m.id) + '">' +
      '<div class="msg-top"><h3>' + esc(m.name) + (m.read ? "" : ' <span class="stock in">New</span>') + "</h3>" +
      '<time class="muted small">' + esc(new Date(m.createdAt).toLocaleString()) + "</time></div>" +
      '<p class="msg-body">' + esc(m.message) + "</p>" +
      '<p class="small muted"><a href="mailto:' + esc(m.email) + '">' + esc(m.email) + "</a>" +
      (m.phone ? '<br><a href="tel:' + esc(m.phone) + '">' + esc(m.phone) + "</a>" : "") + "</p>" +
      '<div class="btn-row"><a class="btn btn-primary" href="mailto:' + esc(m.email) + "?subject=" + encodeURIComponent("Re: your message to " + CONFIG.name) + '">Reply by email</a>' +
      (digits ? '<a class="btn btn-ghost" target="_blank" rel="noopener noreferrer" href="https://wa.me/' + digits + '">Reply on WhatsApp</a>' : "") +
      '<button class="btn btn-ghost" type="button" data-act="read">' + (m.read ? "Mark as unread" : "Mark as read") + "</button>" +
      '<button class="btn btn-ghost" type="button" data-act="del">Delete</button></div></article>';
  }
  function render(msgs) {
    count.textContent = msgs.length + (msgs.length === 1 ? " message" : " messages") + ", " + msgs.filter(m => !m.read).length + " unread";
    list.innerHTML = msgs.length ? msgs.map(card).join("") : '<div class="glass empty"><p>No messages yet. New messages from the contact form appear here.</p></div>';
  }
  async function refresh(quiet) {
    try { render(await api("/api/messages")); show(true); }
    catch (e) {
      if ([401, 503].includes(e.status)) { show(false); if (!quiet) err.textContent = e.message === "Please log in." ? "Your session ended. Please log in again." : e.message; }
      else count.textContent = "Could not reach the server. " + e.message;
    }
  }

  login.addEventListener("submit", async e => {
    e.preventDefault(); err.textContent = "";
    const field = document.getElementById("pw");
    try { await api("/api/login", { method: "POST", body: JSON.stringify({ password: field.value }) }); field.value = ""; refresh(); }
    catch (x) { err.textContent = x.status ? x.message : "Could not reach the server."; field.value = ""; }
  });
  list.addEventListener("click", async e => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const el = b.closest(".msg"), id = el.dataset.id;
    try {
      if (b.dataset.act === "del") { if (!confirm("Delete this message? This cannot be undone.")) return; await api("/api/messages/" + id, { method: "DELETE" }); }
      else await api("/api/messages/" + id, { method: "PATCH", body: JSON.stringify({ read: el.classList.contains("unread") }) });
      refresh();
    } catch (x) { if (x.status === 401) refresh(); else count.textContent = x.message; }
  });
  document.getElementById("refresh").addEventListener("click", () => refresh());
  document.getElementById("logout").addEventListener("click", async () => { try { await api("/api/logout", { method: "POST" }); } catch (x) { /* ignore */ } show(false); });
  setInterval(() => { if (!inbox.hidden) refresh(true); }, 30000);
  refresh(true);                                           // picks up an existing session
})();
