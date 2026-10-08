/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // `npm run preview:build` exports a static copy for the shareable preview page.
  ...(process.env.PREVIEW_EXPORT
    ? { output: "export", distDir: ".next-preview" }
    : {}),
};

module.exports = nextConfig;
