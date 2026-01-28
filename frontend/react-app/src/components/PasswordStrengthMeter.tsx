import { useMemo } from 'react';

interface PasswordStrengthMeterProps {
  password: string;
}

export function PasswordStrengthMeter({ password }: PasswordStrengthMeterProps) {
  const strength = useMemo(() => {
    if (!password) return { score: 0, label: '', color: '', width: 0 };
    
    let score = 0;
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^a-zA-Z0-9]/.test(password)) score++;
    
    if (score <= 2) return { score, label: 'Weak', color: 'text-red-500', bgColor: 'bg-red-500', width: 33 };
    if (score <= 4) return { score, label: 'Medium', color: 'text-yellow-500', bgColor: 'bg-yellow-500', width: 66 };
    return { score, label: 'Strong', color: 'text-green-500', bgColor: 'bg-green-500', width: 100 };
  }, [password]);

  if (!password) return null;

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${strength.bgColor}`}
            style={{ width: `${strength.width}%` }}
          />
        </div>
        <span className={`text-xs font-medium ${strength.color}`}>
          {strength.label}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">
        Use 8+ characters with uppercase, lowercase, numbers, and symbols
      </p>
    </div>
  );
}

