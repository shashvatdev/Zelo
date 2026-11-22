import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  productionBrowserSourceMaps: process.env.SOURCE_MAPS === "1",
  partialPrefetching: true,
};

export default nextConfig;
