import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  agentRules: false,
  serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
