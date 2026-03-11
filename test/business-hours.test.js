import test from "node:test";
import assert from "node:assert/strict";
import { isBusinessHours } from "../src/business-hours.js";

const config = {
  businessTimezone: "America/New_York",
  businessHoursStart: "09:00",
  businessHoursEnd: "16:00"
};

test("returns true during weekday business hours", () => {
  const date = new Date("2026-03-16T14:00:00Z");
  assert.equal(isBusinessHours(date, config), true);
});

test("returns false after closing time", () => {
  const date = new Date("2026-03-16T21:30:00Z");
  assert.equal(isBusinessHours(date, config), false);
});

test("returns false on weekends", () => {
  const date = new Date("2026-03-15T15:00:00Z");
  assert.equal(isBusinessHours(date, config), false);
});
