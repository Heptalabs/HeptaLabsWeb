import { Language } from '../types/language';

export type LayoutConstraintInput = {
  language: Language;
  walletTabLabel: string;
  discoverTabLabel: string;
  settingsLabel: string;
};

const maxByLanguage: Record<Language, number> = {
  ko: 8,
  en: 12,
  zh: 6
};

export const validateTopLabelConstraints = (input: LayoutConstraintInput) => {
  const max = maxByLanguage[input.language];
  return [input.walletTabLabel, input.discoverTabLabel, input.settingsLabel].every((label) => label.length <= max);
};
