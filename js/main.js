/**
 * SolarPro Global — main.js
 * ─────────────────────────────────────────────────────────────
 * Theme toggle, currency switcher, navbar, scroll reveal, counters,
 * testimonial slider, accordion, portfolio filter, lightbox, cookie
 * banner, back-to-top, contact form, active nav link, copyright year.
 *
 * No dependencies — vanilla JS only.
 *
 * Every selector here is verified against the markup by
 * `node guardrails/run.js behaviour`, which drives the real UI in a
 * browser. An earlier version of this file targeted an older set of
 * class names (.tslide, .faq-q, .pitem, .cbtn, .navlink) that the pages
 * never used, so the slider, accordion, portfolio filter, lightbox,
 * currency switcher and active-nav highlight all silently did nothing.
 * Nothing errored — the listeners simply bound to zero elements.
 */

/* ============================================================
   THEME
   ============================================================ */
var TKEY = 'solarproTheme';
var CKEY = 'solarproCurrency';

/* Three preferences, not two. 'system' follows the operating system's
   appearance setting and keeps following it, so a machine that switches to
   dark at sunset takes the page with it without a reload. */
var THEME_ORDER = ['system', 'light', 'dark'];

var THEME_ICONS = {
  light: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
  dark:  '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>',
  system: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>'
};

var THEME_LABELS = {
  system: 'Theme: follows your device. Click for light mode.',
  light:  'Theme: light. Click for dark mode.',
  dark:   'Theme: dark. Click to follow your device.'
};

var _darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

function _readPref() {
  var pref = null;
  try { pref = localStorage.getItem(TKEY); } catch (e) {}
  return THEME_ORDER.indexOf(pref) === -1 ? 'system' : pref;
}

/** Which of light/dark a preference resolves to right now. */
function _resolve(pref) {
  if (pref === 'light' || pref === 'dark') return pref;
  return _darkQuery.matches ? 'dark' : 'light';
}

function _applyTheme(pref, persist) {
  if (THEME_ORDER.indexOf(pref) === -1) pref = 'system';
  var resolved = _resolve(pref);

  var root = document.documentElement;
  root.classList.remove('dark', 'light');
  root.classList.add(resolved);
  root.setAttribute('data-theme-pref', pref);

  document.querySelectorAll('#theme-toggle').forEach(function (btn) {
    btn.innerHTML = THEME_ICONS[pref];
    btn.setAttribute('aria-label', THEME_LABELS[pref]);
    btn.setAttribute('title', THEME_LABELS[pref]);
    btn.setAttribute('data-theme-pref', pref);
  });

  if (persist !== false) {
    try { localStorage.setItem(TKEY, pref); } catch (e) {}
  }
}

/** Cycle system -> light -> dark -> system. */
function toggleTheme() {
  var next = THEME_ORDER[(THEME_ORDER.indexOf(_readPref()) + 1) % THEME_ORDER.length];
  _applyTheme(next);
}

(function () {
  _applyTheme(_readPref(), false);

  // Keep tracking the OS while the preference is 'system'.
  var onSystemChange = function () {
    if (_readPref() === 'system') _applyTheme('system', false);
  };
  if (_darkQuery.addEventListener) _darkQuery.addEventListener('change', onSystemChange);
  else if (_darkQuery.addListener) _darkQuery.addListener(onSystemChange);   // older Safari
})();

/* ============================================================
   CURRENCY
   ============================================================ */
var CURRENCIES = {
  USD: { sym: '$', rate: 1,    label: 'USD' },
  EUR: { sym: '€', rate: 0.92, label: 'EUR' },
  GBP: { sym: '£', rate: 0.79, label: 'GBP' },
  NGN: { sym: '₦', rate: 1550, label: 'NGN' }
};

var _cur = 'USD';
try { _cur = localStorage.getItem(CKEY) || 'USD'; } catch (e) {}
if (!CURRENCIES[_cur]) _cur = 'USD';

