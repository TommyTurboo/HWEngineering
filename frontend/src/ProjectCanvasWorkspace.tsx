import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Connection,
  Controls,
  Edge,
  EdgeChange,
  Handle,
  MarkerType,
  MiniMap,
  Node,
  NodeChange,
  NodeProps,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useUpdateNodeInternals,
  ViewportPortal,
} from "@xyflow/react";
import { toPng } from "html-to-image";
import "@xyflow/react/dist/style.css";
import automaatSymbol from "./assets/canvas-symbols/automaat.svg";
import motorSymbol from "./assets/canvas-symbols/motor.svg";

type ProjectCanvasInstance = {
  id: string;
  name: string;
  tag: string;
  typical_name: string;
  typical_code: string;
  cabinet_instance_id?: string | null;
  field_object_instance_id?: string | null;
  cabinet_name?: string | null;
  field_object_name?: string | null;
};

type CanvasDisplayParameter = {
  code: string;
  label: string;
  value: string;
  inputType: string;
  allowedValues: string[];
};

type CanvasDisplayInterface = {
  id: string;
  code: string;
  direction: string;
  side: CanvasInterfaceSide;
  sideOrder: number;
};

type CanvasInterfaceSide = "left" | "right" | "top" | "bottom";

type CanvasNodeData = {
  id: string;
  name: string;
  tag: string;
  typicalName: string;
  placementLabel?: string | null;
  symbolSrc?: string | null;
  parameters: CanvasDisplayParameter[];
  inputInterfaces: CanvasDisplayInterface[];
  outputInterfaces: CanvasDisplayInterface[];
  interfacesBySide: Record<CanvasInterfaceSide, CanvasDisplayInterface[]>;
  expanded: boolean;
  dirty: boolean;
  saving: boolean;
  onToggleExpand: (instanceId: string) => void;
  onParameterChange: (instanceId: string, parameterCode: string, nextValue: string) => void;
  onSave: (instanceId: string) => void;
};

type CanvasApiNode = {
  id?: string;
  instance_id: string;
  x: number;
  y: number;
  width?: number | null;
  height?: number | null;
};

type CanvasApiEdge = {
  id: string;
  source_instance_id: string;
  target_instance_id: string;
  source_handle?: string | null;
  target_handle?: string | null;
  label?: string | null;
  edge_type?: string | null;
};

type CanvasApiResponse = {
  project_id: string;
  nodes: CanvasApiNode[];
  edges: CanvasApiEdge[];
};

type ConnectionApiRead = {
  id: string;
  project_id: string;
  source_instance_id: string;
  source_interface_code: string;
  target_instance_id: string;
  target_interface_code: string;
  connection_kind: string;
  implementation_kind: string;
  label?: string | null;
  status: string;
};

type ProjectConnectionApiResponse = {
  project_id: string;
  connections: ConnectionApiRead[];
};

const IMPLEMENTATION_KIND_OPTIONS = [
  { value: "conceptual", label: "conceptual" },
  { value: "wire", label: "wire" },
  { value: "cable", label: "cable" },
  { value: "terminal_bridge", label: "terminal_bridge" },
  { value: "busbar", label: "busbar" },
  { value: "prewired_internal", label: "prewired_internal" },
] as const;

type PaperSizeKey = "A0" | "A1" | "A2" | "A3" | "A4";
type PaperOrientation = "landscape" | "portrait";

type CanvasPaperConfig = {
  enabled: boolean;
  paperSize: PaperSizeKey;
  orientation: PaperOrientation;
  pxPerMm: number;
  showTitleBlock: boolean;
};

type Props = {
  apiBaseUrl: string;
  selectedProjectId: string | null;
  selectedProjectName: string;
  instances: ProjectCanvasInstance[];
};

type CanvasFlowProps = {
  nodes: Node<CanvasNodeData>[];
  edges: Edge[];
  nodeTypes: typeof nodeTypes;
  onNodesChange: (changes: NodeChange<Node<CanvasNodeData>>[]) => void;
  onEdgesChange: (changes: EdgeChange<Edge>[]) => void;
  onConnect: (connection: Connection) => void;
  onEdgeClick: (_event: React.MouseEvent, edge: Edge) => void;
  onPaneClick: () => void;
  paperFrame: {
    x: number;
    y: number;
    width: number;
    height: number;
    label: string;
  } | null;
  showTitleBlock: boolean;
  edgeRefreshKey: string;
};

type StoredCanvasState = {
  nodes: CanvasApiNode[];
  edges: CanvasApiEdge[];
};

type InstanceCanvasDetail = {
  id: string;
  etim_class_id: string;
  parameter_definition_snapshots: {
    parameter_code: string;
    parameter_name: string;
    source: string;
    input_type: string;
    unit?: string | null;
    allowed_values: string[];
    default_value: string | null;
    required: number;
    is_parametrizable?: number;
    drives_interfaces?: number;
    show_on_canvas: number;
    origin: string;
    visibility: string;
    sort_order: number;
  }[];
  parameter_selections: {
    parameter_code: string;
    parameter_name?: string;
    input_type?: string;
    selected_value: string | null;
    sort_order?: number;
  }[];
  interfaces: {
    id?: string;
    group_code?: string | null;
    code: string;
    role?: string;
    logical_type?: string;
    direction: string;
    side?: string | null;
    side_order?: number | null;
  }[];
};

