"use client";

import { useEffect, useRef, useState } from "react";
import type { DiagramSettings, LineStyle, TableView } from "@/store/canvas";

type MenuItem =
  | {
      kind: "item";
      label: string;
      shortcut?: string;
      checked?: boolean;
      disabled?: boolean;
      onSelect: () => void;
    }
  | { kind: "sep" };

interface MenuToolbarProps {
  libraryOpen: boolean;
  onToggleLibrary: () => void;
  inspectorOpen: boolean;
  onToggleInspector: () => void;

  zoom: number;
  onZoomTo: (zoom: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;

  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;

  hasSelection: boolean;
  hasShapeSelected: boolean;
  onDelete: () => void;
  onDuplicate: () => void;

  settings: DiagramSettings;
  onSettings: (partial: Partial<DiagramSettings>) => void;
  tableView: TableView;
  onTableView: (view: TableView) => void;

  onClear: () => void;
  onExportSpec: () => void;
  onExportJson: () => void;
  onImportJson: (file: File) => void;
}

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 20 20"
      className="h-[18px] w-[18px]"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function ToolButton({
  label,
  onClick,
  disabled,
  active,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
        active ? "bg-indigo-50 text-indigo-600" : "text-slate-600 hover:bg-slate-100"
      } ${disabled ? "cursor-not-allowed opacity-40 hover:bg-transparent" : ""}`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px shrink-0 bg-slate-200" />;
}

const ZOOM_CHOICES = [50, 75, 100, 125, 150];

export default function MenuToolbar(props: MenuToolbarProps) {
  const {
    libraryOpen,
    onToggleLibrary,
    inspectorOpen,
    onToggleInspector,
    zoom,
    onZoomTo,
    onZoomIn,
    onZoomOut,
    onFit,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    hasSelection,
    hasShapeSelected,
    onDelete,
    onDuplicate,
    settings,
    onSettings,
    tableView,
    onTableView,
    onClear,
    onExportSpec,
    onExportJson,
    onImportJson,
  } = props;

  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close an open menu when clicking elsewhere or pressing Escape.
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [openMenu]);

  const lineStyle = (style: LineStyle, label: string): MenuItem => ({
    kind: "item",
    label,
    checked: settings.lineStyle === style,
    onSelect: () => onSettings({ lineStyle: style }),
  });

  const menus: { id: string; label: string; items: MenuItem[] }[] = [
    {
      id: "file",
      label: "File",
      items: [
        { kind: "item", label: "Export spec (Markdown)", onSelect: onExportSpec },
        { kind: "item", label: "Export JSON", onSelect: onExportJson },
        { kind: "item", label: "Import JSON...", onSelect: () => fileInputRef.current?.click() },
        { kind: "sep" },
        { kind: "item", label: "Clear canvas", onSelect: onClear },
      ],
    },
    {
      id: "edit",
      label: "Edit",
      items: [
        { kind: "item", label: "Undo", shortcut: "Ctrl+Z", disabled: !canUndo, onSelect: onUndo },
        { kind: "item", label: "Redo", shortcut: "Ctrl+Y", disabled: !canRedo, onSelect: onRedo },
        { kind: "sep" },
        {
          kind: "item",
          label: "Duplicate",
          shortcut: "Ctrl+D",
          disabled: !hasShapeSelected,
          onSelect: onDuplicate,
        },
        { kind: "item", label: "Delete", shortcut: "Del", disabled: !hasSelection, onSelect: onDelete },
      ],
    },
    {
      id: "view",
      label: "View",
      items: [
        { kind: "item", label: "Zoom in", onSelect: onZoomIn },
        { kind: "item", label: "Zoom out", onSelect: onZoomOut },
        { kind: "item", label: "Reset zoom (100%)", onSelect: () => onZoomTo(1) },
        { kind: "item", label: "Fit to screen", onSelect: onFit },
        { kind: "sep" },
        {
          kind: "item",
          label: "Shape library",
          checked: libraryOpen,
          onSelect: onToggleLibrary,
        },
        {
          kind: "item",
          label: "Style panel",
          checked: inspectorOpen,
          onSelect: onToggleInspector,
        },
        { kind: "sep" },
        {
          kind: "item",
          label: "Grid",
          checked: settings.grid,
          onSelect: () => onSettings({ grid: !settings.grid }),
        },
        {
          kind: "item",
          label: "Snap to grid",
          checked: settings.snap,
          onSelect: () => onSettings({ snap: !settings.snap }),
        },
      ],
    },
    {
      id: "extras",
      label: "Extras",
      items: [
        lineStyle("orthogonal", "Lines: right angles"),
        lineStyle("straight", "Lines: straight"),
        lineStyle("curved", "Lines: curved"),
        { kind: "sep" },
        {
          kind: "item",
          label: "Connection arrowheads",
          checked: settings.arrowheads,
          onSelect: () => onSettings({ arrowheads: !settings.arrowheads }),
        },
        {
          kind: "item",
          label: "Connection labels",
          checked: settings.showLabels,
          onSelect: () => onSettings({ showLabels: !settings.showLabels }),
        },
        { kind: "sep" },
        {
          kind: "item",
          label: "Tables as cards",
          checked: tableView === "card",
          onSelect: () => onTableView("card"),
        },
        {
          kind: "item",
          label: "Tables with columns",
          checked: tableView === "columns",
          onSelect: () => onTableView("columns"),
        },
      ],
    },
  ];

  const zoomMenu: MenuItem[] = [
    ...ZOOM_CHOICES.map(
      (percent): MenuItem => ({
        kind: "item",
        label: `${percent}%`,
        checked: Math.round(zoom * 100) === percent,
        onSelect: () => onZoomTo(percent / 100),
      })
    ),
    { kind: "sep" },
    { kind: "item", label: "Fit to screen", onSelect: onFit },
  ];

  const renderMenu = (id: string, items: MenuItem[], align: "left" | "right" = "left") =>
    openMenu === id && (
      <div
        className={`absolute top-full z-50 mt-1 min-w-[230px] rounded-xl border border-slate-200 bg-white py-1 shadow-xl ${
          align === "left" ? "left-0" : "right-0"
        }`}
        role="menu"
      >
        {items.map((item, i) =>
          item.kind === "sep" ? (
            <div key={`sep-${i}`} className="my-1 h-px bg-slate-100" />
          ) : (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => {
                setOpenMenu(null);
                item.onSelect();
              }}
              className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-slate-700 ${
                item.disabled ? "cursor-not-allowed opacity-40" : "hover:bg-slate-100"
              }`}
            >
              <span className="w-4 shrink-0 text-xs text-indigo-600">{item.checked ? "✓" : ""}</span>
              <span className="flex-1">{item.label}</span>
              {item.shortcut && (
                <span className="text-[11px] text-slate-400">{item.shortcut}</span>
              )}
            </button>
          )
        )}
      </div>
    );

  return (
    <div
      ref={rootRef}
      className="relative z-40 flex flex-wrap items-center gap-x-1 gap-y-1 border-b border-slate-200 bg-white px-2 py-1"
    >
      {/* Menus */}
      {menus.map((menu) => (
        <div key={menu.id} className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu((cur) => (cur === menu.id ? null : menu.id))}
            onMouseEnter={() => openMenu && setOpenMenu(menu.id)}
            className={`rounded-lg px-2.5 py-1.5 text-sm ${
              openMenu === menu.id
                ? "bg-slate-100 text-slate-900"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            {menu.label}
          </button>
          {renderMenu(menu.id, menu.items)}
        </div>
      ))}

      <Divider />

      {/* Shape library */}
      <ToolButton label="Shape library" active={libraryOpen} onClick={onToggleLibrary}>
        <Icon>
          <rect x="3" y="4" width="14" height="12" rx="2" />
          <path d="M8 4v12" />
        </Icon>
      </ToolButton>

      <Divider />

      {/* Undo, redo */}
      <ToolButton label="Undo (Ctrl+Z)" disabled={!canUndo} onClick={onUndo}>
        <Icon>
          <path d="M8 4L4 8l4 4" />
          <path d="M4 8h7a4 4 0 0 1 0 8H8" />
        </Icon>
      </ToolButton>
      <ToolButton label="Redo (Ctrl+Y)" disabled={!canRedo} onClick={onRedo}>
        <Icon>
          <path d="M12 4l4 4-4 4" />
          <path d="M16 8H9a4 4 0 0 0 0 8h3" />
        </Icon>
      </ToolButton>

      <Divider />

      {/* Delete, duplicate */}
      <ToolButton label="Delete (Del)" disabled={!hasSelection} onClick={onDelete}>
        <Icon>
          <path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10" />
        </Icon>
      </ToolButton>
      <ToolButton label="Duplicate (Ctrl+D)" disabled={!hasShapeSelected} onClick={onDuplicate}>
        <Icon>
          <rect x="7" y="7" width="9" height="9" rx="2" />
          <path d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
        </Icon>
      </ToolButton>

      <Divider />

      {/* Zoom */}
      <ToolButton label="Zoom out" onClick={onZoomOut}>
        <Icon>
          <circle cx="9" cy="9" r="5" />
          <path d="M13 13l4 4M7 9h4" />
        </Icon>
      </ToolButton>
      <div className="relative">
        <button
          type="button"
          title="Zoom level"
          onClick={() => setOpenMenu((cur) => (cur === "zoom" ? null : "zoom"))}
          className="flex h-8 items-center gap-1 rounded-lg px-2 text-sm text-slate-700 hover:bg-slate-100"
        >
          {Math.round(zoom * 100)}%
          <svg
            viewBox="0 0 20 20"
            className="h-3 w-3"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M5 8l5 5 5-5" />
          </svg>
        </button>
        {renderMenu("zoom", zoomMenu)}
      </div>
      <ToolButton label="Zoom in" onClick={onZoomIn}>
        <Icon>
          <circle cx="9" cy="9" r="5" />
          <path d="M13 13l4 4M7 9h4M9 7v4" />
        </Icon>
      </ToolButton>
      <ToolButton label="Fit to screen" onClick={onFit}>
        <Icon>
          <path d="M3 7V3h4M13 3h4v4M17 13v4h-4M7 17H3v-4" />
        </Icon>
      </ToolButton>

      <Divider />

      {/* Line style */}
      <ToolButton
        label="Straight lines"
        active={settings.lineStyle === "straight"}
        onClick={() => onSettings({ lineStyle: "straight" })}
      >
        <Icon>
          <path d="M4 15L16 5" />
        </Icon>
      </ToolButton>
      <ToolButton
        label="Right-angle lines"
        active={settings.lineStyle === "orthogonal"}
        onClick={() => onSettings({ lineStyle: "orthogonal" })}
      >
        <Icon>
          <path d="M4 15h6V5h6" />
        </Icon>
      </ToolButton>
      <ToolButton
        label="Curved lines"
        active={settings.lineStyle === "curved"}
        onClick={() => onSettings({ lineStyle: "curved" })}
      >
        <Icon>
          <path d="M4 15C10 15 10 5 16 5" />
        </Icon>
      </ToolButton>

      <Divider />

      {/* Grid, snap */}
      <ToolButton
        label="Show grid"
        active={settings.grid}
        onClick={() => onSettings({ grid: !settings.grid })}
      >
        <Icon>
          <path d="M3 7h14M3 13h14M7 3v14M13 3v14" />
        </Icon>
      </ToolButton>
      <ToolButton
        label="Snap to grid"
        active={settings.snap}
        onClick={() => onSettings({ snap: !settings.snap })}
      >
        <Icon>
          <path d="M5 3v6a5 5 0 0 0 10 0V3M5 6h3M12 6h3" />
        </Icon>
      </ToolButton>

      {/* Style panel toggle, pushed to the right */}
      <div className="ml-auto">
        <ToolButton label="Style panel" active={inspectorOpen} onClick={onToggleInspector}>
          <Icon>
            <path d="M4 6h12M4 10h12M4 14h12" />
            <circle cx="8" cy="6" r="1.6" />
            <circle cx="13" cy="10" r="1.6" />
            <circle cx="7" cy="14" r="1.6" />
          </Icon>
        </ToolButton>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImportJson(file);
          e.target.value = ""; // allow choosing the same file again
        }}
      />
    </div>
  );
}
