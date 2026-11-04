(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const API = window.SCOUTHUB_API, TOKEN_KEY = "scouthub.token";
  const MAX = 10 * 1048576;
  let cwd = [], rows = [], viewing = null;

  const getToken = () => { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } };
  const toLogin = () => { try { localStorage.removeItem(TOKEN_KEY); } catch {} location.replace("../ScoutHub/?next=" + encodeURIComponent(location.pathname + location.search)); };
  const say = (el, text, err = false) => { el.textContent = text; el.classList.toggle("error", err); };
  const fmt = n => n < 1024 ? `${n} o` : n < 1048576 ? `${(n / 1024).toFixed(1)} Ko` : `${(n / 1048576).toFixed(1)} Mo`;
  const b64 = bytes => { let s = ""; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  const path = (...more) => [...cwd, ...more].join("/");
  const ext = name => (name.split(".").pop() || "").toLowerCase();
  const kind = name => {
    const e = ext(name);
    if (["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"].includes(e)) return "image";
    if (e === "pdf") return "pdf";
    if (["txt", "md", "csv", "json", "xml", "html", "css", "js", "gpx", "dxf", "svg", "log", "yml", "yaml", "ini"].includes(e)) return "text";
    return "other";
  };
  const mime = name => ({ png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp", pdf: "application/pdf" }[ext(name)] || "application/octet-stream");
  const OPEN_WITH = window.SCOUTHUB_OPEN_WITH || {}, APPS = window.SCOUTHUB_APPS || [];
  const appsFor = name => (OPEN_WITH[ext(name)] || []).map(n => APPS.find(a => a.name === n)).filter(Boolean);
  const previewable = name => kind(name) !== "other";
  function openWith(app, name) {
    const u = new URL(app.url, location.href); u.searchParams.set("scoutcloud", path(name));
    window.open(u.href, "_blank", "noopener");
  }
  const icon = e => e.type === "dir" ? "📁" : ({ image: "🖼️", pdf: "📕", text: "📄", other: "📦" })[kind(e.name)];

  async function call(action, data = {}) {
    if (!API) throw new Error("Le serveur ScoutHub n’est pas configuré.");
    let res;
    try { res = await fetch(API, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ action, token: getToken(), ...data }) }); }
    catch { throw new Error("Serveur injoignable."); }
    let out; try { out = await res.json(); } catch { throw new Error("Réponse invalide du serveur."); }
    if (!out.ok) { if (/Session expirée/.test(out.error)) toLogin(); throw new Error(out.error || "Erreur."); }
    return out;
  }
  const put = (p, bytes) => { cacheDrop(); return call("put", { path: p, base64: b64(bytes) }).finally(cacheDrop); };
  const get = async p => unb64((await call("get", { path: p })).base64);

  function crumbs() {
    const nav = $("crumbs"); nav.textContent = "";
    const add = (label, depth) => {
      const b = document.createElement("button"); b.type = "button"; b.textContent = label;
      b.onclick = () => { cwd = cwd.slice(0, depth); list(); }; nav.append(b);
    };
    add("Mes fichiers", 0);
    cwd.forEach((p, i) => { nav.append(" / "); add(p, i + 1); });
  }

  // Liste mémorisée (partagée avec ScoutHub) : affichage immédiat, puis mise à jour depuis le serveur.
  const LS = "scouthub.ls:";
  const cacheGet = p => { try { return JSON.parse(localStorage.getItem(LS + p) || "null"); } catch { return null; } };
  const cachePut = (p, entries) => { try { localStorage.setItem(LS + p, JSON.stringify(entries)); } catch {} };
  const cacheDrop = () => { try { Object.keys(localStorage).filter(k => k.startsWith(LS)).forEach(k => localStorage.removeItem(k)); } catch {} };
  const sortRows = entries => entries.filter(e => e.name !== ".gitkeep").sort((a, b) => a.type === b.type ? a.name.localeCompare(b.name, "fr") : a.type === "dir" ? -1 : 1);
  let listSeq = 0;
  async function list() {
    const seq = ++listSeq, p = path(), cached = cacheGet(p);
    crumbs(); $("c-list").textContent = "";
    if (cached) { rows = sortRows(cached); render(); say($("c-status"), `${rows.length} élément(s) · actualisation…`); }
    else say($("c-status"), "Chargement…");
    try {
      const { entries } = await call("list", { path: p });
      cachePut(p, entries);
      if (seq !== listSeq) return;           // l'utilisateur a changé de dossier entre-temps
      rows = sortRows(entries); render();
    } catch (e) { if (seq === listSeq) say($("c-status"), e.message, true); }
  }

  function render() {
    const q = $("c-search").value.trim().toLowerCase(), ul = $("c-list"); ul.textContent = "";
    const shown = rows.filter(r => !q || r.name.toLowerCase().includes(q));
    say($("c-status"), shown.length ? `${shown.length} élément(s)` : (rows.length ? "Aucun résultat." : "Ce dossier est vide. Importez un fichier ou glissez-le ici."));
    shown.forEach(e => {
      const li = document.createElement("li");
      const ic = Object.assign(document.createElement("span"), { className: "ico", textContent: icon(e) });
      const name = Object.assign(document.createElement("button"), { type: "button", className: "file-name", textContent: e.name });
      const meta = Object.assign(document.createElement("span"), { className: "meta", textContent: e.type === "dir" ? "Dossier" : fmt(e.size) });
      const acts = document.createElement("span"); acts.className = "row-actions";
      const btn = (label, fn, cls = "") => { const b = Object.assign(document.createElement("button"), { type: "button", textContent: label, className: cls }); b.onclick = fn; acts.append(b); };
      if (e.type === "dir") name.onclick = () => { cwd.push(e.name); $("c-search").value = ""; list(); };
      else {
        const def = appsFor(e.name)[0];
        name.onclick = () => def ? openWith(def, e.name) : previewable(e.name) ? view(e) : download(e.name);
        name.title = def ? "Ouvrir avec " + def.name : "";
        openMenu(acts, e);
        if (previewable(e.name)) btn("Aperçu", () => view(e));
        btn("Télécharger", () => download(e.name)); btn("Renommer", () => rename(e.name));
        btn("Supprimer", async () => { if (!confirm(`Supprimer « ${e.name} » ?`)) return;
          try { cacheDrop(); await call("remove", { path: path(e.name) }); cacheDrop(); list(); } catch (x) { say($("c-status"), x.message, true); } }, "del");
      }
      li.append(ic, name, meta, acts); ul.append(li);
    });
  }

  // Menu « Ouvrir avec » : applications compatibles d'abord, puis toutes les autres.
  function openMenu(acts, e) {
    const wrap = document.createElement("span"); wrap.className = "menu-wrap";
    const b = Object.assign(document.createElement("button"), { type: "button", textContent: "Ouvrir avec ▾", className: "primary-sm" });
    const menu = document.createElement("div"); menu.className = "menu"; menu.hidden = true; menu.setAttribute("role", "menu");
    const good = appsFor(e.name), rest = APPS.filter(a => !good.includes(a) && a.name !== "ScoutCloud");
    const add = (a, dim) => {
      const it = Object.assign(document.createElement("button"), { type: "button", className: "menu-item" + (dim ? " dim" : "") }); it.setAttribute("role", "menuitem");
      it.append(Object.assign(document.createElement("img"), { src: "../ScoutHub/" + a.icon, alt: "", width: 20, height: 20 }), document.createTextNode(a.name));
      it.onclick = () => { menu.hidden = true; openWith(a, e.name); }; menu.append(it);
    };
    if (good.length) { menu.append(Object.assign(document.createElement("p"), { className: "menu-h", textContent: "Applications compatibles" })); good.forEach(a => add(a, false)); }
    menu.append(Object.assign(document.createElement("p"), { className: "menu-h", textContent: good.length ? "Autres applications" : "Choisir une application" })); rest.forEach(a => add(a, true));
    b.onclick = ev => { ev.stopPropagation(); document.querySelectorAll(".menu").forEach(m => { if (m !== menu) m.hidden = true; }); menu.hidden = !menu.hidden; };
    wrap.append(b, menu); acts.append(wrap);
  }
  document.addEventListener("click", () => document.querySelectorAll(".menu").forEach(m => m.hidden = true));

  function saveAs(name, bytes) {
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([bytes])); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  async function download(name) {
    say($("c-status"), "Téléchargement…");
    try { saveAs(name, await get(path(name))); say($("c-status"), ""); } catch (e) { say($("c-status"), e.message, true); }
  }
  async function rename(name) {
    const n = (prompt("Nouveau nom :", name) || "").trim();
    if (!n || n === name) return;
    try { say($("c-status"), "Renommage…"); const bytes = await get(path(name)); await put(path(n), bytes); await call("remove", { path: path(name) }); cacheDrop(); list(); }
    catch (e) { say($("c-status"), e.message, true); }
  }

  // ---------- aperçu et édition ----------
  let blobUrl = null;
  async function view(e) {
    const dlg = $("dlg-view"), body = $("view-body"); body.textContent = ""; say($("view-status"), "Chargement…");
    $("view-title").textContent = e.name; $("view-save").hidden = true; viewing = { name: e.name, bytes: null };
    dlg.showModal();
    try {
      const bytes = viewing.bytes = await get(path(e.name)); say($("view-status"), fmt(bytes.length));
      if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
      const k = kind(e.name);
      if (k === "image") { blobUrl = URL.createObjectURL(new Blob([bytes], { type: mime(e.name) })); body.append(Object.assign(document.createElement("img"), { src: blobUrl, alt: e.name })); }
      else if (k === "pdf") { blobUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })); body.append(Object.assign(document.createElement("iframe"), { src: blobUrl, title: e.name })); }
      else if (k === "text") {
        const ta = Object.assign(document.createElement("textarea"), { value: new TextDecoder().decode(bytes), spellcheck: false, id: "view-text" });
        body.append(ta); $("view-save").hidden = false;
      } else body.append(Object.assign(document.createElement("p"), { textContent: "Pas d’aperçu pour ce type de fichier : utilisez Télécharger." }));
    } catch (x) { say($("view-status"), x.message, true); }
  }
  $("view-dl").onclick = () => viewing && viewing.bytes && saveAs(viewing.name, viewing.bytes);
  $("view-save").onclick = async () => {
    try { say($("view-status"), "Enregistrement…"); const bytes = new TextEncoder().encode($("view-text").value); await put(path(viewing.name), bytes); viewing.bytes = bytes; say($("view-status"), "Enregistré."); list(); }
    catch (x) { say($("view-status"), x.message, true); }
  };
  document.querySelectorAll("[data-close]").forEach(b => b.onclick = () => b.closest("dialog").close());

  // ---------- import, création ----------
  async function upload(files) {
    for (const f of files) {
      if (f.size > MAX) { say($("c-status"), `« ${f.name} » dépasse 10 Mo.`, true); continue; }
      say($("c-status"), `Envoi de ${f.name}…`);
      try { await put(path(f.name), new Uint8Array(await f.arrayBuffer())); } catch (e) { say($("c-status"), e.message, true); return; }
    }
    list();
  }
  $("c-up").onclick = () => $("c-input").click();
  $("c-input").onchange = ev => { upload([...ev.target.files]); ev.target.value = ""; };
  $("c-refresh").onclick = list;
  $("c-search").oninput = render;
  $("c-newfolder").onclick = async () => {
    const n = (prompt("Nom du dossier :") || "").trim(); if (!n) return;
    try { await put(path(n, ".gitkeep"), new Uint8Array()); list(); } catch (e) { say($("c-status"), e.message, true); }
  };
  $("c-newfile").onclick = async () => {
    const n = (prompt("Nom du fichier (ex. notes.txt) :") || "").trim(); if (!n) return;
    try { await put(path(n), new TextEncoder().encode(" ")); await list(); view({ name: n, type: "file" }); } catch (e) { say($("c-status"), e.message, true); }
  };
  const panel = $("cloud");
  ["dragenter", "dragover"].forEach(t => panel.addEventListener(t, e => { e.preventDefault(); $("drop").hidden = false; }));
  ["dragleave", "drop"].forEach(t => panel.addEventListener(t, e => { e.preventDefault(); if (t === "drop" || e.target === panel) $("drop").hidden = true; }));
  panel.addEventListener("drop", e => { if (e.dataTransfer && e.dataTransfer.files.length) upload([...e.dataTransfer.files]); });

  // ---------- démarrage ----------
  if (!getToken()) toLogin();
  else {
    $("cloud").hidden = false;
    const dir = new URLSearchParams(location.search).get("dossier");
    if (dir) cwd = dir.split("/").filter(Boolean);
    try { const u = JSON.parse(localStorage.getItem("scouthub.user") || "null"); if (u) $("who").textContent = u.email; } catch {}
    list();                                   // la liste valide elle-même la session : plus d'appel « me » préalable
    call("me").then(o => { $("who").textContent = o.user.email; }).catch(() => {});
  }
})();