function setCurrency(code) {
  if (!CURRENCIES[code]) return;
  _cur = code;
  try { localStorage.setItem(CKEY, code); } catch (e) {}

  var c = CURRENCIES[code];

  // Any element carrying a USD amount re-prices itself.
  document.querySelectorAll('[data-usd]').forEach(function (el) {
    var usd = parseFloat(el.dataset.usd);
    if (!isFinite(usd)) return;
    el.textContent = c.sym + (usd * c.rate).toLocaleString(undefined, { maximumFractionDigits: 0 });
  });

  // Trigger label and selected state.
  document.querySelectorAll('.currency-label').forEach(function (el) {
    el.textContent = c.label;
  });
  document.querySelectorAll('.currency-option').forEach(function (el) {
    var active = el.dataset.currency === code;
    el.classList.toggle('active', active);
    el.setAttribute('aria-selected', String(active));
  });
}

function getCurrSym()  { return (CURRENCIES[_cur] || CURRENCIES.USD).sym; }
function getCurrRate() { return (CURRENCIES[_cur] || CURRENCIES.USD).rate; }

/* Currency dropdown open/close + selection */
(function () {
  var dropdowns = document.querySelectorAll('.currency-dropdown');
  if (!dropdowns.length) return;

  dropdowns.forEach(function (dd) {
    var trigger = dd.querySelector('.currency-trigger');
    var menu    = dd.querySelector('.currency-dropdown-menu');
    if (!trigger || !menu) return;

    trigger.setAttribute('aria-expanded', 'false');

    trigger.addEventListener('click', function (e) {
      e.stopPropagation();
      var open = dd.classList.toggle('open');
      trigger.setAttribute('aria-expanded', String(open));
    });

    menu.querySelectorAll('.currency-option').forEach(function (opt) {
      opt.setAttribute('tabindex', '0');
      var choose = function () {
        setCurrency(opt.dataset.currency);
        dd.classList.remove('open');
        trigger.setAttribute('aria-expanded', 'false');
      };
      opt.addEventListener('click', choose);
      opt.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); }
      });
    });
  });

  // Click anywhere else, or press Escape, to close.
  document.addEventListener('click', function () {
    dropdowns.forEach(function (dd) {
      dd.classList.remove('open');
      var t = dd.querySelector('.currency-trigger');
      if (t) t.setAttribute('aria-expanded', 'false');
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    dropdowns.forEach(function (dd) {
      dd.classList.remove('open');
      var t = dd.querySelector('.currency-trigger');
      if (t) t.setAttribute('aria-expanded', 'false');
    });
  });
})();

/* ============================================================
   NAVBAR
   ============================================================ */
(function () {
  var nb  = document.getElementById('navbar') || document.querySelector('nav.navbar');
  var tog = document.getElementById('hamburger-btn') || document.getElementById('mob-toggle');
  var men = document.getElementById('mobile-menu')   || document.getElementById('mob-menu');

  if (nb) {
    window.addEventListener('scroll', function () {
      nb.classList.toggle('scrolled', window.scrollY > 40);
    });
  }

  if (tog && men) {
    tog.setAttribute('aria-expanded', String(!men.classList.contains('hidden')));
    tog.addEventListener('click', function () {
      var isHidden = men.classList.toggle('hidden');
      tog.setAttribute('aria-expanded', String(!isHidden));
    });
    men.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        men.classList.add('hidden');
        tog.setAttribute('aria-expanded', 'false');
      });
    });
  }

  document.querySelectorAll('#theme-toggle').forEach(function (btn) {
    btn.addEventListener('click', toggleTheme);
  });
})();

/* ============================================================
   SCROLL REVEAL
   ============================================================ */
(function () {
  var els = document.querySelectorAll('[data-aos]');
  if (!els.length) return;

  // Anyone who has asked for less motion gets everything shown immediately.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    els.forEach(function (el) { el.classList.add('aos-animate', 'anim'); });
    return;
  }

  if (!('IntersectionObserver' in window)) {
    els.forEach(function (el) { el.classList.add('aos-animate', 'anim'); });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      var delay = parseInt(e.target.dataset.aosDelay, 10) || 0;
      setTimeout(function () { e.target.classList.add('aos-animate', 'anim'); }, delay);
      io.unobserve(e.target);
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -36px 0px' });

  els.forEach(function (el) { io.observe(el); });
})();

/* ============================================================
   ANIMATED COUNTERS
   ============================================================ */
