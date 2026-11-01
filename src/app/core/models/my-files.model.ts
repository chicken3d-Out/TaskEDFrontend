export interface MyFile {
  id: string;
  label: string;
  category: string | null;
  fileName: string;
  mimeType: string;
  size: number;
  schoolYear: string;
  createdAt: string;
}

export interface MyFilesView {
  currentYear: string;
  driveConnected: boolean;
  files: MyFile[];
}