const InstanceNodeCard = memo(function InstanceNodeCard({ data }: NodeProps<Node<CanvasNodeData>>) {
  const sides: CanvasInterfaceSide[] = ["left", "right", "top", "bottom"];

  return (
    <>
      {sides.flatMap((side) =>
        data.interfacesBySide[side].map((item, index) => {
          const total = data.interfacesBySide[side].length;
          const offset = `${((index + 1) * 100) / (total + 1)}%`;
          const style =
            side === "left" || side === "right"
              ? { top: offset, [side]: -12, transform: "translateY(-50%)" }
              : { left: offset, [side]: -28, transform: "translateX(-50%)" };
          return (
            <div
              className={`canvas-handle-anchor canvas-handle-anchor-${side}`}
              key={`${side}-${item.id}`}
              style={style}
            >
              {(side === "left" || side === "top") ? (
                <span className={`canvas-handle-label canvas-handle-label-${side}`}>{item.code}</span>
              ) : null}
              <Handle
                id={item.id}
                position={sideToPosition(side)}
                type={item.direction === "in" ? "target" : "source"}
              />
              {(side === "right" || side === "bottom") ? (
                <span className={`canvas-handle-label canvas-handle-label-${side}`}>{item.code}</span>
              ) : null}
            </div>
          );
        }),
      )}

      <div className={`canvas-node-card rich-canvas-node${data.expanded ? " is-expanded" : ""}`}>
        <div className="canvas-node-header">
          <div className="canvas-node-header-text">
            <strong>{data.name}</strong>
            <small>{data.tag}</small>
          </div>
          <div className="canvas-node-header-actions">
            <button
              aria-label={data.expanded ? "Collapse node" : "Expand node"}
              className={`canvas-expand-toggle nodrag nopan${data.expanded ? " is-open" : ""}`}
              onClick={(event) => {
                event.stopPropagation();
                data.onToggleExpand(data.id);
              }}
              type="button"
            />
          </div>
        </div>
        <div className="canvas-node-body">
          <div className="canvas-node-symbol">
            {data.symbolSrc ? (
              <img alt="" className="canvas-symbol-image" src={data.symbolSrc} />
            ) : (
              <div className="canvas-symbol-placeholder">{data.typicalName.slice(0, 2).toUpperCase()}</div>
            )}
          </div>
          <div className="canvas-node-summary">
            <small className="canvas-node-typical">{data.typicalName}</small>
            {data.placementLabel ? (
              <small className="canvas-node-placement">{data.placementLabel}</small>
            ) : null}
            <small className="canvas-node-caption">
              {data.parameters.length > 0
                ? `${data.parameters.length} canvas parameters`
                : "No visible parameters"}
            </small>
          </div>
        </div>
        {data.expanded ? (
            <div className="canvas-node-editor nodrag nopan" onClick={(event) => event.stopPropagation()}>
              <div className="canvas-node-editor-status">
                <span>State</span>
                <strong>{data.dirty ? "Unsaved" : "Saved"}</strong>
              </div>
              <div className="canvas-node-editor-grid">
                {data.parameters.length === 0 ? (
                  <p className="canvas-parameter-empty">No editable parameters</p>
                ) : (
                  data.parameters.map((item) => (
                    <div className="canvas-inline-kv" key={item.code}>
                      <label>{item.label}</label>
                      {item.allowedValues.length > 0 ? (
                        <select
                          value={item.value}
                          onChange={(event) =>
                            data.onParameterChange(data.id, item.code, event.target.value)
                          }
                        >
                          <option value="">Select</option>
                          {item.allowedValues.map((value) => (
                            <option key={value} value={value}>
                              {value}
                            </option>
                          ))}
                        </select>
                      ) : item.inputType === "boolean" ? (
                        <select
                          value={item.value}
                          onChange={(event) =>
                            data.onParameterChange(data.id, item.code, event.target.value)
                          }
                        >
                          <option value="">Select</option>
                          <option value="true">true</option>
                          <option value="false">false</option>
                        </select>
                      ) : (
                        <input
                          value={item.value}
                          onChange={(event) =>
                            data.onParameterChange(data.id, item.code, event.target.value)
                          }
                        />
                      )}
                    </div>
                  ))
                )}
              </div>
              <div className="canvas-node-editor-actions">
                <button
                  className="canvas-inline-button canvas-inline-button-primary"
                  disabled={data.saving}
                  onClick={(event) => {
                    event.stopPropagation();
                    data.onSave(data.id);
                  }}
                  type="button"
                >
                  {data.saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ) : null}
      </div>

    </>
  );
});

const nodeTypes = { instanceNode: InstanceNodeCard };
const CANVAS_NODE_WIDTH = 320;
const CANVAS_NODE_HEIGHT = 184;
const EXPORT_MARGIN = 80;
const EXPORT_HEADER_HEIGHT = 88;
const EXPORT_NODE_TOP_OVERFLOW = 42;
const EXPORT_NODE_BOTTOM_OVERFLOW = 34;
const EXPORT_NODE_SIDE_OVERFLOW = 14;
const PAPER_SIZES_MM: Record<PaperSizeKey, { width: number; height: number }> = {
  A0: { width: 841, height: 1189 },
  A1: { width: 594, height: 841 },
  A2: { width: 420, height: 594 },
  A3: { width: 297, height: 420 },
  A4: { width: 210, height: 297 },
};
const DEFAULT_PAPER_CONFIG: CanvasPaperConfig = {
  enabled: true,
  paperSize: "A3",
  orientation: "landscape",
  pxPerMm: 3,
  showTitleBlock: true,
};

function normalizeCanvasSide(side: string | null | undefined, direction: string): CanvasInterfaceSide {
  const normalized = (side ?? "").trim().toLowerCase();
  if (normalized === "left" || normalized === "right" || normalized === "top" || normalized === "bottom") {
    return normalized;
  }
  if (normalized === "line" || normalized === "primary") return "left";
  if (normalized === "load" || normalized === "secondary") return "right";
  if (direction === "out") return "right";
  if (direction === "bidirectional") return "bottom";
  return "left";
}

function sideToPosition(side: CanvasInterfaceSide): Position {
  if (side === "right") return Position.Right;
  if (side === "top") return Position.Top;
  if (side === "bottom") return Position.Bottom;
  return Position.Left;
}

function CanvasFlow({
  nodes,
  edges,
  nodeTypes,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onEdgeClick,
  onPaneClick,
  paperFrame,
  showTitleBlock,
  edgeRefreshKey,
}: CanvasFlowProps) {
  const updateNodeInternals = useUpdateNodeInternals();

  useEffect(() => {
    if (nodes.length === 0) return;
    const frame = window.requestAnimationFrame(() => {
      nodes.forEach((node) => updateNodeInternals(node.id));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [edgeRefreshKey, nodes, updateNodeInternals]);

  return (
    <ReactFlow
      fitView
      nodes={nodes}
      edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
      >
      <MiniMap pannable zoomable />
      <Controls />
      <Background gap={24} size={1} />
      {paperFrame ? (
        <ViewportPortal>
          <PaperFrameOverlay
            height={paperFrame.height}
            label={paperFrame.label}
            showTitleBlock={showTitleBlock}
            width={paperFrame.width}
            x={paperFrame.x}
            y={paperFrame.y}
          />
        </ViewportPortal>
      ) : null}
    </ReactFlow>
  );
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function truncateText(value: string, maxLength: number) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function nodeWidth(node: Node<CanvasNodeData>) {
  return typeof node.width === "number" && node.width > 0 ? node.width : CANVAS_NODE_WIDTH;
}

function nodeHeight(node: Node<CanvasNodeData>) {
  return typeof node.height === "number" && node.height > 0 ? node.height : CANVAS_NODE_HEIGHT;
}

function topAnchorX(node: Node<CanvasNodeData>, handleId?: string | null) {
  const width = nodeWidth(node);
  const handles = node.data.inputInterfaces;
  if (handles.length === 0) return width / 2;
  const index = handleId ? Math.max(handles.findIndex((item) => item.id === handleId), 0) : 0;
  return (width / (handles.length + 1)) * (index + 1);
}

function bottomAnchorX(node: Node<CanvasNodeData>, handleId?: string | null) {
  const width = nodeWidth(node);
  const handles = node.data.outputInterfaces;
  if (handles.length === 0) return width / 2;
  const index = handleId ? Math.max(handles.findIndex((item) => item.id === handleId), 0) : 0;
  return (width / (handles.length + 1)) * (index + 1);
}

function interfaceForHandle(node: Node<CanvasNodeData>, handleId?: string | null) {
  if (!handleId) return null;
  return [...node.data.inputInterfaces, ...node.data.outputInterfaces].find((item) => item.id === handleId) ?? null;
}

function handleAnchorPoint(node: Node<CanvasNodeData>, handleId?: string | null) {
  const width = nodeWidth(node);
  const height = nodeHeight(node);
  const handle = interfaceForHandle(node, handleId);
  const side = handle?.side ?? "bottom";
  const handles = node.data.interfacesBySide[side];
  const index = handle ? Math.max(handles.findIndex((item) => item.id === handle.id), 0) : 0;
  const offset = handles.length > 0 ? (index + 1) / (handles.length + 1) : 0.5;
  if (side === "left") return { x: 0, y: height * offset };
  if (side === "right") return { x: width, y: height * offset };
  if (side === "top") return { x: width * offset, y: 0 };
  return { x: width * offset, y: height };
}

function expandedNodeBounds(nodes: Node<CanvasNodeData>[]) {
  return {
    minX: Math.min(...nodes.map((node) => node.position.x - EXPORT_NODE_SIDE_OVERFLOW)),
    minY: Math.min(...nodes.map((node) => node.position.y - EXPORT_NODE_TOP_OVERFLOW)),
    maxX: Math.max(...nodes.map((node) => node.position.x + nodeWidth(node) + EXPORT_NODE_SIDE_OVERFLOW)),
    maxY: Math.max(...nodes.map((node) => node.position.y + nodeHeight(node) + EXPORT_NODE_BOTTOM_OVERFLOW)),
  };
}

const PaperFrameOverlay = memo(function PaperFrameOverlay({
  x,
  y,
  width,
  height,
  label,
  showTitleBlock,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  showTitleBlock: boolean;
}) {
  return (
    <div className="canvas-paper-frame" style={{ transform: `translate(${x}px, ${y}px)`, width, height }}>
      <div className="canvas-paper-frame-label">{label}</div>
      {showTitleBlock ? (
        <div className="canvas-paper-title-block">
          <strong>{label}</strong>
          <span>Export preview</span>
        </div>
      ) : null}
    </div>
  );
});

function edgePath(sourceX: number, sourceY: number, targetX: number, targetY: number) {
  const verticalOffset = Math.max(60, Math.abs(targetY - sourceY) * 0.35);
  return `M ${sourceX} ${sourceY} C ${sourceX} ${sourceY + verticalOffset}, ${targetX} ${targetY - verticalOffset}, ${targetX} ${targetY}`;
}

async function blobToDataUrl(blob: Blob) {
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("blob_to_data_url_failed"));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error("blob_to_data_url_failed"));
    reader.readAsDataURL(blob);
  });
}

async function resolveSymbolHref(
  src: string | null | undefined,
  cache: Map<string, string>,
) {
  if (!src) return null;
  const cached = cache.get(src);
  if (cached) return cached;
  const response = await fetch(src);
  if (!response.ok) {
    throw new Error("symbol_fetch_failed");
  }
  const dataUrl = await blobToDataUrl(await response.blob());
  cache.set(src, dataUrl);
  return dataUrl;
}

function storageKey(projectId: string) {
  return `hwengineering.projectCanvas.${projectId}`;
}

function paperConfigStorageKey(projectId: string) {
  return `hwengineering.projectCanvas.paper.${projectId}`;
}

function parsePaperConfig(raw: string): CanvasPaperConfig | null {
  try {
    const parsed = JSON.parse(raw) as Partial<CanvasPaperConfig>;
    if (
      typeof parsed.enabled !== "boolean" ||
      !parsed.paperSize ||
      !parsed.orientation ||
      typeof parsed.pxPerMm !== "number" ||
      typeof parsed.showTitleBlock !== "boolean"
    ) {
      return null;
    }
    if (!(parsed.paperSize in PAPER_SIZES_MM)) {
      return null;
    }
    if (parsed.orientation !== "landscape" && parsed.orientation !== "portrait") {
      return null;
    }
    return {
      enabled: parsed.enabled,
      paperSize: parsed.paperSize,
      orientation: parsed.orientation,
      pxPerMm: parsed.pxPerMm,
      showTitleBlock: parsed.showTitleBlock,
    };
  } catch {
    return null;
  }
}

function selectCanvasSymbol(instance: ProjectCanvasInstance, detail?: InstanceCanvasDetail | null) {
  const haystack = `${instance.typical_name} ${instance.typical_code} ${detail?.etim_class_id ?? ""}`.toLowerCase();
  if (haystack.includes("motor")) {
    return motorSymbol;
  }
  if (haystack.includes("circuit breaker") || haystack.includes("mcb") || haystack.includes("ec000042")) {
    return automaatSymbol;
  }
  return null;
}

function buildCanvasParameters(detail?: InstanceCanvasDetail | null) {
  if (!detail) return [];
  const definitionByCode = new Map(
    detail.parameter_definition_snapshots.map((definition) => [
      definition.parameter_code.toLowerCase(),
      definition,
    ]),
  );
  const selectionByCode = new Map(
    detail.parameter_selections.map((selection) => [selection.parameter_code.toLowerCase(), selection.selected_value ?? ""]),
  );
  return detail.parameter_definition_snapshots
    .filter((definition) => definition.visibility === "active" && definition.show_on_canvas === 1)
    .sort((left, right) => left.sort_order - right.sort_order)
    .map((definition) => ({
      code: definition.parameter_code,
      label: definition.parameter_name,
      value: selectionByCode.get(definition.parameter_code.toLowerCase()) ?? "",
      inputType: definitionByCode.get(definition.parameter_code.toLowerCase())?.input_type ?? "managed_value",
      allowedValues: definitionByCode.get(definition.parameter_code.toLowerCase())?.allowed_values ?? [],
    }));
}

function buildCanvasInterfaces(detail?: InstanceCanvasDetail | null) {
  if (!detail) {
    return {
      inputInterfaces: [],
      outputInterfaces: [],
      interfacesBySide: { left: [], right: [], top: [], bottom: [] },
    };
  }
  const allInterfaces = detail.interfaces
    .map((item) => ({
      id: item.code,
      code: item.code,
      direction: item.direction,
      side: normalizeCanvasSide(item.side, item.direction),
      sideOrder: item.side_order ?? 0,
    }))
    .sort((left, right) => left.side.localeCompare(right.side) || left.sideOrder - right.sideOrder || left.code.localeCompare(right.code));
  const interfacesBySide = allInterfaces.reduce<Record<CanvasInterfaceSide, CanvasDisplayInterface[]>>(
    (result, item) => {
      result[item.side].push(item);
      return result;
    },
    { left: [], right: [], top: [], bottom: [] },
  );
  return {
    inputInterfaces: allInterfaces.filter((item) => item.direction === "in"),
    outputInterfaces: allInterfaces.filter((item) => item.direction === "out"),
    interfacesBySide,
  };
}

function buildNodeData(
  instance: ProjectCanvasInstance,
  detail: InstanceCanvasDetail | null | undefined,
  args: {
    expanded: boolean;
    dirty: boolean;
    saving: boolean;
    onToggleExpand: (instanceId: string) => void;
    onParameterChange: (instanceId: string, parameterCode: string, nextValue: string) => void;
    onSave: (instanceId: string) => void;
  },
): CanvasNodeData {
  const interfaces = buildCanvasInterfaces(detail);
  return {
    id: instance.id,
    name: instance.name,
    tag: instance.tag,
    typicalName: instance.typical_name,
    placementLabel: instance.cabinet_name
      ? `Cabinet · ${instance.cabinet_name}`
      : instance.field_object_name
        ? `Field · ${instance.field_object_name}`
        : null,
    symbolSrc: selectCanvasSymbol(instance, detail),
    parameters: buildCanvasParameters(detail),
    inputInterfaces: interfaces.inputInterfaces,
    outputInterfaces: interfaces.outputInterfaces,
    interfacesBySide: interfaces.interfacesBySide,
    expanded: args.expanded,
    dirty: args.dirty,
    saving: args.saving,
    onToggleExpand: args.onToggleExpand,
    onParameterChange: args.onParameterChange,
    onSave: args.onSave,
  };
}

function makeNode(
  instance: ProjectCanvasInstance,
  index: number,
  detail: InstanceCanvasDetail | null | undefined,
  args: {
    expanded: boolean;
    dirty: boolean;
    saving: boolean;
    onToggleExpand: (instanceId: string) => void;
    onParameterChange: (instanceId: string, parameterCode: string, nextValue: string) => void;
    onSave: (instanceId: string) => void;
  },
): Node<CanvasNodeData> {
  return {
    id: instance.id,
    position: {
      x: 120 + (index % 3) * 420,
      y: 120 + Math.floor(index / 3) * 240,
    },
    data: buildNodeData(instance, detail, args),
    type: "instanceNode",
  };
}

function toApiPayload(nodes: Node<CanvasNodeData>[], edges: Edge[]) {
  return {
    nodes: nodes.map((node) => ({
      instance_id: node.id,
      x: node.position.x,
      y: node.position.y,
      width: null,
      height: null,
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source_instance_id: edge.source,
      target_instance_id: edge.target,
      source_handle: edge.sourceHandle ?? null,
      target_handle: edge.targetHandle ?? null,
      label: typeof edge.label === "string" ? edge.label : null,
      edge_type: edge.type ?? null,
    })),
  };
}

function isPersistentNodeChange(change: NodeChange<Node<CanvasNodeData>>) {
  return change.type === "position" || change.type === "remove" || change.type === "replace" || change.type === "add";
}

function isPersistentEdgeChange(change: EdgeChange<Edge>) {
  return change.type === "remove" || change.type === "replace" || change.type === "add";
}

function isValidCachedNode(value: unknown): value is CanvasApiNode {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.instance_id === "string" &&
    typeof candidate.x === "number" &&
    typeof candidate.y === "number"
  );
}

