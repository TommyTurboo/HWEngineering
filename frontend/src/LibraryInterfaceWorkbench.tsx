import {
  Background,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { memo, useMemo, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";

type EtimClassSummary = {
  id: string;
  description: string;
  version: string | null;
  group_id: string | null;
};

type EtimClassDetail = EtimClassSummary & {
  features: {
    art_class_feature_nr: string;
    feature_id: string;
    feature_description: string | null;
    feature_group_description: string | null;
    feature_type: string | null;
    unit_description: string | null;
    values: { value_id: string; value_description: string | null }[];
  }[];
};

type WorkbenchParameter = {
  feature_key: string;
  code: string;
  name: string;
  input_type: string;
  default_value: string;
  allowed_values: string[];
  allowed_values_text?: string;
  required: boolean;
  is_parametrizable: boolean;
  drives_interfaces: boolean;
  show_on_canvas: boolean;
};

type WorkbenchGroup = {
  local_key: string;
  code: string;
  name: string;
  category: string;
  side: string;
};

type WorkbenchMappingRule = {
  local_key: string;
  driver_parameter_code: string;
  driver_value: string;
  group_code: string | null;
  interface_code: string;
  direction: string;
};

type WorkbenchInterface = {
  local_key?: string;
  code: string;
  group_code: string | null;
  role: string;
  logical_type: string;
  direction: string;
  source: "derived" | "override";
  side?: string | null;
  side_order?: number;
  sort_order: number;
};

type ValidationIssue = {
  severity: string;
  code: string;
  message: string;
  parameter_code?: string | null;
  parameter_name?: string | null;
  interface_code?: string | null;
};

type WorkbenchPreviewInterface = {
  group_code: string | null;
  code: string;
  role: string;
  logical_type: string;
  direction: string;
  side: string;
  side_order: number;
  source: string;
  origin: string;
  sort_order: number;
};

type WorkbenchDerivationRow = {
  parameter_code: string;
  parameter_name: string;
  driver_value: string;
  loading: boolean;
  preview: {
    interfaces: WorkbenchPreviewInterface[];
    origin_status: string;
    validation_issues: ValidationIssue[];
  } | null;
  error: string | null;
};

type WorkbenchTypicalSummary = {
  id: string;
  name: string;
  code: string;
  etim_class_id: string;
  etim_class_description: string;
  status: string;
  version: number;
};

type Props = {
  classes: EtimClassSummary[];
  typicals: WorkbenchTypicalSummary[];
  selectedTypicalId: string | null;
  selectedClassId: string;
  selectedClass: EtimClassSummary | undefined;
  classDetail: EtimClassDetail | null;
  mode: "create" | "edit";
  selectedTypicalStatus: "draft" | "released";
  selectedTypicalVersion: number;
  typicalName: string;
  typicalCode: string;
  typicalDescription: string;
  definitions: WorkbenchParameter[];
  interfaceGroups: WorkbenchGroup[];
  interfaceMappingRules: WorkbenchMappingRule[];
  interfaces: WorkbenchInterface[];
  disabledInterfaceCodes: string[];
  derivationRows: WorkbenchDerivationRow[];
  validationIssues: ValidationIssue[];
  isReleasedTypical: boolean;
  submitting: boolean;
  validating: boolean;
  loadingTypical: boolean;
  onSelectClass: (classId: string) => void;
  onTypicalNameChange: (value: string) => void;
  onTypicalCodeChange: (value: string) => void;
  onTypicalDescriptionChange: (value: string) => void;
  onAddLocalParameter: () => void;
  onUpdateDefinition: (featureKey: string, patch: Partial<WorkbenchParameter>) => void;
  onAddInterfaceGroup: () => void;
  onUpdateInterfaceGroup: (localKey: string, patch: Partial<WorkbenchGroup>) => void;
  onDeleteInterfaceGroup: (localKey: string) => void;
  onAddInterfaceMappingRule: () => void;
  onUpdateInterfaceMappingRule: (localKey: string, patch: Partial<WorkbenchMappingRule>) => void;
  onDeleteInterfaceMappingRule: (localKey: string) => void;
  onUpdateInterfaceLayout: (
    interfaceCode: string,
    patch: Partial<Pick<WorkbenchInterface, "side" | "side_order" | "sort_order">>,
    baseInterface: WorkbenchPreviewInterface | WorkbenchInterface,
  ) => void;
  onDisableInterface: (interfaceCode: string) => void;
  onRestoreInterface: (interfaceCode: string) => void;
  onAddOverrideInterface: () => void;
  onUpdateInterfaceOverride: (localKey: string, patch: Partial<WorkbenchInterface>) => void;
  onDeleteInterfaceOverride: (localKey: string) => void;
  onNewTypical: () => void;
  onSaveTypical: () => void;
  onValidateTypical: () => void;
  onReleaseTypical: () => void;
  onCreateDraftFromReleased: () => void;
  onOpenTypical: (typicalId: string) => void;
};

function DenseRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "168px minmax(0, 1fr)" },
        alignItems: "center",
        gap: 1,
        minHeight: 40,
      }}
    >
      <Typography color="text.secondary" fontSize={13} fontWeight={700}>
        {label}
      </Typography>
      {children}
    </Box>
  );
}

type PreviewNodeData = {
  title: string;
  subtitle: string;
  interfacesBySide: Record<"left" | "right" | "top" | "bottom", WorkbenchPreviewInterface[]>;
};

const SIDE_POSITION: Record<"left" | "right" | "top" | "bottom", Position> = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
};

