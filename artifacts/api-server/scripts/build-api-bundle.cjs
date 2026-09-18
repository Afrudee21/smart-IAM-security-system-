const path = require("path");
const fs = require("fs");

function findRootDir(startDir) {
  let cur = startDir;
  while (cur && cur !== path.dirname(cur)) {
    if (fs.existsSync(path.join(cur, "pnpm-workspace.yaml"))) {
      return cur;
    }
    cur = path.dirname(cur);
  }
  return path.resolve(__dirname, "../../..");
}

const rootDir = findRootDir(__dirname);
const apiDir = path.resolve(rootDir, "api");
if (!fs.existsSync(apiDir)) {
  fs.mkdirSync(apiDir, { recursive: true });
}

let esbuild;
try {
  esbuild = require("esbuild");
} catch {
  const esbuildPath = require.resolve("esbuild", {
    paths: [path.resolve(rootDir, "artifacts/api-server"), rootDir],
  });
  esbuild = require(esbuildPath);
}

async function bundle() {
  console.log("Building Vercel Serverless API bundle (api/index.js)...");
  await esbuild.build({
    entryPoints: [path.resolve(rootDir, "artifacts/api-server/src/app.ts")],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: path.resolve(rootDir, "api/index.js"),
    external: ["*.node", "pg-native"],
    logLevel: "info",
  });
  console.log("Vercel Serverless API bundle built successfully.");
}

bundle().catch((err) => {
  console.error("Error building Vercel API bundle:", err);
  process.exit(1);
});
