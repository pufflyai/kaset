import type { Meta, StoryObj } from "@storybook/react";

import { CompileScenarioStory, type CompileScenarioProps, COMPONENT_DESCRIPTION } from "./CompileScenarioStory";

const meta = {
  title: "Tiny UI Bundler/Compile/Broken Bundle",
  component: CompileScenarioStory,
  args: {
    scenario: "fresh",
    snapshotId: "broken",
  },
  argTypes: {
    scenario: {
      control: false,
      table: { disable: true },
    },
    snapshotId: {
      control: false,
      table: { disable: true },
    },
  },
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: COMPONENT_DESCRIPTION,
        story:
          "Runs the compile pipeline against a snapshot that references missing modules, illustrating the error path and surfacing esbuild failure details.",
      },
    },
  },
} satisfies Meta<CompileScenarioProps>;

export default meta;

type Story = StoryObj<typeof meta>;

export const BrokenBundle: Story = {};
