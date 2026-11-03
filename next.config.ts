import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // react-pdf ships its own font and layout engines, which must not be bundled.
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
