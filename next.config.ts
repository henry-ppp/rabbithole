import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "@cursor/sdk",
    "@cursor/sdk-linux-x64",
    "sqlite3",
  ],
};

export default nextConfig;
