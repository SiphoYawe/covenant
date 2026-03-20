/** Status of an x402 payment */
export type PaymentStatus = 'pending' | 'settled' | 'failed';

/** Request to initiate an x402 payment */
export type PaymentRequest = {
  payerAgentId: string;
  payeeAgentId: string;
  /** Human-readable USDC amount, e.g. "6.00" */
  amount: string;
  taskId?: string;
};

/** Result of an x402 payment */
export type PaymentResult = {
  txHash: string;
  payer: string;
  payee: string;
  /** Human-readable USDC amount */
  amount: string;
  status: PaymentStatus;
  timestamp: number;
};

/** Configuration for the x402 facilitator */
export type X402Config = {
  facilitatorUrl: string;
  chainId: number;
  usdcAddress: string;
};

/** Payment proof stored per agent in KV (Story 3.2) */
export type PaymentProof = {
  txHash: string;
  counterpartyAgentId: string;
  /** Human-readable USDC amount */
  amount: string;
  timestamp: number;
  direction: 'outgoing' | 'incoming';
  taskId?: string;
};

/** Data linking a payment to ERC-8004 feedback (Story 3.2) */
export type FeedbackPaymentData = {
  proofOfPayment: string;
  paymentAmount: string;
  payer: string;
  payee: string;
};
