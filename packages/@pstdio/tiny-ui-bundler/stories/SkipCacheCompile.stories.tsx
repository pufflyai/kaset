import type { Meta, StoryObj } from "@storybook/react";

import {
  CompileScenarioStory,
  type CompileScenarioProps,
  COMPONENT_DESCRIPTION,
  SCENARIO_STORY_DESCRIPTIONS,
  DEFAULT_SNAPSHOT_ID,
  SNAPSHOT_IDS,
  SNAPSHOT_LABELS,
} from "./CompileScenarioStory";

const meta = {
  title: "Tiny UI Bundler/Compile/Skip Cache",
  component: CompileScenarioStory,
  args: {
    scenario: "skipCache",
    snapshotId: DEFAULT_SNAPSHOT_ID,
  },
  argTypes: {
    snapshotId: {
      options: SNAPSHOT_IDS,
      control: { type: "select" },
      labels: SNAPSHOT_LABELS,
    },
  },
  parameters: {
    layout: "centered",
    docs: {
      description: {
        component: COMPONENT_DESCRIPTION,
        story: SCENARIO_STORY_DESCRIPTIONS.skipCache,
      },
    },
  },
} satisfies Meta<CompileScenarioProps>;

export default meta;

type Story = StoryObj<typeof meta>;

export const SkipCache: Story = {};
