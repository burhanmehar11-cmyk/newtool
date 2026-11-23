// Zips plugin/ into dist/locenti-plugin.zip for upload to OpenAI's plugin directory.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const out = resolve(root, "dist/locenti-plugin.zip");
mkdirSync(resolve(root, "dist"), { recursive: true });
if (existsSync(out)) rmSync(out);
// Python's zipfile is available almost everywhere (and on Vercel/CI images); no extra npm package needed.
execFileSync("python3", ["-c", `
import os, sys, zipfile
src, dst = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as z:
    for base, _, files in os.walk(src):
        for f in sorted(files):
            p = os.path.join(base, f)
            z.write(p, os.path.relpath(p, src))
print("wrote", dst)
`, resolve(root, "plugin"), out], { stdio: "inherit" });
