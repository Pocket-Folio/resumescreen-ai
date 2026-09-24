import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Every test run gets an isolated data directory.
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "resumescreen-test-"));
