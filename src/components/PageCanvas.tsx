import { DocumentComponent } from '@/types/document';
import { useDocumentStore } from '@/stores/useDocumentStore';
import { GripVertical, X } from 'lucide-react';
import React, { useRef, useState } from 'react';

// ---- Individual Renderers ----

function HeaderRenderer({ comp }: { comp: DocumentComponent }) {
  const { updateComponent } = useDocumentStore();
  const h = comp.headerData!;

  const updateHeader = (field: string, value: string) => {
    updateComponent(comp.id, {
      headerData: { ...h, [field]: value },
    });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => updateHeader('logoUrl', ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  return (
    <div className="border border-border rounded p-4 bg-card">
      <div className="flex items-start gap-4">
        {/* Logo */}
        <div className="shrink-0">
          {h.logoUrl ? (
            <img src={h.logoUrl} alt="Logo" className="w-16 h-16 object-contain" />
          ) : (
            <label className="w-16 h-16 border-2 border-dashed border-border rounded flex items-center justify-center text-xs text-muted-foreground cursor-pointer hover:border-primary transition-colors">
              Logo
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </label>
          )}
        </div>
        {/* Fields */}
        <div className="flex-1 space-y-1.5">
          <input
            value={h.schoolName}
            onChange={(e) => updateHeader('schoolName', e.target.value)}
            className="w-full text-lg font-bold bg-transparent border-none outline-none text-center text-foreground"
            placeholder="School Name"
          />
          <input
            value={h.examTitle}
            onChange={(e) => updateHeader('examTitle', e.target.value)}
            className="w-full text-base font-semibold bg-transparent border-none outline-none text-center text-foreground"
            placeholder="Test / Exam / Exercise"
          />
          <div className="grid grid-cols-3 gap-2 text-sm">
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground text-xs">Name:</span>
              <input
                value={h.studentName}
                onChange={(e) => updateHeader('studentName', e.target.value)}
                className="flex-1 border-b border-border bg-transparent outline-none text-foreground"
                placeholder="________________"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground text-xs">Grade:</span>
              <input
                value={h.grade}
                onChange={(e) => updateHeader('grade', e.target.value)}
                className="flex-1 border-b border-border bg-transparent outline-none text-foreground"
                placeholder="________"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground text-xs">Date:</span>
              <input
                value={h.date}
                onChange={(e) => updateHeader('date', e.target.value)}
                className="flex-1 border-b border-border bg-transparent outline-none text-foreground"
                placeholder="________"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getQuestionNumber(comp: DocumentComponent, allComps: DocumentComponent[]): number {
  const questionTypes = ['numbered-question', 'multiple-choice', 'fill-blank', 'paragraph-question'];
  const questions = allComps.filter((c) => questionTypes.includes(c.type));
  return questions.indexOf(comp) + 1;
}

function NumberedQuestionRenderer({ comp }: { comp: DocumentComponent }) {
  const { updateComponent, components } = useDocumentStore();
  const num = getQuestionNumber(comp, components);
  const style = getTextStyle(comp);

  return (
    <div className="flex items-start gap-2" style={style}>
      <span className="font-semibold text-foreground shrink-0">{num}.</span>
      <textarea
        value={comp.content}
        onChange={(e) => updateComponent(comp.id, { content: e.target.value })}
        className="flex-1 bg-transparent border-none outline-none resize-none text-foreground min-h-[1.5em]"
        rows={1}
        placeholder="Enter question..."
      />
      {comp.marks > 0 && (
        <span className="marks-badge shrink-0">({comp.marks})</span>
      )}
    </div>
  );
}

function MultipleChoiceRenderer({ comp }: { comp: DocumentComponent }) {
  const { updateComponent, components } = useDocumentStore();
  const num = getQuestionNumber(comp, components);
  const options = comp.options || ['A', 'B', 'C', 'D'];
  const style = getTextStyle(comp);

  const updateOption = (idx: number, val: string) => {
    const newOpts = [...options];
    newOpts[idx] = val;
    updateComponent(comp.id, { options: newOpts });
  };

  return (
    <div style={style}>
      <div className="flex items-start gap-2 mb-2">
        <span className="font-semibold text-foreground shrink-0">{num}.</span>
        <textarea
          value={comp.content}
          onChange={(e) => updateComponent(comp.id, { content: e.target.value })}
          className="flex-1 bg-transparent border-none outline-none resize-none text-foreground min-h-[1.5em]"
          rows={1}
          placeholder="Enter question..."
        />
        {comp.marks > 0 && <span className="marks-badge shrink-0">({comp.marks})</span>}
      </div>
      <div className="ml-6 space-y-1">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="text-muted-foreground font-medium w-5">
              {String.fromCharCode(97 + i)})
            </span>
            <input
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              className="flex-1 bg-transparent border-none outline-none text-foreground"
              placeholder={`Option ${String.fromCharCode(65 + i)}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function FillBlankRenderer({ comp }: { comp: DocumentComponent }) {
  const { updateComponent, components } = useDocumentStore();
  const num = getQuestionNumber(comp, components);
  const style = getTextStyle(comp);

  return (
    <div className="flex items-start gap-2" style={style}>
      <span className="font-semibold text-foreground shrink-0">{num}.</span>
      <textarea
        value={comp.content}
        onChange={(e) => updateComponent(comp.id, { content: e.target.value })}
        className="flex-1 bg-transparent border-none outline-none resize-none text-foreground min-h-[1.5em]"
        rows={1}
        placeholder="Use _______ for blanks"
      />
      {comp.marks > 0 && <span className="marks-badge shrink-0">({comp.marks})</span>}
    </div>
  );
}

function AnswerLinesRenderer({ comp }: { comp: DocumentComponent }) {
  const { updateComponent } = useDocumentStore();
  const lines = comp.lineCount || 4;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-muted-foreground">Answer lines:</span>
        <input
          type="number"
          min={1}
          max={20}
          value={lines}
          onChange={(e) => updateComponent(comp.id, { lineCount: Number(e.target.value) })}
          className="w-12 text-xs border border-border rounded px-1 py-0.5 bg-card text-foreground"
        />
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="border-b border-muted-foreground/30 h-6" />
      ))}
    </div>
  );
}

function ParagraphQuestionRenderer({ comp }: { comp: DocumentComponent }) {
  const { updateComponent, components } = useDocumentStore();
  const num = getQuestionNumber(comp, components);
  const lines = comp.lineCount || 8;
  const style = getTextStyle(comp);

  return (
    <div style={style}>
      <div className="flex items-start gap-2 mb-2">
        <span className="font-semibold text-foreground shrink-0">{num}.</span>
        <textarea
          value={comp.content}
          onChange={(e) => updateComponent(comp.id, { content: e.target.value })}
          className="flex-1 bg-transparent border-none outline-none resize-none text-foreground min-h-[1.5em]"
          rows={2}
          placeholder="Enter paragraph question..."
        />
        {comp.marks > 0 && <span className="marks-badge shrink-0">({comp.marks})</span>}
      </div>
      <div className="space-y-1">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="border-b border-muted-foreground/30 h-6" />
        ))}
      </div>
    </div>
  );
}

function MarksBoxRenderer({ comp }: { comp: DocumentComponent }) {
  const { updateComponent } = useDocumentStore();
  const maxMarks = comp.maxMarks || 10;

  return (
    <div className="flex justify-end">
      <div className="border-2 border-foreground rounded px-4 py-2 text-center inline-flex items-center gap-1">
        <span className="text-lg font-bold text-foreground">__</span>
        <span className="text-lg font-bold text-foreground">/</span>
        <input
          type="number"
          value={maxMarks}
          onChange={(e) => updateComponent(comp.id, { maxMarks: Number(e.target.value) })}
          className="w-10 text-lg font-bold bg-transparent border-none outline-none text-center text-foreground"
        />
      </div>
    </div>
  );
}

function TableRenderer({ comp }: { comp: DocumentComponent }) {
  const { updateComponent } = useDocumentStore();
  const rows = comp.rows || 4;
  const cols = comp.columns || 2;
  const data = comp.tableData || Array(rows).fill(null).map(() => Array(cols).fill(''));

  const updateCell = (r: number, c: number, val: string) => {
    const newData = data.map((row) => [...row]);
    newData[r][c] = val;
    updateComponent(comp.id, { tableData: newData });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse border border-foreground/30">
        <tbody>
          {data.map((row, ri) => (
            <tr key={ri}>
              {row.map((cell, ci) => (
                <td key={ci} className="border border-foreground/30 p-1">
                  <input
                    value={cell}
                    onChange={(e) => updateCell(ri, ci, e.target.value)}
                    className="w-full bg-transparent border-none outline-none text-sm text-foreground"
                    placeholder="..."
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TotalMarksRenderer() {
  const totalMarks = useDocumentStore.getState().getTotalMarks();

  return (
    <div className="flex justify-end items-center gap-2 border-t-2 border-foreground pt-2 mt-4">
      <span className="font-bold text-foreground text-base">Total Marks:</span>
      <span className="text-lg font-bold text-primary">{totalMarks}</span>
    </div>
  );
}

function TextBlockRenderer({ comp }: { comp: DocumentComponent }) {
  const { updateComponent } = useDocumentStore();
  const style = getTextStyle(comp);

  return (
    <textarea
      value={comp.content}
      onChange={(e) => updateComponent(comp.id, { content: e.target.value })}
      className="w-full bg-transparent border-none outline-none resize-none text-foreground min-h-[1.5em]"
      style={style}
      rows={1}
      placeholder="Enter text..."
    />
  );
}

function getTextStyle(comp: DocumentComponent): React.CSSProperties {
  return {
    fontWeight: comp.formatting.bold ? 'bold' : 'normal',
    fontStyle: comp.formatting.italic ? 'italic' : 'normal',
    textDecoration: comp.formatting.underline ? 'underline' : 'none',
    fontSize: `${comp.formatting.fontSize}pt`,
    textAlign: comp.formatting.align,
  };
}

// ---- Component Renderer ----

function ComponentRenderer({ comp }: { comp: DocumentComponent }) {
  switch (comp.type) {
    case 'header': return <HeaderRenderer comp={comp} />;
    case 'numbered-question': return <NumberedQuestionRenderer comp={comp} />;
    case 'multiple-choice': return <MultipleChoiceRenderer comp={comp} />;
    case 'fill-blank': return <FillBlankRenderer comp={comp} />;
    case 'answer-lines': return <AnswerLinesRenderer comp={comp} />;
    case 'paragraph-question': return <ParagraphQuestionRenderer comp={comp} />;
    case 'marks-box': return <MarksBoxRenderer comp={comp} />;
    case 'table': return <TableRenderer comp={comp} />;
    case 'total-marks': return <TotalMarksRenderer />;
    case 'text-block': return <TextBlockRenderer comp={comp} />;
    default: return <div className="text-muted-foreground">Unknown component</div>;
  }
}

// ---- Page Canvas ----

export function PageCanvas() {
  const { components, selectedId, selectComponent, addComponent, moveComponent } = useDocumentStore();
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(null);

    const type = e.dataTransfer.getData('component-type');
    if (type) {
      addComponent(type as any, index);
      return;
    }

    // Internal reorder
    const fromStr = e.dataTransfer.getData('component-index');
    if (fromStr) {
      const from = parseInt(fromStr);
      if (from !== index) {
        moveComponent(from, index > from ? index - 1 : index);
      }
    }
    setDraggingIndex(null);
  };

  const handleInternalDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('component-index', String(index));
    e.dataTransfer.effectAllowed = 'move';
    setDraggingIndex(index);
  };

  return (
    <div className="flex-1 overflow-auto bg-canvas p-4 md:p-8 flex justify-center" onClick={() => selectComponent(null)}>
      <div className="page-a4 max-md:scale-[0.85] max-md:origin-top" onClick={(e) => e.stopPropagation()}>
        {components.length === 0 && (
          <div
            className="h-full flex items-center justify-center border-2 border-dashed border-border rounded-lg"
            onDragOver={(e) => handleDragOver(e, 0)}
            onDragLeave={() => setDragOverIndex(null)}
            onDrop={(e) => handleDrop(e, 0)}
          >
            <div className="text-center text-muted-foreground">
              <p className="text-lg font-medium mb-1">Drag components here</p>
              <p className="text-sm">or use a template from the sidebar</p>
            </div>
          </div>
        )}

        {components.map((comp, index) => (
          <React.Fragment key={comp.id}>
            {/* Drop zone above */}
            <div
              className={`h-1 transition-all rounded ${dragOverIndex === index ? 'h-2 bg-primary/40' : ''}`}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragLeave={() => setDragOverIndex(null)}
              onDrop={(e) => handleDrop(e, index)}
            />

            <div
              className={`doc-component p-2 my-0.5 group ${selectedId === comp.id ? 'selected' : ''} ${draggingIndex === index ? 'opacity-40' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                selectComponent(comp.id);
              }}
            >
              {/* Drag handle */}
              <div
                className="absolute -left-6 top-1/2 -translate-y-1/2 cursor-grab opacity-0 group-hover:opacity-60 transition-opacity no-print"
                draggable
                onDragStart={(e) => handleInternalDragStart(e, index)}
                onDragEnd={() => setDraggingIndex(null)}
              >
                <GripVertical className="h-4 w-4 text-muted-foreground" />
              </div>

              <ComponentRenderer comp={comp} />
            </div>
          </React.Fragment>
        ))}

        {/* Drop zone at end */}
        {components.length > 0 && (
          <div
            className={`h-8 transition-all rounded mt-1 ${dragOverIndex === components.length ? 'bg-primary/20 border-2 border-dashed border-primary/40' : ''}`}
            onDragOver={(e) => handleDragOver(e, components.length)}
            onDragLeave={() => setDragOverIndex(null)}
            onDrop={(e) => handleDrop(e, components.length)}
          />
        )}
      </div>
    </div>
  );
}
