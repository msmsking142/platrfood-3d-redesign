import assert from "node:assert/strict";
import test from "node:test";
import { redactContactInfo } from "./redactContactInfo";

test("redacts contact details without changing short numbers", () => {
  assert.equal(
    redactContactInfo("Call me on 9999900001"),
    "Call me on [number hidden]",
  );
  assert.equal(redactContactInfo("+91 98765 43210"), "[number hidden]");
  assert.equal(redactContactInfo("098765-43210"), "[number hidden]");
  assert.equal(redactContactInfo("mail a@b.com"), "mail [email hidden]");
  assert.equal(
    redactContactInfo("2 roti, less spicy, ₹250"),
    "2 roti, less spicy, ₹250",
  );
  assert.equal(redactContactInfo(null), null);
});