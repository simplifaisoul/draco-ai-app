import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["react-syntax-highlighter"],
  serverExternalPackages: ["ssh2"],
};

export default nextConfig;