function isValidCachedEdge(value: unknown): value is CanvasApiEdge {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.source_instance_id === "string" &&
    typeof candidate.target_instance_id === "string"
  );
}

function parseCachedCanvas(raw: string): StoredCanvasState | null {
  try {
    const parsed = JSON.parse(raw) as { nodes?: unknown; edges?: unknown };
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
      return null;
    }
    const nodes = parsed.nodes.filter(isValidCachedNode);
    const validNodeIds = new Set(nodes.map((node) => node.instance_id));
    const edges = parsed.edges
      .filter(isValidCachedEdge)
      .filter(
        (edge) => validNodeIds.has(edge.source_instance_id) && validNodeIds.has(edge.target_instance_id),
      );
    return {
      nodes,
      edges,
    };
  } catch {
    return null;
  }
}

function hydrateCanvas(
  payload: CanvasApiResponse,
  instances: ProjectCanvasInstance[],
  detailsById: Record<string, InstanceCanvasDetail>,
  connectionsById: Record<string, ConnectionApiRead>,
  args: {
    expandedIds: Set<string>;
    dirtyInstances: Record<string, boolean>;
    savingInstanceId: string | null;
    onToggleExpand: (instanceId: string) => void;
    onParameterChange: (instanceId: string, parameterCode: string, nextValue: string) => void;
    onSave: (instanceId: string) => void;
  },
): { nodes: Node<CanvasNodeData>[]; edges: Edge[] } {
  const instanceMap = new Map(instances.map((instance) => [instance.id, instance]));
  const nodes: Node<CanvasNodeData>[] = [];

  for (const node of payload.nodes) {
    const instance = instanceMap.get(node.instance_id);
    if (!instance) {
      continue;
    }
    nodes.push({
      id: node.instance_id,
      position: { x: node.x, y: node.y },
      type: "instanceNode",
      data: buildNodeData(instance, detailsById[node.instance_id], {
        expanded: args.expandedIds.has(node.instance_id),
        dirty: Boolean(args.dirtyInstances[node.instance_id]),
        saving: args.savingInstanceId === node.instance_id,
        onToggleExpand: args.onToggleExpand,
        onParameterChange: args.onParameterChange,
        onSave: args.onSave,
      }),
    });
  }

  return {
    nodes,
    edges: payload.edges.map((edge) => buildReactEdge(edge, connectionsById[edge.id] ?? null)),
  };
}

function canvasEdgesFromConnections(payload: ProjectConnectionApiResponse): CanvasApiEdge[] {
  return payload.connections.map((connection) => ({
    id: connection.id,
    source_instance_id: connection.source_instance_id,
    target_instance_id: connection.target_instance_id,
    source_handle: connection.source_interface_code,
    target_handle: connection.target_interface_code,
    label: connection.connection_kind,
    edge_type: null,
  }));
}

function edgeVisuals(connectionKind?: string | null, implementationKind?: string | null) {
  const normalizedKind = (connectionKind || "logical").toLowerCase();
  const normalizedImplementation = (implementationKind || "conceptual").toLowerCase();

  let stroke = "#64748b";
  if (normalizedKind === "power") stroke = "#b45309";
  if (normalizedKind === "signal") stroke = "#0f766e";
  if (normalizedKind === "network") stroke = "#7c3aed";
  if (normalizedKind === "pe") stroke = "#15803d";

  let strokeWidth = 2;
  let strokeDasharray: string | undefined;
  let animated = false;

  switch (normalizedImplementation) {
    case "wire":
      strokeWidth = 2;
      break;
    case "cable":
      strokeWidth = 3;
      break;
    case "terminal_bridge":
      strokeWidth = 2;
      strokeDasharray = "2 3";
      break;
    case "busbar":
      strokeWidth = 5;
      break;
    case "prewired_internal":
      strokeWidth = 2;
      strokeDasharray = "8 4";
      break;
    default:
      strokeWidth = 2;
      strokeDasharray = "6 4";
      animated = true;
      break;
  }

  return {
    animated,
    labelBg: "#ffffff",
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: stroke,
    },
    style: {
      stroke,
      strokeWidth,
      strokeDasharray,
    },
  };
}

