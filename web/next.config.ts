import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  env: {
    ALLOWED_EMAILS: process.env.ALLOWED_EMAILS,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },
};

export default nextConfig;
