async function loadPageSections() {
  const placeholders = document.querySelectorAll('[data-include]');

  await Promise.all(Array.from(placeholders, async (placeholder) => {
    const response = await fetch(placeholder.dataset.include);

    if (!response.ok) {
      throw new Error(`Kunde inte läsa ${placeholder.dataset.include}`);
    }

    placeholder.outerHTML = await response.text();
  }));
}

/* Tona in startsidans avsnitt när de rullar in i synfältet. */
function activateHomeScrollFade() {
  const isHome = document.querySelector('.hero-banner') && document.querySelector('.home-intro');
  const sections = isHome
    ? [document.querySelector('.home-intro'), document.querySelector('.home-services')]
    : Array.from(document.querySelectorAll('main section'));
  const visibleSections = sections.filter(Boolean);
  if (!visibleSections.length) return;

  if (!('IntersectionObserver' in window)) {
    visibleSections.forEach((section) => section.classList.add('is-visible'));
    return;
  }

  const observer = new IntersectionObserver((entries, activeObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      activeObserver.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });

  visibleSections.forEach((section) => observer.observe(section));
}

function activateNavigation() {
  const menuButton = document.querySelector('.menu-toggle');
  const menu = document.querySelector('#nav-links');
  const routeConfig = {
    sv: { home: 'hem', services: 'tjanster', about: 'om-oss', contact: 'kontakt' },
    en: { home: 'home', services: 'services', about: 'about', contact: 'contact' },
  };
  const currentRoute = () => {
    const segments = window.location.pathname.split('/').filter(Boolean)
      .filter((segment) => segment !== 'index.html');
    const localeIndex = segments.findIndex((segment) => segment === 'sv' || segment === 'en');
    if (localeIndex >= 0) {
      const locale = segments[localeIndex];
      const pages = Object.keys(routeConfig[locale]);
      const currentPage = pages.find((page) => routeConfig[locale][page] === segments[localeIndex + 1]) || 'home';
      return { locale, page: currentPage, base: segments.slice(0, localeIndex), isLocaleRoot: localeIndex === segments.length - 1 };
    }

    const legacyRoutes = { Hem: 'home', Tjanster: 'services', Om: 'about', Kontakt: 'contact' };
    const legacyIndex = segments.findIndex((segment) => legacyRoutes[segment]);
    return {
      locale: 'sv',
      page: legacyIndex >= 0 ? legacyRoutes[segments[legacyIndex]] : 'home',
      base: legacyIndex >= 0 ? segments.slice(0, legacyIndex) : segments,
      isLocaleRoot: legacyIndex < 0,
    };
  };
  const routeUrl = (locale, page, base, localeRoot = false) => {
    const path = [...base, locale, ...(localeRoot ? [] : [routeConfig[locale][page]])];
    return `/${path.join('/')}/`;
  };

  const current = currentRoute();
  document.querySelectorAll('[data-asset]').forEach((asset) => {
    /* Inuti GitHub Pages behåll repots sökväg; språkmapparna är lowercase. */
    const assetRoot = `/${[...current.base, 'General', 'assets'].join('/')}/`;
    asset.src = `${assetRoot}${asset.dataset.asset}`;
  });

  document.querySelectorAll('[data-route]').forEach((link) => {
    const route = link.dataset.route;
    link.href = routeUrl(current.locale, route === 'home-root' ? 'home' : route, current.base, route === 'home-root');
  });

  document.querySelectorAll('[data-language]').forEach((button) => {
    const activeLanguage = current.locale;
    button.setAttribute('aria-pressed', String(button.dataset.language === activeLanguage));
    button.addEventListener('click', () => {
      if (button.dataset.language === activeLanguage) return;
      const nextLocale = button.dataset.language;
      window.location.href = routeUrl(nextLocale, current.page, current.base, current.isLocaleRoot);
    });
  });

  menuButton.addEventListener('click', () => {
    const isOpen = menu.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(isOpen));
  });

  menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
    menu.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
  }));

  document.querySelector('#year').textContent = new Date().getFullYear();
}

