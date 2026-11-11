const DUBLIN_ARRIVALS_URL =
  "https://api.dublinairport.com/dap/flight-listing/arrivals";

const DEFAULT_HEADERS = {
  accept: "*/*",
  "accept-language": "en-GB,en;q=0.9,en-US;q=0.8,en-IE;q=0.7",
  origin: "https://www.dublinairport.com",
  referer: "https://www.dublinairport.com/",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
};

function todayInDublin() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Dublin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function normalizeFlight(flight) {
  return {
    flightNumber: flight.flightIdentity,
    carrier: flight.carrierName,
    carrierCode: flight.carrierCode,
    origin: flight.originAirportName,
    originCode: flight.airportCode,
    scheduledArrival: flight.scheduledDateTime,
    estimatedArrival: flight.estimatedDateTime,
    status: flight.statusMessage,
    statusCode: flight.status,
    isDelayed: Boolean(flight.isDelayed),
    terminal: flight.terminalName,
    baggageBelt: flight.baggageBelt,
    codeShares: flight.codeShares || [],
    internalFlightId: flight.internalFlightId,
  };
}

async function fetchArrivals({ date, limit = 50 } = {}) {
  const queryDate = date || todayInDublin();
  const safeLimit = Math.max(10, Number(limit) || 50);

  const url = new URL(DUBLIN_ARRIVALS_URL);
  url.searchParams.set("date", queryDate);
  url.searchParams.set("limit", String(safeLimit));

  const response = await fetch(url, { headers: DEFAULT_HEADERS });

  if (!response.ok) {
    const body = await response.text();
    const error = new Error(
      `Dublin Airport API error (${response.status}): ${body}`
    );
    error.status = response.status;
    error.body = body;
    throw error;
  }

  const data = await response.json();
  const flights = Array.isArray(data.content) ? data.content : [];

  return {
    date: queryDate,
    count: flights.length,
    flights: flights.map(normalizeFlight),
    rawMeta: {
      totalElements: data.totalElements,
      totalPages: data.totalPages,
      number: data.number,
      size: data.size,
    },
  };
}

function findFlight(flights, flightNumber) {
  const needle = String(flightNumber).replace(/\s+/g, "").toUpperCase();
  return flights.filter((flight) => {
    const identity = String(flight.flightNumber || "")
      .replace(/\s+/g, "")
      .toUpperCase();
    const shares = (flight.codeShares || []).map((code) =>
      String(code).replace(/\s+/g, "").toUpperCase()
    );
    return identity === needle || shares.includes(needle);
  });
}

export { fetchArrivals, findFlight, todayInDublin };
