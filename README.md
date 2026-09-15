# GDF Realtime TV Ticker

Auto-scrolling office-TV board for Global Datafeeds realtime data. Backend
authenticates, loads every instrument across 9 exchanges each day, subscribes to
up to 15,000 symbols on one WebSocket, and fans live LTP / PC / PCP out to the
TV screen — **green** on a fresh tick, **red** when a symbol hasn't updated for
3 seconds.

## Why there is a backend

Three of your requirements make a browser-only build impossible:

1. **API-key secrecy.** SHA-256 is one-way — it cannot be reversed back into
   apikey+username. So instead of shipping the key to the browser, the backend
   stores the real API key and hands the operator an **opaque session token**.
   The Auth tab submits that token; the backend maps it to the key and does the
   Global Datafeeds `Authenticate`. The frontend never sees the key.
2. **15,000 subscriptions** managed on one upstream socket, re-subscribed daily.
3. **Daily `GetInstruments`** across BSE, BSE_IDX, NSE, NSE_IDX, BFO, NFO, MCX,
   NCDEX, CDS, merged into one list, then parallel `SubscribeRealtime` on the
   same connection.

## Run

```bash
# 1. set your real endpoint + admin password in docker-compose.yml
#    GDF_WS_URL: "wss://<your-gdf-host>:<port>/"
#    ADMIN_PASSWORD: "<something-strong>"

docker compose up --build
```

Open `http://<server-ip>:8080` on the office TV.

## Daily operation

1. **Key Creation tab** (admin) — enter admin password, API key, username →
   **Generate Token**. Copy the opaque token. Do this once; the token persists.
2. **Authentication tab** — paste the token → **Start Feed**. The backend
   authenticates, loads instruments, and begins subscribing. Watch the status
   pill go `authenticating → loading → subscribing → live`.
3. **TV Roller tab** — leave it on the screen. Rows auto-scroll and loop. Use
   the speed slider and the filter box as needed.

To automate the morning start, hit the auth endpoint from cron:

```bash
curl -X POST http://localhost:8080/api/auth \
  -H 'content-type: application/json' \
  -d '{"token":"<your-session-token>"}'
```

## Columns

- **LTP** — `LastTradePrice`
- **PC**  — `Close` (previous day's close)
- **PCP** — `PriceChangePercentage`

Green row = updated within `STALE_MS` (default 3s). Red = stale.

## GetInstruments — request, response, cache, and symbol selection

**Request** sent per exchange (on the same authenticated socket):

```json
{ "MessageType": "GetInstruments", "Exchange": "NFO" }
```

`OnlyActive` defaults to `true` upstream, so only live (non-expired) instruments
come back. (Optional server-side filters exist — `InstrumentType`, `Product`,
`Series`, etc. — but we request all and filter locally so multiple types work in
one pass.)

**Response** (`MessageType: "InstrumentsResult"`), array under `Result`:

```json
{
  "Request": { "Exchange": "NFO", "OnlyActive": true, "MessageType": "GetInstruments" },
  "Result": [
    { "Identifier": "FUTIDX_NIFTY_28NOV2024_XX_0", "Name": "FUTIDX",
      "Product": "NIFTY", "Expiry": "28Nov2024", "TradeSymbol": "NIFTY28NOV24FUT",
      "QuotationLot": 25.0, "TokenNumber": "35089", ... }
  ],
  "MessageType": "InstrumentsResult"
}
```

**Which symbol we take:** the **`Identifier`** field of every returned row — that
is exactly the string `SubscribeRealtime` wants as `InstrumentIdentifier`
(e.g. `FUTIDX_NIFTY_28NOV2024_XX_0`). We keep the order returned, per exchange,
then merge across exchanges and cap at `MAX_SUBSCRIPTIONS`.

**Optional trimming** (to spend the 15,000 budget on what you care about):

- `INCLUDE_INSTRUMENT_TYPES` — keep only rows whose `Name` matches, e.g.
  `"FUTIDX,FUTSTK,OPTIDX,OPTSTK"`.
- `INCLUDE_PRODUCTS` — keep only rows whose `Product` matches, e.g.
  `"NIFTY,BANKNIFTY,RELIANCE"`.

Leave both empty to take every instrument each exchange returns.

**Cache — one JSON file per exchange per day** under `/data/instruments`:

- `NFO-YYYY-MM-DD.json`, `NSE-YYYY-MM-DD.json`, … — the raw response per exchange.
- `_merged-YYYY-MM-DD.json` — `{exchange, count, identifiers[]}` per exchange.
- `_subscribed-YYYY-MM-DD.json` — the exact flat list actually subscribed.

Set `REUSE_CACHE=true` to reload today's cached files on a mid-day restart
instead of re-requesting everything. View/download all of these from the
**Instruments tab**, or:

```bash
curl http://localhost:8080/api/admin/instruments -H "x-admin-password: <pw>"
curl -O http://localhost:8080/api/admin/instruments/NFO-2026-09-14.json -H "x-admin-password: <pw>"
```

## Your logs

The backend writes your own record under the `/data/logs` volume, rotated daily:

- **`ticks-YYYY-MM-DD.jsonl`** — one JSON line per tick received:
  `{t, e, s, ltp, pc, pcp, chg, ltt, srv}` (time, exchange, symbol, LTP,
  previous close, % change, abs change, last-trade-time, server-time).
  Grep, `tail -f`, or load into Excel/pandas directly.
- **`events-YYYY-MM-DD.log`** — auth, per-exchange instrument counts, subscribe
  totals, disconnects, errors.

View and download them from the **Logs tab** (admin password required), or via API:

```bash
# list
curl http://localhost:8080/api/admin/logs -H "x-admin-password: <pw>"
# download one
curl -O http://localhost:8080/api/admin/logs/ticks-2026-09-14.jsonl -H "x-admin-password: <pw>"
```

On Windows you can also open them straight from the Docker volume, or copy out with:

```
docker compose cp gdf-ticker:/data/logs ./logs
```

At 15,000 symbols the tick file grows ~1–2 GB/day. Set `LOG_TICKS=false` in
`docker-compose.yml` to keep only the event log.

## Config (env vars)

| Var | Default | Meaning |
|-----|---------|---------|
| `GDF_WS_URL` | — | **Required.** Your upstream WebSocket endpoint |
| `ADMIN_PASSWORD` | `change-me-admin` | Protects Key Creation. **Change it.** |
| `EXCHANGES` | 9 exchanges | Comma list, load + subscribe order |
| `MAX_SUBSCRIPTIONS` | `15000` | Hard cap |
| `STALE_MS` | `3000` | Red threshold |
| `SUB_BATCH_SIZE` / `SUB_BATCH_GAP_MS` | `200` / `50` | Startup subscribe throttle |

## One thing to confirm against your account

`GetInstruments` and `SubscribeRealtime` shapes are confirmed against the docs
and wired in. The only open item:

**Auth payload.** Per docs it's `{ MessageType:"Authenticate", Password: <key> }`.
If your account expects the SHA-256 hash itself as the password rather than the
raw key, hash it in `server.js` before `gdf.start()`. Tell me your exact scheme
and I'll lock it in.

## Files

```
backend/
  server.js       HTTP API + client WS fan-out
  gdfClient.js    upstream auth / instrument load / subscribe / tick state
  tokenStore.js   opaque-token <-> apikey mapping (apikey stays here)
  config.js
frontend/
  index.html      3 tabs: Key Creation, Auth, TV Roller
Dockerfile
docker-compose.yml
```