/* Startsidan — håll första cirkelbildens överkant i linje med den gröna vågen */
function alignHomeWaveWithFirstCircle() {
  const intro = document.querySelector('.home-intro');
  const services = document.querySelector('.home-services');
  const firstCircle = services?.querySelector('.home-service-image-right .home-service-image');

  if (!intro || !services || !firstCircle) return;

  /* Den nedre vågkurvans koordinater i home-intro-shape.svg, från höger till vänster */
  const lowerWaveSegments = [
    [[1600, 770], [1452, 704], [1310, 676], [1154, 719]],
    [[1154, 719], [974, 768], [886, 790], [700, 762]],
    [[700, 762], [492, 732], [338, 702], [184, 748]],
    [[184, 748], [105, 772], [40, 804], [0, 837]],
  ];

  const bezierCoordinate = (points, t, axis) => {
    const inverse = 1 - t;
    return inverse ** 3 * points[0][axis]
      + 3 * inverse ** 2 * t * points[1][axis]
      + 3 * inverse * t ** 2 * points[2][axis]
      + t ** 3 * points[3][axis];
  };

  const getWaveHeight = (svgX) => {
    const segment = lowerWaveSegments.find(([start, , , end]) => svgX <= start[0] && svgX >= end[0]);
    if (!segment) return 0.75;

    let low = 0;
    let high = 1;
    for (let step = 0; step < 32; step += 1) {
      const middle = (low + high) / 2;
      if (bezierCoordinate(segment, middle, 0) > svgX) low = middle;
      else high = middle;
    }

    return bezierCoordinate(segment, (low + high) / 2, 1) / 1000;
  };

  /* Mät om vid sidladdning och fönsterändring så placeringen följer skärmstorleken */
  const updateAlignment = () => {
    services.style.setProperty('--home-wave-shift', '0px');
    const introBounds = intro.getBoundingClientRect();
    const circleBounds = firstCircle.getBoundingClientRect();
    const backgroundWidthSetting = getComputedStyle(intro, '::before').backgroundSize.split(/\s+/)[0];
    const backgroundWidth = backgroundWidthSetting.endsWith('%')
      ? introBounds.width * parseFloat(backgroundWidthSetting) / 100
      : parseFloat(backgroundWidthSetting);
    const circleCenterX = circleBounds.left + circleBounds.width / 2 - introBounds.left;
    const svgX = Math.max(0, Math.min(1600, circleCenterX / backgroundWidth * 1600));
    const targetY = introBounds.top + getWaveHeight(svgX) * introBounds.height;
    const shiftY = targetY - circleBounds.top;

    services.style.setProperty('--home-wave-shift', `${shiftY}px`);
  };

  let framePending = false;
  const scheduleAlignment = () => {
    if (framePending) return;
    framePending = true;
    requestAnimationFrame(() => {
      framePending = false;
      updateAlignment();
    });
  };

  updateAlignment();
  window.addEventListener('resize', scheduleAlignment);
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(scheduleAlignment);
    observer.observe(intro);
    observer.observe(services);
  }
  document.fonts?.ready.then(scheduleAlignment);
}

/* Kontaktformulär — fyll i en returadress och låt FormSubmit sköta POST-skicket */
function activateContactForm() {
  const form = document.querySelector('#contact-form');
  if (!form) return;

  const submitButton = form.querySelector('button[type="submit"]');
  const status = document.querySelector('#contact-form-note');
  const isEnglish = document.documentElement.lang === 'en';
  const sentParameter = isEnglish ? 'sent' : 'skickat';
  if (new URLSearchParams(window.location.search).has(sentParameter)) {
    status.textContent = isEnglish
      ? 'Thank you! Your message has been sent. We will get back to you as soon as we can.'
      : 'Tack! Ditt meddelande är skickat. Vi återkommer så snart vi kan.';
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete(sentParameter);
    window.history.replaceState({}, '', cleanUrl);
  }

  form.addEventListener('submit', () => {
    /* FormSubmit kräver en fullständig URL för _next; skapa fältet först när vi har en giltig adress. */
    const redirectUrl = new URL(window.location.href);
    redirectUrl.searchParams.set(isEnglish ? 'sent' : 'skickat', '1');
    redirectUrl.hash = 'contact-form';
    let nextUrl = form.querySelector('input[name="_next"]');
    if (!nextUrl) {
      nextUrl = document.createElement('input');
      nextUrl.type = 'hidden';
      nextUrl.name = '_next';
      form.append(nextUrl);
    }
    nextUrl.value = redirectUrl.toString();
    submitButton.disabled = true;
    status.textContent = isEnglish ? 'Sending your message…' : 'Skickar ditt meddelande…';
  });
}

loadPageSections()
  .then(() => {
    activateNavigation();
    alignHomeWaveWithFirstCircle();
    activateHomeScrollFade();
    activateContactForm();
  })
  .catch((error) => console.error('Webbplatsens HTML-delar kunde inte läsas in.', error));
