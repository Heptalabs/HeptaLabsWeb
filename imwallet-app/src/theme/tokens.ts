export type ThemePalette = {
  bg: string;
  surface: string;
  card: string;
  cardAlt: string;
  textStrong: string;
  textMuted: string;
  border: string;
  primary: string;
  secondary: string;
  warning: string;
  danger: string;
  success: string;
  chip: string;
  softBlue: string;
};

export const palettes: Record<'light' | 'dark', ThemePalette> = {
  light: {
    bg: '#f5f8ff',
    surface: '#ffffff',
    card: '#ffffff',
    cardAlt: '#0f69ff',
    textStrong: '#0f1f36',
    textMuted: '#6a7b96',
    border: '#dce6f6',
    primary: '#0f69ff',
    secondary: '#3da5ff',
    warning: '#f59e0b',
    danger: '#e11d48',
    success: '#16a34a',
    chip: '#eef4ff',
    softBlue: '#edf4ff'
  },
  dark: {
    bg: '#0b1220',
    surface: '#111a2f',
    card: '#141f37',
    cardAlt: '#2a63f4',
    textStrong: '#f3f7ff',
    textMuted: '#9db0d0',
    border: '#22304a',
    primary: '#68a0ff',
    secondary: '#43bbff',
    warning: '#f8b84e',
    danger: '#ff5d7f',
    success: '#3fdc8c',
    chip: '#18253f',
    softBlue: '#1b2b4a'
  }
};

export const palette = palettes.light;
