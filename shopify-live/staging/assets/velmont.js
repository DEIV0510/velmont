document.addEventListener('DOMContentLoaded', () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (value) => Math.max(0, Math.min(1, value));

  const navToggle = document.querySelector('[data-nav-toggle]');
  const siteNav = document.querySelector('[data-site-nav]');
  if (navToggle && siteNav) {
    navToggle.addEventListener('click', () => {
      const isOpen = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', String(!isOpen));
      siteNav.classList.toggle('is-open', !isOpen);
    });
  }

  // Drives a <video> from a 0–1 progress value: seeks smoothly toward it, keeps the stage hidden until a real
  // frame is painted (so the poster never flashes), and plays once if the server can't seek. Returns update().
  const scrubVideo = ({ stage, video, progress, onFrame = () => {}, onReady = () => {}, keepAlive = () => false }) => {
    let duration = 0;
    let current = 0;
    let frame = 0;
    let chase = 0;
    let scrub = true;

    const tick = () => {
      frame = 0;
      if (!duration && Number.isFinite(video.duration)) duration = video.duration;
      const target = progress();
      current += (target - current) * 0.16;
      if (Math.abs(target - current) < 0.001) current = target;
      const time = current * Math.max(0, duration - 0.05);
      if (scrub && duration && !video.seeking && Math.abs(video.currentTime - time) > 0.02) video.currentTime = time;
      onFrame(current);
      // Keep going until the painted frame matches the scroll: a seek can finish after the scroll has settled.
      const behind = scrub && duration > 0 && (video.seeking || Math.abs(video.currentTime - time) > 0.05);
      chase = behind ? chase + 1 : 0;
      if (current !== target || keepAlive() || (behind && chase < 120)) frame = requestAnimationFrame(tick);
    };
    const update = () => { chase = 0; if (!frame) frame = requestAnimationFrame(tick); };

    const reveal = () => stage.classList.remove('is-pending');
    stage.classList.add('is-pending');
    window.setTimeout(reveal, 3000);
    const ready = () => {
      duration = Number.isFinite(video.duration) ? video.duration : 0;
      // A server without byte ranges (e.g. theme dev's local assets) makes the video unseekable:
      // play it once instead of leaving it frozen on the first frame.
      if (!video.seekable.length || video.seekable.end(0) === 0) {
        scrub = false;
        reveal();
        video.play().catch(() => {});
        return;
      }
      if (video.currentTime === 0) {
        try { video.currentTime = 0.01; } catch (error) { reveal(); }
      }
      onReady();
      update();
    };
    video.addEventListener('loadedmetadata', ready);
    video.addEventListener('seeked', () => { reveal(); update(); });
    if (video.readyState >= 1) ready();

    // iOS only buffers after play(); start and pause right away so seeking can paint frames.
    const priming = video.play();
    if (priming) priming.then(() => { if (scrub) video.pause(); update(); }).catch(() => {});
    return update;
  };

  // Hero: on desktop the section pins while the ring reveals the logo. On mobile the stage sits above the copy:
  // the reveal starts by itself on load and the scroll carries it to the end while the stage leaves the screen.
  const initHero = (hero) => {
    const stage = hero && hero.querySelector('[data-hero-video]');
    const video = stage && stage.querySelector('video');
    if (!video) return () => {};
    video.muted = true;
    video.pause();
    if (reduceMotion) return () => {}; // the poster already shows the final frame

    const grid = hero.querySelector('.hero__grid');
    const arcs = hero.querySelectorAll('.hero__arc');
    const header = document.querySelector('.site-header');
    const desktop = window.matchMedia('(min-width: 901px)');
    const canPin = window.CSS && CSS.supports('overflow', 'clip');
    const pinned = () => hero.classList.contains('hero--pin');
    let pinTop = 0;
    let introStart = 0;

    // The header only stays on screen if it (or its Shopify section wrapper) can actually stick.
    const stuck = (element) => element && getComputedStyle(element).position === 'sticky'
      && element.parentElement && element.parentElement.offsetHeight > element.offsetHeight + 2;
    const intro = () => (introStart ? 0.35 * clamp((performance.now() - introStart) / 3500) : 0);

    const update = scrubVideo({
      stage,
      video,
      progress: () => {
        if (pinned()) {
          const travel = hero.offsetHeight - grid.offsetHeight;
          return clamp((pinTop - hero.getBoundingClientRect().top) / Math.max(1, travel));
        }
        const rect = stage.getBoundingClientRect();
        return Math.max(intro(), clamp(window.scrollY / Math.max(1, rect.top + window.scrollY + rect.height * 0.5)));
      },
      onFrame: (value) => arcs.forEach((arc, index) => { arc.style.scale = String(1 + value * (index ? -0.06 : 0.1)); }),
      onReady: () => { if (!introStart) introStart = performance.now(); },
      keepAlive: () => Boolean(introStart) && !pinned() && performance.now() - introStart < 3600,
    });

    const setPin = () => {
      pinTop = header && (stuck(header) || stuck(header.parentElement)) ? header.offsetHeight : 0;
      hero.style.setProperty('--pin-top', `${pinTop}px`);
      hero.classList.toggle('hero--pin', Boolean(canPin && desktop.matches));
      update();
    };
    setPin();
    if (desktop.addEventListener) desktop.addEventListener('change', setPin);
    return update;
  };

  // Offers: the same video advances while its panel enters the screen and shows the logo once the panel is centered.
  const initOffers = (section) => {
    const stage = section && section.querySelector('[data-offers-video]');
    const video = stage && stage.querySelector('video');
    if (!video) return () => {};
    video.muted = true;
    video.pause();
    if (reduceMotion) return () => {};
    const panel = stage.parentElement; // measured instead of the stage, which drifts with parallax
    return scrubVideo({
      stage,
      video,
      progress: () => {
        const rect = panel.getBoundingClientRect();
        const viewport = window.innerHeight;
        return clamp((viewport - rect.top) / (viewport * 0.5 + rect.height * 0.5));
      },
    });
  };

  const scrollVideos = [['.hero', initHero], ['.offers', initOffers]].map(([selector, init]) => {
    const element = document.querySelector(selector);
    return { selector, init, element, update: init(element) };
  });
  // The theme editor can swap a section's HTML; reconnect to the new element.
  document.addEventListener('shopify:section:load', () => {
    scrollVideos.forEach((entry) => {
      const element = document.querySelector(entry.selector);
      if (element && element !== entry.element) Object.assign(entry, { element, update: entry.init(element) });
    });
  });

  if (!reduceMotion) {
    // Sections rise into view as they enter the screen.
    const revealTargets = [
      '.scent-finder__grid > div', '.section-heading', '.collection-showcase__tabs', '.collection-showcase__panels',
      '.offers__art', '.offers__copy', '.service__cards > div', '.service__actions', '.editorial__grid > div',
      '.site-footer__grid > div', '.collection-page__header', '.collection-page .product-grid > .product-card',
      '.empty-state', '.product-page__grid > div'
    ];
    if ('IntersectionObserver' in window) {
      const revealed = document.querySelectorAll(revealTargets.join(','));
      revealed.forEach((element) => element.classList.add('reveal'));
      revealed.forEach((element) => {
        const index = [...element.parentElement.children].filter((child) => child.classList.contains('reveal')).indexOf(element);
        if (index > 0) element.style.setProperty('--reveal-delay', `${(index % 4) * 0.09}s`);
      });
      const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting || entry.boundingClientRect.top < 0) {
            entry.target.classList.add('is-visible');
            revealObserver.unobserve(entry.target);
          }
        });
      }, { rootMargin: '0px 0px -8% 0px' });
      revealed.forEach((element) => revealObserver.observe(element));
    }

    // Decorative pieces drift at their own speed; measured on the parent so the offset never feeds back.
    const parallax = [
      ['.offers__video', 0.06], ['.offers__line--one', 0.06], ['.offers__line--two', -0.04],
      ['.footer-monogram', 0.08], ['.collection-placeholder span', 0.06]
    ].flatMap(([selector, speed]) => [...document.querySelectorAll(selector)].map((element) => ({ element, speed })));

    const progressBar = document.createElement('span');
    progressBar.className = 'scroll-progress';
    progressBar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(progressBar);

    let scrollFrame = 0;
    const onScroll = () => {
      scrollFrame = 0;
      const viewport = window.innerHeight;
      const scrollable = document.documentElement.scrollHeight - viewport;
      progressBar.style.transform = `scaleX(${scrollable > 0 ? clamp(window.scrollY / scrollable) : 0})`;
      parallax.forEach(({ element, speed }) => {
        const rect = element.parentElement.getBoundingClientRect();
        if (rect.bottom < -200 || rect.top > viewport + 200) return;
        element.style.translate = `0 ${((rect.top + rect.height / 2 - viewport / 2) * -speed).toFixed(1)}px`;
      });
      scrollVideos.forEach((entry) => entry.update());
    };
    const requestScroll = () => { if (!scrollFrame) scrollFrame = requestAnimationFrame(onScroll); };
    window.addEventListener('scroll', requestScroll, { passive: true });
    window.addEventListener('resize', requestScroll);
    requestScroll();
  }

  const collectionTabs = document.querySelectorAll('[data-collection-tab]');
  const collectionPanels = document.querySelectorAll('[data-collection-panel]');
  collectionTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const selection = tab.dataset.collectionTab;
      collectionTabs.forEach((item) => item.classList.toggle('is-active', item === tab));
      collectionPanels.forEach((panel) => panel.classList.toggle('is-active', panel.dataset.collectionPanel === selection));
    });
  });

  const answers = document.querySelectorAll('[data-scent-answer]');
  const result = document.querySelector('[data-scent-result]');
  answers.forEach((answer) => {
    answer.addEventListener('click', () => {
      answers.forEach((item) => item.classList.toggle('is-selected', item === answer));
      if (result && answer.dataset.scentMessage) result.textContent = answer.dataset.scentMessage;
      window.setTimeout(() => { window.location.assign(answer.dataset.scentUrl); }, 420);
    });
  });
});

