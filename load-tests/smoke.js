import http from "k6/http";
import { check, sleep } from "k6";

/**
 * Smoke test — verify the application is alive.
 * k6 run load-tests/smoke.js
 */
export const options = {
  vus: 5,
  duration: "30s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<2000"],
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
    "home 200": (r) => r.status === 200,
  });

  sleep(1);
}
