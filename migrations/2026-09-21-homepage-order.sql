-- 一次性迁移：给已上线的 photos 表加「首页精选作品」列。
-- SQLite 没有 ADD COLUMN IF NOT EXISTS，重复执行会报 duplicate column name，只跑一次。
-- 全新库不用跑这个，schema.sql 里已含该列。
ALTER TABLE photos ADD COLUMN homepage_order INTEGER;
CREATE INDEX IF NOT EXISTS idx_photos_home ON photos(homepage_order);
