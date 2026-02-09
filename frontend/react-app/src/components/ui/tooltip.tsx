import { useState } from 'react';
import { HelpCircle } from 'lucide-react';

interface TooltipProps {
  content: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
}

export function Tooltip({ content, children, icon }: TooltipProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative inline-block">
      <div
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onClick={() => setShow(!show)}
        className="cursor-help inline-flex items-center"
      >
        {children || icon || <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-accent-primary transition-colors" />}
      </div>
      {show && (
        <div
          className="absolute z-50 w-64 p-3 text-sm bg-popover text-popover-foreground border border-border rounded-lg shadow-lg bottom-full left-1/2 transform -translate-x-1/2 mb-2 animate-in fade-in-0 zoom-in-95"
          style={{ maxWidth: '90vw' }}
        >
          <div className="relative">
            {content}
            {/* Arrow */}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-border"></div>
          </div>
        </div>
      )}
    </div>
  );
}

interface TooltipIconProps {
  content: string;
}

export function TooltipIcon({ content }: TooltipIconProps) {
  return (
    <Tooltip content={content}>
      <HelpCircle className="h-4 w-4 text-muted-foreground hover:text-accent-primary transition-colors ml-1 inline-block" />
    </Tooltip>
  );
}
