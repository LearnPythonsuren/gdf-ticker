// ---------------------------------------------------------------------------
// Configuration. Everything overridable via environment variables (Docker).
// ---------------------------------------------------------------------------

export const CONFIG = {
  // HTTP + client WebSocket port (what the TV screen + admin UI connect to)
  PORT: parseInt(process.env.PORT || "8080", 10),

  // Upstream Global Datafeeds WebSocket endpoint.
  // Replace host/port with the one issued to your account.
  // Example format from their docs: wss://<host>:<port>/
  GDF_WS_URL: process.env.GDF_WS_URL || "wss://your-gdf-endpoint:port/",

  // Exchanges to load instruments + subscribe, in order.
  EXCHANGES: (process.env.EXCHANGES ||
    "NSE,NSE_IDX,BSE,BSE_IDX,NFO,BFO,MCX,NCDEX,CDS")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean),

  // Hard cap on total realtime subscriptions (your plan allows 15000).
  MAX_SUBSCRIPTIONS: parseInt(process.env.MAX_SUBSCRIPTIONS || "15000", 10),

  // Milliseconds after which a symbol with no update is "stale" (shown red).
  STALE_MS: parseInt(process.env.STALE_MS || "3000", 10),

  // How often we push the delta of changed rows to TV clients (ms).
  BROADCAST_INTERVAL_MS: parseInt(process.env.BROADCAST_INTERVAL_MS || "500", 10),

  // Throttle: how many SubscribeRealtime messages to send per tick, and the
  // gap between batches, so we don't flood the upstream socket on startup.
  SUB_BATCH_SIZE: parseInt(process.env.SUB_BATCH_SIZE || "200", 10),
  SUB_BATCH_GAP_MS: parseInt(process.env.SUB_BATCH_GAP_MS || "50", 10),

  // If some exchange never returns instruments, proceed with what we have after
  // this many ms instead of hanging on "loading" forever.
  INSTRUMENT_LOAD_TIMEOUT_MS: parseInt(
    process.env.INSTRUMENT_LOAD_TIMEOUT_MS || "20000", 10
  ),

  // Log every non-tick upstream message (and unhandled types). Turn off once
  // things are working to reduce log noise.
  DEBUG_WS: (process.env.DEBUG_WS || "true").toLowerCase() !== "false",

  // File where the admin-created session tokens are persisted.
  TOKENS_FILE: process.env.TOKENS_FILE || "/data/tokens.json",

  // Directory for your own tick + event logs.
  LOG_DIR: process.env.LOG_DIR || "/data/logs",

  // Directory where each exchange's GetInstruments JSON is cached (own file).
  CACHE_DIR: process.env.CACHE_DIR || "/data/instruments",

  // If today's per-exchange cache file exists, reuse it instead of re-requesting
  // from the upstream (handy on mid-day restarts).
  REUSE_CACHE: (process.env.REUSE_CACHE || "false").toLowerCase() === "true",

  // ---- Which symbols we take from GetInstruments ----
  // GetInstruments returns ALL instruments for an exchange (OnlyActive=true by
  // default -> non-expired). We take the `Identifier` field of every row, in
  // the order returned, per exchange, then merge across exchanges.
  //
  // Optional filters (comma lists; empty = no filter):
  //   INCLUDE_INSTRUMENT_TYPES  keep only rows whose Name (instrument type) is
  //                             in this list, e.g. "FUTIDX,FUTSTK,OPTIDX"
  //   INCLUDE_PRODUCTS          keep only rows whose Product is in this list,
  //                             e.g. "NIFTY,BANKNIFTY,RELIANCE"
  // These apply per-exchange to trim the 15000 budget toward what you care
  // about. Leave empty to take everything.
  INCLUDE_INSTRUMENT_TYPES: (process.env.INCLUDE_INSTRUMENT_TYPES || "")
    .split(",").map((s) => s.trim()).filter(Boolean),
  INCLUDE_PRODUCTS: (process.env.INCLUDE_PRODUCTS || "")
    .split(",").map((s) => s.trim()).filter(Boolean),

  // Set "false" to stop writing per-tick JSONL (event log still written).
  // At 15000 symbols * 1 tick/sec this file grows fast; keep it on only if you
  // want the full record.
  LOG_TICKS: (process.env.LOG_TICKS || "true").toLowerCase() !== "false",

  // Admin password to protect the key-creation endpoint. CHANGE THIS.
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || "change-me-admin",

  // Reconnect backoff to upstream (ms).
  RECONNECT_BASE_MS: 2000,
  RECONNECT_MAX_MS: 30000,
};
