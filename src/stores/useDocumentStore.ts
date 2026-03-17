import { create } from 'zustand';
import { DocumentComponent, ComponentType, DEFAULT_FORMATTING, HeaderData } from '@/types/document';

let nextId = 1;
const genId = () => `comp-${nextId++}`;

interface DocStore {
  title: string;
  components: DocumentComponent[];
  selectedId: string | null;

  setTitle: (t: string) => void;
  addComponent: (type: ComponentType, atIndex?: number) => void;
  removeComponent: (id: string) => void;
  updateComponent: (id: string, updates: Partial<DocumentComponent>) => void;
  moveComponent: (fromIndex: number, toIndex: number) => void;
  selectComponent: (id: string | null) => void;
  duplicateComponent: (id: string) => void;
  loadTemplate: (template: string) => void;
  getTotalMarks: () => number;
}

function createDefaultComponent(type: ComponentType, order: number): DocumentComponent {
  const base: DocumentComponent = {
    id: genId(),
    type,
    content: '',
    marks: 0,
    formatting: { ...DEFAULT_FORMATTING },
    order,
  };

  switch (type) {
    case 'header':
      base.headerData = {
        schoolName: 'School Name',
        studentName: '',
        grade: '',
        date: new Date().toLocaleDateString(),
        examTitle: 'Test',
        logoUrl: '',
      };
      break;
    case 'numbered-question':
      base.content = 'Enter your question here';
      base.marks = 2;
      break;
    case 'multiple-choice':
      base.content = 'Enter your question here';
      base.options = ['Option A', 'Option B', 'Option C', 'Option D'];
      base.marks = 1;
      break;
    case 'fill-blank':
      base.content = 'The _______ is the capital of _______.';
      base.blankCount = 2;
      base.marks = 2;
      break;
    case 'answer-lines':
      base.lineCount = 4;
      base.content = '';
      break;
    case 'paragraph-question':
      base.content = 'Write a paragraph about...';
      base.marks = 10;
      base.lineCount = 8;
      break;
    case 'marks-box':
      base.maxMarks = 10;
      break;
    case 'table':
      base.columns = 2;
      base.rows = 4;
      base.tableData = Array(4).fill(null).map(() => Array(2).fill(''));
      break;
    case 'total-marks':
      break;
    case 'text-block':
      base.content = 'Enter text here...';
      base.formatting.fontSize = 12;
      break;
  }

  return base;
}

function getTemplateComponents(template: string): DocumentComponent[] {
  const comps: DocumentComponent[] = [];
  let order = 0;

  // Header
  const header = createDefaultComponent('header', order++);
  if (header.headerData) {
    header.headerData.examTitle = template === 'test' ? 'Test' : template === 'exam' ? 'Examination' : template === 'homework' ? 'Homework' : 'Worksheet';
  }
  comps.push(header);

  if (template === 'test' || template === 'exam') {
    // Section A
    const sectionA = createDefaultComponent('text-block', order++);
    sectionA.content = 'Section A: Multiple Choice';
    sectionA.formatting.bold = true;
    sectionA.formatting.fontSize = 14;
    comps.push(sectionA);

    for (let i = 0; i < 3; i++) {
      comps.push(createDefaultComponent('multiple-choice', order++));
    }

    const sectionB = createDefaultComponent('text-block', order++);
    sectionB.content = 'Section B: Short Answer Questions';
    sectionB.formatting.bold = true;
    sectionB.formatting.fontSize = 14;
    comps.push(sectionB);

    for (let i = 0; i < 2; i++) {
      comps.push(createDefaultComponent('numbered-question', order++));
      comps.push(createDefaultComponent('answer-lines', order++));
    }

    if (template === 'exam') {
      const sectionC = createDefaultComponent('text-block', order++);
      sectionC.content = 'Section C: Essay';
      sectionC.formatting.bold = true;
      sectionC.formatting.fontSize = 14;
      comps.push(sectionC);
      comps.push(createDefaultComponent('paragraph-question', order++));
    }

    comps.push(createDefaultComponent('total-marks', order++));
  } else if (template === 'homework') {
    for (let i = 0; i < 5; i++) {
      comps.push(createDefaultComponent('numbered-question', order++));
      comps.push(createDefaultComponent('answer-lines', order++));
    }
  } else {
    // Worksheet
    for (let i = 0; i < 3; i++) {
      comps.push(createDefaultComponent('fill-blank', order++));
    }
    comps.push(createDefaultComponent('table', order++));
  }

  return comps;
}

export const useDocumentStore = create<DocStore>((set, get) => ({
  title: 'Untitled Document',
  components: [],
  selectedId: null,

  setTitle: (t) => set({ title: t }),

  addComponent: (type, atIndex) =>
    set((state) => {
      const idx = atIndex ?? state.components.length;
      const comp = createDefaultComponent(type, idx);
      const newComps = [...state.components];
      newComps.splice(idx, 0, comp);
      // Reorder
      newComps.forEach((c, i) => (c.order = i));
      return { components: newComps, selectedId: comp.id };
    }),

  removeComponent: (id) =>
    set((state) => ({
      components: state.components.filter((c) => c.id !== id).map((c, i) => ({ ...c, order: i })),
      selectedId: state.selectedId === id ? null : state.selectedId,
    })),

  updateComponent: (id, updates) =>
    set((state) => ({
      components: state.components.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),

  moveComponent: (fromIndex, toIndex) =>
    set((state) => {
      const newComps = [...state.components];
      const [moved] = newComps.splice(fromIndex, 1);
      newComps.splice(toIndex, 0, moved);
      newComps.forEach((c, i) => (c.order = i));
      return { components: newComps };
    }),

  selectComponent: (id) => set({ selectedId: id }),

  duplicateComponent: (id) =>
    set((state) => {
      const comp = state.components.find((c) => c.id === id);
      if (!comp) return state;
      const idx = state.components.indexOf(comp);
      const dup = { ...comp, id: genId(), order: idx + 1 };
      if (dup.options) dup.options = [...dup.options];
      if (dup.tableData) dup.tableData = dup.tableData.map((r) => [...r]);
      if (dup.headerData) dup.headerData = { ...dup.headerData };
      const newComps = [...state.components];
      newComps.splice(idx + 1, 0, dup);
      newComps.forEach((c, i) => (c.order = i));
      return { components: newComps, selectedId: dup.id };
    }),

  loadTemplate: (template) =>
    set({
      components: getTemplateComponents(template),
      selectedId: null,
      title: template.charAt(0).toUpperCase() + template.slice(1),
    }),

  getTotalMarks: () => {
    return get().components.reduce((sum, c) => sum + (c.marks || 0), 0);
  },
}));
