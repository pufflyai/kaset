import { OPFSToolRunner } from "../types";

export const verify_plugin_update: OPFSToolRunner = (_options) => async (_params, config) => {
  return (async () => {
    return {
      messages: [{ role: "tool", tool_call_id: config.toolCall?.id ?? "", content: JSON.stringify({}) }],
    };
  })();
};

export const verify_plugin_update_definition = {
  name: "verify_plugin_update",
  description: "Verify if an update to a plugin was successful",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
};
