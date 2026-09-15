// ---------------------------------------------------------------------------
// Upstream Global Datafeeds WebSocket client.
//
// Lifecycle each trading day:
//   1. connect  -> upstream WS
//   2. Authenticate { MessageType:"Authenticate", Password: <apikey> }
//   3. For each exchange: GetInstruments -> collect symbol identifiers
//   4. Merge all identifiers into one list, cap at MAX_SUBSCRIPTIONS
//   5. SubscribeRealtime for each, in throttled batches, on the SAME socket
//   6. Every RealtimeResult updates in-memory state (LTP/PC/PCP + lastUpdate)
//
// The apikey is passed in from server.js (resolved from the opaque token).
// ---------------------------------------------------------------------------

import { WebSocket } from "ws";
import { EventEmitter } from "events";
import { CONFIG } from "./config.js";
import { logger } from "./logger.js";
import { instrumentCache } from "./instrumentCache.js";

export class GdfClient extends EventEmitter {
  constructor() {
    super();
    this.ws = null;
    this.apikey = null;
    this.authenticated = false;
    this.reconnectDelay = CONFIG.RECONNECT_BASE_MS;

    // symbol state: key = "EXCHANGE:IDENTIFIER"
    // value = { exchange, identifier, ltp, close, priceChange, pctChange,
    //           lastTradeTime, lastUpdate }
    this.state = new Map();

    // instrument identifiers pending subscription
    this._pendingSubs = [];
    this._subscribed = new Set();
    this._instrumentsByExchange = {};
    this._instrumentRequestsOutstanding = 0;
    this.status = "idle"; // idle|connecting|authenticating|loading|subscribing|live|error
  }

  start(apikey) {
    this.apikey = apikey;
    this._connect();
  }

  _setStatus(s) {
    if (this.status !== s) {
      this.status = s;
      this.emit("status", s);
    }
  }

  _connect() {
    this._setStatus("connecting");
    console.log("[gdf] connecting to", CONFIG.GDF_WS_URL);
    this.ws = new WebSocket(CONFIG.GDF_WS_URL);

    this.ws.on("open", () => {
      console.log("[gdf] socket open, authenticating");
      this.reconnectDelay = CONFIG.RECONNECT_BASE_MS;
      this._authenticate();
    });

    this.ws.on("message", (buf) => this._onMessage(buf));

    this.ws.on("close", () => {
      console.warn("[gdf] socket closed");
      logger.event("WARN", "upstream socket closed");
      this.authenticated = false;
      this._setStatus("error");
      this._scheduleReconnect();
    });

    this.ws.on("error", (err) => {
      console.error("[gdf] socket error:", err.message);
      logger.event("ERROR", `upstream socket error: ${err.message}`);
    });
  }

  _scheduleReconnect() {
    const delay = this.reconnectDelay;
    this.reconnectDelay = Math.min(
      this.reconnectDelay * 2,
      CONFIG.RECONNECT_MAX_MS
    );
    console.log(`[gdf] reconnecting in ${delay}ms`);
    setTimeout(() => this._connect(), delay);
  }

