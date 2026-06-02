import { expect, afterEach } from "vitest";
import * as matchers from "@testing-library/jest-dom/matchers";
import { cleanup } from "@testing-library/react";
import { clearRequestCache } from "@/lib/api/requestCache";

expect.extend(matchers);
afterEach(() => {
  cleanup();
  // TD-021: the request cache is module-level and would otherwise leak fresh
  // entries between tests — clear it so each test starts cold.
  clearRequestCache();
});
