import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

const configHome = await mkdtemp(join(tmpdir(), "handoff-firebase-cli-"));
try {
  const command = `"${process.execPath}" --test tests/backend.test.mjs tests/storage-config.test.mjs`;
  const child = spawn(process.execPath, [resolve("node_modules/firebase-tools/lib/bin/firebase.js"),
    "emulators:exec", "--only", "auth", "--project", "demo-handoff-test",
    "--config", "tests/firebase.emulator.json", "--non-interactive", command], {
    env: { ...process.env, XDG_CONFIG_HOME: configHome, CI: "true", NO_COLOR: "1" }, stdio: "inherit", windowsHide: true,
  });
  const [code] = await once(child, "exit");
  process.exitCode = code ?? 1;
} finally {
  if (!resolve(configHome).startsWith(resolve(tmpdir()) + sep)) throw new Error("Refusing to clean outside the temporary directory.");
  await rm(configHome, { recursive: true, force: true });
}
