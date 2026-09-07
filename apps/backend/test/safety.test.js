import assert from "node:assert/strict";
import test from "node:test";

import { validateFile } from "../src/utils/fileValidation.js";
import { validateHttpUrl } from "../src/utils/validateUrl.js";
import { safePathSegment } from "../src/store/fileStore.js";


test("URL validation accepts HTTP(S) and rejects executable protocols", () => {
  assert.equal(validateHttpUrl("https://example.com/path").ok, true);
  assert.equal(validateHttpUrl("javascript:alert(1)").ok, false);
  assert.equal(validateHttpUrl("file:///etc/passwd").ok, false);
});

test("file validation enforces configured size limit", () => {
  const result = validateFile({
    file: { originalname: "sample.txt", size: 11, mimetype: "text/plain" },
    maxBytes: 10,
  });

  assert.equal(result.ok, false);
});

test("stored filenames cannot escape their report directory", () => {
  assert.equal(safePathSegment("../../outside.txt"), "outside.txt");
  assert.equal(safePathSegment("report/../../../token"), "token");
  assert.equal(safePathSegment("..", "fallback"), "fallback");
  assert.equal(safePathSegment("scan evidence.pdf"), "scan_evidence.pdf");
});
