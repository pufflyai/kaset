import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { ChatInput } from "./chat-input";

const meta: Meta<typeof ChatInput> = {
  title: "Components/ChatInput",
  component: ChatInput,
  parameters: { layout: "full" },
};
export default meta;

type Story = StoryObj<typeof ChatInput>;

const initialState = JSON.stringify(
  {
    root: {
      children: [
        {
          children: [
            {
              detail: 0,
              format: 0,
              mode: "normal",
              style: "",
              text: "",
              type: "text",
              version: 1,
            },
          ],
          direction: "ltr",
          format: "",
          indent: 0,
          type: "paragraph",
          version: 1,
        },
      ],
      direction: "ltr",
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  },
  null,
  2,
);

export const Default: Story = {
  args: {
    defaultState: initialState,
    availableResources: ["workspace/project-overview.md", "workspace/data/users.csv"],
    onSubmit: (text: string, attachments: string[]) => {
      console.log("Submitted text:", text);
      if (attachments.length > 0) {
        console.log("Submitted attachments:", attachments);
      }
      alert(`Submitted: ${text}${attachments.length > 0 ? ` with ${attachments.length} attachments` : ""}`);
    },
    suggestions: [
      {
        id: "1",
        summary: "What is the capital of France?",
        prompt: "What is the capital of France?",
      },
      {
        id: "2",
        summary: "Explain the theory of relativity.",
        prompt: "Explain the theory of relativity.",
      },
      {
        id: "3",
        summary: "How does photosynthesis work?",
        prompt: "How does photosynthesis work?",
      },
    ],
  },
};

export const WithAttachments: Story = {
  render: (args) => {
    const [attachedResources, setAttachedResources] = useState<string[]>(args.attachedResources ?? []);

    return (
      <ChatInput
        {...args}
        attachedResources={attachedResources}
        onAttachResource={(resourceId) => {
          setAttachedResources((prev) => {
            if (prev.includes(resourceId)) return prev;
            return [...prev, resourceId];
          });
        }}
        onDetachResource={(resourceId) => {
          setAttachedResources((prev) => prev.filter((id) => id !== resourceId));
        }}
        onClearAttachments={() => setAttachedResources([])}
      />
    );
  },
  args: {
    defaultState: initialState,
    availableResources: [
      "workspace/customer-data.csv",
      "workspace/analysis-report.md",
      "workspace/kpi-overview.xlsx",
      "workspace/notes/meeting-notes.md",
    ],
    attachedResources: ["workspace/customer-data.csv", "workspace/analysis-report.md"],
    suggestions: [
      {
        id: "1",
        summary: "Summarize the attached analysis and data file.",
        prompt: "Summarize the attached analysis and data file.",
      },
      {
        id: "2",
        summary: "Identify anomalies in the data set.",
        prompt: "Identify anomalies in the data set.",
      },
    ],
    onSubmit: (text: string, attachments: string[]) => {
      console.log("Submitted text:", text);
      console.log("Submitted attachments:", attachments);
      alert(`Submitted: ${text}${attachments.length > 0 ? ` with ${attachments.length} attachments` : ""}`);
    },
    onSelectResource: (resourceId: string) => console.log("Selected:", resourceId),
  },
};
