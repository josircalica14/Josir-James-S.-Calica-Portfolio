// Focus view — clicking a finished frame on the gallery or a section page opens
// it in a dimmed overlay at full size, carrying the same before/after wipe the
// section pages have inline. The page itself keeps showing the graded frame; the
// raw half is only revealed inside the overlay.
//
// Triggers are discovered from the markup, so a new plate needs no extra wiring:
//   .ba-item                section pages — raw + graded already in the DOM
//   .ba-item--photoshop     Photoshop page — graded only, no raw exported yet
//   .gallery-ledger__print  gallery page — graded only; the raw path is derived
//                           from the graded one (/after/ → /before/)

import { initCompare } from './before-after.js';

const SLOP_PX = 6; // pointer travel beyond this is a drag, not a click
// Collections with no raw frames exported at all. Their plates open as enlarged
// views instead of asking for a /before/ file that does not exist (one 404 per
// open otherwise, and an empty half-wipe for the first frames of the fade).
const NO_RAW = ['/photoshop/'];

// Gallery plates carry only the graded frame, so the raw is derived from it.
// The two halves do not always share a filename: colour grades ship as
// color-grade-03.webp while their raws are grade-03.webp, so the plain
// /after/ → /before/ swap lands on a file that does not exist and the plate
// would silently degrade to a single frame with no slider.
function rawPathFor(src) {
  return src
    .replace('/after/', '/before/')
    .replace(/\/color-grade-(\d+)\.(\w+)$/i, (_, n, ext) => `/grade-${n}.${ext}`);
}
const FADE_MS = 240;
const FOCUSABLE = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

let modal = null;
let lastTrigger = null;
let hideTimer = 0;

function labelsOf(plate) {
  const cap = plate.querySelector('figcaption');
  if (!cap) return { name: '', tag: '' };
  const nameEl = cap.querySelector('.ba-item__name')
    || [...cap.querySelectorAll('span')].find((s) => !s.classList.contains('gallery-ledger__tag'));
  return {
    name: nameEl ? nameEl.textContent.trim() : '',
    tag: cap.querySelector('.gallery-ledger__tag')?.textContent.trim() || '',
  };
}

function ratioOf(w, h) {
  return Number(w) > 0 && Number(h) > 0 ? Number(w) / Number(h) : 0;
}

function describe(plate) {
  const { name, tag } = labelsOf(plate);
  const ba = plate.querySelector('.ba');
  let after = '';
  let before = '';
  let ratio = 0;

  if (ba) {
    // Section page — both frames are already in the DOM
    after = ba.querySelector('img:not(.ba__before)')?.getAttribute('src') || '';
    before = ba.querySelector('img.ba__before')?.getAttribute('src') || '';
    const [w, h] = (ba.style.aspectRatio || '').split('/').map((n) => parseFloat(n));
    ratio = ratioOf(w, h);
  } else {
    const img = plate.querySelector('img');
    if (!img) return null;
    after = img.getAttribute('src') || '';
    // Gallery plates ship the graded frame only; the raw sits beside it
    const canDerive = after.includes('/after/') && !NO_RAW.some((seg) => after.includes(seg));
    before = canDerive ? rawPathFor(after) : '';
    ratio = ratioOf(img.getAttribute('width'), img.getAttribute('height'));
  }

  if (!after) return null;
  return { name, tag, after, before, ratio: ratio || 0.75 };
}

function buildStage(shot) {
  const plate = document.createElement('div');
  plate.className = 'ba focus-modal__plate';
  plate.style.setProperty('--pos', '50%');
  plate.style.setProperty('--shot-ratio', String(shot.ratio));
  plate.style.aspectRatio = String(shot.ratio);

  const after = document.createElement('img');
  after.src = shot.after;
  after.alt = shot.name ? `${shot.name} — finished frame` : 'Finished frame';
  after.draggable = false;
  plate.append(after);

  if (!shot.before) {
    // Nothing to wipe against — open it as a plain enlarged view
    plate.classList.add('ba--solo');
    return plate;
  }

  const before = document.createElement('img');
  before.className = 'ba__before';
  before.src = shot.before;
  before.alt = shot.name ? `${shot.name} — original frame` : 'Original frame';
  before.draggable = false;
  plate.append(before);

  plate.setAttribute('role', 'slider');
  plate.setAttribute('tabindex', '0');
  plate.setAttribute('aria-label', `${shot.name || 'Photo'} — before and after comparison`);
  plate.setAttribute('aria-valuemin', '0');
  plate.setAttribute('aria-valuemax', '100');
  plate.setAttribute('aria-valuenow', '50');

  plate.insertAdjacentHTML('beforeend', `
      <div class="ba__divider" aria-hidden="true"></div>
      <div class="ba__handle" aria-hidden="true">
          <svg class="ba__grip" viewBox="0 0 18 18" fill="none"><path d="M6 4 2 9l4 5M12 4l4 5-4 5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </div>
      <span class="ba__label ba__label--before">Before</span>
      <span class="ba__label ba__label--after">After</span>`);

  return plate;
}

