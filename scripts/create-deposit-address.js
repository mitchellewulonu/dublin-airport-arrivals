#!/usr/bin/env node
/**
 * Creates a Stripe crypto deposit address.
 * Usage: node scripts/create-deposit-address.js [tempo|base]
 */
require("dotenv").config();

const Stripe = require("stripe");

const network = process.argv[2] || "tempo";
const STRIPE_API_VERSION = "2026-07-29.preview";

async function main() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Missing STRIPE_SECRET_KEY");

  const stripe = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });
  const response = await stripe.rawRequest(
    "POST",
    "/v1/crypto/deposit_addresses",
    { network },
    { apiVersion: STRIPE_API_VERSION }
  );

  const address = response?.address || response?.destination?.address;
  if (!address) throw new Error(`Unexpected response: ${JSON.stringify(response)}`);

  console.log(JSON.stringify({ network, deposit_address: address }, null, 2));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
