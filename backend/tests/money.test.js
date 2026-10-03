// tests/money.test.js -- unit tests for the pure money logic.
// Runs in CI with `npm test` (node --test). No database needed.
const test = require("node:test");
const assert = require("node:assert");
const { feeFor, convert, quote } = require("../lib/money");

test("fee is 1.4% of the amount, rounded to minor units", () => {
  assert.strictEqual(feeFor(5000000), 9999);   // 50,000.00 -> 700.00 fee
  assert.strictEqual(feeFor(100), 1);            // rounds
});

test("convert applies the FX rate and rounds", () => {
  assert.strictEqual(convert(1000000, 0.085), 85000);
  assert.strictEqual(convert(1000000, 1), 1000000); // same-currency
});

test("quote ties fee, principal and credited together", () => {
  const q = quote(5000000, 0.085);
  assert.strictEqual(q.feeMinor, 70000);
  assert.strictEqual(q.principalMinor, 4930000);
  assert.strictEqual(q.creditedMinor, Math.round(4930000 * 0.085));
});

test("a transfer never credits more than the principal in same currency", () => {
  const q = quote(1000000, 1);
  assert.ok(q.creditedMinor < q.sentMinor); // because of the fee
  assert.strictEqual(q.creditedMinor, 1000000 - q.feeMinor);
});
