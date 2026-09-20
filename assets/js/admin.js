// 栖影堂 CMS 后台 SPA（Vanilla，无框架）。对接 Phase 2 的 /api/*。
// 图片：浏览器端 Cropper.js 裁剪 → Canvas 导出 WebP（主图≤2000 q0.85 / 缩略图≤600 q0.80）→ /api/upload → R2。

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const CATS = { portrait: '人像写真', wedding: '婚礼摄影', event: '活动摄影' };

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
let toastTimer;
function toast(msg, isErr) {
  clearTimeout(toastTimer);
  let t = $('#toast');
  if (!t) { t = el('div'); t.id = 'toast'; document.body.append(t); }
  t.textContent = msg; t.className = 'toast' + (isErr ? ' err' : '');
  toastTimer = setTimeout(() => t.remove(), 3200);
}

// —— API ——
const api = {
  async req(method, url, body, form) {
    const init = { method, credentials: 'same-origin', headers: {} };
    if (form) init.body = body;
    else if (body !== undefined) { init.headers['content-type'] = 'application/json'; init.body = JSON.stringify(body); }
    const res = await fetch(url, init);
    if (res.status === 401 && !url.includes('/api/auth/login')) { showLogin(); throw new Error('登录已失效，请重新登录'); }
    let data = {}; try { data = await res.json(); } catch {}
    if (!res.ok) throw new Error(data.error || ('HTTP ' + res.status));
    return data;
  },
  get: u => api.req('GET', u),
  post: (u, b) => api.req('POST', u, b),
  put: (u, b) => api.req('PUT', u, b),
  del: u => api.req('DELETE', u),
  uploadPhoto(id, image, thumb) {
    const fd = new FormData();
    fd.set('kind', 'photo'); fd.set('id', id);
    fd.set('image', image, 'image.webp'); fd.set('thumbnail', thumb, 'thumbnail.webp');
    return api.req('POST', '/api/upload', fd, true);
  },
  uploadCover(id, image) {
    const fd = new FormData();
    fd.set('kind', 'cover'); fd.set('id', id); fd.set('image', image, 'cover.webp');
    return api.req('POST', '/api/upload', fd, true);
  },
};

// —— 鉴权与路由 ——
function showLogin() { $('#app').hidden = true; $('#login-view').hidden = false; }
function enterApp() { $('#login-view').hidden = true; $('#app').hidden = false; route(); }

$('#login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const msg = $('#login-msg'); msg.textContent = '';
  const btn = e.target.querySelector('button'); btn.disabled = true; btn.innerHTML = '<span class="spin"></span> 登录中';
  try { await api.post('/api/auth/login', { password: $('#pw').value }); $('#pw').value = ''; enterApp(); }
  catch (err) { msg.textContent = err.message; }
  finally { btn.disabled = false; btn.textContent = '登录'; }
});
$('#logout-btn').addEventListener('click', async () => {
  try { await api.post('/api/auth/logout', {}); } catch {}
  location.hash = ''; showLogin();
});

const ROUTES = { dashboard: renderDashboard, photos: renderPhotos, stories: renderStories, homepage: renderHomepage };
function route() {
  const name = (location.hash.replace('#', '') || 'dashboard');
  const view = ROUTES[name] || renderDashboard;
  $$('.nav-item[data-nav]').forEach(a => a.classList.toggle('active', a.dataset.nav === name));
  $('#view').innerHTML = '<p class="empty"><span class="spin"></span> 加载中…</p>';
  view().catch(err => { $('#view').innerHTML = `<p class="empty">出错了：${esc(err.message)}</p>`; });
}
addEventListener('hashchange', () => { if (!$('#app').hidden) route(); });

function catOpts(sel) {
  return Object.entries(CATS).map(([v, l]) => `<option value="${v}"${v === sel ? ' selected' : ''}>${l}</option>`).join('');
}

// 子分类/标签建议：该分类下的常用预设 + 现有作品已用到的标签（供 datalist 联想）。
const SUB_PRESETS = { wedding: ['领证', '婚礼'] };
function subOptions(cat) {
  const seen = new Set([...(SUB_PRESETS[cat] || []), ...(PHOTOS.filter(p => p.category === cat && p.subcategory).map(p => p.subcategory))]);
  return [...seen].map(v => `<option value="${esc(v)}"></option>`).join('');
}

