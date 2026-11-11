#!/usr/bin/env node
/**
 * Creates a Stripe crypto deposit address.
 * Usage: node scripts/create-deposit-address.js [tempo|base]
 */
import "dotenv/config";
import Stripe from "stripe";

const network = process.argv[2] || "tempo";
const STRIPE_API_VERSION = "2026-07-29.preview";

const secretKey = process.env.STRIPE_SECRET_KEY;
if (!secretKey) {
  console.error("Missing STRIPE_SECRET_KEY");
  process.exit(1);
}

const stripe = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });
const response = await stripe.rawRequest(
  "POST",
  "/v1/crypto/deposit_addresses",
  { network },
  { apiVersion: STRIPE_API_VERSION }
);

const address = response?.address || response?.destination?.address;
if (!address) {
  console.error(`Unexpected response: ${JSON.stringify(response)}`);
  process.exit(1);
}

console.log(JSON.stringify({ network, deposit_address: address }, null, 2));
