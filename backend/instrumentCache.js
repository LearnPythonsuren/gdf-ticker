// ---------------------------------------------------------------------------
// Instrument cache.
//
// For each exchange we write the raw GetInstruments response to its OWN file,
// dated, under CACHE_DIR (default /data/instruments):
//
//   NSE-2026-09-14.json
//   NFO-2026-09-14.json
//   ... one per exchange, per day
//
// Plus a combined merged file used for subscription:
//
//   _merged-2026-09-14.json   { exchange, count, identifiers:[...] } per exchange
//   _subscribed-2026-09-14.json  the exact flat list we subscribed to
//
// On startup, if today's per-exchange file already exists we can reuse it
// (REUSE_CACHE=true) instead of re-requesting — useful if the app restarts
// mid-day and you don't want to re-pull all instruments.
// ---------------------------------------------------------------------------

import fs from "fs";
import path from "path";
import { CONFIG } from "./config.js";

function today() {
  return new Date().toISOString().slice(0, 10);
}

class InstrumentCache {
  constructor(dir) {
    this.dir = dir;
    fs.mkdirSync(this.dir, { recursive: true });
  }

  _file(exchange, day = today()) {
    return path.join(this.dir, `${exchange}-${day}.json`);
  }

  // Save the raw response for one exchange.
  saveExchange(exchange, rawResponse) {
    try {
      fs.writeFileSync(
        this._file(exchange),
        JSON.stringify(rawResponse, null, 0)
      );
    } catch (e) {
      console.error("[cache] saveExchange failed:", exchange, e.message);
    }
  }

  // Load today's cached raw response for one exchange (or null).
  loadExchange(exchange) {
    const f = this._file(exchange);
    try {
      if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
    } catch (e) {
      console.error("[cache] loadExchange failed:", exchange, e.message);
    }
    return null;
  }

  hasToday(exchange) {
    return fs.existsSync(this._file(exchange));
  }

  // Save the merged view (per-exchange identifier lists).
  saveMerged(byExchange) {
    try {
      const out = Object.entries(byExchange).map(([exchange, identifiers]) => ({
        exchange,
        count: identifiers.length,
        identifiers,
      }));
      fs.writeFileSync(
        path.join(this.dir, `_merged-${today()}.json`),
        JSON.stringify(out, null, 0)
      );
    } catch (e) {
      console.error("[cache] saveMerged failed:", e.message);
    }
  }

  // Save the exact flat list actually subscribed.
  saveSubscribed(list) {
    try {
      fs.writeFileSync(
        path.join(this.dir, `_subscribed-${today()}.json`),
        JSON.stringify(list, null, 0)
      );
    } catch (e) {
      console.error("[cache] saveSubscribed failed:", e.message);
    }
  }

  listFiles() {
    try {
      return fs
        .readdirSync(this.dir)
        .filter((f) => f.endsWith(".json"))
        .map((f) => {
          const st = fs.statSync(path.join(this.dir, f));
          return { name: f, size: st.size, modified: st.mtime.toISOString() };
        })
        .sort((a, b) => (a.name < b.name ? 1 : -1));
    } catch {
      return [];
    }
  }

  filePath(name) {
    const safe = path.basename(name);
    const p = path.join(this.dir, safe);
    return fs.existsSync(p) ? p : null;
  }
}

export const instrumentCache = new InstrumentCache(CONFIG.CACHE_DIR);
