// 首页「客片故事」区块接 /api/home。有数据则渲染，失败/空则保留 index.html 里的静态兜底内容。
const PAGE = { portrait: 'portrait.html', wedding: 'wedding.html', event: 'event.html' };

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function feature(s, i) {
  const issue = s.shoot_date ? esc(s.shoot_date) : String(i + 1).padStart(2, '0');
  const meta = [s.subtitle, s.location].filter(Boolean).map(esc).join(' · ');
  const media = s.cover
    ? `<div class="story-feature-media"><img src="${esc(s.cover)}" alt="${esc(s.title)}" loading="lazy"></div>` : '';
  return `<article class="story-feature">
    ${media}
    <div class="story-feature-text">
      <span class="issue" lang="en">${issue}</span>
      <h3 lang="zh-CN">${esc(s.title)}</h3>
      ${meta ? `<p class="meta">${meta}</p>` : ''}
      ${s.description ? `<p class="lede">${esc(s.description)}</p>` : ''}
      <a class="view-story" href="${PAGE[s.category] || 'index.html'}"><span lang="en">View Story</span> →</a>
    </div>
  </article>`;
}

export async function initHomeCMS() {
  const box = document.getElementById('client-stories');
  if (!box) return;
  let data;
  try {
    const res = await fetch('/api/home', { credentials: 'same-origin' });
    if (!res.ok) return;                       // 后台不可用 → 保留静态兜底
    data = await res.json();
  } catch { return; }
  const stories = Array.isArray(data && data.stories) ? data.stories : [];
  if (!stories.length) return;                 // 未配置精选 → 保留静态兜底
  box.innerHTML = stories.map(feature).join('');
}
