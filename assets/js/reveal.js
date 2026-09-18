export function initReveal(root = document) {
  const els = root.querySelectorAll('[data-reveal]');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    els.forEach(el => el.classList.add('is-visible'));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
    }
  }, { rootMargin: '0px 0px -10% 0px', threshold: 0.05 });
  els.forEach(el => io.observe(el));
}
