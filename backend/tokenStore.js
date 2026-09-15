// ---------------------------------------------------------------------------
// Token store.
//
// Security model (what the user actually asked for):
//   - Admin registers an entry: { apikey, username }.
//   - We compute sha256(apikey + ":" + username) as a STABLE fingerprint
//     (used only to detect duplicates / identify an entry — never sent anywhere).
//   - We generate a random opaque SESSION TOKEN and hand THAT to the client.
//   - The real apikey lives only here, on the backend, on disk (0600).
//   - The Auth tab submits the opaque token; the backend maps token -> apikey
//     and performs the Global Datafeeds Authenticate. The frontend never sees
//     the apikey.
//
// NOTE: sha256 is one-way; you cannot "decrypt" it back to apikey+username.
// The opaque-token indirection is the correct way to keep the apikey hidden.
// ---------------------------------------------------------------------------

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { CONFIG } from "./config.js";

function sha256(s) {
  return crypto.createHash("sha256").update(s, "utf8").digest("hex");
}

class TokenStore {
  constructor(file) {
    this.file = file;
    this.entries = {}; // token -> { apikey, username, fingerprint, createdAt }
    this._load();
  }

  _load() {
    try {
      if (fs.existsSync(this.file)) {
        this.entries = JSON.parse(fs.readFileSync(this.file, "utf8"));
      }
    } catch (e) {
      console.error("[tokenStore] load failed:", e.message);
      this.entries = {};
    }
  }

  _persist() {
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.entries, null, 2), {
        mode: 0o600,
      });
    } catch (e) {
      console.error("[tokenStore] persist failed:", e.message);
    }
  }

  // Create (or return existing) session token for an apikey+username pair.
  create(apikey, username) {
    if (!apikey || !username) {
      throw new Error("apikey and username are required");
    }
    const fingerprint = sha256(apikey + ":" + username);

    // Reuse token if this exact pair already registered.
    for (const [token, e] of Object.entries(this.entries)) {
      if (e.fingerprint === fingerprint) return { token, reused: true };
    }

    const token = crypto.randomBytes(24).toString("hex"); // opaque handle
    this.entries[token] = {
      apikey,
      username,
      fingerprint,
      createdAt: new Date().toISOString(),
    };
    this._persist();
    return { token, reused: false };
  }

  // Resolve an opaque token to the real apikey (backend-only).
  resolveApiKey(token) {
    const e = this.entries[token];
    return e ? e.apikey : null;
  }

  resolveUsername(token) {
    const e = this.entries[token];
    return e ? e.username : null;
  }

  // Safe listing for the admin UI — never exposes the apikey.
  listSafe() {
    return Object.entries(this.entries).map(([token, e]) => ({
      token,
      username: e.username,
      fingerprint: e.fingerprint.slice(0, 12) + "…",
      createdAt: e.createdAt,
    }));
  }

  revoke(token) {
    if (this.entries[token]) {
      delete this.entries[token];
      this._persist();
      return true;
    }
    return false;
  }
}

export const tokenStore = new TokenStore(CONFIG.TOKENS_FILE);
export { sha256 };
