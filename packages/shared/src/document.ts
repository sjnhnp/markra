export type DocumentState = {
  path: string | null;
  name: string;
  content: string;
  dirty: boolean;
  open: boolean;
  revision: number;
};