// —— 概览 ——
async function renderDashboard() {
  const s = await api.get('/api/stats');
  const pct = Math.round((s.photos / (s.max_photos || 1000)) * 100);
  const cls = pct >= 95 ? 'crit' : pct >= 80 ? 'warn' : '';
  const note = pct >= 95 ? '已接近免费存储目标，请删除旧照片。' : pct >= 80 ? '建议清理未使用图片。' : '用量健康。图片存储目标 ≤ 5GB（R2）。';
  $('#view').innerHTML = `<div class="page-head"><h2>概览</h2></div>
    <div class="stats">
      ${statCard('作品总数', s.photos, cls, pct, s.max_photos)}
      ${statCard('已发布', s.published)}${statCard('草稿', s.drafts)}
      ${statCard('客片故事', s.stories)}${statCard('首页精选', s.homepage)}
    </div>
    <p class="empty" style="text-align:left;padding:.5rem 0">${cls ? '⚠ ' : ''}${esc(note)}</p>`;
}
function statCard(lbl, num, cls = '', pct = 0, max) {
  const meter = cls ? `<div class="meter"><i style="width:${Math.min(pct, 100)}%"></i></div>` : '';
  return `<div class="stat ${cls}"><div class="num">${num}${max ? ' / ' + max : ''}</div><div class="lbl">${esc(lbl)}</div>${meter}</div>`;
}

// —— 裁剪 → WebP ——
const canvasToBlob = (canvas, type, q) => new Promise(res => canvas.toBlob(res, type, q));
async function cropToBlobs(cropper) {
  const main = cropper.getCroppedCanvas({ maxWidth: 2000, maxHeight: 2000, imageSmoothingQuality: 'high' });
  const thumb = cropper.getCroppedCanvas({ maxWidth: 600, maxHeight: 600, imageSmoothingQuality: 'high' });
  const image = await canvasToBlob(main, 'image/webp', 0.85);
  const thumbnail = await canvasToBlob(thumb, 'image/webp', 0.80);
  if (!image || !thumbnail) throw new Error('当前浏览器不支持 WebP 导出，请改用 Chrome/Edge');
  return { image, thumbnail, w: main.width, h: main.height };
}
async function cropToCover(cropper) {
  const c = cropper.getCroppedCanvas({ maxWidth: 1400, maxHeight: 1400, imageSmoothingQuality: 'high' });
  const image = await canvasToBlob(c, 'image/webp', 0.85);
  if (!image) throw new Error('当前浏览器不支持 WebP 导出');
  return { image, w: c.width, h: c.height };
}
function openCropper(file, mode, onDone) {
  const url = URL.createObjectURL(file);
  const back = el('div', 'modal-back');
  back.innerHTML = `<div class="modal">
    <div class="modal-head"><b>裁剪 · 统一比例</b><button class="close-x" data-close>×</button></div>
    <div class="modal-body">
      <div class="ratio-bar" id="ratios">${[['自由', ''], ['3:2', 1.5], ['16:9', 16 / 9], ['4:3', 4 / 3], ['1:1', 1], ['3:4', 0.75], ['2:3', 2 / 3]].map(([l, r], i) => `<button type="button" class="chip${i === 1 ? ' active' : ''}" data-ratio="${r}">${l}</button>`).join('')}</div>
      <div class="cropper-host"><img id="crop-img" src="${url}" alt=""></div>
    </div>
    <div class="modal-foot"><button class="btn" data-close>取消</button><button class="btn btn-primary" data-ok>确认裁剪</button></div>
  </div>`;
  document.body.append(back);
  const cropper = new Cropper($('#crop-img', back), { viewMode: 1, aspectRatio: 1.5, autoCropArea: 0.9 });
  $('#ratios', back).addEventListener('click', e => {
    const b = e.target.closest('[data-ratio]'); if (!b) return;
    $$('#ratios .chip', back).forEach(c => c.classList.remove('active')); b.classList.add('active');
    cropper.setAspectRatio(b.dataset.ratio ? Number(b.dataset.ratio) : NaN);
  });
  back.addEventListener('click', async e => {
    if (e.target.closest('[data-close]')) { cropper.destroy(); URL.revokeObjectURL(url); back.remove(); }
    else if (e.target.closest('[data-ok]')) {
      const ok = e.target.closest('[data-ok]'); ok.disabled = true; ok.innerHTML = '<span class="spin"></span>';
      try {
        const blobs = mode === 'cover' ? await cropToCover(cropper) : await cropToBlobs(cropper);
        cropper.destroy(); URL.revokeObjectURL(url); back.remove(); onDone(blobs);
      } catch (err) { toast(err.message, true); ok.disabled = false; ok.textContent = '确认裁剪'; }
    }
  });
}

