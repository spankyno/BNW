export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppSettings {
  showLineNumbers: boolean;
  theme: 'light' | 'dark';
  cookieAccepted: boolean;
}

export interface ThemeColors {
  bg: string;
  surface: string;
  surfaceSecondary: string;
  text: string;
  textSecondary: string;
  accent: string;
  accentLight: string;
  border: string;
  destructive: string;
  tabBar: string;
  inputBg: string;
  placeholder: string;
}
