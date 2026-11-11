#!/usr/bin/env node
/**
 * Creates a Stripe crypto deposit address for x402 Base payments.
 * Prints the address (and optionally appends DEPOSIT_ADDRESS to .env).
 *
 * Usage:
 *   node scripts/create-deposit-address.js
 *   node scripts/create-deposit-address.js --write-env
 */
require("dotenv").config();

const fs = require("fs");
const path = require("path");
const {
  createDepositAddress,
  createStripeClient,
  STRIPE_API_VERSION,
} = require("../src/services/x402");

async function main() {
  const writeEnv = process.argv.includes("--write-env");
  const stripe = createStripeClient();
  const address = await createDepositAddress(stripe);

  console.log(JSON.stringify({
    deposit_address: address,
    stripe_api_version: STRIPE_API_VERSION,
    network: "base",
  }, null, 2));

  if (writeEnv) {
    const envPath = path.join(__dirname, "..", ".env");
    let existing = "";
    try {
      existing = fs.readFileSync(envPath, "utf8");
    } catch {
      existing = "";
    }

    if (/^DEPOSIT_ADDRESS=/m.test(existing)) {
      existing = existing.replace(
        /^DEPOSIT_ADDRESS=.*$/m,
        `DEPOSIT_ADDRESS=${address}`
      );
    } else {
      existing =
        existing.replace(/\s*$/, "") +
        `\nDEPOSIT_ADDRESS=${address}\n`;
    }

    fs.writeFileSync(envPath, existing, "utf8");
    console.error(`Wrote DEPOSIT_ADDRESS to ${envPath}`);
  } else {
    console.error(
      "Add to .env:\nDEPOSIT_ADDRESS=" + address +
        "\n(or re-run with --write-env)"
    );
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
