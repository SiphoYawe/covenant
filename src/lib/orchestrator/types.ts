/** Status of a price negotiation */
export type NegotiationStatus = 'negotiating' | 'agreed' | 'rejected' | 'expired';

/** A single negotiation message from one party */
export type NegotiationMessage = {
  agentId: string;
  action: 'offer' | 'counter' | 'accept' | 'reject';
  amount: number;
  reasoning: string;
};

/** State of an ongoing negotiation */
export type NegotiationState = {
  taskId: string;
  requesterId: string;
  providerId: string;
  currentOffer: number;
  counterOffer?: number;
  round: number;
  maxRounds: number;
  status: NegotiationStatus;
  agreedPrice?: number;
};

/** Result of a completed negotiation */
export type NegotiationResult = {
  status: NegotiationStatus;
  agreedPrice?: number;
  rounds: number;
  messages: NegotiationMessage[];
};

/** Parameters to start a negotiation */
export type NegotiationParams = {
  requesterId: string;
  providerId: string;
  taskDescription: string;
  initialOffer: number;
  maxRounds?: number;
};
