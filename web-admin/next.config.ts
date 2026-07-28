import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "technoblade.tail953a25.ts.net",
    "either-tribal-strips-online.trycloudflare.com",
  ],
  async rewrites() {
    return [
      {
        source: "/docs",
        destination: "http://127.0.0.1:8000/docs",
      },
      {
        source: "/redoc",
        destination: "http://127.0.0.1:8000/redoc",
      },
      {
        source: "/openapi.json",
        destination: "http://127.0.0.1:8000/api/v1/openapi.json",
      },
      {
        source: "/health-check",
        destination: "http://127.0.0.1:8000/health-check",
      },
    ];
  },
};

export default nextConfig;
