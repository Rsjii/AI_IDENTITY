import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface QuizQuestionProps {
  label: string;
  type: 'text' | 'select' | 'tags' | 'radio' | 'textarea' | 'slider' | 'multiselect' | 'checkbox';
  value: any;
  onChange: (value: any) => void;
  placeholder?: string;
  options?: string[];
  suggestions?: string[];
  skipable?: boolean;
  onSkip?: () => void;
}

export function QuizQuestion({
  label,
  type,
  value,
  onChange,
  placeholder,
  options = [],
  suggestions = [],
  skipable = false,
  onSkip,
}: QuizQuestionProps) {
  const renderInput = () => {
    switch (type) {
      case 'text':
        return (
          <Input
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
          />
        );

      case 'select':
        return (
          <Select value={value || ''} onValueChange={(val) => onChange(val)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder={placeholder || 'Select an option'} />
            </SelectTrigger>
            <SelectContent>
              {options.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'radio':
        return (
          <RadioGroup value={value || ''} onValueChange={onChange}>
            {options.map((opt) => (
              <div key={opt} className="flex items-center space-x-2">
                <RadioGroupItem value={opt} id={opt} />
                <Label htmlFor={opt} className="cursor-pointer">
                  {opt}
                </Label>
              </div>
            ))}
          </RadioGroup>
        );

      case 'tags':
        const tags = Array.isArray(value) ? value : value ? [value] : [];
        const addTag = (tag: string) => {
          if (tag && !tags.includes(tag)) {
            onChange([...tags, tag]);
          }
        };
        const removeTag = (tag: string) => {
          onChange(tags.filter((t) => t !== tag));
        };
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                  {tag}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => removeTag(tag)} />
                </Badge>
              ))}
            </div>
            <Input
              placeholder={placeholder || 'Type and press Enter'}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addTag(e.currentTarget.value);
                  e.currentTarget.value = '';
                }
              }}
            />
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {suggestions.map((sug) => (
                  <Badge
                    key={sug}
                    variant="outline"
                    className="cursor-pointer"
                    onClick={() => addTag(sug)}
                  >
                    + {sug}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        );

      case 'textarea':
        return (
          <div className="space-y-2">
            <Textarea
              value={value || ''}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              rows={4}
            />
            <div className="text-xs text-muted-foreground text-right">
              {String(value || '').length} characters
            </div>
          </div>
        );

      case 'slider':
        const sliderValue = Array.isArray(value) ? value[0] : value || 50;
        return (
          <div className="space-y-2">
            <Slider
              value={[sliderValue]}
              onValueChange={(vals) => onChange(vals[0])}
              min={0}
              max={100}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Short</span>
              <span>Detailed</span>
            </div>
            <div className="text-sm text-center mt-2">
              Current: {sliderValue < 33 ? 'Short' : sliderValue < 66 ? 'Medium' : 'Detailed'}
            </div>
          </div>
        );

      case 'multiselect':
        const selected = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2">
            {options.map((opt) => (
              <div key={opt} className="flex items-center space-x-2">
                <Checkbox
                  id={opt}
                  checked={selected.includes(opt)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onChange([...selected, opt]);
                    } else {
                      onChange(selected.filter((s) => s !== opt));
                    }
                  }}
                />
                <Label htmlFor={opt} className="cursor-pointer">
                  {opt}
                </Label>
              </div>
            ))}
          </div>
        );

      case 'checkbox':
        const checkboxes = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2">
            {options.map((opt) => (
              <div key={opt} className="flex items-center space-x-2">
                <Checkbox
                  id={opt}
                  checked={checkboxes.includes(opt)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onChange([...checkboxes, opt]);
                    } else {
                      onChange(checkboxes.filter((s) => s !== opt));
                    }
                  }}
                />
                <Label htmlFor={opt} className="cursor-pointer">
                  {opt}
                </Label>
              </div>
            ))}
            <Input
              placeholder="Add custom topic..."
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.currentTarget.value) {
                  onChange([...checkboxes, e.currentTarget.value]);
                  e.currentTarget.value = '';
                }
              }}
            />
          </div>
        );

      default:
        return <Input value={value || ''} onChange={(e) => onChange(e.target.value)} />;
    }
  };

  return (
    <div className="space-y-3 animate-slide-in-from-right-300">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">{label}</Label>
        {skipable && onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Skip
          </button>
        )}
      </div>
      {renderInput()}
    </div>
  );
}


