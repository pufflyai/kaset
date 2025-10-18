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

const alternateSnapshotId = SNAPSHOT_IDS.find((id) => id !== DEFAULT_SNAPSHOT_ID) ?? DEFAULT_SNAPSHOT_ID;

const meta = {
  title: "Tiny UI Bundler/Compile/Cache Hit",
  component: CompileScenarioStory,
  args: {
    scenario: "cacheHit",
    snapshotId: alternateSnapshotId,
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
        story: SCENARIO_STORY_DESCRIPTIONS.cacheHit,
      },
    },
  },
} satisfies Meta<CompileScenarioProps>;

export default meta;

type Story = StoryObj<typeof meta>;

export const CacheHit: Story = {};
