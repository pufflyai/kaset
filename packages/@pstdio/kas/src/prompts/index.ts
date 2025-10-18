import { prompt } from "@pstdio/prompt-utils";

import DEFAULT_SYSTEM_PROMPT from "./system.md?raw";

export const systemPrompt = prompt`${DEFAULT_SYSTEM_PROMPT}`;
