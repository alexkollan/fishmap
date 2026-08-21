import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const dataDir = process.env.DATA_DIR ?? path.resolve(process.cwd(), "data");
mkdirSync(dataDir, { recursive: true });

export const db: Database.Database = new Database(path.join(dataDir, "fishmap.sqlite"));
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS weather_cache (
    grid_lat REAL NOT NULL,
    grid_lon REAL NOT NULL,
    variable_set TEXT NOT NULL,
    payload TEXT NOT NULL,
    fetched_at INTEGER NOT NULL,
    PRIMARY KEY (grid_lat, grid_lon, variable_set)
  );
`);
