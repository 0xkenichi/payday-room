import { loadFont as loadDisplay } from "@remotion/google-fonts/Fraunces";
import { loadFont as loadBody } from "@remotion/google-fonts/Inter";
import { loadFont as loadMono } from "@remotion/google-fonts/JetBrainsMono";

// Only the weights the scenes use, Latin only, so renders don't stall on slow connections.
export const fonts = {
  display: loadDisplay("normal", { weights: ["600"], subsets: ["latin"] }).fontFamily,
  body: loadBody("normal", { weights: ["400", "500", "600"], subsets: ["latin"] }).fontFamily,
  mono: loadMono("normal", { weights: ["400", "500"], subsets: ["latin"] }).fontFamily,
};

// Dark, to sit next to the Telegram and Switch Console screenshots.
export const c = {
  bg: "#0e1316",
  card: "#161d21",
  line: "#25303a",
  ink: "#eef2f0",
  ink2: "#b4c0bb",
  muted: "#7d8a85",
  money: "#3ddc97",
  moneySoft: "rgba(61,220,151,0.14)",
  usdc: "#4b8fe0",
  usdcSoft: "rgba(75,143,224,0.16)",
  gold: "#f5b942",
  goldSoft: "rgba(245,185,66,0.16)",
  red: "#f0675c",
};

export const FPS = 30;