function handleOffset(index: number, total: number): string {
  return `${((index + 1) * 100) / (total + 1)}%`;
}

const TypicalPreviewNode = memo(function TypicalPreviewNode({ data }: NodeProps<Node<PreviewNodeData>>) {
  return (
    <Box
      sx={(theme) => ({
        width: 320,
        minHeight: 172,
        border: `1px solid ${theme.palette.divider}`,
        borderRadius: 1,
        bgcolor: theme.palette.background.paper,
        boxShadow: theme.shadows[2],
        position: "relative",
      })}
    >
      {(["left", "right", "top", "bottom"] as const).flatMap((side) =>
        data.interfacesBySide[side].map((item, index) => {
          const total = data.interfacesBySide[side].length;
          const style =
            side === "left" || side === "right"
              ? { top: handleOffset(index, total), [side]: -1, transform: "translateY(-50%)" }
              : { left: handleOffset(index, total), [side]: -1, transform: "translateX(-50%)" };
          return (
            <Box
              key={`${side}-${item.code}`}
              sx={{
                position: "absolute",
                zIndex: 5,
                pointerEvents: "none",
                ...style,
              }}
            >
              <Handle
                id={item.code}
                position={SIDE_POSITION[side]}
                type={item.direction === "out" ? "source" : "target"}
                style={{ width: 10, height: 10 }}
              />
              <Typography
                component="span"
                sx={{
                  position: "absolute",
                  whiteSpace: "nowrap",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "text.secondary",
                  ...(side === "left"
                    ? { right: 12, top: -8 }
                    : side === "right"
                      ? { left: 12, top: -8 }
                      : side === "top"
                        ? { top: -20, left: "50%", transform: "translateX(-50%)" }
                        : { bottom: -20, left: "50%", transform: "translateX(-50%)" }),
                }}
              >
                {item.code}
              </Typography>
            </Box>
          );
        }),
      )}
      <Box sx={{ p: 1.5, display: "grid", gap: 0.75, minHeight: 172, alignContent: "center" }}>
        <Typography fontSize={14} fontWeight={900} textAlign="center">
          {data.title || "Draft typical"}
        </Typography>
        <Typography color="text.secondary" fontSize={12} textAlign="center">
          {data.subtitle}
        </Typography>
      </Box>
    </Box>
  );
});

const previewNodeTypes = { typicalPreview: TypicalPreviewNode };

