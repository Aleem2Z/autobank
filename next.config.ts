import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // `standalone` produces a self-contained .next/standalone folder that
  // the Dockerfile copies into a slim runtime image. Has no effect on
  // local `next dev` or Vercel deploys.
  output: "standalone",
};

export default nextConfig;
