import {
  Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight,
  Printer, Download, FileText, Plus, Trash2, Copy, Undo, Redo,
  Save,
} from 'lucide-react';
import { useDocumentStore } from '@/stores/useDocumentStore';

const fontSizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32];

export function Ribbon() {
  const { selectedId, components, updateComponent, title, setTitle } = useDocumentStore();
  const selected = components.find((c) => c.id === selectedId);

  const toggleFormat = (key: 'bold' | 'italic' | 'underline') => {
    if (!selected) return;
    updateComponent(selected.id, {
      formatting: { ...selected.formatting, [key]: !selected.formatting[key] },
    });
  };

  const setAlign = (align: 'left' | 'center' | 'right') => {
    if (!selected) return;
    updateComponent(selected.id, {
      formatting: { ...selected.formatting, align },
    });
  };

  const setFontSize = (size: number) => {
    if (!selected) return;
    updateComponent(selected.id, {
      formatting: { ...selected.formatting, fontSize: size },
    });
  };

  const handlePrint = () => window.print();

  return (
    <div className="no-print flex flex-col border-b border-panel-border bg-panel">
      {/* Title bar */}
      <div className="flex items-center gap-2 md:gap-3 px-2 md:px-4 py-1.5 bg-ribbon">
        <FileText className="h-5 w-5 text-ribbon-foreground" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="bg-transparent text-ribbon-foreground text-sm font-semibold border-none outline-none placeholder:text-ribbon-foreground/60 w-64"
          placeholder="Document Title"
        />
        <div className="flex-1" />
        <button onClick={handlePrint} className="ribbon-btn" title="Print">
          <Printer className="h-4 w-4" />
          <span>Print</span>
        </button>
        <button className="ribbon-btn" title="Save">
          <Save className="h-4 w-4" />
          <span>Save</span>
        </button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 flex-wrap">
        {/* Font size */}
        <select
          value={selected?.formatting.fontSize ?? 12}
          onChange={(e) => setFontSize(Number(e.target.value))}
          className="h-7 px-2 text-xs border border-border rounded bg-card text-foreground"
          disabled={!selected}
        >
          {fontSizes.map((s) => (
            <option key={s} value={s}>{s}pt</option>
          ))}
        </select>

        <div className="ribbon-separator bg-border" />

        {/* Formatting */}
        <button
          onClick={() => toggleFormat('bold')}
          className={`p-1.5 rounded hover:bg-secondary transition-colors ${selected?.formatting.bold ? 'bg-secondary' : ''}`}
          disabled={!selected}
          title="Bold"
        >
          <Bold className="h-4 w-4" />
        </button>
        <button
          onClick={() => toggleFormat('italic')}
          className={`p-1.5 rounded hover:bg-secondary transition-colors ${selected?.formatting.italic ? 'bg-secondary' : ''}`}
          disabled={!selected}
          title="Italic"
        >
          <Italic className="h-4 w-4" />
        </button>
        <button
          onClick={() => toggleFormat('underline')}
          className={`p-1.5 rounded hover:bg-secondary transition-colors ${selected?.formatting.underline ? 'bg-secondary' : ''}`}
          disabled={!selected}
          title="Underline"
        >
          <Underline className="h-4 w-4" />
        </button>

        <div className="ribbon-separator bg-border" />

        {/* Alignment */}
        <button
          onClick={() => setAlign('left')}
          className={`p-1.5 rounded hover:bg-secondary transition-colors ${selected?.formatting.align === 'left' ? 'bg-secondary' : ''}`}
          disabled={!selected}
          title="Align Left"
        >
          <AlignLeft className="h-4 w-4" />
        </button>
        <button
          onClick={() => setAlign('center')}
          className={`p-1.5 rounded hover:bg-secondary transition-colors ${selected?.formatting.align === 'center' ? 'bg-secondary' : ''}`}
          disabled={!selected}
          title="Align Center"
        >
          <AlignCenter className="h-4 w-4" />
        </button>
        <button
          onClick={() => setAlign('right')}
          className={`p-1.5 rounded hover:bg-secondary transition-colors ${selected?.formatting.align === 'right' ? 'bg-secondary' : ''}`}
          disabled={!selected}
          title="Align Right"
        >
          <AlignRight className="h-4 w-4" />
        </button>

        <div className="ribbon-separator bg-border" />

        {/* Selected component actions */}
        {selected && (
          <>
            <button
              onClick={() => useDocumentStore.getState().duplicateComponent(selected.id)}
              className="p-1.5 rounded hover:bg-secondary transition-colors"
              title="Duplicate"
            >
              <Copy className="h-4 w-4" />
            </button>
            <button
              onClick={() => useDocumentStore.getState().removeComponent(selected.id)}
              className="p-1.5 rounded hover:bg-destructive/10 text-destructive transition-colors"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
