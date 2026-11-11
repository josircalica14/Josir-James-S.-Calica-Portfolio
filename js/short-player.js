// Video Edits — self-hosted Short. The poster shows a play badge; pressing it
// starts the file and the badge fades out, then comes back whenever playback
// stops. The <video> keeps its native controls, so seeking, volume, captions and
// fullscreen stay accessible on desktop and mobile without re-implementing them.

export function setupShortPlayer() {
  const players = document.querySelectorAll('[data-short-player]');
  if (!players.length) return; // Not on a page with the video section

  players.forEach((root) => {
    const video = root.querySelector('video');
    const badge = root.querySelector('[data-short-play]');
    if (!video || !badge) return;

    badge.addEventListener('click', () => {
      // play() rejects when the file is missing or the browser blocks it; the
      // badge then stays put so the poster is still the visible affordance
      const started = video.play();
      if (started && typeof started.catch === 'function') started.catch(() => {});
    });

    video.addEventListener('play', () => root.classList.add('is-playing'));
    video.addEventListener('pause', () => root.classList.remove('is-playing'));
    video.addEventListener('ended', () => root.classList.remove('is-playing'));
  });
}
