import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
  allowedDevOrigins: [
    "*.trycloudflare.com",
    "*.ngrok-free.dev",
    "localhost:3000",
    "127.0.0.1:3000"
  ],
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "http://127.0.0.1:8000/api/v1/:path*",
      },
    ];
  },
};

export default nextConfig;
