/**
 * SolarPro Global — main.js
 * ─────────────────────────────────────────────────────────────
 * Handles: Theme toggle, Currency switcher, Navbar scroll,
 *          AOS (animate on scroll), Animated counters,
 *          Testimonial slider, FAQ accordion, Portfolio filter,
 *          Lightbox, Cookie banner, Back-to-top, Contact form,
 *          Active nav highlight.
 * No dependencies — vanilla JS only.
 */

/* ============================================================
   THEME
   ============================================================ */
const TKEY = 'solarproTheme';
const CKEY = 'solarproCurrency';

function _applyTheme(t) {
  const root = document.documentElement;
  root.classList.remove('dark', 'light');
  root.classList.add(t);
  // Update every theme-toggle icon on the page
  document.querySelectorAll('#theme-toggle').forEach(btn => {
    btn.innerHTML = t === 'dark'
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>';
    btn.setAttribute('aria-label', t === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
  });
  localStorage.setItem(TKEY, t);
}

function toggleTheme() {
  _applyTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark');
}

// Init — runs before anything else
(function () {
  const saved = localStorage.getItem(TKEY);
  const sys   = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  _applyTheme(saved || sys);
})();

/* ============================================================
   CURRENCY
   ============================================================ */
const CURRENCIES = {
  USD: { sym: '$',  rate: 1     },
  EUR: { sym: '€',  rate: 0.92  },
  GBP: { sym: '£',  rate: 0.79  },
  NGN: { sym: '₦',  rate: 1580  }
};

let _cur = localStorage.getItem(CKEY) || 'USD';

/** Called by onclick on currency buttons, and by calculator */
function setCurrency(code) {
  _cur = code;
  localStorage.setItem(CKEY, code);
  // Price-tagged elements
  document.querySelectorAll('[data-usd]').forEach(el => {
    const c = CURRENCIES[code];
    el.textContent = c.sym + (parseFloat(el.dataset.usd) * c.rate).toLocaleString(undefined, { maximumFractionDigits: 0 });
  });
  // Button states
  document.querySelectorAll('.cbtn').forEach(b => b.classList.toggle('active', b.dataset.c === code));
  // Re-run calculator if on page
  if (typeof calculateSavings === 'function') calculateSavings();
}

function getCurrSym()  { return CURRENCIES[_cur]?.sym  || '$'; }
function getCurrRate() { return CURRENCIES[_cur]?.rate || 1;   }

/* ============================================================
   NAVBAR
   ============================================================ */
(function () {
  // Support both id="navbar" and class="navbar"
  const nb  = document.getElementById('navbar') || document.querySelector('nav.navbar');
  // Support both id patterns used across pages
  const tog = document.getElementById('hamburger-btn') || document.getElementById('mob-toggle');
  const men = document.getElementById('mobile-menu')   || document.getElementById('mob-menu');

  if (nb) window.addEventListener('scroll', () => nb.classList.toggle('scrolled', window.scrollY > 40));

  if (tog && men) {
    tog.addEventListener('click', () => {
      const isHidden = men.classList.toggle('hidden');
      tog.setAttribute('aria-expanded', String(!isHidden));
    });
    men.querySelectorAll('a').forEach(a => a.addEventListener('click', () => men.classList.add('hidden')));
  }

  // Wire up ALL theme-toggle buttons on page
  document.querySelectorAll('#theme-toggle').forEach(btn => {
    btn.addEventListener('click', toggleTheme);
  });
})();

/* ============================================================
   AOS — lightweight animate-on-scroll
   ============================================================ */
(function () {
  const els = document.querySelectorAll('[data-aos]');
  if (!els.length) return;
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const delay = parseInt(e.target.dataset.aosDelay) || 0;
      setTimeout(() => e.target.classList.add('anim'), delay);
      io.unobserve(e.target);
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -36px 0px' });
  els.forEach(el => io.observe(el));
})();

/* ============================================================
   ANIMATED COUNTERS
   ============================================================ */
function animCounter(el, to, dur = 2000, suf = '') {
  const t0 = performance.now();
  (function tick(now) {
    const p = Math.min((now - t0) / dur, 1);
    const v = Math.floor(to * (1 - Math.pow(1 - p, 3)));
    el.textContent = v.toLocaleString() + suf;
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
}
(function () {
  const io = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      animCounter(e.target, +e.target.dataset.counter, 2000, e.target.dataset.suf || '');
      io.unobserve(e.target);
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('[data-counter]').forEach(el => io.observe(el));
})();

/* ============================================================
   TESTIMONIAL SLIDER
   ============================================================ */
(function () {
  const track = document.getElementById('t-track');
  const slides = document.querySelectorAll('.tslide');
  const dotsW  = document.getElementById('t-dots');
  const prev   = document.getElementById('t-prev');
  const next   = document.getElementById('t-next');
  if (!track || !slides.length) return;

  let cur = 0, total = slides.length, timer;

  // Build dots
  if (dotsW) {
    slides.forEach((_, i) => {
      const d = document.createElement('button');
      d.style.cssText = 'height:8px;border-radius:4px;border:none;cursor:pointer;transition:all .3s;outline:none;';
      d.setAttribute('aria-label', `Slide ${i + 1}`);
      d.addEventListener('click', () => go(i));
      dotsW.appendChild(d);
    });
  }

  function updateDots() {
    if (!dotsW) return;
    dotsW.querySelectorAll('button').forEach((d, i) => {
      d.style.background = i === cur ? 'var(--orange)' : 'rgba(255,255,255,.28)';
      d.style.width = i === cur ? '24px' : '8px';
    });
  }

  function go(i) {
    cur = ((i % total) + total) % total;
    track.style.transform = `translateX(-${cur * 100}%)`;
    updateDots();
  }

  function startAuto() { timer = setInterval(() => go(cur + 1), 5000); }
  function stopAuto()  { clearInterval(timer); }

  if (prev) prev.addEventListener('click', () => { stopAuto(); go(cur - 1); startAuto(); });
  if (next) next.addEventListener('click', () => { stopAuto(); go(cur + 1); startAuto(); });
  track.addEventListener('mouseenter', stopAuto);
  track.addEventListener('mouseleave', startAuto);

  // Touch swipe
  let tx = 0;
  track.addEventListener('touchstart', e => { tx = e.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', e => {
    const dx = tx - e.changedTouches[0].clientX;
    if (Math.abs(dx) > 48) { stopAuto(); go(cur + (dx > 0 ? 1 : -1)); startAuto(); }
  });

  updateDots(); go(0); startAuto();
})();

/* ============================================================
   FAQ ACCORDION
   ============================================================ */
(function () {
  document.querySelectorAll('.faq-q').forEach(btn => {
    btn.addEventListener('click', () => {
      const item   = btn.closest('.faq-item');
      const wasOpen = item.classList.contains('open');
      document.querySelectorAll('.faq-item.open').forEach(x => x.classList.remove('open'));
      if (!wasOpen) item.classList.add('open');
    });
  });
})();

/* ============================================================
   PORTFOLIO FILTER + LIGHTBOX
   ============================================================ */
(function () {
  const fbtns = document.querySelectorAll('.filter-btn');
  const items = document.querySelectorAll('.pitem');
  const lb    = document.getElementById('lightbox');
  const lbImg = document.getElementById('lb-img');
  const lbCls = document.getElementById('lb-close');

  fbtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const f = btn.dataset.filter;
      fbtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      items.forEach(item => {
        const show = f === 'all' || item.dataset.cat === f;
        item.style.display = show ? '' : 'none';
        if (show) {
          item.style.opacity = '0';
          requestAnimationFrame(() => {
            item.style.transition = 'opacity .4s ease';
            item.style.opacity    = '1';
          });
        }
      });
    });
  });

  if (lb) {
    items.forEach(item => {
      item.addEventListener('click', () => {
        const img = item.querySelector('img');
        if (img && lbImg) { lbImg.src = img.src; lbImg.alt = img.alt || ''; }
        lb.classList.add('open');
        document.body.style.overflow = 'hidden';
      });
    });
    const close = () => { lb.classList.remove('open'); document.body.style.overflow = ''; };
    if (lbCls) lbCls.addEventListener('click', close);
    lb.addEventListener('click', e => { if (e.target === lb) close(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }
})();

/* ============================================================
   COOKIE BANNER
   ============================================================ */
(function () {
  // Support both id="cookie-banner" and id="cookie"
  const el  = document.getElementById('cookie-banner') || document.getElementById('cookie');
  const acc = document.getElementById('cookie-accept') || document.getElementById('cookie-acc');
  const dec = document.getElementById('cookie-decline')|| document.getElementById('cookie-dec');
  if (!el) return;
  if (localStorage.getItem('cookieOk')) return;
  setTimeout(() => el.classList.add('show'), 1800);
  const dismiss = () => { el.classList.remove('show'); };
  if (acc) acc.addEventListener('click', () => { localStorage.setItem('cookieOk', '1'); dismiss(); });
  if (dec) dec.addEventListener('click', () => { localStorage.setItem('cookieOk', '0'); dismiss(); });
})();

/* ============================================================
   BACK TO TOP
   ============================================================ */
(function () {
  // Support both id="back-to-top" and id="btt"
  const btn = document.getElementById('back-to-top') || document.getElementById('btt');
  if (!btn) return;
  window.addEventListener('scroll', () => btn.classList.toggle('show', window.scrollY > 420));
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
})();

/* ============================================================
   CONTACT FORM
   ============================================================ */
(function () {
  const form = document.getElementById('contact-form');
  if (!form) return;
  const ok  = document.getElementById('form-ok');
  const btn = document.getElementById('form-btn');

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (btn) { btn.textContent = 'Sending…'; btn.disabled = true; }
    // TODO: replace with real endpoint (Formspree, EmailJS, your server)
    await new Promise(r => setTimeout(r, 1400));
    form.reset();
    if (btn) { btn.textContent = 'Send Message'; btn.disabled = false; }
    if (ok)  { ok.classList.remove('hidden'); setTimeout(() => ok.classList.add('hidden'), 5000); }
  });
})();

/* ============================================================
   ACTIVE NAV LINK
   ============================================================ */
(function () {
  const pg = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.navlink').forEach(a => {
    const href = (a.getAttribute('href') || '').split('/').pop();
    if (href === pg || (pg === '' && href === 'index.html')) a.classList.add('nav-active');
  });
})();

/* ============================================================
   DYNAMIC COPYRIGHT YEAR
   ============================================================ */
(function () {
  const yr = new Date().getFullYear();
  document.querySelectorAll('.footer-year').forEach(el => { el.textContent = yr; });
})();

/* ============================================================
   DOMContentLoaded — init currency display
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => setCurrency(_cur));
