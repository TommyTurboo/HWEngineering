import type { DragEvent, MouseEvent } from "react";
import { SimpleTreeView, TreeItem } from "@mui/x-tree-view";

type TypicalLibraryLeaf = {
  id: string;
  lineage_id?: string | null;
  name: string;
  code: string;
  etim_class_id: string;
  etim_class_description: string;
  status: string;
  version: number;
};

type LibraryTreeNode = {
  node_id: string;
  parent_id?: string | null;
  code: string;
  name: string;
  node_type: string;
  source: string;
  sort_order: number;
  children: LibraryTreeNode[];
  typicals: TypicalLibraryLeaf[];
};

type Props = {
  nodes: LibraryTreeNode[];
  onOpenTypical: (typicalId: string) => void;
  onNodeContextMenu: (node: LibraryTreeNode, event: MouseEvent) => void;
  onDropTypical: (args: { typicalLineageId: string; nodeId: string }) => void;
};

function renderNode(
  node: LibraryTreeNode,
  onOpenTypical: (typicalId: string) => void,
  onNodeContextMenu: (node: LibraryTreeNode, event: MouseEvent) => void,
  onDropTypical: (args: { typicalLineageId: string; nodeId: string }) => void,
) {
  return (
    <TreeItem
      key={node.node_id}
      itemId={node.node_id}
      label={
        <span
          onContextMenu={(event) => onNodeContextMenu(node, event)}
          onDragOver={(event) => {
            if (node.source !== "library") return;
            event.preventDefault();
          }}
          onDrop={(event) => {
            if (node.source !== "library") return;
            event.preventDefault();
            const typicalLineageId = event.dataTransfer.getData("application/x-typical-lineage-id");
            if (!typicalLineageId) return;
            onDropTypical({ typicalLineageId, nodeId: node.node_id });
          }}
        >
          {`${node.name} (${node.typicals.length + node.children.length})`}
        </span>
      }
    >
      {node.children.map((child) =>
        renderNode(child, onOpenTypical, onNodeContextMenu, onDropTypical),
      )}
      {node.typicals.map((typical) => (
        <TreeItem
          key={typical.id}
          itemId={typical.id}
          label={`${typical.name} · v${typical.version} · ${typical.status}`}
          slotProps={{
            label: {
              draggable: true,
              onDragStart: (event: DragEvent) => {
                event.dataTransfer?.setData(
                  "application/x-typical-lineage-id",
                  typical.lineage_id ?? typical.id,
                );
                event.dataTransfer?.setData("text/plain", typical.name);
              },
            },
          }}
          onClick={() => onOpenTypical(typical.id)}
        />
      ))}
    </TreeItem>
  );
}

export default function TypicalLibraryTree({
  nodes,
  onOpenTypical,
  onNodeContextMenu,
  onDropTypical,
}: Props) {
  return (
    <div className="tree-panel">
      <SimpleTreeView>
        {nodes.map((node) => renderNode(node, onOpenTypical, onNodeContextMenu, onDropTypical))}
      </SimpleTreeView>
    </div>
  );
}
