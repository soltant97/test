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

function activateNavigation() {
  const menuButton = document.querySelector('.menu-toggle');
  const menu = document.querySelector('#nav-links');

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
  if (new URLSearchParams(window.location.search).has('skickat')) {
    status.textContent = 'Tack! Ditt meddelande är skickat. Vi återkommer så snart vi kan.';
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('skickat');
    window.history.replaceState({}, '', cleanUrl);
  }

  form.addEventListener('submit', () => {
    /* FormSubmit kräver en fullständig URL för _next; skapa fältet först när vi har en giltig adress. */
    const redirectUrl = new URL(window.location.href);
    redirectUrl.searchParams.set('skickat', '1');
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
    status.textContent = 'Skickar ditt meddelande…';
  });
}

loadPageSections()
  .then(() => {
    activateNavigation();
    alignHomeWaveWithFirstCircle();
    activateContactForm();
  })
  .catch((error) => console.error('Webbplatsens HTML-delar kunde inte läsas in.', error));