// —— 作品管理 ——
let PHOTOS = [];
async function renderPhotos() {
  const { items } = await api.get('/api/photos?limit=500');
  PHOTOS = items;
  $('#view').innerHTML = `<div class="page-head"><h2>作品管理</h2>
      <div style="display:flex;gap:.5rem">
        <select class="select" id="pf-cat" style="width:auto"><option value="">全部分类</option>${catOpts('')}</select>
        <button class="btn btn-primary" id="add-btn">＋ 上传作品</button>
      </div></div>
    ${items.length ? `<div class="masonry" id="grid">${items.map(photoCard).join('')}</div>` : '<p class="empty">还没有作品，点右上角上传。</p>'}`;
  $('#add-btn').onclick = openUpload;
  $('#pf-cat').onchange = e => { const c = e.target.value; $$('#grid .card').forEach(card => { card.hidden = c && card.dataset.cat !== c; }); };
  $('#grid').addEventListener('click', async e => {
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    const id = e.target.closest('.card').dataset.id;
    const p = PHOTOS.find(x => x.id === id);
    if (btn.dataset.act === 'toggle') { try { await api.put('/api/photos/' + id, { is_published: !p.is_published }); toast('已更新'); renderPhotos(); } catch (err) { toast(err.message, true); } }
    else if (btn.dataset.act === 'edit') openPhotoEdit(p);
    else if (btn.dataset.act === 'del') { if (confirm(p.source === 'site' ? '删除该历史作品？仅移除记录，静态图片文件保留在站点。' : '删除该作品？图片会从 R2 一并移除。')) { try { await api.del('/api/photos/' + id); toast('已删除'); renderPhotos(); } catch (err) { toast(err.message, true); } } }
  });
}
function photoCard(p) {
  const sub = p.subcategory ? ` · ${esc(p.subcategory)}` : '';
  const legacy = p.source === 'site' ? '<span class="badge draft" title="历史静态图，仅可改元数据/隐藏/删除，不能重新裁剪">旧图</span>' : '';
  return `<div class="card" data-id="${p.id}" data-cat="${p.category}">
    <span class="badge ${p.is_published ? 'pub' : 'draft'}">${p.is_published ? '已发布' : '草稿'}</span>${legacy}
    <img src="${esc(p.thumbnail)}" alt="${esc(p.alt_text || p.title)}" loading="lazy">
    <div class="meta"><div class="t">${esc(p.title)}</div><div class="c">${esc(CATS[p.category] || p.category)}${sub}</div></div>
    <div class="actions">
      <button class="btn btn-sm" data-act="toggle">${p.is_published ? '隐藏' : '发布'}</button>
      <button class="btn btn-sm" data-act="edit">编辑</button>
      <button class="btn btn-sm" data-act="del">删除</button>
    </div></div>`;
}
async function loadStoryOptions(sel, current) {
  try { const { items } = await api.get('/api/stories?limit=200'); sel.innerHTML = '<option value="">（无）</option>' + items.map(s => `<option value="${s.id}"${s.id === current ? ' selected' : ''}>${esc(s.title)}</option>`).join(''); }
  catch { sel.innerHTML = '<option value="">（无）</option>'; }
}
function openPhotoEdit(p) {
  const back = el('div', 'modal-back');
  back.innerHTML = `<div class="modal" style="width:min(560px,100%)">
    <div class="modal-head"><b>编辑作品</b><button class="close-x" data-close>×</button></div>
    <div class="modal-body">
      <img src="${esc(p.image)}" alt="" style="max-height:28vh;margin:0 auto 1rem;border-radius:8px">
      <div class="field"><label>标题</label><input class="input" id="e-title" value="${esc(p.title)}"></div>
      <div class="row">
        <div class="field"><label>分类</label><select class="select" id="e-cat">${catOpts(p.category)}</select></div>
        <div class="field"><label>子分类/标签</label><input class="input" id="e-sub" list="e-sub-list" value="${esc(p.subcategory || '')}" placeholder="如 领证 / 婚礼 / 清新日系"><datalist id="e-sub-list">${subOptions(p.category)}</datalist></div>
      </div>
      <div class="field"><label>排序（小在前）</label><input class="input" id="e-sort" type="number" value="${p.sort_order}"></div>
      <div class="field"><label>Alt 文本</label><input class="input" id="e-alt" value="${esc(p.alt_text || '')}"></div>
      <div class="field"><label>描述</label><textarea class="textarea" id="e-desc">${esc(p.description || '')}</textarea></div>
      <div class="field"><label>归属故事</label><select class="select" id="e-story"><option value="">加载中…</option></select></div>
      <label class="field" style="display:flex;align-items:center;gap:.5rem"><input type="checkbox" id="e-pub" ${p.is_published ? 'checked' : ''}> 已发布</label>
    </div>
    <div class="modal-foot"><button class="btn" data-close>取消</button><button class="btn btn-primary" id="e-save">保存</button></div>
  </div>`;
  document.body.append(back);
  back.addEventListener('click', e => { if (e.target.closest('[data-close]')) back.remove(); });
  loadStoryOptions($('#e-story', back), p.story_id);
  $('#e-save', back).onclick = async () => {
    const body = {
      title: $('#e-title', back).value, category: $('#e-cat', back).value,
      subcategory: $('#e-sub', back).value.trim() || null,
      alt_text: $('#e-alt', back).value,
      description: $('#e-desc', back).value, story_id: $('#e-story', back).value || null,
      sort_order: Number($('#e-sort', back).value) || 0, is_published: $('#e-pub', back).checked,
    };
    try { await api.put('/api/photos/' + p.id, body); toast('已保存'); back.remove(); renderPhotos(); } catch (e) { toast(e.message, true); }
  };
}

