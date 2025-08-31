import { customAlphabet } from "nanoid";

/**
 * Generate a short UID that is easier for the LLM to copy
 */
const nanoid = customAlphabet("1234567890abcdefghijklmz", 6);

export const shortUID = (prefix = "r") => `${prefix}${nanoid()}`;
