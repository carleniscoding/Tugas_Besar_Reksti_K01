import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { serializeBigInt } from "./serializers.js";

describe("serializeBigInt", () => {
  it("converts BigInt and Date values inside nested response objects", () => {
    const date = new Date("2026-05-21T12:00:00.000Z");

    assert.deepEqual(serializeBigInt({ id: 1n, date, nested: [{ value: 2n }] }), {
      id: "1",
      date: "2026-05-21T12:00:00.000Z",
      nested: [{ value: "2" }],
    });
  });
});
