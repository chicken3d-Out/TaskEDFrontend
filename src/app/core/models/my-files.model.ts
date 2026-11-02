export interface MyFile {
  id: string;
  label: string;
  category: string | null;
  link: string;
  schoolYear: string;
  createdAt: string;
}

export interface MyFilesView {
  currentYear: string;
  files: MyFile[];
}
