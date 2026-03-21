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
  clientId: 'e30a9566-25ca-4366-a607-29e3bad6ec8e',
  cookies: {
    tokens: {
      id_token: {
        httpOnly: false,
      },
    },
  },
});

export default withCivicAuth(nextConfig);
