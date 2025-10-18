import { type CompileResult } from "@pstdio/tiny-ui-bundler";
import React from "react";
import { getTinyUIRuntimePath } from "../../setupTinyUI";
import type { TinyUIStatus } from "../../types";
import { useTinyUiInstance, type TinyUIActionHandler } from "../hooks/useTinyUiInstance";

export type { TinyUIActionHandler } from "../hooks/useTinyUiInstance";

export interface TinyUIProps {
  title?: string;
  style?: React.CSSProperties;
  instanceId: string;
  sourceId?: string;
  skipCache?: boolean;
  autoCompile?: boolean;
  onStatusChange?(s: TinyUIStatus): void;
  onReady?(r: CompileResult): void;
  onError?(e: Error): void;
  onActionCall?: TinyUIActionHandler;
}

export function TinyUI(props: TinyUIProps) {
  const {
    instanceId,
    title = "tiny-ui",
    sourceId = instanceId,
    skipCache = false,
    autoCompile = true,
    style,
    onStatusChange,
    onReady,
    onError,
    onActionCall,
  } = props;

  const { iframeRef } = useTinyUiInstance({
    instanceId,
    sourceId,
    skipCache,
    autoCompile,
    onStatusChange,
    onReady,
    onError,
    onActionCall,
  });

  const runtimePath = getTinyUIRuntimePath();

  return (
    <div style={style}>
      <iframe
        ref={iframeRef}
        title={title}
        src={runtimePath}
        style={{ flex: 1, width: "100%", height: "100%", border: 0, background: "transparent" }}
      />
    </div>
  );
}
