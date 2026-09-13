/**
 * money.js
 * -----------------------------------------------------------------------
 * Every quantity that matters for correctness is stored and manipulated
 * as a BigInt integer, never as a JS `number` (float64). Floats are only
 * ever used at the very edge, when we format a number for display.
 *
 * Units:
 *   - USD balances are stored in CENTS            (1 USD  = 100n)
 *   - Crypto quantities are stored in MICRO-UNITS  (1 coin = 1_000_000n)
 *   - Prices are stored in MICRO-USD               (1 USD  = 1_000_000n)
 *
 * Using micro-units (1e6) for both price and quantity gives us 6 decimal
 * places of precision for token amounts (enough for BTC/ETH/SOL retail
 * trade sizes) while keeping every intermediate calculation as an
 * integer, so there is never any binary floating-point rounding drift.
 * -----------------------------------------------------------------------
 */

const CENTS_PER_USD = 100n;
const MICROS_PER_UNIT = 1_000_000n; // for both quantity and price

/** Convert a human-entered USD amount (e.g. 250.50) to integer cents. */
function usdToCents(usd) {
  // Parse via string to avoid float representation issues on the input itself.
  const [whole, frac = ""] = String(usd).split(".");
  const fracPadded = (frac + "00").slice(0, 2);
  const sign = whole.startsWith("-") ? -1n : 1n;
  const wholeAbs = BigInt(whole.replace("-", "") || "0");
  return sign * (wholeAbs * CENTS_PER_USD + BigInt(fracPadded));
}

/** Convert a live float price (from exchange feed) to integer micro-USD. */
function priceToMicros(price) {
  // Exchange feeds give us floats; round to the nearest micro-unit ONCE,
  // right at the system boundary, and treat it as exact from then on.
  return BigInt(Math.round(price * 1_000_000));
}

/** cents -> display string, e.g. 1000050n -> "10000.50" */
function centsToDisplay(cents) {
  const neg = cents < 0n;
  const abs = neg ? -cents : cents;
  const whole = abs / CENTS_PER_USD;
  const rem = abs % CENTS_PER_USD;
  return `${neg ? "-" : ""}${whole.toString()}.${rem.toString().padStart(2, "0")}`;
}

/** micro-units -> display string with up to 6 decimals, trailing zeros trimmed */
function microsToDisplay(micros, decimals = 6) {
  const neg = micros < 0n;
  const abs = neg ? -micros : micros;
  const whole = abs / MICROS_PER_UNIT;
  const rem = abs % MICROS_PER_UNIT;
  let remStr = rem.toString().padStart(6, "0").slice(0, decimals);
  remStr = remStr.replace(/0+$/, "");
  return `${neg ? "-" : ""}${whole.toString()}${remStr ? "." + remStr : ""}`;
}

/**
 * Given a USD amount (integer cents) and a price (integer micro-USD),
 * compute the quantity purchasable, in integer micro-units, rounding
 * DOWN (floor) so a user can never spend more than they authorized.
 *
 *   quantity_micros = usd_cents * MICROS_PER_UNIT * MICROS_PER_UNIT
 *                      / (price_micros * CENTS_PER_USD)
 *
 * We scale up before dividing so the division happens once, at the end,
 * on the largest possible numerator - this is the standard technique
 * for avoiding intermediate rounding error in integer math.
 */
function usdToQuantity(usdCents, priceMicros) {
  if (priceMicros <= 0n) throw new Error("Invalid price");
  const numerator = usdCents * MICROS_PER_UNIT * MICROS_PER_UNIT;
  const denominator = priceMicros * CENTS_PER_USD;
  return numerator / denominator; // BigInt division floors toward zero (safe: both positive)
}

/**
 * Given a quantity (integer micro-units) and a price (integer micro-USD),
 * compute the USD cost, in integer cents, rounding DOWN for sells (so the
 * user never receives more cash than the market price justifies) and
 * rounding UP would be used for anything charged against the user - we
 * consistently floor, and document that this can only ever bias
 * fractional-cent value in the *platform's* favor, never the user's.
 */
function quantityToUsd(quantityMicros, priceMicros) {
  const numerator = quantityMicros * priceMicros * CENTS_PER_USD;
  const denominator = MICROS_PER_UNIT * MICROS_PER_UNIT;
  return numerator / denominator;
}

module.exports = {
  CENTS_PER_USD,
  MICROS_PER_UNIT,
  usdToCents,
  priceToMicros,
  centsToDisplay,
  microsToDisplay,
  usdToQuantity,
  quantityToUsd,
};
