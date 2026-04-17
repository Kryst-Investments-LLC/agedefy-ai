import http from "k6/http";
import { check, sleep } from "k6";

/**
 * Baseline test — measure normal operating latency.
 * k6 run load-tests/baseline.js
 */
export const options = {
  stages: [
    { duration: "30s", target: 50 },
    { duration: "4m", target: 50 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<3000", "p(99)<5000"],
  },
};

const BASE = __ENV.BASE_URL || "http://localhost:3000";

export default function () {
  const healthRes = http.get(`${BASE}/api/health`);
  check(healthRes, {
    "health 200": (r) => r.status === 200,
  });

  const homeRes = http.get(`${BASE}/`);
  check(homeRes, {
    "home loads": (r) => r.status === 200,
    "home fast": (r) => r.timings.duration < 2000,
  });

  // Public pages
  const pages = ["/learn", "/community", "/marketplace"];
  const page = pages[Math.floor(Math.random() * pages.length)];
  const pageRes = http.get(`${BASE}${page}`);
  check(pageRes, {
    [`${page} loads`]: (r) => r.status === 200,
  });

  sleep(0.5 + Math.random());
}
