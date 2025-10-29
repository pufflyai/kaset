import { getIconComponent, type IconName } from "../utils/getIcon.ts";
import {
  Avatar,
  Box,
  Button,
  Card,
  Timeline as ChakraTimeline,
  Input,
  Link,
  Span,
  Stack,
  Text,
} from "@chakra-ui/react";
import { ChevronUpIcon } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";
import { CodeEditor } from "./code-editor.tsx";
import { DiffBubble } from "./diff-bubble.tsx";
import { DiffEditor } from "./diff-editor.tsx";
import { ResourceBadge } from "./resource-badge.tsx";

export const Timeline = ChakraTimeline;

export type TimelineDoc = {
  items: Item[];
};

export type Item = {
  id?: string;
  timestamp?: string;
  indicator?: Indicator;
  title: TitleSegment[];
  blocks?: Block[];
  expandable?: boolean;
};

export type Indicator =
  | { type: "icon"; icon: IconName; color?: string }
  | { type: "avatar"; src: string; alt?: string }
  | { type: "none" };

export type TitleSegment =
  | { kind: "text"; text: string; bold?: boolean; muted?: boolean }
  | { kind: "avatar"; src: string; alt?: string }
  | { kind: "diff"; fileName: string; filePath?: string; additions?: number; deletions?: number }
  | {
      kind: "link";
      text: string;
      href?: string;
      filePath?: string;
      bold?: boolean;
      muted?: boolean;
      variant?: "default" | "bubble";
    };

export type Block =
  | { type: "comment"; text: string; reactions?: { clap?: number } }
  | { type: "code"; language: string; code: string; editable?: boolean }
  | { type: "diff"; language?: string; original: string; modified: string; sideBySide?: boolean }
  | { type: "input"; placeholder?: string }
  | { type: "text"; text: string }
  | {
      type: "references";
      references: Array<string>;
    }
  | { type: "component"; render: (ctx: { onOpenFile?: (filePath: string) => void }) => ReactNode };

function TitleInline({
  seg,
  isClickable,
  onOpenFile,
}: {
  seg: TitleSegment;
  isClickable?: boolean;
  onOpenFile?: (filePath: string) => void;
}) {
  if (seg.kind === "avatar") {
    return (
      <Avatar.Root width="1.5rem" height="1.5rem">
        <Avatar.Image src={seg.src} alt={seg.alt} />
        <Avatar.Fallback />
      </Avatar.Root>
    );
  }

  if (seg.kind === "diff") {
    const additions = seg.additions ?? 0;
    const deletions = seg.deletions ?? 0;
    return (
      <DiffBubble
        fileName={seg.fileName}
        additions={additions}
        deletions={deletions}
        onClickFileLink={() => {
          const path = seg.filePath ?? seg.fileName;
          onOpenFile?.(path);
        }}
      />
    );
  }

  if (seg.kind === "link") {
    const fontWeight = seg.bold ? "medium" : undefined;

    if (seg.variant === "bubble") {
      const isInteractive = Boolean(seg.href || seg.filePath);
      return (
        <Link
          href={seg.href ?? "#"}
          fontWeight={fontWeight}
          color={seg.muted ? "foreground.secondary" : "foreground.secondary"}
          textDecoration="none"
          cursor={isInteractive ? "pointer" : "default"}
          onClick={(event) => {
            event.stopPropagation();
            if (!seg.href) {
              event.preventDefault();
            }
            if (seg.filePath) {
              onOpenFile?.(seg.filePath);
            }
          }}
          _hover={{
            textDecoration: "underline",
            color: seg.muted ? "foreground.secondary" : "foreground.blue-dark",
          }}
        >
          {seg.text}
        </Link>
      );
    }

    return (
      <Link
        href={seg.href ?? "#"}
        fontWeight={fontWeight}
        color={seg.muted ? "foreground.secondary" : "accent.primary"}
        textDecoration="underline"
        onClick={(event) => {
          if (!seg.href) {
            event.preventDefault();
          }
          if (seg.filePath) {
            onOpenFile?.(seg.filePath);
          }
        }}
        _hover={{
          color: seg.muted ? "foreground.secondary" : "accent.primary",
          textDecoration: "underline",
        }}
      >
        {seg.text}
      </Link>
    );
  }

  const fontWeight = seg.bold ? "medium" : undefined;
  return (
    <Span
      fontWeight={fontWeight}
      color="foreground.secondary"
      _groupHover={{
        color: isClickable && !seg.muted ? "foreground.primary" : "foreground.secondary",
      }}
    >
      {seg.text}
    </Span>
  );
}

