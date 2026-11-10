// Runs `wrangler dev` for the end-to-end tests. Browsers probe the self-signed certificate in the background,
// and Wrangler logs every rejected probe as an error, so those lines are dropped. Everything else passes through.
import { spawn } from "node:child_process";

const child = spawn("npx", ["wrangler", "dev", ...process.argv.slice(2)], {
  shell: process.platform === "win32",
  stdio: ["ignore", "pipe", "pipe"],
  env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
});

function relay(stream, target) {
  let pending = "";
  stream.on("data", chunk => {
    const lines = (pending + chunk).split(/\r?\n/);
    pending = lines.pop();
    for (const line of lines) if (line.trim() && !/TLS handshake failed/.test(line)) target.write(`${line}\n`);
  });
}
relay(child.stdout, process.stdout);
relay(child.stderr, process.stderr);

child.on("exit", code => process.exit(code ?? 1));
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill(signal));
