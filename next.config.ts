import { createCivicAuthPlugin } from '@civic/auth/nextjs';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  serverExternalPackages: [
    'agent0-sdk',
    '@ipshipyard/node-datachannel',
    'helia',
    '@libp2p/webrtc',
  ],
};

const withCivicAuth = createCivicAuthPlugin({
  clientId: process.env.CIVIC_CLIENT_ID ?? '',
});

export default withCivicAuth(nextConfig);
