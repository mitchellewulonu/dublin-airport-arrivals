const { Mppx, tempo, discovery } = require("mppx/express");
const { Store } = require("mppx/server");

const PRICE = process.env.MPP_PRICE || process.env.X402_PRICE || "0.01";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/**
 * Build MPP (Machine Payments Protocol) handlers for Express.
 * Uses Tempo testnet when TEMPO_TESTNET is not "false".
 */
function createMpp() {
  const secretKey = requireEnv("MPP_SECRET_KEY");
  const recipient = requireEnv("TEMPO_DEPOSIT_ADDRESS");
  const testnet = String(process.env.TEMPO_TESTNET || "true").toLowerCase() !== "false";

  // Explicit memory store is required in production/serverless.
  const store = Store.memory();

  const mppx = Mppx.create({
    methods: [
      tempo({
        recipient,
        testnet,
        store,
      }),
    ],
    secretKey,
  });

  return {
    mppx,
    price: PRICE,
    testnet,
    recipient: recipient.toLowerCase(),
    charge: mppx.charge({ amount: PRICE }),
    mountDiscovery(app) {
      discovery(app, mppx, {
        info: {
          title: "Dublin Airport Arrivals API",
          version: "1.0.0",
          description: "Paid Dublin Airport arrivals data via MPP",
        },
      });
    },
  };
}

module.exports = {
  PRICE,
  createMpp,
};
