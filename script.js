/* MARG — interactions and scroll animations (GSAP + ScrollTrigger + Lenis) */
(() => {
  const root = document.documentElement;
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  // If the animation libraries did not load, fall back to a normal, fully visible page.
  if (!window.gsap || !window.ScrollTrigger) root.classList.remove('anim');
  const ANIM = root.classList.contains('anim');
  const FINE = matchMedia('(hover: hover) and (pointer: fine)').matches;

  $('#year').textContent = new Date().getFullYear();

  /* ---------- Navigation ---------- */
  const header = $('.site-header');
  const nav = $('#nav');
  const toggle = $('.nav-toggle');
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  let lastY = 0;
  const onScroll = (y) => {
    header.classList.toggle('is-scrolled', y > 40);
    header.classList.toggle('is-hidden', y > lastY && y > 500 && !nav.classList.contains('is-open'));
    lastY = y;
  };
  addEventListener('scroll', () => onScroll(scrollY), { passive: true });

  /* ---------- Contact form ---------- */
  // Requests go straight to MARG's Gmail through FormSubmit (free, no account).
  const CONTACT_EMAIL = 'mohamedraafat15112005@gmail.com';
  const FORM_ENDPOINT = `https://formsubmit.co/ajax/${CONTACT_EMAIL}`;
  const form = $('#contact-form');
  const status = $('.form-status', form);
  const submitBtn = $('button[type="submit"]', form);
  const submitLabel = $('span', submitBtn);
  const setStatus = (text, isError = false) => {
    status.classList.toggle('is-error', isError);
    status.classList.toggle('is-success', !isError && !!text);
    status.textContent = text;
  };
  form.addEventListener('input', (e) => {
    if (e.target.getAttribute('aria-invalid') === 'true' && e.target.value.trim()) e.target.setAttribute('aria-invalid', 'false');
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.classList.contains('is-sending')) return;
    let firstInvalid = null;
    $$('[required]', form).forEach((field) => {
      const ok = field.checkValidity() && field.value.trim() !== '';
      field.setAttribute('aria-invalid', ok ? 'false' : 'true');
      if (!ok && !firstInvalid) firstInvalid = field;
    });
    if (firstInvalid) {
      setStatus('Add your name, a valid work email and a few words about your project, then send again.', true);
      firstInvalid.focus();
      return;
    }
    const d = new FormData(form);
    if (d.get('_honey')) return; // filled in by a spam bot
    const company = String(d.get('company') || '').trim();
    const payload = {
      _subject: `New ${d.get('type')} project from ${d.get('name')}${company ? ` (${company})` : ''}`,
      _template: 'table',
      _captcha: 'false',
      'Project type': d.get('type'),
      name: d.get('name'),
      email: d.get('email'),
      Company: company || '-',
      message: d.get('message'),
    };
    form.classList.add('is-sending');
    submitBtn.disabled = true;
    submitLabel.textContent = 'Sending...';
    setStatus('');
    try {
      const res = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(payload),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok || String(out.success) !== 'true') throw new Error(out.message || 'Request failed');
      const first = String(d.get('name')).trim().split(/\s+/)[0];
      form.reset();
      $$('[aria-invalid]', form).forEach((f) => f.removeAttribute('aria-invalid'));
      setStatus(`Thanks, ${first}. Your project details are with us, and we will reply to your email within two working days.`);
    } catch (err) {
      setStatus('Your message could not be sent. Please try again, or reach us on WhatsApp or by email.', true);
    } finally {
      form.classList.remove('is-sending');
      submitBtn.disabled = false;
      submitLabel.textContent = 'Send project details';
    }
  });

  if (!ANIM) {
    $('.loader')?.remove();
    window.dispatchEvent(new Event('marg:intro'));
    return;
  }

  /* ================= Animated experience ================= */
  // The intro plays from the top of the page, so do not restore an old scroll position.
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (!location.hash) scrollTo(0, 0);
  gsap.registerPlugin(ScrollTrigger);

  /* ---------- Smooth scroll ---------- */
  let lenis = null;
  if (window.Lenis) {
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = id === '#top' ? 0 : $(id);
    if (target === null) return;
    e.preventDefault();
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    if (lenis) lenis.scrollTo(target, { offset: 0, duration: 1.6 });
    else (target === 0 ? scrollTo({ top: 0 }) : target.scrollIntoView());
  }));

  /* ---------- Text splitting ---------- */
  function splitChars(el) {
    $$('.line', el).forEach((line) => {
      line.setAttribute('aria-hidden', 'true');
      const walk = (node) => {
        [...node.childNodes].forEach((child) => {
          if (child.nodeType === 3) {
            const frag = document.createDocumentFragment();
            child.textContent.split(/(\s+)/).forEach((part) => {
              if (!part) return;
              if (/^\s+$/.test(part)) { frag.append(' '); return; }
              const word = document.createElement('span');
              word.className = 'word';
              [...part].forEach((c) => {
                const ch = document.createElement('span');
                ch.className = 'char';
                ch.textContent = c;
                word.append(ch);
              });
              frag.append(word);
            });
            child.replaceWith(frag);
          } else if (child.classList.contains('grad-text')) {
            child.classList.add('char'); // keep the gradient whole; animate it as one piece
            child.style.display = 'inline-block';
          } else walk(child);
        });
      };
      walk(line);
    });
  }
  function splitWords(el, mask = true) {
    const words = el.textContent.trim().split(/\s+/);
    el.setAttribute('aria-label', el.textContent.trim());
    el.textContent = '';
    words.forEach((w, i) => {
      const word = document.createElement('span');
      word.className = 'word';
      word.textContent = w;
      let node = word;
      if (mask) {
        node = document.createElement('span');
        node.className = 'wmask';
        node.style.cssText = 'display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:.1em;margin-bottom:-.1em';
        node.append(word);
      }
      node.setAttribute('aria-hidden', 'true');
      el.append(node);
      if (i < words.length - 1) el.append(' ');
    });
    return $$('.word', el);
  }
  $$('.split').forEach(splitChars);

  /* ---------- Intro ---------- */
  const loader = $('.loader');
  gsap.set('.hero-title .char', { yPercent: 120, rotate: 6 });
  gsap.set('.hero .reveal-up', { y: 40, opacity: 0 });
  gsap.set(header, { yPercent: -100 });

  function heroIn() {
    const tl = gsap.timeline();
    tl.to('.hero-title .char', { yPercent: 0, rotate: 0, duration: 1.3, stagger: 0.022, ease: 'expo.out' })
      .to('.hero .reveal-up', { y: 0, opacity: 1, duration: 1, stagger: 0.12, ease: 'expo.out' }, 0.25)
      .to(header, { yPercent: 0, duration: 1, ease: 'expo.out' }, 0.4);
    window.dispatchEvent(new Event('marg:intro'));
    return tl;
  }

  if (loader) {
    loader.style.animation = 'none';
    lenis?.stop();
    const count = { v: 0 };
    const countEl = $('.loader-count span');
    gsap.set('.loader-word span', { yPercent: 115 });
    gsap.set('.loader-tag', { opacity: 0, letterSpacing: '2.2em' });
    gsap.set(loader, { clipPath: 'inset(0% 0% 0% 0%)' });
    gsap.timeline()
      .to('.loader-word span', { yPercent: 0, duration: 0.9, stagger: 0.07, ease: 'expo.out' })
      .to('.loader-tag', { opacity: 1, letterSpacing: '.9em', duration: 1, ease: 'expo.out' }, 0.35)
      .to('.loader-bar i', { scaleX: 1, duration: 1.2, ease: 'power2.inOut' }, 0)
      .to(count, { v: 100, duration: 1.2, ease: 'power2.inOut', onUpdate: () => { countEl.textContent = Math.round(count.v); } }, 0)
      .to(loader, { backgroundPosition: '100% 0%', duration: 1.6, ease: 'none' }, 0)
      .to('.loader-word span', { yPercent: -115, duration: 0.7, stagger: 0.06, ease: 'expo.in' }, '+=.1')
      .to('.loader-tag, .loader-bar, .loader-count', { opacity: 0, duration: 0.4 }, '<')
      .to(loader, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.9, ease: 'expo.inOut' }, '-=.15')
      .add(heroIn, '-=.55')
      .add(() => { loader.remove(); lenis?.start(); });
  } else heroIn();

  /* ---------- Section titles: words rise from a mask ---------- */
  $$('.split-words').forEach((el) => {
    const words = splitWords(el);
    gsap.from(words, {
      yPercent: 110, duration: 1.1, stagger: 0.06, ease: 'expo.out',
      scrollTrigger: { trigger: el, start: 'top 85%' },
    });
  });

  /* ---------- Contact title ---------- */
  gsap.from('.contact-title .char', {
    yPercent: 120, rotate: 6, duration: 1.2, stagger: 0.02, ease: 'expo.out',
    scrollTrigger: { trigger: '.contact-title', start: 'top 80%' },
  });

  /* ---------- Marquee skews with scroll speed ---------- */
  const skew = gsap.quickTo('.marquee-track', 'skewX', { duration: 0.5, ease: 'power3' });
  ScrollTrigger.create({
    onUpdate: (self) => skew(gsap.utils.clamp(-14, 14, self.getVelocity() / -250)),
  });
  gsap.fromTo('.marquee', { xPercent: 4 }, { xPercent: -4, ease: 'none', scrollTrigger: { trigger: '.marquee', scrub: true } });

  /* ---------- Services: horizontal scroll on large screens ---------- */
  const mm = gsap.matchMedia();
  mm.add('(min-width: 1001px)', () => {
    const track = $('.hscroll-track');
    const dist = () => track.scrollWidth - innerWidth;
    const tween = gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: { trigger: '.hscroll', pin: true, scrub: 1, end: () => '+=' + dist(), invalidateOnRefresh: true },
    });
    $$('.service').forEach((panel) => {
      gsap.from(panel.querySelector('.service-art'), {
        clipPath: 'inset(15% 25% 15% 25% round 1.4rem)', ease: 'none',
        scrollTrigger: { trigger: panel, containerAnimation: tween, start: 'left 95%', end: 'left 40%', scrub: true },
      });
      gsap.from(panel.querySelectorAll('.service-art > *'), {
        scale: 0.6, rotate: -12, ease: 'none',
        scrollTrigger: { trigger: panel, containerAnimation: tween, start: 'left 95%', end: 'left 30%', scrub: true },
      });
      gsap.from(panel.querySelectorAll('.service-body > *'), {
        x: 80, opacity: 0, stagger: 0.08, ease: 'none',
        scrollTrigger: { trigger: panel, containerAnimation: tween, start: 'left 75%', end: 'left 35%', scrub: true },
      });
    });
  });
  mm.add('(max-width: 1000px)', () => {
    $$('.service').forEach((panel) => gsap.from(panel, {
      y: 80, opacity: 0, duration: 1.1, ease: 'expo.out',
      scrollTrigger: { trigger: panel, start: 'top 88%' },
    }));
  });

  /* ---------- Statement: words light up ---------- */
  const st = $('.statement-text');
  const stWords = splitWords(st, false);
  gsap.fromTo(stWords, { opacity: 0.12 }, {
    opacity: 1, stagger: 0.1, ease: 'none',
    scrollTrigger: { trigger: st, start: 'top 80%', end: 'bottom 45%', scrub: true },
  });

  /* ---------- Feature cards flip up ---------- */
  gsap.from('.feature', {
    y: 80, rotateX: -35, opacity: 0, transformOrigin: '50% 100%',
    duration: 1.2, stagger: { each: 0.08, grid: 'auto' }, ease: 'expo.out',
    scrollTrigger: { trigger: '.feature-grid', start: 'top 85%' },
  });

  /* ---------- Process line draws, steps follow ---------- */
  gsap.fromTo('.steps-line i', { scaleX: 0 }, {
    scaleX: 1, ease: 'none',
    scrollTrigger: { trigger: '.steps', start: 'top 85%', end: 'bottom 55%', scrub: true },
  });
  gsap.from('.step', {
    y: 60, opacity: 0, duration: 1, stagger: 0.15, ease: 'expo.out',
    scrollTrigger: { trigger: '.steps', start: 'top 80%' },
  });
  gsap.to('.step-num', { backgroundPosition: '-200% 0', duration: 6, ease: 'none', repeat: -1 });

  /* ---------- Work: curtain reveal + parallax ---------- */
  $$('.work-card').forEach((card) => {
    const art = $('.work-art', card);
    gsap.fromTo(art, { clipPath: 'inset(100% 0% 0% 0% round 2rem)' }, {
      clipPath: 'inset(0% 0% 0% 0% round 2rem)', duration: 1.4, ease: 'expo.inOut',
      scrollTrigger: { trigger: card, start: 'top 85%' },
    });
    gsap.fromTo($('.work-art img', card), { yPercent: -5 }, {
      yPercent: 5, ease: 'none',
      scrollTrigger: { trigger: card, start: 'top bottom', end: 'bottom top', scrub: true },
    });
    gsap.from($('.work-body', card), {
      y: 30, opacity: 0, duration: 1, ease: 'expo.out', delay: 0.4,
      scrollTrigger: { trigger: card, start: 'top 85%' },
    });
  });

  /* ---------- FAQ: animated open / close ---------- */
  $$('.faq details').forEach((d) => {
    const body = $('.faq-a', d);
    $('summary', d).addEventListener('click', (e) => {
      e.preventDefault();
      if (d.open) {
        gsap.to(body, { height: 0, duration: 0.45, ease: 'expo.inOut', onComplete: () => { d.open = false; gsap.set(body, { clearProps: 'height' }); } });
        d.classList.remove('is-open');
      } else {
        d.open = true;
        gsap.fromTo(body, { height: 0 }, { height: 'auto', duration: 0.6, ease: 'expo.out', onComplete: () => ScrollTrigger.refresh() });
      }
    });
  });

  /* ---------- Contact + footer ---------- */
  gsap.from('.contact-copy > p, .contact-details', {
    y: 40, opacity: 0, duration: 1, stagger: 0.12, ease: 'expo.out',
    scrollTrigger: { trigger: '.contact', start: 'top 70%' },
  });
  gsap.from('.contact-form', {
    y: 100, rotateX: -20, opacity: 0, duration: 1.4, ease: 'expo.out', transformPerspective: 1200,
    scrollTrigger: { trigger: '.contact-form', start: 'top 90%' },
  });
  gsap.from('.footer-giant', {
    yPercent: 45, scaleY: 0.6, opacity: 0, transformOrigin: '50% 100%', ease: 'none',
    scrollTrigger: { trigger: '.site-footer', start: 'top bottom', end: 'bottom bottom', scrub: true },
  });

  /* ---------- Pointer effects (desktop) ---------- */
  if (FINE) {
    // Soft light that trails the normal pointer
    const glow = $('.cursor-glow');
    const gx = gsap.quickTo(glow, 'x', { duration: 0.9, ease: 'power3' });
    const gy = gsap.quickTo(glow, 'y', { duration: 0.9, ease: 'power3' });
    gsap.set(glow, { x: innerWidth * 0.7, y: innerHeight * 0.4 });
    addEventListener('pointermove', (e) => { gx(e.clientX); gy(e.clientY); });
    document.addEventListener('pointerover', (e) => {
      glow.classList.toggle('is-hover', !!e.target.closest('a, button, summary, label, .tilt'));
    });
    document.addEventListener('pointerleave', () => gsap.to(glow, { opacity: 0, duration: 0.4 }));
    document.addEventListener('pointerenter', () => gsap.to(glow, { opacity: 1, duration: 0.4 }));

    // Magnetic buttons
    $$('.magnetic').forEach((el) => {
      const inner = el.querySelector('span');
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const mx = e.clientX - (r.left + r.width / 2);
        const my = e.clientY - (r.top + r.height / 2);
        gsap.to(el, { x: mx * 0.35, y: my * 0.45, duration: 0.5, ease: 'power3' });
        if (inner) gsap.to(inner, { x: mx * 0.15, y: my * 0.2, duration: 0.5, ease: 'power3' });
      });
      el.addEventListener('pointerleave', () => {
        gsap.to([el, inner], { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, .35)' });
      });
    });

    // 3D tilt with a light that follows the pointer
    $$('.tilt').forEach((el) => {
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.style.setProperty('--mx', `${px * 100}%`);
        el.style.setProperty('--my', `${py * 100}%`);
        gsap.to(el, { rotateY: (px - 0.5) * 10, rotateX: (0.5 - py) * 10, transformPerspective: 1000, duration: 0.6, ease: 'power3' });
      });
      el.addEventListener('pointerleave', () => gsap.to(el, { rotateX: 0, rotateY: 0, duration: 1, ease: 'elastic.out(1, .4)' }));
    });
  }

  document.fonts?.ready.then(() => ScrollTrigger.refresh());
  addEventListener('load', () => ScrollTrigger.refresh());
})();
