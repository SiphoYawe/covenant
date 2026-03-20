import { withSentryConfig } from '@sentry/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'agent0-sdk',
    '@ipshipyard/node-datachannel',
    'helia',
    '@libp2p/webrtc',
  ],
};

export default withSentryConfig(nextConfig, {
  org: 'covenant',
  project: 'covenant',
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  automaticVercelMonitors: true,
});