function trapTab(e) {
  const items = [...modal.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
  if (!items.length) return;
  const first = items[0];
  const last = items[items.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

function ensureModal() {
  if (modal) return modal;

  modal = document.createElement('div');
  modal.className = 'focus-modal';
  modal.hidden = true;
  modal.innerHTML = `
      <div class="focus-modal__backdrop" data-focus-close></div>
      <div class="focus-modal__dialog" role="dialog" aria-modal="true" tabindex="-1" aria-label="Photo focus view">
          <figure class="focus-modal__figure">
              <!-- Title above the image, close button centred below it -->
              <figcaption class="focus-modal__caption">
                  <span class="focus-modal__name"></span>
                  <span class="gallery-ledger__tag focus-modal__tag"></span>
              </figcaption>
              <div class="focus-modal__stage">
                  <div class="focus-modal__slot"></div>
              </div>
              <button class="focus-modal__close" type="button" data-focus-close>Close</button>
          </figure>
      </div>`;

  // Backdrop and close button both carry [data-focus-close]
  modal.addEventListener('click', (e) => {
    if (e.target.closest('[data-focus-close]')) close();
  });

  document.addEventListener('keydown', (e) => {
    if (modal.hidden) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') {
      trapTab(e);
    }
  });

  document.body.append(modal);
  return modal;
}

function open(shot, trigger) {
  ensureModal();
  clearTimeout(hideTimer);

  const slot = modal.querySelector('.focus-modal__slot');
  const plate = buildStage(shot);
  slot.replaceChildren(plate);
  if (!plate.classList.contains('ba--solo')) initCompare(plate);

  const nameEl = modal.querySelector('.focus-modal__name');
  const tagEl = modal.querySelector('.focus-modal__tag');
  nameEl.textContent = shot.name;
  tagEl.textContent = shot.tag;
  tagEl.hidden = !shot.tag;

  lastTrigger = trigger || null;
  modal.hidden = false;
  document.body.classList.add('focus-modal-open');
  requestAnimationFrame(() => modal.classList.add('is-open'));
  // Focus the dialog itself so the Close pill is not pre-lit on open; Tab moves
  // into the plate (slider) and then the button.
  modal.querySelector('.focus-modal__dialog').focus({ preventScroll: true });
}

function close() {
  if (!modal || modal.hidden) return;
  modal.classList.remove('is-open');
  document.body.classList.remove('focus-modal-open');

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  hideTimer = window.setTimeout(() => {
    modal.hidden = true;
    modal.querySelector('.focus-modal__slot').replaceChildren();
  }, reduced ? 0 : FADE_MS);

  if (lastTrigger && document.contains(lastTrigger)) lastTrigger.focus({ preventScroll: true });
  lastTrigger = null;
}

function enhance(plate) {
  const shot = describe(plate);
  if (!shot) return;

  plate.classList.add('is-focus-trigger');
  if (!plate.hasAttribute('tabindex')) plate.setAttribute('tabindex', '0');
  if (!plate.hasAttribute('role')) plate.setAttribute('role', 'button');
  plate.dataset.focusRaw = shot.before ? 'yes' : 'no';
  if (!plate.hasAttribute('aria-label')) {
    plate.setAttribute('aria-label', `Open ${shot.name || 'photo'} — before and after`);
  }

  // A press that never travels is a click; anything further is a divider drag
  let origin = null;
  plate.addEventListener('pointerdown', (e) => {
    origin = { x: e.clientX, y: e.clientY };
  }, { passive: true });
  plate.addEventListener('pointerup', (e) => {
    if (!origin) return;
    const moved = Math.abs(e.clientX - origin.x) > SLOP_PX
      || Math.abs(e.clientY - origin.y) > SLOP_PX;
    origin = null;
    if (!moved) open(shot, plate);
  });
  plate.addEventListener('pointercancel', () => { origin = null; }, { passive: true });

  plate.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      open(shot, plate);
    }
  });
}

export function setupFocusModal() {
  const plates = document.querySelectorAll('.ba-item, .gallery-ledger__print');
  if (!plates.length) return; // Not on a gallery or section page
  plates.forEach(enhance);
}
