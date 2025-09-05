import { createAgent, createLLMTask, Tool } from "../src/index";

// Weather tool
const weatherTool = Tool(
  async (location: string) => ({
    location,
    temperature: 75,
    condition: "Sunny",
  }),
  {
    name: "weather",
    description: "Get the current weather for a given location.",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "string",
          description: "The location to get the weather for.",
        },
      },
      required: ["location"],
    },
  },
);

// News tool
const fetchNews = async (topic: string = "general") => {
  await new Promise((r) => setTimeout(r, 100));

  return {
    topic,
    articles: [{ title: "Demo", publishedAt: new Date().toISOString() }],
  };
};

const newsTool = Tool(fetchNews as any, {
  name: "news",
  description: "Get the latest news.",
  parameters: {
    type: "object",
    properties: {
      topic: { type: "string", description: "Topic, defaults to general" },
    },
    required: [],
  },
});

// Single agent that can call both tools
const agent = createAgent({
  template: [
    {
      role: "system",
      content: "You are a helpful assistant with access to weather and news tools.",
    },
  ],
  llm: createLLMTask({ model: "gpt-5-mini" }),
  tools: [weatherTool, newsTool],
});

const conversation = [
  {
    role: "user" as const,
    content: "What's the weather like in Miami, and any latest news on hurricanes?",
  },
];

for await (const history of agent(conversation)) {
  console.log(JSON.stringify(history, null, 2));
}
