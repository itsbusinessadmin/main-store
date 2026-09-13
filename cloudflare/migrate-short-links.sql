-- One-time migration for a database created before short links existed.
--
--   npx wrangler d1 execute main-store --remote --file=./migrate-short-links.sql
--
-- Skip it entirely on a database created from schema.sql, which already has
-- both columns. Running it there stops at the first ALTER with "duplicate
-- column name", which is harmless but means nothing below it runs either --
-- that is the whole reason these statements are not in schema.sql.
--
-- Safe to stop at that error: it only ever adds columns and numbers rows that
-- have no number yet. Nothing here drops or overwrites anything.

ALTER TABLE stores ADD COLUMN store_no INTEGER;
ALTER TABLE stores ADD COLUMN slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_no ON stores(store_no);
CREATE UNIQUE INDEX IF NOT EXISTS idx_stores_slug_u ON stores(slug);
CREATE INDEX IF NOT EXISTS idx_stores_slug ON stores(slug);

-- Number every existing store, oldest first, so each one has a link
-- immediately: the oldest store becomes /1, the next /2, and so on.
UPDATE stores SET store_no = (
  SELECT COUNT(*) FROM stores AS earlier
  WHERE earlier.created_at <= stores.created_at
) WHERE store_no IS NULL;
