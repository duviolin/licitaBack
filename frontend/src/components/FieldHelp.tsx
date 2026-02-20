import { HelpCircle } from 'lucide-react';

interface FieldHelpProps {
  text: string;
}

export function FieldHelp({ text }: FieldHelpProps) {
  return (
    <p className="flex items-start gap-1 text-xs text-slate-400 mt-1">
      <HelpCircle size={12} className="shrink-0 mt-0.5" />
      <span>{text}</span>
    </p>
  );
}
