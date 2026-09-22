-- 栖影堂 CMS — D1 schema
-- 应用：npx wrangler d1 execute qiyingtang --local  --file=./schema.sql
--       npx wrangler d1 execute qiyingtang --remote --file=./schema.sql
-- 约束：只存元数据，绝不存图片二进制（图在 R2）。

-- photos：单张照片。R2 对象 key 由 id 派生（photos/{id}/image.webp、thumbnail.webp），
-- 因此不额外存完整 URL；前台 URL 由 API 用 env.R2_PUBLIC_BASE + key 拼出。
CREATE TABLE IF NOT EXISTS photos (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  description    TEXT,
  category       TEXT NOT NULL,               -- 'portrait' | 'wedding' | 'event'
  subcategory    TEXT,                        -- 页内分组标签：婚礼→领证/婚礼，人像→风格名；可为空
  source         TEXT NOT NULL DEFAULT 'r2'   -- 'r2'（后台上传，图在 R2）| 'site'（历史静态图，图仍是 Pages 路径）
                 CHECK (source IN ('r2','site')),
  story_id       TEXT REFERENCES stories(id) ON DELETE SET NULL,
  image_key      TEXT NOT NULL,               -- source=r2: R2 key photos/{id}/image.webp；source=site: 站内路径 /assets/images/...
  thumbnail_key  TEXT NOT NULL,
  width          INTEGER NOT NULL,
  height         INTEGER NOT NULL,
  alt_text       TEXT,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  is_published   INTEGER NOT NULL DEFAULT 0,
  homepage_order INTEGER,                             -- NULL = 不上首页；非 NULL = 首页「精选作品」，值即展示顺序
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 覆盖前台按「已发布 + 分类 + 顺序」与后台按故事取图的查询，避免全表扫描。
CREATE INDEX IF NOT EXISTS idx_photos_pub   ON photos(is_published, category, sort_order);
CREATE INDEX IF NOT EXISTS idx_photos_story ON photos(story_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_photos_home  ON photos(homepage_order);

-- stories：主题/故事（4 大目标第 3 项）。content 存极简 Markdown 原文，前端渲染。
CREATE TABLE IF NOT EXISTS stories (
  id           TEXT PRIMARY KEY,
  slug         TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  subtitle     TEXT,
  cover_key    TEXT,                           -- 封面 R2: stories/{id}/cover.webp
  category     TEXT NOT NULL,
  description  TEXT,
  content      TEXT,
  location     TEXT,
  shoot_date   TEXT,
  sort_order   INTEGER NOT NULL DEFAULT 0,
  is_published INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_stories_pub ON stories(is_published, sort_order);

-- homepage：首页精选，单行表。story_ids 为按展示顺序排列的 JSON 数组字符串。
CREATE TABLE IF NOT EXISTS homepage (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  story_ids  TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
INSERT OR IGNORE INTO homepage (id, story_ids) VALUES (1, '[]');

-- settings：键值配置（如上传软阈值、站点文案）。
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
