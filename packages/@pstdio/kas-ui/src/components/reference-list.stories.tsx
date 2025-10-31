import type { Meta, StoryObj } from "@storybook/react";
import { ReferenceList } from "./reference-list";

const meta: Meta<typeof ReferenceList> = {
  title: "Components/ReferenceList",
  component: ReferenceList,
  parameters: {
    layout: "padded",
  },
};

export default meta;

type Story = StoryObj<typeof ReferenceList>;

const sampleReferences = ["workspace/analysis/report.md", "workspace/data/users.csv"];

export const Default: Story = {
  args: {
    references: sampleReferences,
    onSelect: (resourceId) => console.log("Selected:", resourceId),
    onRemove: (resourceId) => console.log("Remove:", resourceId),
  },
};

export const Empty: Story = {
  args: {
    references: [],
  },
};
