require("dotenv").config();

const express = require("express");
const cors = require("cors");
const {
  fetchArrivals,
  findFlight,
  todayInDublin,
} = require("./services/dublinAirport");
const { createMpp } = require("./services/mpp");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const mpp = createMpp();
mpp.mountDiscovery(app);

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    service: "dublin-airport-arrivals",
    payment: {
      protocol: "mpp",
      price: mpp.price,
      testnet: mpp.testnet,
    },
  });
});

/**
 * GET /arrivals
 * Query params:
 *   date   - YYYY-MM-DD (defaults to today in Europe/Dublin)
 *   limit  - min 10 (default 50)
 *   flight - optional flight number filter (e.g. EI209 or FR7125)
 *
 * Requires MPP payment (HTTP 402 until settled).
 */
app.get("/arrivals", mpp.charge, async (req, res) => {
  try {
    const { date, limit, flight } = req.query;

    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        error: "Invalid date. Use YYYY-MM-DD.",
      });
    }

    const result = await fetchArrivals({ date, limit });

    if (flight) {
      const matches = findFlight(result.flights, flight);
      return res.json({
        date: result.date,
        query: { flight: String(flight).toUpperCase() },
        count: matches.length,
        flights: matches,
      });
    }

    return res.json({
      date: result.date,
      count: result.count,
      flights: result.flights,
    });
  } catch (err) {
    console.error("Failed to fetch arrivals:", err.message);
    return res.status(err.status || 502).json({
      error: "Unable to fetch Dublin Airport arrivals",
      detail: err.message,
    });
  }
});

/**
 * GET /arrivals/:flightNumber
 * Convenience route for a single flight lookup.
 * Requires MPP payment (HTTP 402 until settled).
 */
app.get("/arrivals/:flightNumber", mpp.charge, async (req, res) => {
  try {
    const { date, limit } = req.query;
    const { flightNumber } = req.params;

    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        error: "Invalid date. Use YYYY-MM-DD.",
      });
    }

    const result = await fetchArrivals({
      date,
      limit: limit || 200,
    });
    const matches = findFlight(result.flights, flightNumber);

    if (matches.length === 0) {
      return res.status(404).json({
        date: result.date,
        flight: String(flightNumber).toUpperCase(),
        error: "Flight not found in arrivals listing",
      });
    }

    return res.json({
      date: result.date,
      count: matches.length,
      flights: matches,
    });
  } catch (err) {
    console.error("Failed to fetch arrival:", err.message);
    return res.status(err.status || 502).json({
      error: "Unable to fetch Dublin Airport arrival",
      detail: err.message,
    });
  }
});

app.get("/", (_req, res) => {
  res.json({
    service: "Dublin Airport Arrivals API",
    today: todayInDublin(),
    payment: {
      required: true,
      protocol: "mpp",
      statusOnUnpaid: 402,
      price: mpp.price,
      testnet: mpp.testnet,
      recipient: mpp.recipient,
    },
    endpoints: {
      health: "GET /health",
      openapi: "GET /openapi.json",
      arrivals: "GET /arrivals?date=YYYY-MM-DD&limit=50&flight=EI209",
      arrivalByFlight: "GET /arrivals/:flightNumber?date=YYYY-MM-DD",
    },
  });
});

app.listen(PORT, () => {
  console.log(
    `Dublin Airport arrivals API listening on http://localhost:${PORT}`
  );
  console.log(
    `MPP enabled: $${mpp.price} via Tempo (${mpp.testnet ? "testnet" : "mainnet"}) → ${mpp.recipient}`
  );
});
