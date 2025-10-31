import type { Meta, StoryObj } from "@storybook/react";
import { Box } from "@chakra-ui/react";
import { RichMessage } from "./message";

const sampleMarkdown = `# Release Notes\n\n- Added Storybook stories for Kas UI primitives.\n- Improved error handling in the tooling timeline.\n\n## Next Steps\n\n1. Verify the agent against the new test suite.\n2. Share feedback with the design team.\n\n---\n\n\`\`\`tsx\nexport function Greeting() {\n  return <h1>Hello, Storybook!</h1>;\n}\n\`\`\`\n`;

const meta: Meta<typeof RichMessage> = {
  title: "Rich Text/RichMessage",
  component: RichMessage,
  args: {
    defaultState: sampleMarkdown,
    debug: false,
  },
  decorators: [
    (Story) => (
      <Box width="720px" maxW="100%" borderWidth="1px" borderRadius="lg" overflow="hidden">
        <Story />
      </Box>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof RichMessage>;

export const MarkdownExample: Story = {};

export const DebugTree: Story = {
  args: {
    debug: true,
  },
};