function buildReactEdge(edge: CanvasApiEdge, connection?: ConnectionApiRead | null): Edge {
  const connectionKind = connection?.connection_kind ?? edge.edge_type ?? edge.label ?? "logical";
  const implementationKind = connection?.implementation_kind ?? "conceptual";
  const visuals = edgeVisuals(connectionKind, implementationKind);

  return {
    id: edge.id,
    source: edge.source_instance_id,
    target: edge.target_instance_id,
    sourceHandle: edge.source_handle ?? undefined,
    targetHandle: edge.target_handle ?? undefined,
    label: connectionKind,
    animated: visuals.animated,
    style: visuals.style,
    markerEnd: visuals.markerEnd,
    labelStyle: {
      fill: visuals.style.stroke,
      fontSize: 11,
      fontWeight: 600,
    },
    labelBgStyle: {
      fill: visuals.labelBg,
      fillOpacity: 0.92,
    },
    labelBgPadding: [6, 3],
    labelBgBorderRadius: 4,
  };
}

export default function ProjectCanvasWorkspace({
  apiBaseUrl,
  selectedProjectId,
  selectedProjectName,
  instances,
}: Props) {
  const [nodes, setNodes] = useState<Node<CanvasNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState("");
  const [expandedInstanceIds, setExpandedInstanceIds] = useState<string[]>([]);
  const [dirtyInstances, setDirtyInstances] = useState<Record<string, boolean>>({});
  const [savingInstanceId, setSavingInstanceId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [canvasError, setCanvasError] = useState<string | null>(null);
  const [paperConfig, setPaperConfig] = useState<CanvasPaperConfig>(DEFAULT_PAPER_CONFIG);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [instanceDetails, setInstanceDetails] = useState<Record<string, InstanceCanvasDetail>>({});
  const [connectionsById, setConnectionsById] = useState<Record<string, ConnectionApiRead>>({});
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const canvasShellRef = useRef<HTMLDivElement | null>(null);
  const instanceDetailsRef = useRef<Record<string, InstanceCanvasDetail>>({});
  const instancesRef = useRef<ProjectCanvasInstance[]>([]);
  const nodesRef = useRef<Node<CanvasNodeData>[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const selectedProjectIdRef = useRef<string | null>(selectedProjectId);
  const saveNodeInstanceRef = useRef<(instanceId: string) => void>(() => {});
  const persistCanvasStateRef = useRef<
    (nextNodes: Node<CanvasNodeData>[], nextEdges: Edge[], options?: { successMessage?: string | null }) => Promise<void>
  >(async () => {});
  const canvasAutosaveTimerRef = useRef<number | null>(null);
  const instanceAutosaveTimersRef = useRef<Record<string, number>>({});

  useEffect(() => {
    instanceDetailsRef.current = instanceDetails;
  }, [instanceDetails]);

  useEffect(() => {
    instancesRef.current = instances;
  }, [instances]);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    selectedProjectIdRef.current = selectedProjectId;
  }, [selectedProjectId]);

  useEffect(() => {
    return () => {
      if (canvasAutosaveTimerRef.current !== null) {
        window.clearTimeout(canvasAutosaveTimerRef.current);
      }
      Object.values(instanceAutosaveTimersRef.current).forEach((timer) => window.clearTimeout(timer));
      instanceAutosaveTimersRef.current = {};
    };
  }, []);

  const saveLocalCache = useCallback(
    (nextNodes: Node<CanvasNodeData>[], nextEdges: Edge[]) => {
      if (!selectedProjectId) return;
      const payload: StoredCanvasState = toApiPayload(nextNodes, nextEdges);
      window.localStorage.setItem(storageKey(selectedProjectId), JSON.stringify(payload));
    },
    [selectedProjectId],
  );

  useEffect(() => {
    if (!selectedProjectId) {
      setPaperConfig(DEFAULT_PAPER_CONFIG);
      return;
    }
    const raw = window.localStorage.getItem(paperConfigStorageKey(selectedProjectId));
    if (!raw) {
      setPaperConfig(DEFAULT_PAPER_CONFIG);
      return;
    }
    const parsed = parsePaperConfig(raw);
    setPaperConfig(parsed ?? DEFAULT_PAPER_CONFIG);
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) return;
    window.localStorage.setItem(paperConfigStorageKey(selectedProjectId), JSON.stringify(paperConfig));
  }, [paperConfig, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId || instances.length === 0) {
      setInstanceDetails({});
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const payloads = await Promise.all(
          instances.map(async (instance) => {
            const response = await fetch(`${apiBaseUrl}/api/v1/instances/${instance.id}`);
            if (!response.ok) {
              return null;
            }
            return (await response.json()) as InstanceCanvasDetail;
          }),
        );
        if (cancelled) return;
        setInstanceDetails(
          Object.fromEntries(
            payloads.filter((item): item is InstanceCanvasDetail => item !== null).map((item) => [item.id, item]),
          ),
        );
      } catch {
        if (!cancelled) {
          setInstanceDetails({});
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl, instances, selectedProjectId]);

  const toggleExpandNode = useCallback((instanceId: string) => {
    setExpandedInstanceIds((current) =>
      current.includes(instanceId)
        ? current.filter((item) => item !== instanceId)
        : [...current, instanceId],
    );
  }, []);

  const scheduleInstanceAutosave = useCallback((instanceId: string) => {
    if (!selectedProjectIdRef.current) return;
    const existing = instanceAutosaveTimersRef.current[instanceId];
    if (existing) {
      window.clearTimeout(existing);
    }
    instanceAutosaveTimersRef.current[instanceId] = window.setTimeout(() => {
      delete instanceAutosaveTimersRef.current[instanceId];
      void saveNodeInstanceRef.current(instanceId);
    }, 700);
  }, []);

  const updateNodeParameter = useCallback((instanceId: string, parameterCode: string, nextValue: string) => {
    setInstanceDetails((current) => {
      const detail = current[instanceId];
      if (!detail) return current;
      const nextSelections = detail.parameter_selections.map((selection) =>
        selection.parameter_code.toLowerCase() === parameterCode.toLowerCase()
          ? { ...selection, selected_value: nextValue || null }
          : selection,
      );
      return {
        ...current,
        [instanceId]: {
          ...detail,
          parameter_selections: nextSelections,
        },
      };
    });
    setDirtyInstances((current) => ({ ...current, [instanceId]: true }));
    setSaveMessage(null);
    setCanvasError(null);
    scheduleInstanceAutosave(instanceId);
  }, [scheduleInstanceAutosave]);

  const saveNodeInstance = useCallback(
    async (instanceId: string) => {
      const instance = instancesRef.current.find((item) => item.id === instanceId);
      const detail = instanceDetailsRef.current[instanceId];
      if (!instance || !detail) return;
      setSavingInstanceId(instanceId);
      setCanvasError(null);
      setSaveMessage(null);
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/instances/${instanceId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: instance.name,
            tag: instance.tag,
            description: null,
            parameter_definition_snapshots: detail.parameter_definition_snapshots.map((definition) => ({
              parameter_code: definition.parameter_code,
              parameter_name: definition.parameter_name,
              source: definition.source,
              input_type: definition.input_type,
              unit: definition.unit || null,
              allowed_values: definition.allowed_values,
              default_value: definition.default_value || null,
              required: definition.required === 1,
              is_parametrizable: definition.is_parametrizable !== 0,
              drives_interfaces: definition.drives_interfaces === 1,
              show_on_canvas: definition.show_on_canvas === 1,
              origin: definition.origin,
              visibility: definition.visibility,
              sort_order: definition.sort_order,
            })),
            parameter_selections: detail.parameter_selections.map((selection) => ({
              parameter_code: selection.parameter_code,
              selected_value: selection.selected_value || null,
            })),
          }),
        });
        if (!response.ok) {
          const detailPayload = (await response.json().catch(() => null)) as { detail?: string } | null;
          setCanvasError(detailPayload?.detail ?? "Canvas instance opslaan mislukt.");
          return;
        }
        const saved = (await response.json()) as InstanceCanvasDetail;
        const nextDetails = {
          ...instanceDetailsRef.current,
          [saved.id]: saved,
        };
        instanceDetailsRef.current = nextDetails;
        setInstanceDetails(nextDetails);
        setDirtyInstances((current) => ({ ...current, [saved.id]: false }));

        const savedInterfaces = buildCanvasInterfaces(saved);
        const nodeHandleMap = new Map(
          nodesRef.current.map((node) => [
            node.id,
            {
              inputHandles: new Set(node.data.inputInterfaces.map((item) => item.id)),
              outputHandles: new Set(node.data.outputInterfaces.map((item) => item.id)),
            },
          ]),
        );
        nodeHandleMap.set(saved.id, {
          inputHandles: new Set(savedInterfaces.inputInterfaces.map((item) => item.id)),
          outputHandles: new Set(savedInterfaces.outputInterfaces.map((item) => item.id)),
        });

        const nextEdges = edgesRef.current.filter((edge) => {
          const sourceNode = nodeHandleMap.get(edge.source);
          const targetNode = nodeHandleMap.get(edge.target);
          if (!sourceNode || !targetNode) {
            return false;
          }
          if (edge.sourceHandle && !sourceNode.outputHandles.has(edge.sourceHandle)) {
            return false;
          }
          if (edge.targetHandle && !targetNode.inputHandles.has(edge.targetHandle)) {
            return false;
          }
          return true;
        });

        const removedConnections = edgesRef.current.length - nextEdges.length;
        if (removedConnections > 0) {
          edgesRef.current = nextEdges;
          setEdges(nextEdges);
          saveLocalCache(nodesRef.current, nextEdges);
          await persistCanvasStateRef.current(nodesRef.current, nextEdges);
          setSaveMessage(
            `Canvas instance opgeslagen. ${removedConnections} ongeldige connectie${removedConnections === 1 ? "" : "s"} verwijderd.`,
          );
        } else {
          setSaveMessage("Canvas instance opgeslagen.");
        }
      } catch {
        setCanvasError("Canvas instance opslaan mislukt.");
      } finally {
        setSavingInstanceId(null);
      }
    },
    [apiBaseUrl, saveLocalCache],
  );

  useEffect(() => {
    saveNodeInstanceRef.current = (instanceId: string) => {
      void saveNodeInstance(instanceId);
    };
  }, [saveNodeInstance]);

  useEffect(() => {
    if (nodes.length === 0) return;
    const expandedIds = new Set(expandedInstanceIds);
    setNodes((current) =>
      current.map((node) => {
        const instance = instances.find((item) => item.id === node.id);
        if (!instance) return node;
        return {
          ...node,
          data: buildNodeData(instance, instanceDetails[node.id], {
            expanded: expandedIds.has(node.id),
            dirty: Boolean(dirtyInstances[node.id]),
            saving: savingInstanceId === node.id,
            onToggleExpand: toggleExpandNode,
            onParameterChange: updateNodeParameter,
            onSave: (id) => {
              void saveNodeInstance(id);
            },
          }),
        };
      }),
      );
  }, [
    dirtyInstances,
    expandedInstanceIds,
    instanceDetails,
    instances,
    nodes.length,
    saveNodeInstance,
    savingInstanceId,
    toggleExpandNode,
    updateNodeParameter,
  ]);

  useEffect(() => {
    if (canvasAutosaveTimerRef.current !== null) {
      window.clearTimeout(canvasAutosaveTimerRef.current);
      canvasAutosaveTimerRef.current = null;
    }
    Object.values(instanceAutosaveTimersRef.current).forEach((timer) => window.clearTimeout(timer));
    instanceAutosaveTimersRef.current = {};

    if (!selectedProjectId) {
      setNodes([]);
      setEdges([]);
      setSelectedInstanceId("");
      setSelectedEdgeId(null);
      setExpandedInstanceIds([]);
      setSaveMessage(null);
      setCanvasError(null);
      setDirty(false);
      setDirtyInstances({});
      setConnectionsById({});
      return;
    }

    const cached = window.localStorage.getItem(storageKey(selectedProjectId));
    if (cached) {
      const parsed = parseCachedCanvas(cached);
      if (parsed) {
        const hydrated = hydrateCanvas(
          {
            project_id: selectedProjectId,
            nodes: parsed.nodes,
            edges: parsed.edges,
          },
          instances,
          instanceDetails,
          {},
          {
            expandedIds: new Set(),
            dirtyInstances: {},
            savingInstanceId: null,
            onToggleExpand: toggleExpandNode,
            onParameterChange: updateNodeParameter,
            onSave: (id) => {
              void saveNodeInstance(id);
            },
          },
        );
        setNodes(hydrated.nodes);
        setEdges(hydrated.edges);
      } else {
        window.localStorage.removeItem(storageKey(selectedProjectId));
        setNodes([]);
        setEdges([]);
      }
    } else {
    setNodes([]);
    setEdges([]);
  }
  setSelectedInstanceId("");
  setSelectedEdgeId(null);
  setExpandedInstanceIds([]);
  setSaveMessage(null);
  setCanvasError(null);
  setDirty(false);
  setDirtyInstances({});
  setConnectionsById({});

      let cancelled = false;
      void (async () => {
        setIsLoading(true);
        try {
          const [canvasResponse, connectionsResponse] = await Promise.all([
            fetch(`${apiBaseUrl}/api/v1/projects/${selectedProjectId}/canvas`),
            fetch(`${apiBaseUrl}/api/v1/projects/${selectedProjectId}/connections`),
          ]);
          if (cancelled) return;
          if (!canvasResponse.ok) {
            setCanvasError("Canvas laden mislukt.");
            return;
          }
          const payload = (await canvasResponse.json()) as CanvasApiResponse;
          const connectionPayload = connectionsResponse.ok
            ? ((await connectionsResponse.json()) as ProjectConnectionApiResponse)
            : null;
          setConnectionsById(
            Object.fromEntries((connectionPayload?.connections ?? []).map((connection) => [connection.id, connection])),
          );
          const mergedPayload: CanvasApiResponse = {
            ...payload,
            edges:
              connectionPayload && connectionPayload.connections.length > 0
                ? canvasEdgesFromConnections(connectionPayload)
                : payload.edges,
          };
          const rehydrated = hydrateCanvas(mergedPayload, instances, instanceDetails, Object.fromEntries((connectionPayload?.connections ?? []).map((connection) => [connection.id, connection])), {
            expandedIds: new Set(),
            dirtyInstances: {},
            savingInstanceId: null,
          onToggleExpand: toggleExpandNode,
          onParameterChange: updateNodeParameter,
          onSave: (id) => {
            void saveNodeInstance(id);
          },
          });
          setNodes(rehydrated.nodes);
          setEdges(rehydrated.edges);
        saveLocalCache(rehydrated.nodes, rehydrated.edges);
      } catch {
        if (!cancelled) {
          setCanvasError("Canvas laden mislukt.");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    apiBaseUrl,
    instances,
    saveLocalCache,
    selectedProjectId,
    toggleExpandNode,
    updateNodeParameter,
  ]);

  const canvasInstanceIds = useMemo(() => new Set(nodes.map((node) => node.id)), [nodes]);

  const availableInstances = useMemo(
    () => instances.filter((instance) => !canvasInstanceIds.has(instance.id)),
    [canvasInstanceIds, instances],
  );
  const selectedConnection = selectedEdgeId ? connectionsById[selectedEdgeId] ?? null : null;

  const updateSelectedConnectionImplementation = useCallback(
    async (nextImplementationKind: string) => {
      if (!selectedConnection) return;
      setCanvasError(null);
      setSaveMessage(null);
      try {
        const response = await fetch(`${apiBaseUrl}/api/v1/connections/${selectedConnection.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            source_instance_id: selectedConnection.source_instance_id,
            source_interface_code: selectedConnection.source_interface_code,
            target_instance_id: selectedConnection.target_instance_id,
            target_interface_code: selectedConnection.target_interface_code,
            connection_kind: selectedConnection.connection_kind,
            implementation_kind: nextImplementationKind,
            label: selectedConnection.label ?? null,
            status: selectedConnection.status,
          }),
        });
        if (!response.ok) {
          const detail = (await response.json().catch(() => null)) as { detail?: string } | null;
          setCanvasError(detail?.detail ?? "Connection updaten mislukt.");
          return;
        }
        const updated = (await response.json()) as ConnectionApiRead;
        setConnectionsById((current) => ({ ...current, [updated.id]: updated }));
        setEdges((current) =>
          current.map((edge) =>
            edge.id === updated.id
              ? buildReactEdge(
                  {
                    id: updated.id,
                    source_instance_id: updated.source_instance_id,
                    target_instance_id: updated.target_instance_id,
                    source_handle: updated.source_interface_code,
                    target_handle: updated.target_interface_code,
                    label: updated.connection_kind,
                    edge_type: updated.connection_kind,
                  },
                  updated,
                )
              : edge,
          ),
        );
        setSaveMessage("Connection bijgewerkt.");
      } catch {
        setCanvasError("Connection updaten mislukt.");
      }
    },
    [apiBaseUrl, selectedConnection],
  );

  const contentBounds = useMemo(() => {
    if (nodes.length === 0) {
      return null;
    }
    return expandedNodeBounds(nodes);
  }, [nodes]);

  const paperFrame = useMemo(() => {
    if (!paperConfig.enabled) return null;
    const size = PAPER_SIZES_MM[paperConfig.paperSize];
    const widthMm =
      paperConfig.orientation === "landscape" ? Math.max(size.width, size.height) : Math.min(size.width, size.height);
    const heightMm =
      paperConfig.orientation === "landscape" ? Math.min(size.width, size.height) : Math.max(size.width, size.height);
    const width = widthMm * paperConfig.pxPerMm;
    const height = heightMm * paperConfig.pxPerMm;

    if (!contentBounds) {
      return {
        x: 160,
        y: 120,
        width,
        height,
        label: `${paperConfig.paperSize} ${paperConfig.orientation} · ${paperConfig.pxPerMm} px/mm`,
      };
    }

    const centerX = (contentBounds.minX + contentBounds.maxX) / 2;
    const centerY = (contentBounds.minY + contentBounds.maxY) / 2;

    return {
      x: centerX - width / 2,
      y: centerY - height / 2,
      width,
      height,
      label: `${paperConfig.paperSize} ${paperConfig.orientation} · ${paperConfig.pxPerMm} px/mm`,
    };
  }, [contentBounds, paperConfig]);

  const edgeRefreshKey = useMemo(
    () =>
      nodes
        .map((node) => {
          const handles = (["left", "right", "top", "bottom"] as CanvasInterfaceSide[])
            .flatMap((side) => node.data.interfacesBySide[side].map((item) => `${side}:${item.id}:${item.sideOrder}`))
            .join("|");
          return `${node.id}:${handles}`;
        })
        .join(";"),
    [nodes],
  );

  const paperFrameFit = useMemo(() => {
    if (!paperFrame || !contentBounds) {
      return null;
    }
    const fitsWidth = contentBounds.minX >= paperFrame.x && contentBounds.maxX <= paperFrame.x + paperFrame.width;
    const fitsHeight = contentBounds.minY >= paperFrame.y && contentBounds.maxY <= paperFrame.y + paperFrame.height;
    return {
      fitsWidth,
      fitsHeight,
      fits: fitsWidth && fitsHeight,
    };
  }, [contentBounds, paperFrame]);

  function setCanvasState(nextNodes: Node<CanvasNodeData>[], nextEdges: Edge[], markDirty = true) {
    setNodes(nextNodes);
    setEdges(nextEdges);
    saveLocalCache(nextNodes, nextEdges);
    if (markDirty) {
      setDirty(true);
      setSaveMessage(null);
      scheduleCanvasAutosave();
    }
  }

  const persistCanvasState = useCallback(
    async (
      nextNodes: Node<CanvasNodeData>[],
      nextEdges: Edge[],
      options?: { successMessage?: string | null },
    ) => {
      if (!selectedProjectId) return;
      setIsSaving(true);
      setCanvasError(null);
      if (options?.successMessage !== undefined) {
        setSaveMessage(null);
      }
        try {
          const response = await fetch(`${apiBaseUrl}/api/v1/projects/${selectedProjectId}/canvas`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(toApiPayload(nextNodes, nextEdges)),
        });
        if (!response.ok) {
          const detail = (await response.json().catch(() => null)) as { detail?: string } | null;
            setCanvasError(detail?.detail ?? "Canvas opslaan mislukt.");
            return;
          }
          const payload = (await response.json()) as CanvasApiResponse;
          const connectionsResponse = await fetch(`${apiBaseUrl}/api/v1/projects/${selectedProjectId}/connections`);
          const connectionPayload = connectionsResponse.ok
            ? ((await connectionsResponse.json()) as ProjectConnectionApiResponse)
            : null;
          setConnectionsById(
            Object.fromEntries((connectionPayload?.connections ?? []).map((connection) => [connection.id, connection])),
          );
          const mergedPayload: CanvasApiResponse = {
            ...payload,
            edges:
              connectionPayload && connectionPayload.connections.length > 0
                ? canvasEdgesFromConnections(connectionPayload)
                : payload.edges,
          };
          const connectionMap = Object.fromEntries(
            (connectionPayload?.connections ?? []).map((connection) => [connection.id, connection]),
          );
          const hydrated = hydrateCanvas(mergedPayload, instancesRef.current, instanceDetailsRef.current, connectionMap, {
            expandedIds: new Set(expandedInstanceIds),
            dirtyInstances,
            savingInstanceId,
          onToggleExpand: toggleExpandNode,
          onParameterChange: updateNodeParameter,
          onSave: (id) => {
            void saveNodeInstance(id);
          },
        });
        setNodes(hydrated.nodes);
        setEdges(hydrated.edges);
        saveLocalCache(hydrated.nodes, hydrated.edges);
        setDirty(false);
        if (options?.successMessage) {
          setSaveMessage(options.successMessage);
        }
      } catch {
        setCanvasError("Canvas opslaan mislukt.");
      } finally {
        setIsSaving(false);
      }
    },
    [
      apiBaseUrl,
      dirtyInstances,
      expandedInstanceIds,
      saveLocalCache,
      saveNodeInstance,
      savingInstanceId,
      selectedProjectId,
      toggleExpandNode,
      updateNodeParameter,
    ],
  );

  useEffect(() => {
    persistCanvasStateRef.current = async (nextNodes, nextEdges, options) => {
      await persistCanvasState(nextNodes, nextEdges, options);
    };
  }, [persistCanvasState]);

  const scheduleCanvasAutosave = useCallback(() => {
    if (!selectedProjectId) return;
    if (canvasAutosaveTimerRef.current !== null) {
      window.clearTimeout(canvasAutosaveTimerRef.current);
    }
    canvasAutosaveTimerRef.current = window.setTimeout(() => {
      canvasAutosaveTimerRef.current = null;
      void persistCanvasState(nodesRef.current, edgesRef.current);
    }, 700);
  }, [persistCanvasState, selectedProjectId]);

  function handleNodesChange(changes: NodeChange<Node<CanvasNodeData>>[]) {
    const nextNodes = applyNodeChanges<Node<CanvasNodeData>>(changes, nodes);
    const shouldPersist = changes.some(isPersistentNodeChange);
    setCanvasState(nextNodes, edges, shouldPersist);
  }

  function handleEdgesChange(changes: EdgeChange<Edge>[]) {
    const nextEdges = applyEdgeChanges(changes, edges);
    const shouldPersist = changes.some(isPersistentEdgeChange);
    setCanvasState(nodes, nextEdges, shouldPersist);
  }

  function handleConnect(connection: Connection) {
    if (connection.source && connection.target && connection.source === connection.target) {
      setCanvasError("Self-connections binnen dezelfde instance zijn niet toegestaan op projectniveau.");
      return;
    }
    const nextEdges = addEdge(
      {
        ...connection,
        animated: true,
      },
      edges,
    );
    setCanvasState(nodes, nextEdges);
  }

  function handleEdgeClick(_event: React.MouseEvent, edge: Edge) {
    setSelectedEdgeId(edge.id);
  }

  function handlePaneClick() {
    setSelectedEdgeId(null);
  }

  function addSelectedInstance() {
    if (!selectedInstanceId) return;
    const instance = instances.find((item) => item.id === selectedInstanceId);
    if (!instance) return;
    const nextNodes = [
      ...nodes,
      makeNode(instance, nodes.length, instanceDetails[instance.id], {
        expanded: true,
        dirty: Boolean(dirtyInstances[instance.id]),
        saving: savingInstanceId === instance.id,
        onToggleExpand: toggleExpandNode,
        onParameterChange: updateNodeParameter,
        onSave: (id) => {
          void saveNodeInstance(id);
        },
      }),
    ];
    setCanvasState(nextNodes, edges);
    setExpandedInstanceIds((current) => (current.includes(instance.id) ? current : [...current, instance.id]));
    setSelectedInstanceId("");
  }

  function clearCanvas() {
    setCanvasState([], []);
  }

  function fitPaperFrameToContent() {
    if (!contentBounds) return;
    const size = PAPER_SIZES_MM[paperConfig.paperSize];
    const paperWidthMm =
      paperConfig.orientation === "landscape" ? Math.max(size.width, size.height) : Math.min(size.width, size.height);
    const paperHeightMm =
      paperConfig.orientation === "landscape" ? Math.min(size.width, size.height) : Math.max(size.width, size.height);
    const requiredPxPerMm = Math.max(
      (contentBounds.maxX - contentBounds.minX) / paperWidthMm,
      (contentBounds.maxY - contentBounds.minY) / paperHeightMm,
    );
    const nextPxPerMm = Math.max(1, Math.ceil(requiredPxPerMm * 10) / 10 + 0.2);
    setPaperConfig((current) => ({
      ...current,
      enabled: true,
      pxPerMm: nextPxPerMm,
    }));
  }

  async function saveCanvas() {
    await persistCanvasState(nodesRef.current, edgesRef.current, { successMessage: "Canvas opgeslagen." });
  }

  async function downloadCanvasSvg() {
    if (nodes.length === 0) {
      setCanvasError("Canvas SVG export mislukt.");
      return;
    }

    try {
      const exportDate = new Intl.DateTimeFormat("nl-BE", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      const symbolCache = new Map<string, string>();
      const bounds = contentBounds ?? expandedNodeBounds(nodes);

      const exportArea = paperFrame
        ? {
            x: paperFrame.x,
            y: paperFrame.y,
            width: paperFrame.width,
            height: paperFrame.height,
            usesPaperFrame: true,
          }
        : {
            x: bounds.minX - EXPORT_MARGIN,
            y: bounds.minY - EXPORT_MARGIN,
            width: Math.max(Math.ceil(bounds.maxX - bounds.minX + EXPORT_MARGIN * 2), 1200),
            height: Math.max(Math.ceil(bounds.maxY - bounds.minY + EXPORT_MARGIN * 2), 800),
            usesPaperFrame: false,
          };

      const canvasWidth = Math.ceil(exportArea.width);
      const canvasHeight = Math.ceil(exportArea.height);
      const exportWidth = canvasWidth;
      const exportHeight = canvasHeight + EXPORT_HEADER_HEIGHT;

      const offsetX = -exportArea.x;
      const offsetY = EXPORT_HEADER_HEIGHT - exportArea.y;
      const nodeById = new Map(nodes.map((node) => [node.id, node]));

      const edgeMarkup = edges
        .map((edge) => {
          const sourceNode = nodeById.get(edge.source);
          const targetNode = nodeById.get(edge.target);
          if (!sourceNode || !targetNode) return "";

          const sourceAnchor = handleAnchorPoint(sourceNode, edge.sourceHandle);
          const targetAnchor = handleAnchorPoint(targetNode, edge.targetHandle);
          const sourceX = sourceNode.position.x + sourceAnchor.x + offsetX;
          const sourceY = sourceNode.position.y + sourceAnchor.y + offsetY;
          const targetX = targetNode.position.x + targetAnchor.x + offsetX;
          const targetY = targetNode.position.y + targetAnchor.y + offsetY;
          return `<path class="export-edge" d="${edgePath(sourceX, sourceY, targetX, targetY)}" />`;
        })
        .join("");

      const nodeMarkup = (
        await Promise.all(
          nodes.map(async (node) => {
            const x = node.position.x + offsetX;
            const y = node.position.y + offsetY;
            const width = nodeWidth(node);
            const height = nodeHeight(node);
            const symbolHref = await resolveSymbolHref(node.data.symbolSrc, symbolCache).catch(() => null);
            const visibleParameters = node.data.parameters.slice(0, 5);
            const handleMarkup = (["left", "right", "top", "bottom"] as CanvasInterfaceSide[])
              .flatMap((side) =>
                node.data.interfacesBySide[side].map((item, index) => {
                  const handles = node.data.interfacesBySide[side];
                  const offset = handles.length > 0 ? (index + 1) / (handles.length + 1) : 0.5;
                  const handleX = side === "left" ? 0 : side === "right" ? width : width * offset;
                  const handleY = side === "top" ? 0 : side === "bottom" ? height : height * offset;
                  const labelX = side === "left" ? -12 : side === "right" ? width + 12 : handleX;
                  const labelY = side === "top" ? -12 : side === "bottom" ? height + 18 : handleY + 3;
                  const labelAnchor = side === "left" ? "end" : side === "right" ? "start" : "middle";
                  const labelClass =
                    side === "top"
                      ? "export-handle-label-top"
                      : side === "bottom"
                        ? "export-handle-label-bottom"
                        : "export-handle-label-side";
                  return `
                    <circle class="export-handle" cx="${handleX}" cy="${handleY}" r="5" />
                    <text class="export-handle-label ${labelClass}" text-anchor="${labelAnchor}" x="${labelX}" y="${labelY}">${escapeXml(item.code)}</text>
                  `;
                }),
              )
              .join("");

            const parameterRows =
              visibleParameters.length === 0
                ? `<text class="export-parameter-empty" x="118" y="110">No visible parameters</text>`
                : visibleParameters
                    .map((item, index) => {
                      const rowY = 98 + index * 18;
                      return `
                        <line class="export-parameter-rule" x1="116" y1="${rowY - 12}" x2="${width - 14}" y2="${rowY - 12}" />
                        <text class="export-parameter-label" x="118" y="${rowY}">${escapeXml(truncateText(item.label, 18))}</text>
                        <text class="export-parameter-value" x="${width - 16}" y="${rowY}">${escapeXml(truncateText(item.value, 11))}</text>
                      `;
                    })
                    .join("");

            return `
              <g class="export-node" transform="translate(${x} ${y})">
                ${handleMarkup}
                <rect class="export-node-frame" x="0" y="0" width="${width}" height="${height}" rx="18" ry="18" />
                <rect class="export-node-header" x="0" y="0" width="${width}" height="42" rx="18" ry="18" />
                <rect class="export-node-header-mask" x="0" y="24" width="${width}" height="18" />
                <text class="export-node-title" x="18" y="22">${escapeXml(truncateText(node.data.name, 26))}</text>
                <text class="export-node-tag" x="${width - 18}" y="22">${escapeXml(truncateText(node.data.tag, 18))}</text>
                <rect class="export-symbol-box" x="16" y="56" width="84" height="84" rx="12" ry="12" />
                ${
                  symbolHref
                    ? `<image href="${symbolHref}" x="20" y="60" width="76" height="76" preserveAspectRatio="xMidYMid meet" />`
                    : `<text class="export-symbol-fallback" x="58" y="104">${escapeXml(node.data.typicalName.slice(0, 2).toUpperCase())}</text>`
                }
                <text class="export-node-typical" x="118" y="64">${escapeXml(truncateText(node.data.typicalName, 28))}</text>
                ${parameterRows}
              </g>
            `;
          }),
        )
      ).join("");

      const exportFrameMarkup = exportArea.usesPaperFrame
        ? `
          <rect x="0.5" y="${EXPORT_HEADER_HEIGHT + 0.5}" width="${canvasWidth - 1}" height="${canvasHeight - 1}" fill="none" stroke="rgba(18, 112, 87, 0.58)" stroke-width="2" stroke-dasharray="8 6" />
          ${
            paperConfig.showTitleBlock
              ? `<rect x="${canvasWidth - 200}" y="${exportHeight - 84}" width="180" height="56" fill="#ffffff" stroke="rgba(18, 112, 87, 0.5)" stroke-width="1.5" />
                 <text class="export-subtitle" x="${canvasWidth - 188}" y="${exportHeight - 60}">${escapeXml(truncateText(paperFrame?.label ?? "", 24))}</text>
                 <text class="export-subtitle" x="${canvasWidth - 188}" y="${exportHeight - 42}">Export preview</text>`
              : ""
          }
        `
        : "";

      const svgMarkup = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${exportWidth}" height="${exportHeight}" viewBox="0 0 ${exportWidth} ${exportHeight}">
  <defs>
    <style>
      .export-background { fill: #f3f6f5; }
      .export-header { fill: #ffffff; stroke: rgba(23, 32, 42, 0.08); stroke-width: 1; }
      .export-title { font: 700 20px "Segoe UI", sans-serif; fill: #17202a; }
      .export-subtitle { font: 500 13px "Segoe UI", sans-serif; fill: #536471; }
      .export-edge { fill: none; stroke: #127057; stroke-width: 2.25; stroke-linecap: round; stroke-linejoin: round; }
      .export-node-frame { fill: #ffffff; stroke: rgba(18, 112, 87, 0.25); stroke-width: 1.5; }
      .export-node-header { fill: #127057; }
      .export-node-header-mask { fill: #127057; }
      .export-node-title { font: 700 14px "Segoe UI", sans-serif; fill: #ffffff; dominant-baseline: middle; }
      .export-node-tag { font: 500 12px "Segoe UI", sans-serif; fill: rgba(255,255,255,0.92); text-anchor: end; dominant-baseline: middle; }
      .export-symbol-box { fill: #f3f6f5; stroke: rgba(23, 32, 42, 0.08); stroke-width: 1; }
      .export-symbol-fallback { font: 700 24px "Segoe UI", sans-serif; fill: #127057; text-anchor: middle; dominant-baseline: middle; }
      .export-node-typical { font: 600 12px "Segoe UI", sans-serif; fill: #17202a; dominant-baseline: hanging; }
      .export-parameter-rule { stroke: rgba(23, 32, 42, 0.08); stroke-width: 1; }
      .export-parameter-label { font: 600 10.5px "Segoe UI", sans-serif; fill: #344054; dominant-baseline: middle; }
      .export-parameter-value { font: 500 10.5px "Segoe UI", sans-serif; fill: #17202a; text-anchor: end; dominant-baseline: middle; }
      .export-parameter-empty { font: italic 11px "Segoe UI", sans-serif; fill: #7b8794; dominant-baseline: middle; }
      .export-handle { fill: #ffffff; stroke: #127057; stroke-width: 2; }
      .export-handle-label { font: 600 10px "Segoe UI", sans-serif; fill: #344054; text-anchor: middle; }
      .export-handle-label-top { dominant-baseline: auto; }
      .export-handle-label-bottom { dominant-baseline: hanging; }
      .export-handle-label-side { dominant-baseline: middle; }
    </style>
  </defs>
  <rect class="export-background" x="0" y="0" width="${exportWidth}" height="${exportHeight}" />
  <rect class="export-header" x="0" y="0" width="${exportWidth}" height="${EXPORT_HEADER_HEIGHT}" />
  <text class="export-title" x="28" y="34">${escapeXml(selectedProjectName || "Project canvas")}</text>
  <text class="export-subtitle" x="28" y="58">Canvas export</text>
  <text class="export-subtitle" x="${exportWidth - 28}" y="34" text-anchor="end">Date</text>
  <text class="export-subtitle" x="${exportWidth - 28}" y="58" text-anchor="end">${escapeXml(exportDate)}</text>
  ${exportFrameMarkup}
  ${edgeMarkup}
  ${nodeMarkup}
</svg>`;

      const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
      const downloadUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const safeProjectName = (selectedProjectName || "project-canvas")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      anchor.href = downloadUrl;
      anchor.download = `${safeProjectName || "project-canvas"}.svg`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(downloadUrl);
      setCanvasError(null);
      setSaveMessage("Canvas SVG gedownload.");
    } catch {
      setCanvasError("Canvas SVG export mislukt.");
      return;
    }
  }

  async function downloadCanvasImage() {
    const shell = canvasShellRef.current;
    if (!shell) {
      setCanvasError("Canvas image export mislukt.");
      return;
    }

    const exportRoot = shell.querySelector(".react-flow");
    if (!(exportRoot instanceof HTMLElement)) {
      setCanvasError("Canvas image export mislukt.");
      return;
    }

    try {
      const dataUrl = await toPng(exportRoot, {
        cacheBust: true,
        backgroundColor: "#f3f6f5",
        pixelRatio: 2,
        filter: (node) => {
          if (!(node instanceof HTMLElement)) {
            return true;
          }
          return !(
            node.classList.contains("react-flow__minimap") ||
            node.classList.contains("react-flow__controls") ||
            node.classList.contains("react-flow__attribution")
          );
        },
      });

      const anchor = document.createElement("a");
      const safeProjectName = (selectedProjectName || "project-canvas")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      anchor.href = dataUrl;
      anchor.download = `${safeProjectName || "project-canvas"}.png`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      setCanvasError(null);
      setSaveMessage("Canvas image gedownload.");
    } catch {
      setCanvasError("Canvas image export mislukt.");
    }
  }

  if (!selectedProjectId) {
    return (
      <div className="editor-panel workspace-placeholder">
        <div className="editor-header">
          <h3>Project canvas</h3>
        </div>
        <p className="empty-state">
          Open eerst een project vanuit `Overview` of `Workspace` om instances op een canvas te plaatsen.
        </p>
      </div>
    );
  }

  return (
    <div className="workspace-layout">
      <div className="workspace-sidebar">
        <div className="editor-panel">
          <div className="editor-header">
            <div>
              <h3>Canvas source</h3>
              <p className="section-caption">
                Voeg instances uit project <strong>{selectedProjectName}</strong> toe aan het canvas.
              </p>
            </div>
          </div>
          <label className="field">
            <span>Available instance</span>
            <select value={selectedInstanceId} onChange={(event) => setSelectedInstanceId(event.target.value)}>
              <option value="">Select instance</option>
              {availableInstances.map((instance) => (
                <option key={instance.id} value={instance.id}>
                  {instance.name} · {instance.tag}
                </option>
              ))}
            </select>
          </label>
          <div className="editor-actions">
            <button disabled={!selectedInstanceId} onClick={addSelectedInstance} type="button">
              Add to canvas
            </button>
            <button className="secondary-button" onClick={clearCanvas} type="button">
              Clear canvas
            </button>
          </div>
        </div>

        <div className="editor-panel">
          <div className="editor-header">
            <div>
              <h3>Canvas status</h3>
              <p className="section-caption">
                Canvas state is cached locally and now persisted to the backend per project.
              </p>
            </div>
          </div>
          <div className="instance-status-grid">
            <article className="status-card compact-status">
              <span className="label">Nodes</span>
              <strong>{nodes.length}</strong>
            </article>
            <article className="status-card compact-status">
              <span className="label">Edges</span>
              <strong>{edges.length}</strong>
            </article>
            <article className="status-card compact-status">
              <span className="label">State</span>
              <strong>{dirty ? "Unsaved changes" : "Saved"}</strong>
              <small>{isLoading ? "Loading from backend" : "Backend synced"}</small>
            </article>
          </div>
          <div className="editor-actions">
            <button disabled={isSaving || isLoading} onClick={() => void saveCanvas()} type="button">
              {isSaving ? "Saving..." : "Save canvas"}
            </button>
            <button className="secondary-button" onClick={() => void downloadCanvasSvg()} type="button">
              Download SVG
            </button>
          </div>
        </div>

        <div className="editor-panel">
          <div className="editor-header">
            <div>
              <h3>SVG export preview</h3>
              <p className="section-caption">
                Toon een documentkader op het canvas om te zien of de inhoud ongeveer binnen een blad past.
              </p>
            </div>
          </div>
          <label className="checkbox-field">
            <input
              checked={paperConfig.enabled}
              onChange={(event) =>
                setPaperConfig((current) => ({
                  ...current,
                  enabled: event.target.checked,
                }))
              }
              type="checkbox"
            />
            <span>Show paper frame</span>
          </label>
          <label className="field">
            <span>Paper size</span>
            <select
              value={paperConfig.paperSize}
              onChange={(event) =>
                setPaperConfig((current) => ({
                  ...current,
                  paperSize: event.target.value as PaperSizeKey,
                }))
              }
            >
              {(["A0", "A1", "A2", "A3", "A4"] as PaperSizeKey[]).map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Orientation</span>
            <select
              value={paperConfig.orientation}
              onChange={(event) =>
                setPaperConfig((current) => ({
                  ...current,
                  orientation: event.target.value as PaperOrientation,
                }))
              }
            >
              <option value="landscape">Landscape</option>
              <option value="portrait">Portrait</option>
            </select>
          </label>
          <label className="field">
            <span>Preview scale</span>
            <select
              value={String(paperConfig.pxPerMm)}
              onChange={(event) =>
                setPaperConfig((current) => ({
                  ...current,
                  pxPerMm: Number(event.target.value),
                }))
              }
            >
              <option value="1">1 px/mm</option>
              <option value="2">2 px/mm</option>
              <option value="3">3 px/mm</option>
              <option value="4">4 px/mm</option>
              <option value="5">5 px/mm</option>
              <option value="6">6 px/mm</option>
              <option value="8">8 px/mm</option>
              <option value="10">10 px/mm</option>
              <option value="12">12 px/mm</option>
            </select>
          </label>
          <div className="editor-actions">
            <button className="secondary-button" disabled={!contentBounds} onClick={fitPaperFrameToContent} type="button">
              Fit frame to content
            </button>
          </div>
          <label className="checkbox-field">
            <input
              checked={paperConfig.showTitleBlock}
              onChange={(event) =>
                setPaperConfig((current) => ({
                  ...current,
                  showTitleBlock: event.target.checked,
                }))
              }
              type="checkbox"
            />
            <span>Show title block</span>
          </label>
          {paperFrame ? (
            <div className="canvas-paper-meta">
              <strong>{paperFrame.label}</strong>
              {paperFrameFit ? (
                <small className={paperFrameFit.fits ? "fit-ok" : "fit-warning"}>
                  {paperFrameFit.fits ? "Current content fits inside the selected frame." : "Current content exceeds the selected frame."}
                </small>
              ) : null}
              <small>
                Preview only. Zonder formele modelschaal is dit een visuele documentcheck en geen definitieve printscale.
              </small>
            </div>
          ) : null}
        </div>

        <div className="editor-panel">
          <div className="editor-header">
            <div>
              <h3>Instances on canvas</h3>
              <p className="section-caption">Current project instances that are already placed on the canvas.</p>
            </div>
          </div>
          <div className="list-panel">
            {nodes.length === 0 ? (
              <p className="empty-state">Nog geen instances op het canvas.</p>
            ) : (
              nodes.map((node) => {
                const instance = instances.find((item) => item.id === node.id);
                return (
                  <article className="typical-card" key={node.id}>
                    <div className="typical-card-body">
                      <strong>{instance?.name ?? node.id}</strong>
                      <small>{instance?.tag ?? "No tag"}</small>
                      <small>{instance?.typical_name ?? "Unknown typical"}</small>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="workspace-detail">
        {selectedConnection ? (
          <div className="editor-panel">
            <div className="editor-header">
              <div>
                <h3>Connection</h3>
                <p className="section-caption">
                  {selectedConnection.source_interface_code} → {selectedConnection.target_interface_code}
                </p>
              </div>
            </div>
            <div className="field-grid">
              <label className="field">
                <span>Connection kind</span>
                <input readOnly value={selectedConnection.connection_kind} />
              </label>
              <label className="field">
                <span>Implementation</span>
                <select
                  value={selectedConnection.implementation_kind}
                  onChange={(event) => {
                    void updateSelectedConnectionImplementation(event.target.value);
                  }}
                >
                  {IMPLEMENTATION_KIND_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ) : null}

        <div className="editor-panel">
          <div className="editor-header">
            <div>
              <h3>Canvas</h3>
              <p className="section-caption">
                Place instances, move them freely and connect them. This version stores canvas state per project in the backend.
              </p>
            </div>
            <div className="editor-actions">
              <button className="secondary-button" onClick={() => void downloadCanvasImage()} type="button">
                Download image
              </button>
            </div>
          </div>
          {canvasError ? <p className="error-message">{canvasError}</p> : null}
          {saveMessage ? <p className="success-message">{saveMessage}</p> : null}
          <div className="project-canvas-shell" ref={canvasShellRef}>
            <ReactFlowProvider>
              <CanvasFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                onConnect={handleConnect}
                onEdgeClick={handleEdgeClick}
                onPaneClick={handlePaneClick}
                paperFrame={paperFrame}
                showTitleBlock={paperConfig.showTitleBlock}
                edgeRefreshKey={edgeRefreshKey}
              />
            </ReactFlowProvider>
          </div>
        </div>
      </div>
    </div>
  );
}
