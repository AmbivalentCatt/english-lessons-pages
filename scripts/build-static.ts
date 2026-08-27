import { cp, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");

await new Promise<void>((resolve, reject) => {
  const child = spawn(path.join(root, "node_modules/.bin/vite"), ["build"], {
    cwd: root,
    env: process.env,
    stdio: "inherit",
  });
  child.once("error", reject);
  child.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`Vite build exited with ${code}`)));
});

const index = path.join(root, "dist/index.html");
const legacyRoute = path.join(root, "dist/liquid-scroll-lab/reference-v7-micro-fidelity");
await mkdir(legacyRoute, { recursive: true });
await cp(index, path.join(root, "dist/404.html"));
await cp(index, path.join(legacyRoute, "index.html"));
await writeFile(path.join(root, "dist/.nojekyll"), "", "utf8");
