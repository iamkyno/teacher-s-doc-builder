export type ComponentType =
  | 'header'
  | 'numbered-question'
  | 'multiple-choice'
  | 'fill-blank'
  | 'answer-lines'
  | 'paragraph-question'
  | 'marks-box'
  | 'table'
  | 'total-marks'
  | 'text-block';

export interface DocumentComponent {
  id: string;
  type: ComponentType;
  content: string;
  marks: number;
  formatting: {
    bold: boolean;
    italic: boolean;
    underline: boolean;
    fontSize: number;
    align: 'left' | 'center' | 'right';
  };
  order: number;
  // Type-specific data
  options?: string[]; // for multiple-choice
  lineCount?: number; // for answer-lines
  blankCount?: number; // for fill-blank
  columns?: number; // for table
  rows?: number; // for table
  tableData?: string[][]; // for table
  headerData?: HeaderData; // for header
  maxMarks?: number; // for marks-box
}

export interface HeaderData {
  schoolName: string;
  studentName: string;
  grade: string;
  date: string;
  examTitle: string;
  logoUrl: string;
}

export interface DocumentState {
  title: string;
  components: DocumentComponent[];
  selectedId: string | null;
}

export const DEFAULT_FORMATTING: DocumentComponent['formatting'] = {
  bold: false,
  italic: false,
  underline: false,
  fontSize: 12,
  align: 'left',
};

export const COMPONENT_LABELS: Record<ComponentType, string> = {
  'header': 'Page Header',
  'numbered-question': 'Numbered Question',
  'multiple-choice': 'Multiple Choice (A/B/C/D)',
  'fill-blank': 'Fill in the Blank',
  'answer-lines': 'Answer Lines',
  'paragraph-question': 'Paragraph Question',
  'marks-box': 'Marks Box',
  'table': 'Table',
  'total-marks': 'Total Marks',
  'text-block': 'Text Block',
};

export const COMPONENT_ICONS: Record<ComponentType, string> = {
  'header': '📋',
  'numbered-question': '1️⃣',
  'multiple-choice': '🔘',
  'fill-blank': '___',
  'answer-lines': '📝',
  'paragraph-question': '📄',
  'marks-box': '✅',
  'table': '📊',
  'total-marks': '🧮',
  'text-block': 'T',
};
