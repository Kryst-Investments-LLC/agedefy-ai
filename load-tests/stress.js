import http from "k6/http";
import { check, sleep } from "k6";

/**
 * Stress test — ramp to 200 VUs to find the breaking point.
 * k6 run load-tests/stress.js
 */
export const options = {
  stages: [
    { duration: "1m", target: 50 },
    { duration: "2m", target: 100 },
    { duration: "2m", target: 200 },
    { duration: "1m", target: 200 },
    { duration: "2m", target: 0 },
  ],
  thresholds: {
    http_req_duration: ["p(95)<5000"],
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
    "home loads": (r) => r.status < 500,
  });

  // Unauthed POST — should get 401 consistently under load
  const bioRes = http.post(
    `${BASE}/api/biomarkers`,
    JSON.stringify({ name: "test" }),
    { headers: { "Content-Type": "application/json" } }
  );
  check(bioRes, {
    "unauthed POST 401": (r) => r.status === 401,
  });

  // Rate-limited endpoint
  const searchRes = http.get(`${BASE}/api/clinical-trials/search?q=aging&limit=1`);
  check(searchRes, {
    "search responds": (r) => r.status < 500,
  });

  sleep(0.2 + Math.random() * 0.5);
}