// —— 上传队列 ——
function openUpload() {
  const back = el('div', 'modal-back');
  back.innerHTML = `<div class="modal">
    <div class="modal-head"><b>上传作品</b><button class="close-x" data-close>×</button></div>
    <div class="modal-body">
      <div class="field"><label>选择照片（可多选，单次 ≤ 30 张；上传前逐张裁剪并压成 WebP）</label>
        <input class="input" type="file" id="files" accept="image/jpeg,image/png,image/webp" multiple></div>
      <div class="row">
        <div class="field"><label>分类</label><select class="select" id="up-cat">${catOpts('portrait')}</select></div>
        <div class="field"><label>子分类/标签（本批共用，可留空）</label><input class="input" id="up-sub" list="up-sub-list" placeholder="如 领证 / 婚礼 / 清新日系"><datalist id="up-sub-list">${subOptions('portrait')}</datalist></div>
        <div class="field"><label>状态</label><select class="select" id="up-pub"><option value="1">直接发布</option><option value="0">存为草稿</option></select></div>
      </div>
      <div class="queue" id="queue"></div>
    </div>
    <div class="modal-foot"><button class="btn" data-close>取消</button><button class="btn btn-primary" id="do-upload">上传</button></div>
  </div>`;
  document.body.append(back);
  const queue = $('#queue', back); const items = [];
  $('#files', back).onchange = e => {
    const files = [...e.target.files].slice(0, 30);
    if (e.target.files.length > 30) toast('单次最多 30 张，已截取前 30 张', true);
    files.forEach(f => items.push(mkQueueItem(f, queue)));
  };
  back.addEventListener('click', e => { if (e.target.closest('[data-close]')) back.remove(); });
  $('#do-upload', back).onclick = async () => {
    const cat = $('#up-cat', back).value, pub = $('#up-pub', back).value === '1';
    const sub = $('#up-sub', back).value.trim() || null;
    const ready = items.filter(i => i.parts);
    if (!ready.length) { toast('请先为每张照片点「裁剪」', true); return; }
    const btn = $('#do-upload', back); btn.disabled = true;
    for (const it of ready) {
      try {
        it.setBar(30);
        await api.uploadPhoto(it.id, it.parts.image, it.parts.thumbnail);
        it.setBar(70);
        await api.post('/api/photos', { id: it.id, title: it.title || it.name, category: cat, subcategory: sub, width: it.parts.w, height: it.parts.h, alt_text: it.title || it.name, is_published: pub, sort_order: 0 });
        it.setBar(100); it.done();
      } catch (err) { it.fail(err.message); }
    }
    toast('上传完成'); back.remove(); renderPhotos();
  };
}
function mkQueueItem(file, queue) {
  const id = crypto.randomUUID();
  const row = el('div', 'q-item');
  row.innerHTML = `<img class="prev" src="" alt=""><div class="q-meta">
      <input class="input" placeholder="标题（留空用文件名）" style="margin-bottom:.35rem">
      <div style="font-size:.78rem;color:var(--admin-mute)">${esc(file.name)}</div>
      <div class="bar"><i></i></div></div>
    <button class="btn btn-sm" data-crop>裁剪</button>`;
  queue.append(row);
  const prev = $('.prev', row), bar = $('.bar > i', row), titleIn = $('input', row), cropBtn = $('[data-crop]', row);
  prev.src = URL.createObjectURL(file);
  const it = {
    id, name: file.name, parts: null,
    get title() { return titleIn.value.trim(); },
    setBar: p => bar.style.width = p + '%',
    done() { row.classList.remove('failed'); row.classList.add('ready'); cropBtn.textContent = '✓'; cropBtn.disabled = true; },
    fail(msg) { row.classList.add('failed'); row.classList.remove('ready'); cropBtn.textContent = '重试'; toast(msg, true); },
  };
  cropBtn.onclick = () => openCropper(file, 'photo', parts => {
    it.parts = parts; row.classList.add('ready');
    prev.src = URL.createObjectURL(parts.image);
    cropBtn.textContent = '重新裁剪';
    bar.style.width = '0';
  });
  return it;
}