function animCounter(el, to, dur, suf) {
  dur = dur || 2000;
  suf = suf || '';
  if (!isFinite(to)) return;
  var t0 = performance.now();
  (function tick(now) {
    var p = Math.min((now - t0) / dur, 1);
    var v = Math.floor(to * (1 - Math.pow(1 - p, 3)));
    el.textContent = v.toLocaleString() + suf;
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
}

(function () {
  var els = document.querySelectorAll('[data-counter]');
  if (!els.length || !('IntersectionObserver' in window)) return;
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      animCounter(e.target, Number(e.target.dataset.counter), 2000, e.target.dataset.suf || '');
      io.unobserve(e.target);
    });
  }, { threshold: 0.5 });
  els.forEach(function (el) { io.observe(el); });
})();

/* ============================================================
   TESTIMONIAL SLIDER
   ============================================================ */
(function () {
  var track  = document.getElementById('testimonial-track');
  var slides = document.querySelectorAll('.testimonial-slide');
  var dotsW  = document.getElementById('testimonial-dots');
  var prev   = document.getElementById('slider-prev');
  var next   = document.getElementById('slider-next');
  if (!track || !slides.length) return;

  var cur = 0;
  var total = slides.length;
  var timer = null;

  if (dotsW) {
    slides.forEach(function (_, i) {
      var d = document.createElement('button');
      d.type = 'button';
      d.className = 'slider-dot';
      // The dot reads as 8px tall but the button is 44px, so it can be tapped
      // with a thumb. `background-clip: content-box` keeps the paint inside the
      // padding, so the larger hit area stays invisible.
      d.style.cssText =
        'height:8px;box-sizing:content-box;padding:18px 6px;' +
        'background-clip:content-box;border-radius:10px;border:none;' +
        'cursor:pointer;transition:width .3s,background .3s;outline:none;';
      d.setAttribute('aria-label', 'Go to testimonial ' + (i + 1));
      d.addEventListener('click', function () { restart(i); });
      dotsW.appendChild(d);
    });
  }

  function updateDots() {
    if (!dotsW) return;
    dotsW.querySelectorAll('button').forEach(function (d, i) {
      var active = i === cur;
      d.style.background = active ? 'var(--primary)' : 'rgba(148,163,184,.4)';
      d.style.width = active ? '24px' : '8px';
      d.setAttribute('aria-current', String(active));
    });
  }

  function go(i) {
    cur = ((i % total) + total) % total;
    track.style.transform = 'translateX(-' + (cur * 100) + '%)';
    slides.forEach(function (s, idx) {
      s.setAttribute('aria-hidden', String(idx !== cur));
    });
    updateDots();
  }

  function startAuto() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    stopAuto();
    timer = setInterval(function () { go(cur + 1); }, 6000);
  }
  function stopAuto() { if (timer) { clearInterval(timer); timer = null; } }
  function restart(i) { stopAuto(); go(i); startAuto(); }

  if (prev) prev.addEventListener('click', function () { restart(cur - 1); });
  if (next) next.addEventListener('click', function () { restart(cur + 1); });

  track.addEventListener('mouseenter', stopAuto);
  track.addEventListener('mouseleave', startAuto);

  var tx = 0;
  track.addEventListener('touchstart', function (e) { tx = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', function (e) {
    var dx = tx - e.changedTouches[0].clientX;
    if (Math.abs(dx) > 48) restart(cur + (dx > 0 ? 1 : -1));
  });

  go(0);
  startAuto();
})();

/* ============================================================
   ACCORDION
   ============================================================ */
(function () {
  var headers = document.querySelectorAll('.accordion-header');
  if (!headers.length) return;

  headers.forEach(function (btn) {
    var item = btn.closest('.accordion-item');
    if (!item) return;
    btn.setAttribute('aria-expanded', String(item.classList.contains('open')));

    btn.addEventListener('click', function () {
      var wasOpen = item.classList.contains('open');
      document.querySelectorAll('.accordion-item.open').forEach(function (x) {
        x.classList.remove('open');
        var h = x.querySelector('.accordion-header');
        if (h) h.setAttribute('aria-expanded', 'false');
      });
      if (!wasOpen) {
        item.classList.add('open');
        btn.setAttribute('aria-expanded', 'true');
      }
    });
  });
})();