export default function LibraryInterfaceWorkbench({
  classes,
  typicals,
  selectedTypicalId,
  selectedClassId,
  selectedClass,
  classDetail,
  mode,
  selectedTypicalStatus,
  selectedTypicalVersion,
  typicalName,
  typicalCode,
  typicalDescription,
  definitions,
  interfaceGroups,
  interfaceMappingRules,
  interfaces,
  disabledInterfaceCodes,
  derivationRows,
  validationIssues,
  isReleasedTypical,
  submitting,
  validating,
  loadingTypical,
  onSelectClass,
  onTypicalNameChange,
  onTypicalCodeChange,
  onTypicalDescriptionChange,
  onAddLocalParameter,
  onUpdateDefinition,
  onAddInterfaceGroup,
  onUpdateInterfaceGroup,
  onDeleteInterfaceGroup,
  onAddInterfaceMappingRule,
  onUpdateInterfaceMappingRule,
  onDeleteInterfaceMappingRule,
  onUpdateInterfaceLayout,
  onDisableInterface,
  onRestoreInterface,
  onAddOverrideInterface,
  onUpdateInterfaceOverride,
  onDeleteInterfaceOverride,
  onNewTypical,
  onSaveTypical,
  onValidateTypical,
  onReleaseTypical,
  onCreateDraftFromReleased,
  onOpenTypical,
}: Props) {
  const driverParameters = definitions.filter((definition) => definition.drives_interfaces);
  const previewIssueCount = derivationRows.reduce(
    (total, row) => total + (row.preview?.validation_issues.length ?? 0) + (row.error ? 1 : 0),
    0,
  );
  const missingDriver = definitions.length > 0 && driverParameters.length === 0;
  const emptyMapping = interfaceMappingRules.length === 0;
  const [selectedPreviewKey, setSelectedPreviewKey] = useState("");
  const selectedPreviewRow =
    derivationRows.find((row) => `${row.parameter_code}:${row.driver_value}` === selectedPreviewKey) ??
    derivationRows[0] ??
    null;
  const selectedTypical = useMemo(
    () => typicals.find((typical) => typical.id === selectedTypicalId) ?? null,
    [selectedTypicalId, typicals],
  );
  const typicalCounts = useMemo(
    () =>
      typicals.reduce(
        (counts, typical) => ({
          total: counts.total + 1,
          draft: counts.draft + (typical.status === "draft" ? 1 : 0),
          released: counts.released + (typical.status === "released" ? 1 : 0),
        }),
        { total: 0, draft: 0, released: 0 },
      ),
    [typicals],
  );
  const layoutByCode = useMemo(
    () =>
      new Map(
        interfaces.map((item) => [
          item.code.toUpperCase(),
          {
            side: selectableSide(item.side ?? ""),
            side_order: item.side_order ?? 0,
            sort_order: item.side_order ?? item.sort_order ?? 0,
          },
        ]),
      ),
    [interfaces],
  );
  const overrideInterfaces = useMemo(
    () => interfaces.filter((item) => item.source === "override"),
    [interfaces],
  );
  const disabledCodes = useMemo(
    () => new Set(disabledInterfaceCodes.map((code) => code.toUpperCase())),
    [disabledInterfaceCodes],
  );
  const issuesByInterface = useMemo(() => {
    const result = new Map<string, ValidationIssue[]>();
    for (const issue of [
      ...validationIssues,
      ...derivationRows.flatMap((row) => row.preview?.validation_issues ?? []),
    ]) {
      const code = issue.interface_code?.trim().toUpperCase();
      if (!code) continue;
      result.set(code, [...(result.get(code) ?? []), issue]);
    }
    return result;
  }, [derivationRows, validationIssues]);
  const previewInterfaces = useMemo(
    () =>
      (selectedPreviewRow?.preview?.interfaces ?? [])
        .filter((item) => !disabledCodes.has(item.code.toUpperCase()))
        .map((item) => {
          const override = layoutByCode.get(item.code.toUpperCase());
          return {
            ...item,
            side: selectableSide(override?.side || item.side),
            side_order: override?.side_order ?? item.side_order,
            sort_order: override?.sort_order ?? item.sort_order,
          };
        })
        .sort((left, right) => left.side.localeCompare(right.side) || left.side_order - right.side_order || left.code.localeCompare(right.code)),
    [disabledCodes, layoutByCode, selectedPreviewRow],
  );
  const interfacesBySide = useMemo(
    () =>
      previewInterfaces.reduce<Record<"left" | "right" | "top" | "bottom", WorkbenchPreviewInterface[]>>(
        (result, item) => {
          const side = selectableSide(item.side) || "left";
          result[side as "left" | "right" | "top" | "bottom"].push({ ...item, side });
          return result;
        },
        { left: [], right: [], top: [], bottom: [] },
      ),
    [previewInterfaces],
  );
  const previewNodes = useMemo<Node<PreviewNodeData>[]>(
    () => [
      {
        id: "typical-preview-node",
        type: "typicalPreview",
        position: { x: 220, y: 120 },
        data: {
          title: typicalCode || typicalName || "Draft typical",
          subtitle: selectedPreviewRow
            ? `${selectedPreviewRow.parameter_code} = ${selectedPreviewRow.driver_value}`
            : "Geen driver value geselecteerd",
          interfacesBySide,
        },
        draggable: false,
      },
    ],
    [interfacesBySide, selectedPreviewRow, typicalCode, typicalName],
  );

  function handleAllowedValuesChange(
    definition: WorkbenchParameter,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const allowedValues = event.target.value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    onUpdateDefinition(definition.feature_key, {
      allowed_values: allowedValues,
      allowed_values_text: event.target.value,
    } as Partial<WorkbenchParameter>);
  }

  function selectableSide(side: string): string {
    return ["left", "right", "top", "bottom"].includes(side) ? side : "";
  }

  return (
    <Box
      sx={(theme) => ({
        display: "grid",
        gap: 1.5,
        color: theme.palette.text.primary,
      })}
    >
      <Box
        sx={(theme) => ({
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          minHeight: 44,
          px: 1.25,
          py: 0.75,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
          bgcolor: theme.palette.background.paper,
        })}
      >
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Typography fontSize={14} fontWeight={800}>
            Interface Workbench
          </Typography>
          <Chip size="small" label={`${selectedTypicalStatus} v${selectedTypicalVersion}`} />
          {loadingTypical ? <Chip size="small" label="Laden" variant="outlined" /> : null}
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Box sx={{ display: "grid", gap: 0.25, minWidth: { xs: 220, sm: 320 } }}>
            <Typography color="text.secondary" fontSize={11} fontWeight={700}>
              Open typical
            </Typography>
            <Box
              component="select"
              data-testid="workbench-open-typical"
              value={selectedTypicalId ?? ""}
              disabled={loadingTypical || typicals.length === 0}
              onChange={(event) => {
                if (event.target.value) {
                  onOpenTypical(event.target.value);
                }
              }}
              sx={(theme) => ({
                height: 32,
                px: 1,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 1,
                bgcolor: theme.palette.background.paper,
                color: theme.palette.text.primary,
                font: "inherit",
                fontSize: 13,
              })}
            >
              <option value="">Geen selectie</option>
              {typicals.map((typical) => (
                <option key={typical.id} value={typical.id}>
                  {typical.code} · {typical.name} · {typical.status} v{typical.version}
                </option>
              ))}
            </Box>
          </Box>
          {isReleasedTypical ? (
            <Button size="small" variant="outlined" onClick={onCreateDraftFromReleased}>
              Nieuwe draft
            </Button>
          ) : null}
          {mode === "edit" && !isReleasedTypical ? (
            <Button size="small" variant="outlined" onClick={onReleaseTypical}>
              Release
            </Button>
          ) : null}
          <Button size="small" variant="outlined" onClick={onNewTypical}>
            Nieuw
          </Button>
          <Button
            size="small"
            variant="outlined"
            disabled={!selectedClassId || validating}
            onClick={onValidateTypical}
          >
            {validating ? "Valideren" : "Valideer"}
          </Button>
          <Button
            size="small"
            variant="contained"
            disabled={!selectedClassId || submitting || isReleasedTypical}
            onClick={onSaveTypical}
          >
            {submitting ? "Opslaan" : mode === "edit" ? "Opslaan" : "Aanmaken"}
          </Button>
        </Stack>
      </Box>

      <Box
        sx={(theme) => ({
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) auto" },
          alignItems: "center",
          gap: 1,
          px: 1.25,
          py: 0.75,
          border: `1px solid ${theme.palette.divider}`,
          borderRadius: 1,
          bgcolor: theme.palette.background.paper,
        })}
      >
        <Box minWidth={0}>
          <Typography noWrap fontSize={13} fontWeight={800} data-testid="workbench-selected-typical">
            {selectedTypical
              ? `${selectedTypical.code} · ${selectedTypical.name}`
              : mode === "edit"
                ? `${typicalCode || "Onbekende typical"} · ${typicalName || "zonder naam"}`
                : "Nieuwe draft typical"}
          </Typography>
          <Typography noWrap color="text.secondary" fontSize={12}>
            {selectedTypical
              ? `${selectedTypical.etim_class_id} · ${selectedTypical.etim_class_description}`
              : selectedClass
                ? `${selectedClass.id} · ${selectedClass.description}`
                : "Geen ETIM klasse geselecteerd"}
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.75} flexWrap="wrap" useFlexGap justifyContent="flex-end">
          <Chip size="small" variant="outlined" label={`${typicalCounts.total} typicals`} />
          <Chip size="small" variant="outlined" label={`${typicalCounts.released} released`} />
          <Chip size="small" variant="outlined" label={`${typicalCounts.draft} drafts`} />
          <Chip size="small" label={`${definitions.length} parameters`} />
          <Chip size="small" label={`${interfaceMappingRules.length} mappings`} />
          <Chip size="small" label={`${previewInterfaces.length} preview interfaces`} />
        </Stack>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", xl: "minmax(420px, 0.9fr) minmax(520px, 1.1fr)" },
          gap: 1.5,
        }}
      >
        <Box
          sx={(theme) => ({
            display: "grid",
            gap: 1.25,
            p: 1.5,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
            bgcolor: theme.palette.background.paper,
          })}
        >
          <Typography fontSize={13} fontWeight={800}>
            Typical
          </Typography>
          <DenseRow label="ETIM klasse">
            <Box
              component="select"
              value={selectedClassId}
              disabled={isReleasedTypical}
              onChange={(event) => onSelectClass(event.target.value)}
              sx={(theme) => ({
                width: "100%",
                height: 38,
                px: 1,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 1,
                bgcolor: theme.palette.background.paper,
                color: theme.palette.text.primary,
                font: "inherit",
                fontSize: 13,
              })}
            >
              <option value="">Selecteer ETIM klasse</option>
              {selectedClass && !classes.some((item) => item.id === selectedClass.id) ? (
                <option value={selectedClass.id}>
                  {selectedClass.id} · {selectedClass.description}
                </option>
              ) : null}
              {classes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.id} · {item.description}
                </option>
              ))}
            </Box>
          </DenseRow>
          <DenseRow label="Naam">
            <TextField
              size="small"
              value={typicalName}
              disabled={isReleasedTypical}
              onChange={(event) => onTypicalNameChange(event.target.value)}
            />
          </DenseRow>
          <DenseRow label="Code">
            <TextField
              size="small"
              value={typicalCode}
              disabled={isReleasedTypical}
              onChange={(event) => onTypicalCodeChange(event.target.value)}
            />
          </DenseRow>
          <DenseRow label="Beschrijving">
            <TextField
              size="small"
              value={typicalDescription}
              disabled={isReleasedTypical}
              onChange={(event) => onTypicalDescriptionChange(event.target.value)}
            />
          </DenseRow>
          {!selectedClass ? (
            <Typography color="text.secondary" fontSize={13}>
              Geen ETIM-classificatie gekozen.
            </Typography>
          ) : null}
          {selectedClass && !classDetail ? (
            <Typography color="text.secondary" fontSize={13}>
              ETIM-features zijn nog niet geladen.
            </Typography>
          ) : null}

          <Divider />

          <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
            <Typography fontSize={13} fontWeight={800}>
              React Flow preview
            </Typography>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Driver value</InputLabel>
              <Select
                data-testid="workbench-preview-driver-value"
                label="Driver value"
                value={
                  selectedPreviewRow
                    ? `${selectedPreviewRow.parameter_code}:${selectedPreviewRow.driver_value}`
                    : ""
                }
                onChange={(event) => setSelectedPreviewKey(event.target.value)}
              >
                {derivationRows.length === 0 ? (
                  <MenuItem value="">Geen preview</MenuItem>
                ) : (
                  derivationRows.map((row) => (
                    <MenuItem key={`${row.parameter_code}:${row.driver_value}`} value={`${row.parameter_code}:${row.driver_value}`}>
                      {row.driver_value}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
          </Stack>
          <Box
            sx={(theme) => ({
              height: 360,
              minHeight: 360,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 1,
              overflow: "hidden",
              bgcolor: theme.palette.background.default,
            })}
          >
            {previewInterfaces.length === 0 ? (
              <Box sx={{ height: "100%", display: "grid", placeItems: "center", px: 2 }}>
                <Typography color="text.secondary" fontSize={13} textAlign="center">
                  Geen resolved interfaces voor deze driverwaarde.
                </Typography>
              </Box>
            ) : (
              <ReactFlowProvider>
                <ReactFlow
                  nodes={previewNodes}
                  edges={[]}
                  nodeTypes={previewNodeTypes}
                  fitView
                  fitViewOptions={{ padding: 0.28 }}
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable={false}
                  proOptions={{ hideAttribution: true }}
                >
                  <Background gap={16} size={1} />
                  <Controls showInteractive={false} />
                </ReactFlow>
              </ReactFlowProvider>
            )}
          </Box>

          <Box sx={{ display: "grid", gap: 0.75 }}>
            <Typography color="text.secondary" fontSize={12} fontWeight={800}>
              Interface layout
            </Typography>
            {previewInterfaces.length === 0 ? (
              <Typography color="text.secondary" fontSize={13}>
                Kies een driverwaarde met resolved interfaces.
              </Typography>
            ) : (
              previewInterfaces.map((item) => (
                <Box
                  key={`layout-${item.code}`}
                  sx={(theme) => ({
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 116px 88px" },
                    gap: 0.75,
                    alignItems: "center",
                    p: 0.75,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 1,
                  })}
                >
                  <Box minWidth={0}>
                    <Typography noWrap fontSize={13} fontWeight={800}>
                      {item.code}
                    </Typography>
                    <Typography noWrap color="text.secondary" fontSize={12}>
                      {item.direction} · {item.role}
                    </Typography>
                  </Box>
                  <FormControl size="small">
                    <InputLabel>Side</InputLabel>
                    <Select
                      label="Side"
                      value={selectableSide(item.side)}
                      disabled={isReleasedTypical}
                      onChange={(event) =>
                        onUpdateInterfaceLayout(item.code, { side: event.target.value }, item)
                      }
                    >
                      <MenuItem value="left">left</MenuItem>
                      <MenuItem value="right">right</MenuItem>
                      <MenuItem value="top">top</MenuItem>
                      <MenuItem value="bottom">bottom</MenuItem>
                    </Select>
                  </FormControl>
                  <TextField
                    size="small"
                    label="Order"
                    type="number"
                    value={item.side_order}
                    disabled={isReleasedTypical}
                    onChange={(event) =>
                      onUpdateInterfaceLayout(item.code, {
                        side_order: Number(event.target.value),
                        sort_order: Number(event.target.value),
                      }, item)
                    }
                  />
                </Box>
              ))
            )}
          </Box>
        </Box>

        <Box
          sx={(theme) => ({
            display: "grid",
            gap: 1,
            p: 1.5,
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: 1,
            bgcolor: theme.palette.background.paper,
          })}
        >
          <Typography fontSize={13} fontWeight={800}>
            Interfaceconfiguratie
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(4, minmax(0, 1fr))" },
              gap: 1,
            }}
          >
            <FormControl size="small">
              <InputLabel>Driver</InputLabel>
              <Select label="Driver" value={driverParameters[0]?.code ?? ""}>
                {driverParameters.length === 0 ? (
                  <MenuItem value="">Geen driver</MenuItem>
                ) : (
                  driverParameters.map((definition) => (
                    <MenuItem key={definition.code} value={definition.code}>
                      {definition.code}
                    </MenuItem>
                  ))
                )}
              </Select>
            </FormControl>
            <TextField size="small" label="Parameters" value={definitions.length} InputProps={{ readOnly: true }} />
            <TextField size="small" label="Groepen" value={interfaceGroups.length} InputProps={{ readOnly: true }} />
            <TextField size="small" label="Interfaces" value={interfaces.length} InputProps={{ readOnly: true }} />
          </Box>

          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {missingDriver ? <Alert severity="warning" sx={{ py: 0 }}>Geen interface-driver ingesteld.</Alert> : null}
            {emptyMapping ? <Alert severity="warning" sx={{ py: 0 }}>Geen interface mappings.</Alert> : null}
            {previewIssueCount > 0 ? (
              <Alert severity="error" sx={{ py: 0 }}>
                {previewIssueCount} preview issue{previewIssueCount === 1 ? "" : "s"}
              </Alert>
            ) : null}
          </Stack>

          <Divider />

          <Box
            sx={{
              display: "grid",
              gap: 0.75,
            }}
          >
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
              <Typography color="text.secondary" fontSize={12} fontWeight={800}>
                Parameter governance
              </Typography>
              <Button size="small" variant="outlined" disabled={isReleasedTypical} onClick={onAddLocalParameter}>
                Lokale parameter
              </Button>
            </Stack>
            {definitions.length === 0 ? (
              <Typography color="text.secondary" fontSize={13}>
                Selecteer ETIM-features of voeg een lokale parameter toe.
              </Typography>
            ) : (
              definitions.map((definition) => (
                <Box
                  key={definition.feature_key}
                  sx={(theme) => ({
                    display: "grid",
                    gridTemplateColumns: {
                      xs: "1fr",
                      lg: "minmax(130px, 0.8fr) minmax(100px, 0.6fr) minmax(110px, 0.7fr) minmax(150px, 1fr) 78px 78px",
                    },
                    gap: 0.75,
                    alignItems: "center",
                    p: 0.75,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 1,
                  })}
                >
                  <TextField
                    size="small"
                    label="Naam"
                    value={definition.name}
                    disabled={isReleasedTypical}
                    onChange={(event) => onUpdateDefinition(definition.feature_key, { name: event.target.value })}
                  />
                  <TextField
                    size="small"
                    label="Code"
                    value={definition.code}
                    disabled={isReleasedTypical}
                    onChange={(event) => onUpdateDefinition(definition.feature_key, { code: event.target.value })}
                  />
                  <TextField
                    size="small"
                    label="Default"
                    value={definition.default_value}
                    disabled={isReleasedTypical}
                    onChange={(event) => onUpdateDefinition(definition.feature_key, { default_value: event.target.value })}
                  />
                  <TextField
                    size="small"
                    label="Allowed"
                    value={definition.allowed_values_text ?? definition.allowed_values.join(", ")}
                    disabled={isReleasedTypical}
                    onChange={(event) => handleAllowedValuesChange(definition, event)}
                  />
                  <Button
                    size="small"
                    variant={definition.drives_interfaces ? "contained" : "outlined"}
                    disabled={isReleasedTypical}
                    onClick={() =>
                      onUpdateDefinition(definition.feature_key, {
                        drives_interfaces: !definition.drives_interfaces,
                      })
                    }
                  >
                    Driver
                  </Button>
                  <Button
                    size="small"
                    variant={definition.show_on_canvas ? "contained" : "outlined"}
                    disabled={isReleasedTypical}
                    onClick={() =>
                      onUpdateDefinition(definition.feature_key, {
                        show_on_canvas: !definition.show_on_canvas,
                      })
                    }
                  >
                    Canvas
                  </Button>
                </Box>
              ))
            )}
          </Box>

          <Divider />

          <Box sx={{ display: "grid", gap: 0.75 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
              <Typography color="text.secondary" fontSize={12} fontWeight={800}>
                Driver value matrix
              </Typography>
              <Button size="small" variant="outlined" disabled={isReleasedTypical} onClick={onAddInterfaceMappingRule}>
                Mapping
              </Button>
            </Stack>
            {derivationRows.length === 0 ? (
              <Typography color="text.secondary" fontSize={13}>
                Markeer een parameter als driver en voeg waarden toe om de matrix te vullen.
              </Typography>
            ) : (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", xl: "repeat(2, minmax(0, 1fr))" },
                  gap: 0.75,
                }}
              >
                {derivationRows.map((row) => {
                  const issues = row.preview?.validation_issues ?? [];
                  return (
                    <Box
                      key={`${row.parameter_code}-${row.driver_value}`}
                      sx={(theme) => ({
                        display: "grid",
                        gap: 0.5,
                        p: 0.75,
                        border: `1px solid ${issues.length > 0 || row.error ? theme.palette.error.main : theme.palette.divider}`,
                        borderRadius: 1,
                      })}
                    >
                      <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap" useFlexGap>
                        <Typography fontSize={13} fontWeight={800}>
                          {row.driver_value}
                        </Typography>
                        <Chip size="small" variant="outlined" label={row.parameter_code} />
                        <Chip
                          size="small"
                          color={row.preview?.origin_status === "resolved" ? "success" : "default"}
                          label={row.loading ? "laden" : row.preview?.origin_status ?? "geen preview"}
                        />
                      </Stack>
                      {row.error ? (
                        <Typography color="error" fontSize={12}>{row.error}</Typography>
                      ) : null}
                      {issues.slice(0, 2).map((issue, index) => (
                        <Typography color={issue.severity === "error" ? "error" : "text.secondary"} fontSize={12} key={`${issue.code}-${index}`}>
                          {issue.message}
                        </Typography>
                      ))}
                      <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                        {(row.preview?.interfaces ?? []).slice(0, 8).map((item) => (
                          <Chip
                            key={`${item.code}-${item.side}-${item.side_order}`}
                            size="small"
                            label={`${item.code} · ${item.side}`}
                            variant="outlined"
                          />
                        ))}
                        {!row.loading && row.preview && row.preview.interfaces.length === 0 ? (
                          <Typography color="text.secondary" fontSize={12}>Geen interfaces</Typography>
                        ) : null}
                      </Stack>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Box>

          <Divider />

          <Box sx={{ display: "grid", gap: 0.75 }}>
            <Typography color="text.secondary" fontSize={12} fontWeight={800}>
              Mapping rules
            </Typography>
            {interfaceMappingRules.length === 0 ? (
              <Typography color="text.secondary" fontSize={13}>
                Nog geen mappingregels gedefinieerd.
              </Typography>
            ) : (
              interfaceMappingRules.map((rule) => {
                return (
                  <Box
                    key={rule.local_key}
                    sx={(theme) => ({
                      display: "grid",
                      gridTemplateColumns: {
                        xs: "1fr",
                        lg: "minmax(130px, 0.8fr) minmax(100px, 0.6fr) minmax(120px, 0.7fr) minmax(120px, 0.8fr) minmax(100px, 0.6fr) 88px",
                      },
                      gap: 0.75,
                      alignItems: "center",
                      p: 0.75,
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: 1,
                    })}
                  >
                    <TextField
                      size="small"
                      label="Driver"
                      value={rule.driver_parameter_code}
                      disabled={isReleasedTypical}
                      onChange={(event) =>
                        onUpdateInterfaceMappingRule(rule.local_key, { driver_parameter_code: event.target.value })
                      }
                      helperText={
                        rule.driver_parameter_code &&
                        !definitions.some((definition) => definition.code === rule.driver_parameter_code)
                          ? "ontbreekt"
                          : undefined
                      }
                    />
                    <TextField
                      size="small"
                      label="Waarde"
                      value={rule.driver_value}
                      disabled={isReleasedTypical}
                      onChange={(event) => onUpdateInterfaceMappingRule(rule.local_key, { driver_value: event.target.value })}
                    />
                    <FormControl size="small">
                      <InputLabel>Groep</InputLabel>
                      <Select
                        label="Groep"
                        value={rule.group_code ?? ""}
                        disabled={isReleasedTypical}
                        onChange={(event) =>
                          onUpdateInterfaceMappingRule(rule.local_key, { group_code: event.target.value || null })
                        }
                      >
                        <MenuItem value="">Geen</MenuItem>
                        {interfaceGroups.map((group) => (
                          <MenuItem key={group.local_key} value={group.code}>{group.code}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                    <TextField
                      size="small"
                      label="Interface"
                      value={rule.interface_code}
                      disabled={isReleasedTypical}
                      onChange={(event) => onUpdateInterfaceMappingRule(rule.local_key, { interface_code: event.target.value })}
                    />
                    <FormControl size="small">
                      <InputLabel>Richting</InputLabel>
                      <Select
                        label="Richting"
                        value={rule.direction}
                        disabled={isReleasedTypical}
                        onChange={(event) => onUpdateInterfaceMappingRule(rule.local_key, { direction: event.target.value })}
                      >
                        <MenuItem value="in">in</MenuItem>
                        <MenuItem value="out">out</MenuItem>
                        <MenuItem value="bidirectional">bidirectional</MenuItem>
                      </Select>
                    </FormControl>
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      disabled={isReleasedTypical}
                      onClick={() => onDeleteInterfaceMappingRule(rule.local_key)}
                    >
                      Verwijder
                    </Button>
                  </Box>
                );
              })
            )}
          </Box>

          <Divider />

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", lg: "1fr 1fr" },
              gap: 1,
            }}
          >
            <Stack spacing={0.75}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                <Typography color="text.secondary" fontSize={12} fontWeight={800}>
                  Groups
                </Typography>
                <Button size="small" variant="outlined" disabled={isReleasedTypical} onClick={onAddInterfaceGroup}>
                  Groep
                </Button>
              </Stack>
              {interfaceGroups.length === 0 ? (
                <Typography color="text.secondary" fontSize={13}>
                  Nog geen interfacegroepen.
                </Typography>
              ) : (
                interfaceGroups.map((group) => (
                  <Box
                    key={group.local_key}
                    sx={(theme) => ({
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) 86px 84px",
                      gap: 1,
                      alignItems: "center",
                      px: 1,
                      py: 0.75,
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: 1,
                    })}
                  >
                    <Box minWidth={0}>
                      <Typography noWrap fontSize={13} fontWeight={700}>
                        {group.name || group.code}
                      </Typography>
                      <Typography noWrap color="text.secondary" fontSize={12}>
                        {group.code} · {group.category}
                      </Typography>
                    </Box>
                    <FormControl size="small">
                      <Select
                        value={selectableSide(group.side)}
                        disabled={isReleasedTypical}
                        onChange={(event) =>
                          onUpdateInterfaceGroup(group.local_key, { side: event.target.value })
                        }
                      >
                        <MenuItem value="">auto</MenuItem>
                        <MenuItem value="left">left</MenuItem>
                        <MenuItem value="right">right</MenuItem>
                        <MenuItem value="top">top</MenuItem>
                        <MenuItem value="bottom">bottom</MenuItem>
                      </Select>
                    </FormControl>
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      disabled={isReleasedTypical}
                      onClick={() => onDeleteInterfaceGroup(group.local_key)}
                    >
                      Wis
                    </Button>
                  </Box>
                ))
              )}
            </Stack>
            <Stack spacing={0.75}>
              <Typography color="text.secondary" fontSize={12} fontWeight={800}>
                Resolved
              </Typography>
              {interfaces.length === 0 ? (
                <Typography color="text.secondary" fontSize={13}>
                  Nog geen interfaces.
                </Typography>
              ) : (
                interfaces.slice(0, 8).map((item) => (
                  <Box
                    key={`${item.source}-${item.code}`}
                    sx={(theme) => ({
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) 78px 78px",
                      gap: 1,
                      alignItems: "center",
                      px: 1,
                      py: 0.75,
                      border: `1px solid ${theme.palette.divider}`,
                      borderRadius: 1,
                    })}
                  >
                    <Box minWidth={0}>
                      <Typography noWrap fontSize={13} fontWeight={700}>
                        {item.code}
                      </Typography>
                      <Typography noWrap color="text.secondary" fontSize={12}>
                        {item.role} · {item.logical_type}
                      </Typography>
                    </Box>
                    <Chip size="small" label={item.direction} />
                    <Chip size="small" variant="outlined" label={item.side || "auto"} />
                  </Box>
                ))
              )}
            </Stack>
          </Box>

          {driverParameters.length === 0 ? (
            <Typography color="text.secondary" fontSize={13}>
              Geen interface-driver ingesteld.
            </Typography>
          ) : null}
          {interfaceMappingRules.length === 0 ? (
            <Typography color="text.secondary" fontSize={13}>
              Geen interface mappings.
            </Typography>
          ) : null}
          {validationIssues.length > 0 ? (
            <Stack spacing={0.5}>
              {validationIssues.slice(0, 4).map((issue, index) => (
                <Typography
                  key={`${issue.code}-${index}`}
                  color={issue.severity === "error" ? "error" : "text.secondary"}
                  fontSize={12}
                >
                  {issue.message}
                </Typography>
              ))}
            </Stack>
          ) : null}

          <Divider />

          <Box sx={{ display: "grid", gap: 0.75 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
              <Typography color="text.secondary" fontSize={12} fontWeight={800}>
                Interface states
              </Typography>
              <Button size="small" variant="outlined" disabled={isReleasedTypical} onClick={onAddOverrideInterface}>
                Override
              </Button>
            </Stack>
            {previewInterfaces.length === 0 && overrideInterfaces.length === 0 && disabledInterfaceCodes.length === 0 ? (
              <Typography color="text.secondary" fontSize={13}>
                Geen actieve, uitgeschakelde of override interfaces.
              </Typography>
            ) : null}
            {previewInterfaces.map((item) => {
              const rowIssues = issuesByInterface.get(item.code.toUpperCase()) ?? [];
              const isOverride = overrideInterfaces.some(
                (override) => override.code.toUpperCase() === item.code.toUpperCase(),
              );
              return (
                <Box
                  key={`state-${item.code}`}
                  sx={(theme) => ({
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 92px 108px" },
                    gap: 0.75,
                    alignItems: "center",
                    p: 0.75,
                    border: `1px solid ${rowIssues.length > 0 ? theme.palette.error.main : theme.palette.divider}`,
                    borderRadius: 1,
                  })}
                >
                  <Box minWidth={0}>
                    <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
                      <Typography noWrap fontSize={13} fontWeight={800}>
                        {item.code}
                      </Typography>
                      <Chip size="small" label={isOverride ? "override" : "derived"} color={isOverride ? "warning" : "default"} />
                      <Chip size="small" variant="outlined" label={`${item.side}:${item.side_order}`} />
                    </Stack>
                    <Typography noWrap color={rowIssues.length > 0 ? "error" : "text.secondary"} fontSize={12}>
                      {rowIssues[0]?.message ?? `${item.direction} · ${item.logical_type}`}
                    </Typography>
                  </Box>
                  <Button
                    size="small"
                    variant="outlined"
                    disabled={isReleasedTypical}
                    onClick={() => onUpdateInterfaceLayout(item.code, { side: item.side, side_order: item.side_order, sort_order: item.sort_order }, item)}
                  >
                    Pin
                  </Button>
                  <Button
                    size="small"
                    color="error"
                    variant="outlined"
                    disabled={isReleasedTypical}
                    onClick={() => onDisableInterface(item.code)}
                  >
                    Uitschakelen
                  </Button>
                </Box>
              );
            })}
            {disabledInterfaceCodes.map((code) => (
              <Box
                key={`disabled-${code}`}
                sx={(theme) => ({
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 1fr) 108px" },
                  gap: 0.75,
                  alignItems: "center",
                  p: 0.75,
                  border: `1px dashed ${theme.palette.divider}`,
                  borderRadius: 1,
                })}
              >
                <Box minWidth={0}>
                  <Stack direction="row" spacing={0.5} alignItems="center" flexWrap="wrap" useFlexGap>
                    <Typography noWrap fontSize={13} fontWeight={800}>
                      {code}
                    </Typography>
                    <Chip size="small" color="error" variant="outlined" label="disabled" />
                  </Stack>
                  <Typography noWrap color="text.secondary" fontSize={12}>
                    Niet zichtbaar in resolved output en preview.
                  </Typography>
                </Box>
                <Button size="small" variant="outlined" disabled={isReleasedTypical} onClick={() => onRestoreInterface(code)}>
                  Herstel
                </Button>
              </Box>
            ))}
          </Box>

          <Box sx={{ display: "grid", gap: 0.75 }}>
            <Typography color="text.secondary" fontSize={12} fontWeight={800}>
              Overrides
            </Typography>
            {overrideInterfaces.length === 0 ? (
              <Typography color="text.secondary" fontSize={13}>
                Geen expliciete overrides.
              </Typography>
            ) : (
              overrideInterfaces.map((item) => {
                const localKey = item.local_key ?? item.code;
                const rowIssues = issuesByInterface.get(item.code.toUpperCase()) ?? [];
                return (
                  <Box
                    key={`override-${localKey}`}
                    sx={(theme) => ({
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", lg: "minmax(90px, 0.7fr) minmax(110px, 1fr) minmax(110px, 1fr) 112px 82px" },
                      gap: 0.75,
                      alignItems: "center",
                      p: 0.75,
                      border: `1px solid ${rowIssues.length > 0 ? theme.palette.error.main : theme.palette.divider}`,
                      borderRadius: 1,
                    })}
                  >
                    <TextField
                      size="small"
                      label="Code"
                      value={item.code}
                      disabled={isReleasedTypical}
                      error={rowIssues.length > 0}
                      onChange={(event) => onUpdateInterfaceOverride(localKey, { code: event.target.value })}
                    />
                    <TextField
                      size="small"
                      label="Rol"
                      value={item.role}
                      disabled={isReleasedTypical}
                      onChange={(event) => onUpdateInterfaceOverride(localKey, { role: event.target.value })}
                    />
                    <TextField
                      size="small"
                      label="Type"
                      value={item.logical_type}
                      disabled={isReleasedTypical}
                      onChange={(event) => onUpdateInterfaceOverride(localKey, { logical_type: event.target.value })}
                    />
                    <FormControl size="small">
                      <InputLabel>Side</InputLabel>
                      <Select
                        label="Side"
                        value={selectableSide(item.side ?? "")}
                        disabled={isReleasedTypical}
                        onChange={(event) => onUpdateInterfaceOverride(localKey, { side: event.target.value })}
                      >
                        <MenuItem value="">auto</MenuItem>
                        <MenuItem value="left">left</MenuItem>
                        <MenuItem value="right">right</MenuItem>
                        <MenuItem value="top">top</MenuItem>
                        <MenuItem value="bottom">bottom</MenuItem>
                      </Select>
                    </FormControl>
                    <Button
                      size="small"
                      color="error"
                      variant="outlined"
                      disabled={isReleasedTypical}
                      onClick={() => onDeleteInterfaceOverride(localKey)}
                    >
                      Wis
                    </Button>
                    {rowIssues.length > 0 ? (
                      <Typography color="error" fontSize={12} sx={{ gridColumn: "1 / -1" }}>
                        {rowIssues[0].message}
                      </Typography>
                    ) : null}
                  </Box>
                );
              })
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
