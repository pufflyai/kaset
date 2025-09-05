export function toolNotFound(name: string): Error {
  return new Error(`Tool '${name}' not found`);
}

export function invalidToolCall(toolName: string): Error {
  return new Error(`Invalid tool call for '${toolName}'`);
}

export function invalidMessage(role: string): Error {
  return new Error(`Invalid message for role '${role}'`);
}
