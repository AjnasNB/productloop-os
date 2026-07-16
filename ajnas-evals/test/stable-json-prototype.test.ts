import { describe, expect, test } from "vitest";
import { stableJson } from "../src/stable-json.js";

describe("stable JSON descriptor hardening", () => {
  test("rejects accessor-backed objects and arrays under Object.prototype.value pollution", () => {
    assertPrototypePollutionResistance(stableJson);
  });
});

function assertPrototypePollutionResistance(canonicalize: (value: unknown) => string): void {
  let getterCalls = 0;
  const objectValue = {};
  Object.defineProperty(objectValue, "secret", { enumerable: true, get: () => { getterCalls += 1; return "getter"; } });
  const arrayValue: unknown[] = [];
  Object.defineProperty(arrayValue, "0", { enumerable: true, configurable: true, get: () => { getterCalls += 1; return "getter"; } });
  const previous = Object.getOwnPropertyDescriptor(Object.prototype, "value");
  let objectError: unknown;
  let arrayError: unknown;
  try {
    Object.defineProperty(Object.prototype, "value", { value: "polluted", configurable: true, writable: true });
    try { canonicalize(objectValue); } catch (error) { objectError = error; }
    try { canonicalize(arrayValue); } catch (error) { arrayError = error; }
  } finally {
    if (previous) Object.defineProperty(Object.prototype, "value", previous);
    else Reflect.deleteProperty(Object.prototype, "value");
  }
  expect(objectError).toBeInstanceOf(TypeError);
  expect(arrayError).toBeInstanceOf(TypeError);
  expect(getterCalls).toBe(0);
}