/* ============================================================
   PORTFOLIO FILTER + LIGHTBOX
   ============================================================ */
(function () {
  var fbtns = document.querySelectorAll('.filter-btn');
  var items = document.querySelectorAll('.project-card');
  var lb    = document.getElementById('lightbox-overlay');
  var lbIn  = document.getElementById('lightbox-content-inner');
  var lbCls = document.getElementById('lightbox-close');
  var lastFocus = null;

  if (fbtns.length && items.length) {
    fbtns.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var f = btn.dataset.filter;
        fbtns.forEach(function (b) {
          var on = b === btn;
          b.classList.toggle('active', on);
          b.setAttribute('aria-pressed', String(on));
        });
        items.forEach(function (item) {
          // The cards carry their category in data-type, matching the
          // data-filter values on the buttons (residential/commercial/offgrid).
          var cat  = item.dataset.type;
          var show = f === 'all' || cat === f;
          item.style.display = show ? '' : 'none';
          item.setAttribute('aria-hidden', String(!show));
        });
      });
    });
  }

  if (!lb || !items.length) return;

  function open(item) {
    if (lbIn) {
      var img   = item.querySelector('img');
      var title = item.dataset.title || (item.querySelector('h3') || {}).textContent || '';
      var desc  = item.dataset.description || '';
      lbIn.innerHTML = '';

      if (img) {
        var big = document.createElement('img');
        big.src = img.currentSrc || img.src;
        big.alt = img.alt || '';
        big.style.cssText = 'width:100%;height:auto;display:block;border-radius:16px 16px 0 0;';
        lbIn.appendChild(big);
      }
      var body = document.createElement('div');
      body.style.cssText = 'padding:1.5rem;';
      var h = document.createElement('h3');
      h.textContent = title;
      h.style.cssText = 'font-size:1.25rem;font-weight:700;margin:0 0 .6rem;color:var(--text);';
      var p = document.createElement('p');
      p.textContent = desc;
      p.style.cssText = 'font-size:.9rem;line-height:1.7;margin:0;color:var(--text-muted);';
      body.appendChild(h);
      if (desc) body.appendChild(p);
      lbIn.appendChild(body);
    }
    lastFocus = document.activeElement;
    lb.classList.add('open');
    lb.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    if (lbCls) lbCls.focus();
  }

  function close() {
    lb.classList.remove('open');
    lb.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  items.forEach(function (item) {
    item.setAttribute('tabindex', '0');
    item.setAttribute('role', 'button');
    item.addEventListener('click', function () { open(item); });
    item.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(item); }
    });
  });

  if (lbCls) lbCls.addEventListener('click', close);
  lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && lb.classList.contains('open')) close();
  });
})();

/* ============================================================
   COOKIE BANNER
   ============================================================ */
(function () {
  var el  = document.getElementById('cookie-banner');
  var acc = document.getElementById('cookie-accept');
  var dec = document.getElementById('cookie-decline');
  if (!el) return;

  var stored = null;
  try { stored = localStorage.getItem('cookieOk'); } catch (e) {}
  if (stored !== null) return;

  setTimeout(function () { el.classList.add('show'); }, 1800);

  function dismiss(value) {
    try { localStorage.setItem('cookieOk', value); } catch (e) {}
    el.classList.remove('show');
  }
  if (acc) acc.addEventListener('click', function () { dismiss('1'); });
  if (dec) dec.addEventListener('click', function () { dismiss('0'); });
})();

/* ============================================================
   BACK TO TOP
   ============================================================ */
