import { ComponentType, COMPONENT_LABELS, COMPONENT_ICONS } from '@/types/document';
import { useDocumentStore } from '@/stores/useDocumentStore';
import { FileText, BookOpen, ClipboardList, PenLine } from 'lucide-react';

const COMPONENT_LIST: ComponentType[] = [
  'header',
  'numbered-question',
  'multiple-choice',
  'fill-blank',
  'answer-lines',
  'paragraph-question',
  'marks-box',
  'table',
  'total-marks',
  'text-block',
];

const TEMPLATES = [
  { id: 'test', label: 'Test', icon: FileText },
  { id: 'exam', label: 'Exam', icon: BookOpen },
  { id: 'homework', label: 'Homework', icon: ClipboardList },
  { id: 'worksheet', label: 'Worksheet', icon: PenLine },
];

export function ComponentsSidebar() {
  const { loadTemplate, addComponent } = useDocumentStore();

  const handleDragStart = (e: React.DragEvent, type: ComponentType) => {
    e.dataTransfer.setData('component-type', type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  return (
    <div className="no-print w-60 max-md:w-64 border-r border-panel-border bg-panel flex flex-col overflow-y-auto h-full">
      {/* Templates */}
      <div className="p-3 border-b border-panel-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Quick Templates
        </h3>
        <div className="grid grid-cols-2 gap-1.5">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => loadTemplate(t.id)}
              className="flex flex-col items-center gap-1 p-2 rounded text-xs hover:bg-secondary transition-colors border border-transparent hover:border-border"
            >
              <t.icon className="h-5 w-5 text-primary" />
              <span className="text-foreground">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Components */}
      <div className="p-3 flex-1">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
          Components
        </h3>
        <p className="text-[10px] text-muted-foreground mb-2">Drag onto page or click to add</p>
        <div className="flex flex-col gap-1">
          {COMPONENT_LIST.map((type) => (
            <div
              key={type}
              draggable
              onDragStart={(e) => handleDragStart(e, type)}
              onClick={() => addComponent(type)}
              className="drag-component"
            >
              <span className="text-base w-6 text-center shrink-0">{COMPONENT_ICONS[type]}</span>
              <span className="text-foreground truncate">{COMPONENT_LABELS[type]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
