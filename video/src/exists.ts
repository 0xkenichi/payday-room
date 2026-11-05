import manifest from "../public/manifest.json";

// Remotion renders in a browser, so it can't look at the disk. tools/manifest.mjs
// lists what's in public/ before each render, and scenes check against that.
const files = new Set<string>(manifest.files);
export const existsSync = (path: string) => files.has(path);
