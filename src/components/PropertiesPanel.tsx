import { useDocumentStore } from '@/stores/useDocumentStore';
import { COMPONENT_LABELS } from '@/types/document';
import { Trash2, Copy, ChevronUp, ChevronDown } from 'lucide-react';

export function PropertiesPanel() {
  const { selectedId, components, updateComponent, removeComponent, duplicateComponent, moveComponent } = useDocumentStore();
  const selected = components.find((c) => c.id === selectedId);
  const totalMarks = useDocumentStore.getState().getTotalMarks();

  if (!selected) {
    return (
      <div className="no-print w-56 max-md:w-60 border-l border-panel-border bg-panel p-4 h-full">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Properties
        </h3>
        <p className="text-sm text-muted-foreground">Select a component to edit its properties</p>

        <div className="mt-6 pt-4 border-t border-panel-border">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Document Info
          </h3>
          <div className="text-sm space-y-1">
            <p className="text-foreground">Components: <span className="font-semibold">{components.length}</span></p>
            <p className="text-foreground">Total Marks: <span className="font-semibold text-primary">{totalMarks}</span></p>
          </div>
        </div>
      </div>
    );
  }

  const idx = components.indexOf(selected);

  return (
    <div className="no-print w-56 max-md:w-60 border-l border-panel-border bg-panel p-4 overflow-y-auto h-full">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
        Properties
      </h3>

      <div className="space-y-3">
        {/* Type */}
        <div>
          <label className="text-xs text-muted-foreground">Type</label>
          <p className="text-sm font-medium text-foreground">{COMPONENT_LABELS[selected.type]}</p>
        </div>

        {/* Marks */}
        {!['header', 'answer-lines', 'total-marks', 'text-block', 'marks-box', 'table'].includes(selected.type) && (
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Marks</label>
            <input
              type="number"
              min={0}
              max={100}
              value={selected.marks}
              onChange={(e) => updateComponent(selected.id, { marks: Number(e.target.value) })}
              className="w-full h-8 px-2 text-sm border border-border rounded bg-card text-foreground"
            />
          </div>
        )}

        {/* Line count */}
        {(selected.type === 'answer-lines' || selected.type === 'paragraph-question') && (
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Lines</label>
            <input
              type="number"
              min={1}
              max={30}
              value={selected.lineCount || 4}
              onChange={(e) => updateComponent(selected.id, { lineCount: Number(e.target.value) })}
              className="w-full h-8 px-2 text-sm border border-border rounded bg-card text-foreground"
            />
          </div>
        )}

        {/* Table dimensions */}
        {selected.type === 'table' && (
          <>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Columns</label>
              <input
                type="number"
                min={1}
                max={8}
                value={selected.columns || 2}
                onChange={(e) => {
                  const cols = Number(e.target.value);
                  const rows = selected.rows || 4;
                  const newData = Array(rows).fill(null).map((_, ri) =>
                    Array(cols).fill('').map((_, ci) => selected.tableData?.[ri]?.[ci] || '')
                  );
                  updateComponent(selected.id, { columns: cols, tableData: newData });
                }}
                className="w-full h-8 px-2 text-sm border border-border rounded bg-card text-foreground"
              />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">Rows</label>
              <input
                type="number"
                min={1}
                max={20}
                value={selected.rows || 4}
                onChange={(e) => {
                  const rows = Number(e.target.value);
                  const cols = selected.columns || 2;
                  const newData = Array(rows).fill(null).map((_, ri) =>
                    Array(cols).fill('').map((_, ci) => selected.tableData?.[ri]?.[ci] || '')
                  );
                  updateComponent(selected.id, { rows, tableData: newData });
                }}
                className="w-full h-8 px-2 text-sm border border-border rounded bg-card text-foreground"
              />
            </div>
          </>
        )}

        {/* Max marks for marks-box */}
        {selected.type === 'marks-box' && (
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Max Marks</label>
            <input
              type="number"
              min={1}
              max={200}
              value={selected.maxMarks || 10}
              onChange={(e) => updateComponent(selected.id, { maxMarks: Number(e.target.value) })}
              className="w-full h-8 px-2 text-sm border border-border rounded bg-card text-foreground"
            />
          </div>
        )}

        {/* Multiple choice options count */}
        {selected.type === 'multiple-choice' && (
          <div>
            <label className="text-xs text-muted-foreground block mb-1">Options</label>
            <input
              type="number"
              min={2}
              max={8}
              value={selected.options?.length || 4}
              onChange={(e) => {
                const count = Number(e.target.value);
                const opts = selected.options || [];
                const newOpts = Array(count).fill('').map((_, i) => opts[i] || `Option ${String.fromCharCode(65 + i)}`);
                updateComponent(selected.id, { options: newOpts });
              }}
              className="w-full h-8 px-2 text-sm border border-border rounded bg-card text-foreground"
            />
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-1 pt-2 border-t border-panel-border">
          <button
            onClick={() => idx > 0 && moveComponent(idx, idx - 1)}
            disabled={idx === 0}
            className="p-1.5 rounded hover:bg-secondary transition-colors disabled:opacity-30"
            title="Move Up"
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <button
            onClick={() => idx < components.length - 1 && moveComponent(idx, idx + 1)}
            disabled={idx === components.length - 1}
            className="p-1.5 rounded hover:bg-secondary transition-colors disabled:opacity-30"
            title="Move Down"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button
            onClick={() => duplicateComponent(selected.id)}
            className="p-1.5 rounded hover:bg-secondary transition-colors"
            title="Duplicate"
          >
            <Copy className="h-4 w-4" />
          </button>
          <button
            onClick={() => removeComponent(selected.id)}
            className="p-1.5 rounded hover:bg-destructive/10 text-destructive transition-colors"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        {/* Total marks */}
        <div className="pt-2 border-t border-panel-border">
          <p className="text-xs text-muted-foreground">Total Marks</p>
          <p className="text-lg font-bold text-primary">{totalMarks}</p>
        </div>
      </div>
    </div>
  );
}
