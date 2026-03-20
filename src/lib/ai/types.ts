/** Configuration for a Claude API call */
export type ClaudeCallConfig = {
  systemPrompt: string;
  userMessage: string;
  maxTokens?: number;
};

/** Claude message response (simplified) */
export type ClaudeResponse = {
  content: string;
  stopReason: string | null;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
};
