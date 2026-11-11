const { createFacilitatorConfig } = require("@coinbase/x402");
const { HTTPFacilitatorClient } = require("@x402/core/server");
const { ExactEvmScheme } = require("@x402/evm/exact/server");
const { paymentMiddleware, x402ResourceServer } = require("@x402/express");
const Stripe = require("stripe");

const STRIPE_API_VERSION = "2026-07-29.preview";
const PRICE = process.env.X402_PRICE || "$0.01";

const NETWORKS = {
  testnet: {
    caip2: "eip155:84532", // Base Sepolia
    stripeNetwork: "base",
    label: "Base Sepolia (testnet)",
  },
  mainnet: {
    caip2: "eip155:8453", // Base
    stripeNetwork: "base",
    label: "Base (mainnet)",
  },
};

function resolveMode() {
  const raw = String(process.env.X402_NETWORK || "testnet").toLowerCase();
  if (raw === "mainnet" || raw === "live" || raw === "base") return "mainnet";
  return "testnet";
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function createStripeClient() {
  const secretKey = requireEnv("STRIPE_SECRET_KEY");
  return new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION });
}

async function createDepositAddress(stripe = createStripeClient()) {
  const response = await stripe.rawRequest(
    "POST",
    "/v1/crypto/deposit_addresses",
    { network: "base" },
    { apiVersion: STRIPE_API_VERSION }
  );
  const address = response?.address || response?.destination?.address;
  if (!address) {
    throw new Error(
      `Unexpected crypto deposit address response: ${JSON.stringify(response)}`
    );
  }
  return String(address).toLowerCase();
}

function buildFacilitatorClient(mode) {
  if (mode === "testnet") {
    return new HTTPFacilitatorClient({
      url: process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator",
    });
  }

  const apiKeyId = requireEnv("CDP_API_KEY_ID");
  const apiKeySecret = requireEnv("CDP_API_KEY_SECRET");
  return new HTTPFacilitatorClient(
    createFacilitatorConfig(apiKeyId, apiKeySecret)
  );
}

function buildPaidRouteConfig(payTo, network) {
  const accepts = [
    {
      scheme: "exact",
      price: PRICE,
      network,
      payTo,
      maxTimeoutSeconds: Number(process.env.X402_TIMEOUT_SECONDS || 60),
    },
  ];

  const resource = {
    accepts,
    description: "Dublin Airport arrivals data",
    mimeType: "application/json",
  };

  return {
    "GET /arrivals": resource,
    "GET /arrivals/*": resource,
  };
}

function attachStripeSettlementRecorder(resourceServer, stripe, mode) {
  const { stripeNetwork } = NETWORKS[mode];

  resourceServer.onAfterSettle(async ({ result, requirements }) => {
    const txHash = result?.transaction;
    if (!txHash || !result.success) return;

    // requirements.amount is atomic USDC (6 decimals). $0.01 = 10000.
    const amountInCents = Math.round(Number(requirements.amount) / 10000);
    if (!Number.isFinite(amountInCents) || amountInCents < 1) {
      console.warn(
        `Skipping PaymentIntent for tx ${txHash}: amount ${requirements.amount}`
      );
      return;
    }

    try {
      const pi = await stripe.paymentIntents.create(
        {
          amount: amountInCents,
          currency: "usd",
          confirm: true,
          payment_method_data: { type: "crypto" },
          allowed_payment_method_types: ["crypto"],
          payment_method_options: {
            crypto: {
              mode: "transaction_verification",
              transaction_verification_options: {
                network: stripeNetwork,
                transaction_hash: txHash,
              },
            },
          },
          metadata: {
            source: "dublin-airport-arrivals",
            x402_network: requirements.network,
            x402_asset: requirements.asset,
          },
        },
        { idempotencyKey: txHash }
      );
      console.log(`Recorded PaymentIntent ${pi.id} for tx ${txHash}`);
    } catch (err) {
      console.error(
        `Failed to record PaymentIntent for tx ${txHash}:`,
        err.message
      );
    }
  });
}

/**
 * Build Express x402 middleware that returns HTTP 402 until payment settles.
 * Defaults to Base Sepolia testnet; set X402_NETWORK=mainnet for live Base + CDP.
 */
function createX402PaymentMiddleware() {
  const mode = resolveMode();
  const networkConfig = NETWORKS[mode];
  const depositAddress = requireEnv("DEPOSIT_ADDRESS").toLowerCase();
  const stripe = createStripeClient();

  const facilitatorClient = buildFacilitatorClient(mode);
  const resourceServer = new x402ResourceServer(facilitatorClient).register(
    networkConfig.caip2,
    new ExactEvmScheme()
  );

  attachStripeSettlementRecorder(resourceServer, stripe, mode);

  const routes = buildPaidRouteConfig(depositAddress, networkConfig.caip2);
  const paywallConfig = {
    appName: "Dublin Airport Arrivals",
    testnet: mode === "testnet",
  };

  const middleware = paymentMiddleware(
    routes,
    resourceServer,
    paywallConfig
  );

  return {
    middleware,
    mode,
    network: networkConfig.caip2,
    networkLabel: networkConfig.label,
    price: PRICE,
    payTo: depositAddress,
  };
}

module.exports = {
  NETWORKS,
  PRICE,
  STRIPE_API_VERSION,
  createDepositAddress,
  createStripeClient,
  createX402PaymentMiddleware,
  resolveMode,
};
