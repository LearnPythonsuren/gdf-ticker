// ---------------------------------------------------------------------------
// Logger.
//
// Writes two kinds of files under LOG_DIR (default /data/logs), rotated daily:
//
//   ticks-YYYY-MM-DD.jsonl   one JSON line per RealtimeResult received
//   events-YYYY-MM-DD.log    human-readable lifecycle log (auth, subscribe,
//                            stale flips, errors)
//
// JSONL (one JSON object per line) is chosen so you can grep, tail, or load it
// into pandas/Excel later without a parser. Console output is unchanged.
// ---------------------------------------------------------------------------

import fs from "fs";
import path from "path";
import { CONFIG } from "./config.js";

function today() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function ts() {
  return new Date().toISOString();
}

class Logger {
  constructor(dir) {
    this.dir = dir;
    this._day = null;
    this._tickStream = null;
    this._eventStream = null;
    this._tickCount = 0;
    fs.mkdirSync(this.dir, { recursive: true });
    this._roll();
  }

  _roll() {
    const d = today();
    if (d === this._day) return;
    this._day = d;
    if (this._tickStream) this._tickStream.end();
    if (this._eventStream) this._eventStream.end();
    this._tickStream = fs.createWriteStream(
      path.join(this.dir, `ticks-${d}.jsonl`),
      { flags: "a" }
    );
    this._eventStream = fs.createWriteStream(
      path.join(this.dir, `events-${d}.log`),
      { flags: "a" }
    );
    this.event("INFO", `log rolled to ${d}`);
  }

  // Lifecycle / diagnostic line.
  event(level, msg) {
    this._roll();
    const line = `${ts()} [${level}] ${msg}\n`;
    if (this._eventStream) this._eventStream.write(line);
  }

  // One realtime tick. Stores the fields you care about, compactly.
  tick(msg) {
    this._roll();
    this._tickCount++;
    const rec = {
      t: ts(),
      e: msg.Exchange,
      s: msg.InstrumentIdentifier,
      ltp: msg.LastTradePrice,
      pc: msg.Close,
      pcp: msg.PriceChangePercentage,
      chg: msg.PriceChange,
      ltt: msg.LastTradeTime,
      srv: msg.ServerTime,
    };
    if (this._tickStream) this._tickStream.write(JSON.stringify(rec) + "\n");
  }

  stats() {
    return { day: this._day, ticksLoggedToday: this._tickCount, dir: this.dir };
  }

  // List available log files (for the download endpoint).
  listFiles() {
    try {
      return fs
        .readdirSync(this.dir)
        .filter((f) => f.endsWith(".jsonl") || f.endsWith(".log"))
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
    // prevent path traversal
    const safe = path.basename(name);
    const p = path.join(this.dir, safe);
    return fs.existsSync(p) ? p : null;
  }
}

export const logger = new Logger(CONFIG.LOG_DIR);
