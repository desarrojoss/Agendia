import assert from "node:assert/strict";
import { test } from "node:test";
import { errorDeSlug, slugDesde } from "./slug.ts";

test("slugDesde limpia tildes, espacios y símbolos", () => {
  assert.equal(slugDesde("Barbería  Don José!"), "barberia-don-jose");
  assert.equal(slugDesde("  ---Ñandú & Co---  "), "nandu-co");
  assert.equal(slugDesde("a".repeat(50)).length, 30);
  assert.equal(slugDesde(""), "");
});

test("errorDeSlug valida formato, largo y reservados", () => {
  assert.equal(errorDeSlug("navaja-barber"), null);
  assert.equal(errorDeSlug("ab") !== null, true);
  assert.equal(errorDeSlug("Navaja") !== null, true);
  assert.equal(errorDeSlug("navaja--club") !== null, true);
  assert.equal(errorDeSlug("-navaja") !== null, true);
  assert.equal(errorDeSlug("panel") !== null, true);
  assert.equal(errorDeSlug("api") !== null, true);
  assert.equal(errorDeSlug("a".repeat(31)) !== null, true);
});
