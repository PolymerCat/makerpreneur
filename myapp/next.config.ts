import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist", "pdfkit"],
  
};

module.exports = {
  allowedDevOrigins: ['10.185.19.177'],
}

export default nextConfig;
