import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'export',
  env: {
    ALLOWED_EMAILS: process.env.ALLOWED_EMAILS,
  },
  /* config options here */
};

export default nextConfig;