(function () {
  var btn = document.getElementById('back-to-top');
  if (!btn) return;
  window.addEventListener('scroll', function () {
    btn.classList.toggle('show', window.scrollY > 420);
  });
  btn.addEventListener('click', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();

/* ============================================================
   CONTACT FORM
   ============================================================ */
(function () {
  var form = document.getElementById('contact-form');
  if (!form) return;

  var ok  = document.getElementById('form-success');
  var btn = form.querySelector('button[type="submit"]');

  // field id -> { error element id, validate(value) -> message|null }
  var RULES = {
    'contact-name': {
      error: 'name-error',
      test: function (v) { return v.trim().length >= 2 ? null : 'Please enter your name.'; }
    },
    'contact-email': {
      error: 'email-error',
      test: function (v) {
        if (!v.trim()) return 'Please enter your email address.';
        return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? null : 'Please enter a valid email address.';
      }
    },
    'contact-phone': {
      error: 'phone-error',
      test: function (v) {
        if (!v.trim()) return null;                      // optional
        return /^[+\d][\d\s()-]{6,}$/.test(v.trim()) ? null : 'Please enter a valid phone number.';
      }
    },
    'contact-country': {
      error: 'country-error',
      test: function (v) { return v ? null : 'Please choose your country.'; }
    },
    'contact-service': {
      error: 'service-error',
      test: function (v) { return v ? null : 'Please choose a service.'; }
    },
    'contact-message': {
      error: 'message-error',
      test: function (v) { return v.trim().length >= 10 ? null : 'Please tell us a little more (at least 10 characters).'; }
    }
  };

  function showError(fieldId, message) {
    var rule = RULES[fieldId];
    var field = document.getElementById(fieldId);
    var errEl = rule && document.getElementById(rule.error);
    if (errEl) {
      errEl.textContent = message || '';
      errEl.classList.toggle('show', Boolean(message));
    }
    if (field) field.setAttribute('aria-invalid', String(Boolean(message)));
    return !message;
  }

  function validateField(fieldId) {
    var rule = RULES[fieldId];
    var field = document.getElementById(fieldId);
    if (!rule || !field) return true;
    return showError(fieldId, rule.test(field.value));
  }

  Object.keys(RULES).forEach(function (fieldId) {
    var field = document.getElementById(fieldId);
    if (!field) return;
    field.addEventListener('blur',  function () { validateField(fieldId); });
    field.addEventListener('input', function () {
      // Only clear a visible error as the user corrects it — never introduce
      // a new one mid-typing.
      var errEl = document.getElementById(RULES[fieldId].error);
      if (errEl && errEl.classList.contains('show')) validateField(fieldId);
    });
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var firstInvalid = null;
    Object.keys(RULES).forEach(function (fieldId) {
      if (!validateField(fieldId) && !firstInvalid) firstInvalid = fieldId;
    });

    if (firstInvalid) {
      var el = document.getElementById(firstInvalid);
      if (el) { el.focus(); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      return;
    }

    // This template has no backend. Point the form at your own endpoint —
    // Formspree, Web3Forms, EmailJS or your server — in the fetch below.
    // Until then it confirms locally so the flow can be demonstrated.
    if (btn) { btn.dataset.label = btn.textContent; btn.textContent = 'Sending…'; btn.disabled = true; }

    setTimeout(function () {
      form.reset();
      Object.keys(RULES).forEach(function (fieldId) { showError(fieldId, null); });
      if (btn) { btn.textContent = btn.dataset.label || 'Send Message'; btn.disabled = false; }
      if (ok) {
        ok.classList.add('show');
        ok.setAttribute('role', 'status');
        setTimeout(function () { ok.classList.remove('show'); }, 6000);
      }
    }, 900);
  });
})();

/* ============================================================
   ACTIVE NAV LINK
   ============================================================ */
(function () {
  var pg = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(function (a) {
    var href = (a.getAttribute('href') || '').split('/').pop();
    if (href === pg || (pg === 'index.html' && href === 'index.html')) {
      a.classList.add('active');
      a.setAttribute('aria-current', 'page');
    }
  });
})();

/* ============================================================
   DYNAMIC COPYRIGHT YEAR
   ============================================================ */
(function () {
  var yr = new Date().getFullYear();
  /* The Recalculate button. This was an inline onclick until v1.6.0; it moved
     here so that no BEHAVIOUR depends on 'unsafe-inline' in the Content
     Security Policy. The inline theme block in <head> still needs the
     allowance, but that one is load-bearing for the flash-of-wrong-theme fix,
     whereas this was simply convenient. */
  document.querySelectorAll('[data-recalculate]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var calc = document.getElementById('calc-btn');
      if (calc) calc.click();
    });
  });

  document.querySelectorAll('.footer-year').forEach(function (el) { el.textContent = yr; });
})();

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', function () { setCurrency(_cur); });
