export interface ModelPricing {
  id: string;
  label: string;
  inputTokenCost: number;
  outputTokenCost: number;
  perTokens: number;
}

export const MODELS: Record<string, ModelPricing> = {
  "gpt-5": {
    id: "gpt-5",
    label: "GPT-5",
    inputTokenCost: 1.25,
    outputTokenCost: 10,
    perTokens: 1_000_000,
  },
  "gpt-5-mini": {
    id: "gpt-5-mini",
    label: "GPT-5 mini",
    inputTokenCost: 0.25,
    outputTokenCost: 2,
    perTokens: 1_000_000,
  },
};

export function getModelPricing(modelId: string | null | undefined): ModelPricing | undefined {
  if (!modelId) return undefined;

  return MODELS[modelId];
}

export function estimateInputCost(tokens: number, model: ModelPricing): number {
  return (tokens / model.perTokens) * model.inputTokenCost;
}

export function estimateOutputCost(tokens: number, model: ModelPricing): number {
  return (tokens / model.perTokens) * model.outputTokenCost;
}

export function formatUSD(amount: number): string {
  try {
    return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 6 }).format(
      amount,
    );
  } catch {
    return `$${amount.toFixed(6)}`;
  }
}