// —— 客片故事 ——
async function renderStories() {
  const { items } = await api.get('/api/stories?limit=200');
  $('#view').innerHTML = `<div class="page-head"><h2>客片故事</h2><button class="btn btn-primary" id="story-add">＋ 新建故事</button></div>
    ${items.length ? `<div class="list">${items.map(storyRow).join('')}</div>` : '<p class="empty">还没有故事。故事可关联多张作品，并可设为首页精选。</p>'}`;
  $('#story-add').onclick = () => openStoryEditor(null);
  $('#view').addEventListener('click', async e => {
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    const id = e.target.closest('.list-row').dataset.id;
    const s = items.find(x => x.id === id);
    if (btn.dataset.act === 'edit') openStoryEditor(s);
    else if (btn.dataset.act === 'toggle') { try { await api.put('/api/stories/' + id, { is_published: !s.is_published }); toast('已更新'); renderStories(); } catch (err) { toast(err.message, true); } }
    else if (btn.dataset.act === 'del') { if (confirm('删除该故事？（下属照片不会被删）')) { try { await api.del('/api/stories/' + id); toast('已删除'); renderStories(); } catch (err) { toast(err.message, true); } } }
  });
}
function storyRow(s) {
  return `<div class="list-row" data-id="${s.id}">
    ${s.cover ? `<img class="thumb" src="${esc(s.cover)}" alt="">` : '<div class="thumb"></div>'}
    <div class="grow"><div class="t">${esc(s.title)}</div><div class="s">${esc(CATS[s.category] || s.category)}${s.location ? ' · ' + esc(s.location) : ''}${s.shoot_date ? ' · ' + esc(s.shoot_date) : ''}</div></div>
    <span class="badge ${s.is_published ? 'pub' : 'draft'}" style="position:static">${s.is_published ? '已发布' : '草稿'}</span>
    <button class="btn btn-sm" data-act="toggle">${s.is_published ? '隐藏' : '发布'}</button>
    <button class="btn btn-sm" data-act="edit">编辑</button>
    <button class="btn btn-sm" data-act="del">删除</button>
  </div>`;
}
function openStoryEditor(s) {
  const isNew = !s;
  const id = s ? s.id : crypto.randomUUID();
  const back = el('div', 'modal-back');
  back.innerHTML = `<div class="modal">
    <div class="modal-head"><b>${isNew ? '新建故事' : '编辑故事'}</b><button class="close-x" data-close>×</button></div>
    <div class="modal-body">
      <div class="field"><label>封面</label>
        <div style="display:flex;gap:.75rem;align-items:center">
          <img id="cover-prev" class="thumb" style="width:120px;height:80px;object-fit:cover;border-radius:6px;background:var(--admin-panel-2)" src="${s && s.cover ? esc(s.cover) : ''}" alt="">
          <input type="file" id="cover-file" accept="image/jpeg,image/png,image/webp">
        </div></div>
      <div class="row">
        <div class="field"><label>标题 *</label><input class="input" id="s-title" value="${esc(s?.title || '')}"></div>
        <div class="field"><label>slug（URL，小写英数连字符）*</label><input class="input" id="s-slug" value="${esc(s?.slug || '')}" placeholder="autumn-wedding"></div>
      </div>
      <div class="row">
        <div class="field"><label>副标题</label><input class="input" id="s-sub" value="${esc(s?.subtitle || '')}"></div>
        <div class="field"><label>分类</label><select class="select" id="s-cat">${catOpts(s?.category)}</select></div>
      </div>
      <div class="row">
        <div class="field"><label>地点</label><input class="input" id="s-loc" value="${esc(s?.location || '')}"></div>
        <div class="field"><label>拍摄时间</label><input class="input" id="s-date" value="${esc(s?.shoot_date || '')}" placeholder="2026.09"></div>
      </div>
      <div class="field"><label>简介 / lede</label><input class="input" id="s-desc" value="${esc(s?.description || '')}"></div>
      <div class="field"><label>正文（极简 Markdown：空行分段，行首 # ## 标题，**粗体**）</label><textarea class="textarea" id="s-content" style="min-height:160px">${esc(s?.content || '')}</textarea></div>
      <label class="field" style="display:flex;align-items:center;gap:.5rem"><input type="checkbox" id="s-pub" ${s && s.is_published ? 'checked' : ''}> 已发布</label>
    </div>
    <div class="modal-foot"><button class="btn" data-close>取消</button><button class="btn btn-primary" id="s-save">${isNew ? '创建' : '保存'}</button></div>
  </div>`;
  document.body.append(back);
  back.addEventListener('click', e => { if (e.target.closest('[data-close]')) back.remove(); });

  let coverBlob = null;
  $('#cover-file', back).onchange = e => { const f = e.target.files[0]; if (f) openCropper(f, 'cover', parts => { coverBlob = parts.image; $('#cover-prev', back).src = URL.createObjectURL(parts.image); }); };

  $('#s-save', back).onclick = async () => {
    const btn = $('#s-save', back); btn.disabled = true; btn.innerHTML = '<span class="spin"></span>';
    const body = {
      id, slug: $('#s-slug', back).value, title: $('#s-title', back).value, subtitle: $('#s-sub', back).value,
      category: $('#s-cat', back).value, location: $('#s-loc', back).value, shoot_date: $('#s-date', back).value,
      description: $('#s-desc', back).value, content: $('#s-content', back).value, is_published: $('#s-pub', back).checked,
      cover_uploaded: !!coverBlob,
    };
    try {
      if (coverBlob) await api.uploadCover(id, coverBlob);
      if (isNew) await api.post('/api/stories', body); else await api.put('/api/stories/' + id, body);
      toast('已保存'); back.remove(); renderStories();
    } catch (e) { toast(e.message, true); btn.disabled = false; btn.textContent = isNew ? '创建' : '保存'; }
  };
}

