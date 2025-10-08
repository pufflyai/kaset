export interface PluginHostError extends Error {
  code: string;
  pluginId?: string;
  details?: unknown;
}

function createError(code: string, message: string, pluginId?: string, details?: unknown): PluginHostError {
  const error = new Error(message) as PluginHostError;
  error.name = "PluginHostError";
  error.code = code;
  error.pluginId = pluginId;
  error.details = details;
  return error;
}

export function manifestParseError(path: string, message: string, details?: unknown): PluginHostError {
  const error = createError("E_MANIFEST_PARSE", `Failed to parse manifest at ${path}: ${message}`);
  if (details !== undefined) error.details = details;
  return error;
}

export function apiIncompatible(pluginId: string, pluginApi: string, hostApi: string): PluginHostError {
  return createError(
    "E_API_INCOMPATIBLE",
    `Plugin ${pluginId} targets API ${pluginApi}, which is incompatible with host ${hostApi}`,
    pluginId,
  );
}

export function commandNotFound(pluginId: string, commandId: string): PluginHostError {
  return createError("E_CMD_NOT_FOUND", `Command ${commandId} not found for plugin ${pluginId}`, pluginId);
}

export function commandParamsInvalid(pluginId: string, commandId: string, ajvErrors: unknown): PluginHostError {
  return createError("E_CMD_PARAM_INVALID", `Invalid parameters for ${pluginId}:${commandId}`, pluginId, ajvErrors);
}

export function importFailed(pluginId: string, entry: string, cause: unknown): PluginHostError {
  return createError(
    "E_IMPORT_FAILED",
    `Failed to import plugin ${pluginId} entry ${entry}: ${(cause as Error)?.message ?? cause}`,
    pluginId,
    cause,
  );
}