  _send(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(obj));
    }
  }

  _authenticate() {
    this._setStatus("authenticating");
    // Per docs: { MessageType:"Authenticate", Password: accessKey }
    this._send({ MessageType: "Authenticate", Password: this.apikey });
  }

  _onMessage(buf) {
    const text = buf.toString();
    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      // Per GDF docs, the API sometimes sends PLAIN-TEXT diagnostic messages
      // instead of JSON — e.g. "Access Denied. Key already in use by other
      // session.", key expired/invalid, exchange or function not allowed.
      // These previously looked like silence. Surface them loudly.
      const diag = text.trim();
      if (diag) {
        console.warn("[gdf][DIAGNOSTIC]", diag);
        logger.event("WARN", `diagnostic: ${diag}`);
        this.lastDiagnostic = diag;
        // If a diagnostic arrives while we're waiting on instruments, stop
        // waiting — the exchange/function was likely refused.
        if (this.status === "loading") {
          this._mergeAndSubscribe();
        }
      }
      return;
    }

    if (CONFIG.DEBUG_WS) {
      // Log the type of every message, and the full body of anything that isn't
      // a per-second realtime tick or the constant Echo heartbeat.
      if (msg.MessageType !== "RealtimeResult" && msg.MessageType !== "Echo") {
        console.log("[gdf][msg]", JSON.stringify(msg).slice(0, 600));
      }
    }

    switch (msg.MessageType) {
      case "AuthenticateResult":
        if (msg.Complete) {
          console.log("[gdf] authenticated:", msg.Message);
          logger.event("INFO", `authenticated: ${msg.Message}`);
          this.authenticated = true;
          // Ask what this key is allowed to do (exchanges, functions, symbol
          // limit). The reply is logged so you can see if NFO is permitted.
          this._send({ MessageType: "GetLimitation" });
          this._loadAllInstruments();
        } else {
          console.error("[gdf] auth failed:", msg.Message);
          logger.event("ERROR", `auth failed: ${msg.Message}`);
          this._setStatus("error");
          this.emit("authfail", msg.Message);
        }
        break;

      case "InstrumentsResult":
      case "GetInstrumentsResult":
        this._onInstruments(msg);
        break;

      case "RealtimeResult":
        this._onRealtime(msg);
        break;

      case "LimitationResult":
      case "GetLimitationResult":
        console.log("[gdf] limitation:", JSON.stringify(msg));
        logger.event("INFO", `limitation: ${JSON.stringify(msg)}`);
        break;

      case "Echo":
        // Server keep-alive heartbeat. Reply so the connection stays healthy.
        // Not logged (it arrives constantly).
        this._send({ MessageType: "Echo" });
        break;

      case "AllowVMRunningResult":
      case "AllowServerOSRunningResult":
        // Informational capability flags sent right after auth; ignore quietly.
        break;

      default:
        // Fallback: any message carrying an instrument array.
        if (Array.isArray(msg.Result) &&
            (msg.Exchange || (msg.Request && msg.Request.Exchange))) {
          this._onInstruments(msg);
        } else if (msg.MessageType) {
          // Log unrecognized message types once so we can adapt (e.g. an error
          // reply to GetInstruments, or a differently-named result).
          console.warn("[gdf] unhandled MessageType:", msg.MessageType,
            CONFIG.DEBUG_WS ? "" : JSON.stringify(msg).slice(0, 300));
        }
        break;
    }
  }

  _loadAllInstruments() {
    this._setStatus("loading");
    this._instrumentsByExchange = {};
    this._merged = false;

    // If REUSE_CACHE and today's files exist, load from disk instead of asking
    // the upstream again.
    const toRequest = [];
    for (const ex of CONFIG.EXCHANGES) {
      if (CONFIG.REUSE_CACHE && instrumentCache.hasToday(ex)) {
        const raw = instrumentCache.loadExchange(ex);
        if (raw) {
          console.log(`[gdf] ${ex}: loaded from cache`);
          logger.event("INFO", `instruments ${ex}: loaded from cache`);
          this._ingestInstruments(ex, raw, /*fromCache*/ true);
          continue;
        }
      }
      toRequest.push(ex);
    }

    this._instrumentRequestsOutstanding = toRequest.length;
    this._instrumentsRequested = new Set(toRequest);
    this._instrumentsReceived = new Set();
    if (toRequest.length === 0) {
      this._mergeAndSubscribe();
      return;
    }
    for (const ex of toRequest) {
      console.log("[gdf] GetInstruments", ex);
      // OnlyActive defaults to true upstream -> only live (non-expired) symbols.
      this._send({ MessageType: "GetInstruments", Exchange: ex });
    }

    // Stall timer: instead of a single hard deadline (a big exchange like NFO
    // can return 79k+ rows and take a while), we reset this every time an
    // instrument reply arrives. It only fires if NOTHING new has come in for
    // INSTRUMENT_STALL_MS — i.e. the load has genuinely stalled.
    this._armStallTimer();
  }

  _armStallTimer() {
    clearTimeout(this._loadTimer);
    this._loadTimer = setTimeout(() => {
      if (this.status === "loading") {
        const missing = [...this._instrumentsRequested].filter(
          (e) => !this._instrumentsReceived.has(e)
        );
        console.warn("[gdf] instrument load stalled; missing:", missing.join(", ") || "(none)");
        logger.event("WARN", `instrument load stalled; missing: ${missing.join(", ") || "(none)"}`);
        this._mergeAndSubscribe();
      }
    }, CONFIG.INSTRUMENT_STALL_MS);
  }

  // Extract + filter identifiers from a raw GetInstruments response and store.
  _ingestInstruments(ex, raw, fromCache) {
    const list = Array.isArray(raw.Result) ? raw.Result : [];

    // ---- SYMBOL SELECTION ----
    // We take the `Identifier` of every row (that's the string SubscribeRealtime
    // wants as InstrumentIdentifier, e.g. "FUTIDX_NIFTY_28NOV2024_XX_0").
    // Optional filters trim by instrument type (row.Name) and Product.
    let rows = list;
    if (CONFIG.INCLUDE_INSTRUMENT_TYPES.length) {
      const set = new Set(CONFIG.INCLUDE_INSTRUMENT_TYPES);
      rows = rows.filter((r) => set.has(r.Name));
    }
    if (CONFIG.INCLUDE_PRODUCTS.length) {
      const set = new Set(CONFIG.INCLUDE_PRODUCTS);
      rows = rows.filter((r) => set.has(r.Product));
    }
    const identifiers = rows
      .map((r) => r.Identifier || r.InstrumentIdentifier || r.Name)
      .filter(Boolean);

    this._instrumentsByExchange[ex] = identifiers;
    console.log(
      `[gdf] ${ex}: ${list.length} returned, ${identifiers.length} selected` +
        (fromCache ? " (cache)" : "")
    );
    logger.event(
      "INFO",
      `instruments ${ex}: ${list.length} returned, ${identifiers.length} selected`
    );

    // Cache the RAW response to its own per-exchange file (unless it came from
    // cache already).
    if (!fromCache) instrumentCache.saveExchange(ex, raw);
  }

  _onInstruments(msg) {
    const ex = msg.Exchange || (msg.Request && msg.Request.Exchange) || "UNKNOWN";
    this._ingestInstruments(ex, msg, /*fromCache*/ false);

    // Only count the first reply per requested exchange.
    let firstForEx = false;
    if (this._instrumentsReceived && !this._instrumentsReceived.has(ex) &&
        this._instrumentsRequested && this._instrumentsRequested.has(ex)) {
      this._instrumentsReceived.add(ex);
      firstForEx = true;
      if (this._instrumentRequestsOutstanding > 0) {
        this._instrumentRequestsOutstanding--;
      }
    }

    if (this.status === "loading") {
      // Data is still flowing — reset the stall timer so a big/slow exchange
      // doesn't get abandoned mid-load.
      this._armStallTimer();
      if (this._instrumentRequestsOutstanding === 0) {
        clearTimeout(this._loadTimer);
        this._mergeAndSubscribe();
      }
    } else if (firstForEx) {
      // Late arrival AFTER we already went live (e.g. NFO came back after the
      // stall). Subscribe to this exchange's instruments incrementally instead
      // of dropping them.
      const ids = this._instrumentsByExchange[ex] || [];
      const add = ids.slice(0, Math.max(0, CONFIG.MAX_SUBSCRIPTIONS - this._subscribed.size));
      console.log(`[gdf] late ${ex}: queueing ${add.length} for subscription`);
      logger.event("INFO", `late ${ex}: queueing ${add.length} subscriptions`);
      for (const id of add) this._pendingSubs.push({ exchange: ex, identifier: id });
      instrumentCache.saveMerged(this._instrumentsByExchange);
      if (!this._pumping) this._pumpSubscriptions();
    }
  }

  _mergeAndSubscribe() {
    if (this._merged) return; // run once per load cycle
    this._merged = true;
    clearTimeout(this._loadTimer);
    // Merge all exchanges into one flat subscription list (single JSON view).
    const merged = [];
    for (const ex of CONFIG.EXCHANGES) {
      const ids = this._instrumentsByExchange[ex] || [];
      for (const id of ids) merged.push({ exchange: ex, identifier: id });
    }

    const capped = merged.slice(0, CONFIG.MAX_SUBSCRIPTIONS);
    console.log(
      `[gdf] merged ${merged.length} instruments, subscribing to ${capped.length}`
    );
    logger.event(
      "INFO",
      `merged ${merged.length} instruments, subscribing to ${capped.length}`
    );

    // Cache the merged per-exchange view and the exact flat subscription list.
    instrumentCache.saveMerged(this._instrumentsByExchange);
    instrumentCache.saveSubscribed(capped);
    this.emit("instrumentsLoaded", {
      total: merged.length,
      subscribing: capped.length,
      byExchange: Object.fromEntries(
        CONFIG.EXCHANGES.map((ex) => [
          ex,
          (this._instrumentsByExchange[ex] || []).length,
        ])
      ),
    });

    this._pendingSubs = capped;
    this._setStatus("subscribing");
    this._pumpSubscriptions();
  }

  // Throttled batch subscribe on the SAME socket, in parallel across exchanges.
  _pumpSubscriptions() {
    this._pumping = true;
    if (this._pendingSubs.length === 0) {
      this._pumping = false;
      if (this.status !== "live") {
        this._setStatus("live");
        console.log("[gdf] all subscriptions sent, live");
        logger.event("INFO", `live: ${this._subscribed.size} subscriptions active`);
      }
      return;
    }
    const batch = this._pendingSubs.splice(0, CONFIG.SUB_BATCH_SIZE);
    for (const { exchange, identifier } of batch) {
      const key = exchange + ":" + identifier;
      if (this._subscribed.has(key)) continue;
      this._subscribed.add(key);
      this._send({
        MessageType: "SubscribeRealtime",
        Exchange: exchange,
        InstrumentIdentifier: identifier,
      });
      // seed a placeholder row so the TV shows it as stale (red) until first tick
      if (!this.state.has(key)) {
        this.state.set(key, {
          exchange,
          identifier,
          ltp: null,
          close: null,
          priceChange: null,
          pctChange: null,
          lastTradeTime: null,
          lastUpdate: 0,
        });
      }
    }
    setTimeout(() => this._pumpSubscriptions(), CONFIG.SUB_BATCH_GAP_MS);
  }

  _onRealtime(msg) {
    if (CONFIG.LOG_TICKS) logger.tick(msg);
    const key = msg.Exchange + ":" + msg.InstrumentIdentifier;
    const row = this.state.get(key) || {
      exchange: msg.Exchange,
      identifier: msg.InstrumentIdentifier,
    };
    row.ltp = msg.LastTradePrice;          // LTP
    row.close = msg.Close;                  // PC  = previous Close
    row.priceChange = msg.PriceChange;      // absolute change
    row.pctChange = msg.PriceChangePercentage; // PCP = % change
    row.lastTradeTime = msg.LastTradeTime;
    row.lastUpdate = Date.now();
    this.state.set(key, row);
  }

  // Snapshot for a client that just connected (full board).
  snapshot() {
    const now = Date.now();
    const rows = [];
    for (const [key, r] of this.state) {
      rows.push(this._rowForWire(key, r, now));
    }
    return rows;
  }

  // Only rows updated since `since` (delta broadcast).
  delta(since) {
    const now = Date.now();
    const rows = [];
    for (const [key, r] of this.state) {
      if (r.lastUpdate > since) rows.push(this._rowForWire(key, r, now));
    }
    return rows;
  }

  _rowForWire(key, r, now) {
    const stale = now - r.lastUpdate > CONFIG.STALE_MS;
    return {
      k: key,
      e: r.exchange,
      s: r.identifier,
      ltp: r.ltp,
      pc: r.close,
      pcp: r.pctChange,
      chg: r.priceChange,
      t: r.lastTradeTime,
      stale, // true -> TV renders red
    };
  }

  stats() {
    const now = Date.now();
    let fresh = 0;
    let stale = 0;
    for (const [, r] of this.state) {
      if (now - r.lastUpdate > CONFIG.STALE_MS) stale++;
      else fresh++;
    }
    return {
      status: this.status,
      total: this.state.size,
      subscribed: this._subscribed.size,
      fresh,
      stale,
      diagnostic: this.lastDiagnostic || null,
    };
  }
}