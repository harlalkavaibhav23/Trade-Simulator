// Mirrors backend/src/money.js display logic. All amounts arrive from the
// API as strings (BigInt-safe over JSON) and are only ever formatted here
// for display - never used in arithmetic as JS floats.

export function centsToUsd(cents) {
  const n = BigInt(cents);
  const neg = n < 0n;
  const abs = neg ? -n : n;
  const whole = abs / 100n;
  const rem = abs % 100n;
  return `${neg ? "-" : ""}$${whole.toLocaleString()}.${rem.toString().padStart(2, "0")}`;
}

export function microsToQuantity(micros, decimals = 6) {
  const n = BigInt(micros);
  const neg = n < 0n;
  const abs = neg ? -n : n;
  const whole = abs / 1_000_000n;
  const rem = abs % 1_000_000n;
  let remStr = rem.toString().padStart(6, "0").slice(0, decimals).replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole.toString()}${remStr ? "." + remStr : ""}`;
}