/* ==========================================================================
   VELMONT — Capa nueva (bolsa AJAX, guardados, cursor, magnetismo, reveal
   por palabras, galeria+tilt de la ficha, filtros de coleccion). El bloque
   de arriba (scrubVideo, initHero, initOffers, reveal, parallax, tabs,
   scent-finder) es el motor ya construido: no se toca. Todo lo monetario
   sale siempre de /cart.js — nada aqui calcula un precio de oferta por su
   cuenta, para que el dia que exista el descuento real de "2 X 280.000" el
   total ya salga bien sin tocar una linea de este archivo.
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(pointer: fine)').matches;
  const money = (cents) => '$' + Math.round(cents / 100).toLocaleString('es-CO');

  /* ---------------- Cursor de marca ---------------- */
  if (!reduceMotion && fine) {
    const dot = document.createElement('div');
    dot.className = 'cursor-dot';
    dot.setAttribute('aria-hidden', 'true');
    document.body.appendChild(dot);
    document.body.classList.add('cursor-on');
    let x = -100, y = -100, cx = -100, cy = -100, ready = false;
    window.addEventListener('pointermove', (e) => {
      x = e.clientX; y = e.clientY;
      if (!ready) { ready = true; cx = x; cy = y; dot.classList.add('ready'); }
    }, { passive: true });
    const tick = () => { cx += (x - cx) * .22; cy += (y - cy) * .22; dot.style.transform = `translate3d(${cx}px, ${cy}px, 0)`; requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    const isField = (t) => t.closest('input, textarea, select, [contenteditable]');
    document.addEventListener('pointerover', (e) => {
      if (isField(e.target)) { dot.classList.add('hide'); return; }
      dot.classList.remove('hide');
      dot.classList.toggle('grow', !!e.target.closest('a, button, [data-cursor]'));
    });
    document.addEventListener('pointerdown', () => dot.classList.add('press'));
    document.addEventListener('pointerup', () => dot.classList.remove('press'));
    document.addEventListener('pointerleave', () => dot.classList.add('hide'));
    document.addEventListener('pointerenter', () => dot.classList.remove('hide'));

    /* Magnetismo: solo en .button y .text-link, que no traen transform propio. */
    document.querySelectorAll('.button, .text-link').forEach((el) => {
      let raf = null;
      el.addEventListener('mousemove', (e) => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          const r = el.getBoundingClientRect();
          const mx = (e.clientX - r.left - r.width / 2) * .18;
          const my = (e.clientY - r.top - r.height / 2) * .24;
          el.style.transform = `translate(${mx.toFixed(1)}px, ${my.toFixed(1)}px)`;
          raf = null;
        });
      });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; });
    });
  }

  /* ---------------- Revelado palabra por palabra ---------------- */
  const wordBlocks = document.querySelectorAll('[data-reveal-words]');
  if (wordBlocks.length) {
    wordBlocks.forEach((el) => {
      const text = el.textContent.trim();
      el.setAttribute('aria-label', text);
      const words = text.split(/\s+/);
      el.innerHTML = words.map((w, i) => `<span class="word" style="--wi:${i}"><span>${w}</span></span>`).join(' ');
    });
    if (reduceMotion || !('IntersectionObserver' in window)) {
      wordBlocks.forEach((el) => el.classList.add('is-split-visible'));
    } else {
      const io = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) { entry.target.classList.add('is-split-visible'); io.unobserve(entry.target); }
        });
      }, { rootMargin: '0px 0px -8% 0px' });
      wordBlocks.forEach((el) => io.observe(el));
    }
  }

  /* ---------------- Ficha de producto: miniaturas + tilt ---------------- */
  const stage = document.querySelector('[data-product-image]');
  if (stage) {
    const main = stage.querySelector('img');
    document.querySelectorAll('[data-thumb]').forEach((thumb) => {
      thumb.addEventListener('click', () => {
        document.querySelectorAll('[data-thumb]').forEach((t) => t.classList.remove('is-active'));
        thumb.classList.add('is-active');
        if (main) { main.src = thumb.dataset.full; main.srcset = ''; }
      });
    });
    if (!reduceMotion && fine && main) {
      let raf = null;
      stage.addEventListener('mousemove', (e) => {
        if (raf) return;
        raf = requestAnimationFrame(() => {
          const r = stage.getBoundingClientRect();
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          main.style.setProperty('--tilt-x', `${(-py * 6).toFixed(2)}deg`);
          main.style.setProperty('--tilt-y', `${(px * 6).toFixed(2)}deg`);
          raf = null;
        });
      });
      stage.addEventListener('mouseleave', () => { main.style.setProperty('--tilt-x', '0deg'); main.style.setProperty('--tilt-y', '0deg'); });
    }
  }

  /* ---------------- Filtros de coleccion (por casa — el unico dato real y comun a todo el catalogo) ---------------- */
  const filterBar = document.querySelector('[data-collection-filters]');
  if (filterBar) {
    const cards = [...document.querySelectorAll('.product-grid > .product-card')];
    const vendors = [...new Set(cards.map((c) => c.dataset.vendor).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
    if (vendors.length > 1) {
      filterBar.innerHTML = ['<button type="button" class="is-active" data-filter="">Todas las casas</button>']
        .concat(vendors.map((v) => `<button type="button" data-filter="${v.replace(/"/g, '&quot;')}">${v}</button>`)).join('');
      filterBar.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        filterBar.querySelectorAll('button').forEach((b) => b.classList.toggle('is-active', b === btn));
        const v = btn.dataset.filter;
        cards.forEach((c) => { c.style.display = (!v || c.dataset.vendor === v) ? '' : 'none'; });
      });
    }
  }

  /* ==========================================================================
     Bolsa lateral — Cart AJAX API real de Shopify.
     ========================================================================== */
  const cartDrawer = document.querySelector('[data-cart-drawer]');
  const cartScrim = document.querySelector('[data-cart-scrim]');
  const cartBody = document.querySelector('[data-cart-body]');
  const cartFoot = document.querySelector('[data-cart-foot]');
  const cartCounts = document.querySelectorAll('[data-cart-count]');

  let editions = [];
  try {
    const raw = document.getElementById('velmont-promo-data');
    editions = raw ? (JSON.parse(raw.textContent).editions || []) : [];
  } catch (err) { editions = []; }

  const openCart = () => {
    if (!cartDrawer) return;
    cartDrawer.classList.add('is-open'); cartDrawer.setAttribute('aria-hidden', 'false');
    cartScrim && cartScrim.classList.add('is-open');
    document.documentElement.style.overflow = 'hidden';
  };
  const closeCart = () => {
    if (!cartDrawer) return;
    cartDrawer.classList.remove('is-open'); cartDrawer.setAttribute('aria-hidden', 'true');
    cartScrim && cartScrim.classList.remove('is-open');
    document.documentElement.style.overflow = '';
  };

  const promoBlockHTML = (edition, inCart) => {
    const have = inCart.reduce((n, l) => n + (edition.productIds.includes(l.product_id) ? l.quantity : 0), 0);
    if (have === 0) return '';
    const remainder = Math.max(0, edition.units - have);
    const pct = Math.min(1, have / edition.units);
    const note = remainder === 0
      ? `<strong>Dupla completa</strong> — llevas tu ${edition.label}.`
      : `Te falta <strong>${remainder}</strong> fragancia${remainder > 1 ? 's' : ''} de esta selección para ${edition.label}.`;
    return `
      <div class="cart-promo">
        <span class="cart-promo__label">${edition.label}</span>
        <div class="cart-promo__bar"><i style="transform:scaleX(${pct})"></i></div>
        <p class="cart-promo__note">${note}</p>
      </div>`;
  };

  const lineHTML = (item) => `
    <div class="cart-drawer__line" data-line="${item.key}">
      <a href="${item.url}">${item.image ? `<img src="${item.image.replace(/(\.[a-z]+)(\?|$)/i, '_180x$1$2')}" alt="${item.product_title}" loading="lazy">` : '<span></span>'}</a>
      <div>
        <p class="cart-drawer__line-vendor">${item.vendor || ''}</p>
        <p class="cart-drawer__line-name"><a href="${item.url}">${item.product_title}</a></p>
        <div class="cart-drawer__stepper">
          <button type="button" data-qty-down aria-label="Quitar uno">−</button>
          <span>${item.quantity}</span>
          <button type="button" data-qty-up aria-label="Añadir uno">+</button>
        </div>
      </div>
      <div class="cart-drawer__line-right">
        <span class="cart-drawer__price">${money(item.final_line_price)}</span>
        <button class="cart-drawer__remove" type="button" data-line-remove>Quitar</button>
      </div>
    </div>`;

  const renderCart = (cart) => {
    cartCounts.forEach((el) => { el.textContent = cart.item_count; });
    document.querySelectorAll('[data-saved-count]').forEach(() => {}); // no-op, guardados se pinta aparte

    if (!cartBody || !cartFoot) return;
    if (!cart.items.length) {
      cartBody.innerHTML = '<div class="cart-drawer__empty"><p>Tu bolsa aún no tiene aroma.</p><button class="button button--gold" type="button" data-cart-close-inline>Explorar catálogo</button></div>';
      cartFoot.innerHTML = '';
      const inline = cartBody.querySelector('[data-cart-close-inline]');
      if (inline) inline.addEventListener('click', () => { closeCart(); window.location.href = '/collections/all'; });
      return;
    }
    const promos = editions.map((ed) => promoBlockHTML(ed, cart.items)).filter(Boolean).join('');
    cartBody.innerHTML = cart.items.map(lineHTML).join('') + promos;
    cartFoot.innerHTML = `
      <div class="cart-drawer__totals"><span>Subtotal</span><strong>${money(cart.total_price)}</strong></div>
      <button class="button button--gold" type="button" data-cart-checkout>Continuar al pago</button>
      <p style="text-align:center;margin-top:10px"><a class="text-link" href="${window.Shopify ? window.Shopify.routes.root + 'cart' : '/cart'}" style="font-size:9px">Ver bolsa completa</a></p>`;

    cartBody.querySelectorAll('[data-qty-up]').forEach((b) => b.addEventListener('click', (e) => {
      const key = e.target.closest('[data-line]').dataset.line;
      const span = e.target.closest('.cart-drawer__stepper').querySelector('span');
      changeLine(key, Number(span.textContent) + 1);
    }));
    cartBody.querySelectorAll('[data-qty-down]').forEach((b) => b.addEventListener('click', (e) => {
      const key = e.target.closest('[data-line]').dataset.line;
      const span = e.target.closest('.cart-drawer__stepper').querySelector('span');
      changeLine(key, Math.max(0, Number(span.textContent) - 1));
    }));
    cartBody.querySelectorAll('[data-line-remove]').forEach((b) => b.addEventListener('click', (e) => {
      changeLine(e.target.closest('[data-line]').dataset.line, 0);
    }));
    const checkoutBtn = cartFoot.querySelector('[data-cart-checkout]');
    if (checkoutBtn) checkoutBtn.addEventListener('click', () => { window.location.href = (window.Shopify ? window.Shopify.routes.root : '/') + 'cart'; });
  };

  const fetchCart = () => fetch('/cart.js').then((r) => r.json());
  const refreshCart = () => fetchCart().then(renderCart).catch(() => {});

  const changeLine = (id, quantity) => {
    fetch('/cart/change.js', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, quantity }),
    }).then((r) => r.json()).then(renderCart).catch(() => {});
  };

  const addToCart = (variantId, qty = 1) => fetch('/cart/add.js', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items: [{ id: variantId, quantity: qty }] }),
  }).then((r) => { if (!r.ok) throw new Error('add-failed'); return refreshCart(); }).then(openCart);

  document.querySelectorAll('[data-cart-open]').forEach((el) => el.addEventListener('click', (e) => { e.preventDefault(); openCart(); refreshCart(); }));
  document.querySelectorAll('[data-cart-close]').forEach((el) => el.addEventListener('click', closeCart));
  cartScrim && cartScrim.addEventListener('click', closeCart);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCart(); });

  // El formulario de la ficha sigue funcionando SIN JS (accion normal); con JS,
  // intercepta y abre la bolsa en vez de recargar la pagina.
  document.querySelectorAll('.product-form').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const submit = form.querySelector('.product-form__submit');
      const idInput = form.querySelector('[name="id"]');
      if (!idInput) return;
      submit && (submit.disabled = true);
      addToCart(idInput.value, 1).finally(() => { submit && (submit.disabled = false); });
    });
  });

  document.addEventListener('click', (e) => {
    const quick = e.target.closest('[data-quick-add]');
    if (!quick) return;
    e.preventDefault();
    quick.disabled = true;
    addToCart(quick.dataset.quickAdd, 1).finally(() => { quick.disabled = false; });
  });

  refreshCart();

  /* ==========================================================================
     Guardados — localStorage, sin necesitar cuenta de cliente.
     ========================================================================== */
  const SAVE_KEY = 'velmont_saved';
  const getSaved = () => { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || '[]'); } catch { return []; } };
  const setSaved = (list) => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(list)); } catch {} };

  const savedDrawer = document.querySelector('[data-saved-drawer]');
  const savedBody = document.querySelector('[data-saved-body]');
  const savedCountEls = document.querySelectorAll('[data-saved-count]');

  const syncSaveButtons = () => {
    const ids = getSaved().map(String);
    document.querySelectorAll('[data-save]').forEach((btn) => {
      const on = ids.includes(String(btn.dataset.save));
      btn.classList.toggle('is-on', on);
      btn.setAttribute('aria-pressed', String(on));
    });
    savedCountEls.forEach((el) => { el.textContent = ids.length; el.hidden = ids.length === 0; });
  };

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-save]');
    if (!btn) return;
    e.preventDefault();
    const id = String(btn.dataset.save);
    const list = getSaved();
    const idx = list.findIndex((x) => String(x.id) === id);
    if (idx > -1) list.splice(idx, 1);
    else {
      const card = btn.closest('.product-card') || btn.closest('.product-page');
      const name = card ? (card.querySelector('h1,h3')?.textContent.trim() || '') : '';
      const url = card ? (card.querySelector('a[href*="/products/"]')?.getAttribute('href') || location.pathname) : location.pathname;
      const img = card ? card.querySelector('img')?.src : '';
      const price = card ? card.querySelector('.product-card__price span, .product-page__price')?.textContent.trim() : '';
      list.push({ id, name, url, img, price });
    }
    setSaved(list);
    syncSaveButtons();
    renderSaved();
  });

  const renderSaved = () => {
    if (!savedBody) return;
    const list = getSaved();
    if (!list.length) { savedBody.innerHTML = '<div class="cart-drawer__empty"><p>Aún no guardas ninguna fragancia.</p></div>'; return; }
    savedBody.innerHTML = list.map((p) => `
      <div class="cart-drawer__line">
        <a href="${p.url}">${p.img ? `<img src="${p.img}" alt="${p.name}" loading="lazy">` : '<span></span>'}</a>
        <div><p class="cart-drawer__line-name"><a href="${p.url}">${p.name}</a></p><p class="cart-drawer__price">${p.price || ''}</p></div>
        <button class="cart-drawer__remove" type="button" data-unsave="${p.id}">Quitar</button>
      </div>`).join('');
  };
  savedBody && savedBody.addEventListener('click', (e) => {
    const b = e.target.closest('[data-unsave]');
    if (!b) return;
    setSaved(getSaved().filter((x) => String(x.id) !== String(b.dataset.unsave)));
    syncSaveButtons(); renderSaved();
  });

  document.querySelectorAll('[data-saved-open]').forEach((el) => el.addEventListener('click', () => {
    savedDrawer && savedDrawer.classList.add('is-open');
    savedDrawer && savedDrawer.setAttribute('aria-hidden', 'false');
    renderSaved();
  }));
  document.querySelectorAll('[data-saved-close]').forEach((el) => el.addEventListener('click', () => {
    savedDrawer && savedDrawer.classList.remove('is-open');
    savedDrawer && savedDrawer.setAttribute('aria-hidden', 'true');
  }));

  syncSaveButtons();
});
