import test from "node:test";
import assert from "node:assert/strict";
import { parseAdminIds } from "./admins.ts";

test("parses comma-separated ids, trimming blanks", () => {
  assert.deepEqual([...parseAdminIds("123, 456 ,,789")], ["123", "456", "789"]);
});

test("empty string means no admins", () => {
  assert.equal(parseAdminIds("").size, 0);
});
