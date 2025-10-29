import type { Meta, StoryObj } from "@storybook/react";
import { ChangeBubble } from "../components/change-bubble";

const meta: Meta<typeof ChangeBubble> = {
  title: "Kas UI/ChangeBubble",
  component: ChangeBubble,
  args: {
    additions: 8,
    deletions: 2,
    fileCount: 1,
    streaming: false,
  },
};

export default meta;

type Story = StoryObj<typeof ChangeBubble>;

export const Summary: Story = {};

export const Streaming: Story = {
  args: {
    streaming: true,
    additions: 12,
    deletions: 3,
    fileCount: 4,
  },
};

export const MultipleFiles: Story = {
  args: {
    additions: 28,
    deletions: 7,
    fileCount: 5,
  },
};