function IndicatorView({ ind }: { ind?: Indicator }) {
  if (!ind || ind.type === "none") return null;

  if (ind.type === "icon") {
    const IndicatorIcon = getIconComponent(ind.icon);
    return (
      <Timeline.Indicator outline="none" shadow="none" border="none" background={"bg"} color={"foreground.primary"}>
        <Span display="inline-flex" alignItems="center">
          <IndicatorIcon size={14} strokeWidth={1} />
        </Span>
      </Timeline.Indicator>
    );
  }

  return (
    <Timeline.Indicator>
      <Avatar.Root boxSize="full">
        <Avatar.Image src={ind.src} alt={ind.alt} />
        <Avatar.Fallback />
      </Avatar.Root>
    </Timeline.Indicator>
  );
}

function BlockView({ b, onOpenFile }: { b: Block; onOpenFile?: (filePath: string) => void }) {
  switch (b.type) {
    case "comment":
      return (
        <Card.Root>
          <Card.Body>{b.text}</Card.Body>
          {b.reactions?.clap ? (
            <Card.Footer>
              <Button>👏 {b.reactions.clap}</Button>
            </Card.Footer>
          ) : null}
        </Card.Root>
      );
    case "code":
      return (
        <Card.Root height="120px" minH="120px" minWidth="320px" overflow="hidden">
          <Card.Body padding="0">
            <CodeEditor language={b.language} code={b.code} isEditable={!!b.editable} />
          </Card.Body>
        </Card.Root>
      );
    case "diff":
      return (
        <Card.Root height="160px" minH="160px" minWidth="320px" overflow="hidden">
          <Card.Body padding="0">
            <DiffEditor
              original={b.original}
              modified={b.modified}
              language={b.language}
              sideBySide={false}
              disableScroll={true}
            />
          </Card.Body>
        </Card.Root>
      );
    case "input":
      return <Input placeholder={b.placeholder ?? ""} />;
    case "text":
      return (
        <Card.Root background="transparent">
          <Card.Body padding="sm">
            <Text textStyle="label/S/regular">{b.text}</Text>
          </Card.Body>
        </Card.Root>
      );
    case "references":
      return (
        <Stack mt="xs" gap="xs" flexDir="row" flexWrap="wrap">
          {b.references.map((ref) => {
            return <ResourceBadge key={ref} fileName={ref} />;
          })}
        </Stack>
      );
    case "component":
      return <>{b.render({ onOpenFile })}</>;
  }
}

export function TimelineFromJSON({ data, onOpenFile }: { data: TimelineDoc; onOpenFile?: (filePath: string) => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const getKey = (it: Item, idx: number) => (it.id ? `id:${it.id}` : `idx:${idx}`);

  const toggle = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <Timeline.Root>
      {data.items.map((it, idx) => {
        const key = getKey(it, idx);
        const hasBlocks = (it.blocks?.length ?? 0) > 0;
        const canExpand = (it.expandable ?? true) && hasBlocks;
        const isOpen = canExpand ? (expanded[key] ?? false) : hasBlocks;

        return (
          <Timeline.Item gap="xs" key={key}>
            <Timeline.Connector>
              <Timeline.Separator />
              <IndicatorView ind={it.indicator} />
            </Timeline.Connector>
            <Timeline.Content pb="xs">
              {it.title.length > 0 && (
                <Timeline.Title
                  className="group"
                  fontWeight="normal"
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  cursor={canExpand ? "pointer" : "default"}
                  onClick={canExpand ? () => toggle(key) : undefined}
                >
                  <Span display="inline-flex" alignItems="center" gap="sm" flexWrap={"wrap"}>
                    <Span display="inline-flex" alignItems="center" gap="xs" flexWrap={"wrap"}>
                      {it.title.map((seg, i) => (
                        <TitleInline key={i} seg={seg} isClickable={canExpand} onOpenFile={onOpenFile} />
                      ))}
                    </Span>
                    {canExpand ? (
                      <Span
                        display="inline-flex"
                        alignItems="center"
                        transition="transform 200ms ease, color 200ms ease"
                        transform={isOpen ? "rotate(0deg)" : "rotate(-180deg)"}
                        color="transparent"
                        _groupHover={{ color: "foreground.primary" }}
                      >
                        <ChevronUpIcon size={12} />
                      </Span>
                    ) : null}
                  </Span>
                </Timeline.Title>
              )}
              {hasBlocks ? (
                <Box
                  display="grid"
                  gridTemplateRows={isOpen ? "1fr" : "0fr"}
                  transition="grid-template-rows 220ms ease"
                >
                  {isOpen ? (
                    <Box
                      overflow="hidden"
                      opacity={1}
                      transform="translateY(0)"
                      transition="opacity 200ms ease, transform 200ms ease"
                    >
                      {it.blocks!.map((b, i) => (
                        <Box key={i}>
                          <BlockView b={b} onOpenFile={onOpenFile} />
                        </Box>
                      ))}
                    </Box>
                  ) : null}
                </Box>
              ) : null}
            </Timeline.Content>
          </Timeline.Item>
        );
      })}
    </Timeline.Root>
  );
}