// —— 首页精选 ——
let HOME = [];
async function renderHomepage() {
  const [{ stories: cur }, { items: all }] = await Promise.all([api.get('/api/home'), api.get('/api/stories?limit=200')]);
  HOME = cur.slice();
  const pubAll = all.filter(s => s.is_published);
  const pool = pubAll.filter(s => !HOME.some(h => h.id === s.id));
  $('#view').innerHTML = `<div class="page-head"><h2>首页精选</h2><button class="btn btn-primary" id="home-save">保存顺序</button></div>
    <p class="empty" style="text-align:left;padding:0 0 1rem">拖拽调整顺序，首页「客片故事」区块将按此顺序显示。</p>
    <div class="home-slots" id="slots"></div>
    <div class="row" style="margin-top:1.5rem;align-items:flex-end">
      <div class="field" style="flex:1"><label>添加已发布故事</label><select class="select" id="home-add"><option value="">选择要加入首页的故事…</option>${pool.map(s => `<option value="${s.id}">${esc(s.title)}</option>`).join('')}</select></div>
      <button class="btn" id="home-add-btn">＋ 加入</button>
    </div>`;
  drawSlots();
  $('#home-add-btn').onclick = () => {
    const sel = $('#home-add'); const sid = sel.value; if (!sid) return;
    const story = pubAll.find(s => s.id === sid);
    if (story && !HOME.some(h => h.id === sid)) { HOME.push(story); drawSlots(); sel.innerHTML = `<option value="">选择要加入首页的故事…</option>` + (pubAll.filter(s => !HOME.some(h => h.id === s.id)).map(s => `<option value="${s.id}">${esc(s.title)}</option>`).join('')); }
  };
  $('#home-save').onclick = async () => {
    try { await api.put('/api/home', { story_ids: HOME.map(s => s.id) }); toast('首页精选已更新'); } catch (e) { toast(e.message, true); }
  };
}
function drawSlots() {
  const box = $('#slots');
  if (!HOME.length) { box.innerHTML = '<p class="empty">尚未选择首页故事。</p>'; return; }
  box.innerHTML = HOME.map((s, i) => `<div class="slot" draggable="true" data-id="${s.id}">
    <span class="drag-handle" title="拖拽排序">⠿</span>
    ${s.cover ? `<img src="${esc(s.cover)}" alt="">` : '<div class="thumb"></div>'}
    <div style="flex:1"><div>${esc(s.title)}</div><div style="font-size:.78rem;color:var(--admin-mute)">${esc(CATS[s.category] || s.category)}</div></div>
    <button class="btn btn-sm" data-rm="${s.id}">移除</button></div>`).join('');
  $$('#slots [data-rm]', box).forEach(b => b.onclick = () => { HOME = HOME.filter(s => s.id !== b.dataset.rm); drawSlots(); });
  wireDrag(box);
}
function wireDrag(box) {
  let dragEl = null;
  const after = y => {
    let best = null, bestOff = -Infinity;
    for (const s of $$('.slot', box)) {
      if (s === dragEl) continue;
      const r = s.getBoundingClientRect();
      const off = y - (r.top + r.height / 2);
      if (off < 0 && off > bestOff) { best = s; bestOff = off; }
    }
    return best;
  };
  $$('.slot', box).forEach(item => {
    item.addEventListener('dragstart', () => { dragEl = item; item.style.opacity = '.5'; });
    item.addEventListener('dragend', () => { item.style.opacity = ''; dragEl = null; commitOrder(); });
  });
  box.addEventListener('dragover', e => {
    if (!dragEl) return;
    e.preventDefault();
    const a = after(e.clientY);
    if (a == null) box.appendChild(dragEl); else box.insertBefore(dragEl, a);
  });
  function commitOrder() {
    const order = $$('.slot', box).map(n => n.dataset.id);
    HOME = order.map(id => HOME.find(s => s.id === id)).filter(Boolean);
  }
}

// —— 启动 ——
(async function boot() {
  try { await api.get('/api/auth/me'); enterApp(); }
  catch { showLogin(); }
})();
