// node --test src/lib/melee.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { isWorthRetrying, HttpError } from "./melee.ts";

test("transient failures retry, permanent ones do not", () => {
  // Network-level: the exact failure that broke the first backfill attempt.
  assert.equal(isWorthRetrying(Object.assign(new Error("fetch failed"), { code: "UND_ERR_CONNECT_TIMEOUT" })), true);
  assert.equal(isWorthRetrying(new HttpError(503, "/tournament/list", "Service Unavailable")), true);
  assert.equal(isWorthRetrying(new HttpError(429, "/tournament/list", "Too Many Requests")), true);

  // Retrying these cannot help, and melee revokes credentials over volume.
  assert.equal(isWorthRetrying(new HttpError(401, "/tournament/list", "Unauthorized")), false);
  assert.equal(isWorthRetrying(new HttpError(403, "/tournament/list", "Forbidden")), false);
  assert.equal(isWorthRetrying(new HttpError(404, "/standing/list/current/1", "Not Found")), false);
});
