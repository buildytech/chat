// Progressive enhancement, loaded with the CSP nonce; no inline handlers,
// no third-party code, no network requests.
//
// Privacy: the cart lives in sessionStorage of this tab (or in memory when
// storage is blocked). Nothing typed on the site is sent to the server, and
// no cookie is set for visitors. Prices always come from the catalog the
// server renders on the cart page.
(function () {
  "use strict";

  var KEY = "site-cart-v1";
  var memory = {};

  var load = function () {
    try {
      var raw = window.sessionStorage.getItem(KEY);
      return raw ? JSON.parse(raw) || {} : {};
    } catch (e) {
      return memory;
    }
  };
  var save = function (cart) {
    memory = cart;
    try { window.sessionStorage.setItem(KEY, JSON.stringify(cart)); } catch (e) { /* memory only */ }
  };
  var clampQty = function (n) {
    n = parseInt(n, 10);
    if (isNaN(n) || n < 0) { return 0; }
    return n > 99 ? 99 : n;
  };
  var setQty = function (slug, qty) {
    var cart = load();
    qty = clampQty(qty);
    if (qty === 0) { delete cart[slug]; } else { cart[slug] = qty; }
    var keys = Object.keys(cart);
    if (keys.length > 50) { delete cart[keys[0]]; }
    save(cart);
    return cart;
  };
  var count = function (cart) {
    return Object.keys(cart).reduce(function (n, k) { return n + clampQty(cart[k]); }, 0);
  };

  var updateBadge = function () {
    var n = String(count(load()));
    document.querySelectorAll("[data-cart-count]").forEach(function (el) { el.textContent = n; });
  };

  // Elements that only make sense with JavaScript.
  document.querySelectorAll("[data-js-hide]").forEach(function (el) { el.hidden = true; });
  document.querySelectorAll("[data-js-show]").forEach(function (el) { el.hidden = false; });
  updateBadge();

  // Product page: add to cart without any request.
  var showInCart = function (slug) {
    var q = load()[slug] || 0;
    document.querySelectorAll('[data-in-cart="' + slug + '"]').forEach(function (a) {
      a.hidden = q === 0;
      a.textContent = (a.getAttribute("data-in-cart-label") || "") + " " + q;
    });
  };
  document.querySelectorAll("[data-add-to-cart]").forEach(function (btn) {
    var slug = btn.getAttribute("data-add-to-cart");
    showInCart(slug);
    btn.addEventListener("click", function () {
      var input = document.getElementById(btn.getAttribute("data-qty-input") || "");
      var add = Math.max(1, clampQty(input ? input.value : 1));
      setQty(slug, (load()[slug] || 0) + add);
      updateBadge();
      showInCart(slug);
    });
  });

  // Cart page.
  var catalogEl = document.getElementById("cart-catalog");
  var message = document.getElementById("order-message");
  if (catalogEl && message) {
    var catalog = {};
    try { catalog = JSON.parse(catalogEl.textContent) || {}; } catch (e) { catalog = {}; }
    var products = catalog.products || {};
    var spec = catalog.money || { prefix: "", suffix: "", thousands: ",", decimal: "." };
    var fmt = function (minor) {
      var neg = minor < 0;
      if (neg) { minor = -minor; }
      var whole = String(Math.floor(minor / 100)), frac = minor % 100;
      var out = "";
      for (var i = 0; i < whole.length; i++) {
        if (i > 0 && (whole.length - i) % 3 === 0) { out += spec.thousands; }
        out += whole.charAt(i);
      }
      if (frac !== 0) { out += spec.decimal + (frac < 10 ? "0" : "") + frac; }
      return (neg ? "-" : "") + spec.prefix + out + spec.suffix;
    };
    var words = function (k) { return message.getAttribute("data-msg-" + k) || ""; };
    var clean = function (v, max) {
      v = String(v || "").replace(/[\r\n\t]+/g, " ").replace(/[\u0000-\u001f\u007f]/g, "").trim();
      return v.length > max ? v.slice(0, max) : v;
    };
    var list = document.querySelector("[data-cart-lines]");
    var proto = document.querySelector("[data-cart-proto]");
    var totalEl = document.querySelector("[data-cart-total]");
    var fields = document.querySelectorAll("[data-order-field]");
    var contact = document.getElementById("contact-button");
    var baseHref = contact ? contact.getAttribute("href") : "";
    var subject = (contact && contact.getAttribute("data-subject")) || document.title;
    var lines = [];

    var field = function (name) {
      var el = document.querySelector('[data-order-field="' + name + '"]');
      return el ? el.value : "";
    };

    var buildMessage = function () {
      var total = 0;
      var text = words("greeting") + "\n\n" + words("items") + ":\n";
      lines.forEach(function (l, i) {
        total += l.price * l.qty;
        text += (i + 1) + ". " + l.title + " x " + l.qty + " (" + fmt(l.price) + ") = " + fmt(l.price * l.qty) + "\n";
      });
      text += "\n" + words("total") + ": " + fmt(total) + "\n\n";
      text += words("name") + ": " + clean(field("name"), 120) + "\n";
      text += words("contact") + ": " + clean(field("contact"), 200);
      var note = clean(field("note"), 1000);
      if (note) { text += "\n" + words("note") + ": " + note; }
      message.value = text;
      if (totalEl) { totalEl.textContent = fmt(total); }
      if (contact && baseHref) {
        var kind = contact.getAttribute("data-prefill");
        var base = baseHref.split("?")[0];
        if (kind === "mailto") {
          contact.setAttribute("href", base + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(text));
        } else if (kind === "whatsapp") {
          contact.setAttribute("href", base + "?text=" + encodeURIComponent(text));
        }
      }
    };

    var render = function () {
      var cart = load();
      lines = [];
      Object.keys(cart).forEach(function (slug) {
        var p = products[slug];
        if (!p) { return; } // unpublished, out of stock or unknown: dropped
        lines.push({ slug: slug, title: p.title, href: p.href, image: p.image, price: p.price, qty: clampQty(cart[slug]) });
      });
      // forget slugs the catalog no longer has
      var kept = {};
      lines.forEach(function (l) { if (l.qty > 0) { kept[l.slug] = l.qty; } });
      save(kept);
      updateBadge();

      list.querySelectorAll("[data-cart-line]").forEach(function (el) {
        if (el.parentNode) { el.parentNode.removeChild(el); }
      });
      lines.forEach(function (l) {
        var row = proto.cloneNode(true);
        row.hidden = false;
        row.removeAttribute("data-cart-proto");
        row.setAttribute("data-cart-line", l.slug);
        var img = row.querySelector("[data-line-image]");
        if (l.image) { img.setAttribute("src", l.image); img.setAttribute("alt", ""); } else { img.remove(); }
        var title = row.querySelector("[data-line-title]");
        title.textContent = l.title;
        title.setAttribute("href", l.href);
        row.querySelector("[data-line-price]").textContent = fmt(l.price);
        row.querySelector("[data-line-total]").textContent = fmt(l.price * l.qty);
        var qty = row.querySelector("[data-line-qty]");
        var id = "qty-" + l.slug;
        qty.id = id;
        qty.value = String(l.qty);
        row.querySelector("[data-line-qty-label]").setAttribute("for", id);
        // re-render after the event (a change can fire while the row blurs)
        qty.addEventListener("change", function () { setQty(l.slug, qty.value); window.setTimeout(render, 0); });
        var rm = row.querySelector("[data-line-remove]");
        rm.setAttribute("aria-label", (rm.getAttribute("aria-label") || "") + ": " + l.title);
        rm.addEventListener("click", function () { setQty(l.slug, 0); window.setTimeout(render, 0); });
        list.appendChild(row);
      });

      var empty = lines.length === 0;
      document.querySelectorAll("[data-cart-empty]").forEach(function (el) { el.hidden = !empty; });
      document.querySelectorAll("[data-cart-filled]").forEach(function (el) { el.hidden = empty; });
      buildMessage();
    };

    fields.forEach(function (f) { f.addEventListener("input", buildMessage); });
    render();

    var copy = document.getElementById("copy-order");
    if (copy) {
      var label = copy.querySelector("[data-copy-label]");
      var original = label ? label.textContent : "";
      copy.addEventListener("click", function () {
        var done = function () {
          if (label) {
            label.textContent = copy.getAttribute("data-copied") || original;
            setTimeout(function () { label.textContent = original; }, 2000);
          }
        };
        var fallback = function () { message.select(); document.execCommand("copy"); done(); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(message.value).then(done, fallback);
        } else {
          fallback();
        }
      });
    }
  }

  // Cabinet settings: live preview of the contact button.
  var preview = document.getElementById("contact-preview");
  var classesEl = document.getElementById("button-classes");
  if (preview && classesEl) {
    var classes = {};
    try { classes = JSON.parse(classesEl.textContent) || {}; } catch (e) { classes = {}; }
    var get = function (id) { return document.getElementById(id); };
    var sync = function () {
      var v = get("s-contact_variant"), s = get("s-contact_size"), t = get("s-contact_label");
      var u = get("s-contact_url"), w = get("s-contact_new_window");
      var cls = classes[(v ? v.value : "default") + "|" + (s ? s.value : "lg")];
      if (cls) { preview.className = cls; }
      var lbl = preview.querySelector("[data-preview-label]");
      if (lbl) { lbl.textContent = (t && t.value.trim()) || preview.getAttribute("data-default-label") || ""; }
      preview.setAttribute("href", (u && u.value.trim()) || "#");
      if (w && w.checked) {
        preview.setAttribute("target", "_blank");
        preview.setAttribute("rel", "noopener noreferrer");
      } else {
        preview.removeAttribute("target");
        preview.removeAttribute("rel");
      }
    };
    ["s-contact_variant", "s-contact_size", "s-contact_label", "s-contact_url", "s-contact_new_window"].forEach(function (id) {
      var el = get(id);
      if (el) { el.addEventListener("input", sync); el.addEventListener("change", sync); }
    });
    preview.addEventListener("click", function (e) { e.preventDefault(); });
  }

  // Destructive buttons ask once.
  document.querySelectorAll("[data-confirm]").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      if (!window.confirm(btn.getAttribute("data-confirm"))) { e.preventDefault(); }
    });
  });
})();
