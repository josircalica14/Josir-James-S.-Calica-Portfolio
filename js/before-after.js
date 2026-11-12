// Before/after compare — drag (or arrow-key) the divider to wipe between the
// raw and edited frames. The .ba element carries --pos (0–100%), which CSS uses
// to clip the raw frame to the left of the divider; the graded frame fills the
// rest, so the plate reads BEFORE then AFTER left to right. Dragging right
// therefore reveals more raw. Works with mouse, touch (pointer capture), and
// keyboard via the slider role.
//
// initCompare() wires a single plate, so the focus-view overlay — which builds
// its plate at runtime — reuses exactly this behaviour instead of carrying a
// second copy of the drag logic.

export function initCompare(plate) {
  if (!plate || plate.dataset.compareReady === '1') return;
  plate.dataset.compareReady = '1';

  const setPos = (pct) => {
    const pos = Math.min(100, Math.max(0, pct));
    plate.style.setProperty('--pos', pos + '%');
    plate.setAttribute('aria-valuenow', String(Math.round(pos)));
  };

  const fromEvent = (e) => {
    const r = plate.getBoundingClientRect();
    setPos(((e.clientX - r.left) / r.width) * 100);
  };

  // The "before" frame may not exist yet (camera raws are not web ready).
  // Once that image settles, drop the plate to a single graded frame and
  // leave it non-interactive rather than showing an empty wipe.
  const before = plate.querySelector('img.ba__before');
  const settle = () => {
    if (before && before.naturalWidth > 0) return;
    plate.classList.add('ba--solo');
    plate.removeAttribute('role');
    plate.removeAttribute('aria-valuemin');
    plate.removeAttribute('aria-valuemax');
    plate.removeAttribute('aria-valuenow');
    plate.removeAttribute('tabindex');
  };
  if (before) {
    if (before.complete) settle();
    // A missing file fires "error", a present one fires "load" — both must
    // settle the plate or a 404 leaves an empty half-wipe on screen.
    before.addEventListener('load', settle, { once: true });
    before.addEventListener('error', settle, { once: true });
  } else {
    // No raw was ever supplied for this grade — render it as a single frame.
    settle();
  }

  // Touch handling — simplified approach using CSS touch-action.
  // The handle has touch-action:none in CSS, plate has touch-action:pan-y.
  // This CSS-first approach is more reliable than JavaScript preventDefault.
  const handle = plate.querySelector('.ba__handle');
  let isDragging = false;
  let startX = 0;

  if (handle) {
    // Touch on handle only - nowhere else
    handle.addEventListener('touchstart', (e) => {
      if (plate.classList.contains('ba--solo')) return;

      isDragging = true;
      startX = e.touches[0].clientX;
    }, { passive: true });

    // Listen for movement on the plate
    plate.addEventListener('touchmove', (e) => {
      if (!isDragging) return;

      const touch = e.touches[0];
      const r = plate.getBoundingClientRect();
      setPos(((touch.clientX - r.left) / r.width) * 100);
    }, { passive: true });

    plate.addEventListener('touchend', () => {
      isDragging = false;
    }, { passive: true });

    plate.addEventListener('touchcancel', () => {
      isDragging = false;
    }, { passive: true });
  }

  // Mouse-only drag — uses mousedown so touch events never trigger it.
  plate.addEventListener('mousedown', (e) => {
    if (plate.classList.contains('ba--solo')) return;
    e.preventDefault();
    fromEvent(e);
    const move = (ev) => fromEvent(ev);
    const up = () => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  });

  // Keyboard: arrows nudge the divider 4%, Home/End jump to the edges.
  plate.addEventListener('keydown', (e) => {
    if (plate.classList.contains('ba--solo')) return;
    const current = parseFloat(plate.style.getPropertyValue('--pos')) || 50;
    const step = e.shiftKey ? 10 : 4;
    if (e.key === 'ArrowLeft') { e.preventDefault(); setPos(current - step); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); setPos(current + step); }
    else if (e.key === 'Home') { e.preventDefault(); setPos(0); }
    else if (e.key === 'End') { e.preventDefault(); setPos(100); }
  });
}

export function setupBeforeAfter() {
  document.querySelectorAll('.ba').forEach(initCompare);
}
