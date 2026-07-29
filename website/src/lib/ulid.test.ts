import test from "node:test";
import assert from "node:assert/strict";
import { ulid } from "./ulid.ts";

test("26 chars of Crockford base32", () => {
  assert.match(ulid(), /^[0-9A-HJKMNP-TV-Z]{26}$/);
});

test("later timestamps sort later", () => {
  assert.ok(ulid(1_000_000) < ulid(2_000_000));
});

test("no collisions across a burst", () => {
  const burst = new Set(Array.from({ length: 1000 }, () => ulid()));
  assert.equal(burst.size, 1000);
});
