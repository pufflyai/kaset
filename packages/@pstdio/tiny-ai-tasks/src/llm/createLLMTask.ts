import { type OpenAIModelOptions, type OpenAIToolDef, openaiModel } from "./openaiModel";

export type { OpenAIToolDef };

/** @deprecated Use {@link OpenAIModelOptions} instead. */
export type LLMTaskOptions = OpenAIModelOptions;

/** @deprecated Use {@link openaiModel} instead. */
export const createLLMTask = openaiModel;
