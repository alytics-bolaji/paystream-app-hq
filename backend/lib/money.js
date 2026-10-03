// lib/money.js -- pure money helpers. No database, no network, so they are
// easy to unit-test in CI (that is exactly what tests/money.test.js does).
//
// Golden rule of a payments system: money is stored and moved in MINOR units
// (kobo, pesewa, cents) as whole integers -- never as a decimal fraction,
// because lost fractions in a payments company are called fraud.

const TAKE_RATE = 0.014; // Paystream takes 1.4% of every transfer

// The fee Paystream charges on a transfer, in minor units.
function feeFor(amountMinor) {
  return Math.round(amountMinor * TAKE_RATE);
}

// Convert a principal amount from one currency to another using an FX rate.
// Same-currency transfers use a rate of 1.
function convert(principalMinor, rate) {
  return Math.round(principalMinor * rate);
}

// Work out everything about a transfer in one place: the fee, the principal
// (what is left after the fee), and what the recipient is credited.
function quote(amountMinor, rate) {
  const fee = feeFor(amountMinor);
  const principal = amountMinor - fee;
  const credited = convert(principal, rate);
  return { sentMinor: amountMinor, feeMinor: fee, principalMinor: principal, creditedMinor: credited };
}

// Format minor units as a human string, e.g. 1250000 -> "12,500.00".
function formatMinor(amountMinor) {
  return (amountMinor / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

module.exports = { TAKE_RATE, feeFor, convert, quote, formatMinor };
