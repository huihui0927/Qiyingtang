export function initCarousel(slidesEl, dotsEl, { interval = 6000 } = {}) {
  const slides = [...slidesEl.querySelectorAll('.hero-slide')];
  if (slides.length < 2) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let current = -1;
  let timer = null;

  const dots = [];
  if (dotsEl) {
    slides.forEach((_, i) => {
      const dot = document.createElement('button');
      dot.className = 'hero-dot';
      dot.type = 'button';
      dot.setAttribute('role', 'tab');
      dot.setAttribute('aria-label', `第 ${i + 1} 张`);
      dot.addEventListener('click', () => { show(i); restart(); });
      dotsEl.append(dot);
      dots.push(dot);
    });
  }

  function show(i) {
    if (current >= 0) slides[current].classList.remove('is-active');
    current = (i + slides.length) % slides.length;
    // 重触发 slide-breathe 动画
    const el = slides[current];
    el.classList.remove('is-active');
    void el.offsetWidth;
    el.classList.add('is-active');
    dots.forEach((d, j) => d.setAttribute('aria-selected', String(j === current)));
  }

  function restart() {
    if (timer) clearInterval(timer);
    if (!reduce) timer = setInterval(() => show(current + 1), interval);
  }

  show(0);
  if (!reduce) {
    restart();
    const root = slidesEl.closest('.hero');
    root.addEventListener('pointerenter', () => clearInterval(timer));
    root.addEventListener('pointerleave', restart);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) clearInterval(timer);
      else restart();
    });
  }
}
