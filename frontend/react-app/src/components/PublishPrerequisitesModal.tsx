import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle2, AlertCircle, XCircle, Loader2, ArrowRight } from 'lucide-react';

interface PrerequisiteItem {
  id: string;
  label: string;
  status: 'complete' | 'incomplete' | 'in_progress';
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface PublishPrerequisitesModalProps {
  open: boolean;
  onClose: () => void;
  prerequisites: PrerequisiteItem[];
}

export function PublishPrerequisitesModal({
  open,
  onClose,
  prerequisites,
}: PublishPrerequisitesModalProps) {
  const completed = prerequisites.filter((p) => p.status === 'complete').length;
  const total = prerequisites.length;
  const allComplete = completed === total;

  const getStatusIcon = (status: PrerequisiteItem['status']) => {
    switch (status) {
      case 'complete':
        return <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />;
      case 'in_progress':
        return <Loader2 className="h-5 w-5 text-amber-500 animate-spin flex-shrink-0" />;
      case 'incomplete':
        return <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen: boolean) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            📋 Complete these steps to publish
          </DialogTitle>
          <DialogDescription>
            Your listing needs a few more details before it can go live
          </DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="my-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium">Progress</span>
            <span className="text-text-secondary">
              {completed} of {total} steps complete
            </span>
          </div>
          <div className="h-3 w-full bg-bg-tertiary rounded-full overflow-hidden">
            <div
              className="h-full bg-accent-primary transition-all duration-300"
              style={{ width: `${(completed / total) * 100}%` }}
            />
          </div>
        </div>

        {allComplete ? (
          <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
            <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-700 dark:text-green-300">
              <strong>All set!</strong> Your listing meets all requirements and can be published.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <AlertDescription className="text-amber-700 dark:text-amber-300">
              <strong>Almost ready!</strong> Complete the remaining steps below to publish your listing.
            </AlertDescription>
          </Alert>
        )}

        {/* Prerequisites List */}
        <div className="space-y-3 my-4">
          {prerequisites.map((prereq) => (
            <div
              key={prereq.id}
              className={`border rounded-lg p-4 ${
                prereq.status === 'complete'
                  ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20'
                  : prereq.status === 'in_progress'
                  ? 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20'
                  : 'border-border-default bg-bg-secondary'
              }`}
            >
              <div className="flex items-start gap-3">
                {getStatusIcon(prereq.status)}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4 className="font-medium text-sm">{prereq.label}</h4>
                      <p className="text-xs text-text-secondary mt-1">{prereq.description}</p>
                    </div>
                  </div>
                  {prereq.action && prereq.status !== 'complete' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={prereq.action.onClick}
                      className="mt-2"
                    >
                      {prereq.action.label}
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            {allComplete ? 'Close' : 'Save as Draft'}
          </Button>
          {!allComplete && (
            <Button
              onClick={() => {
                const firstIncomplete = prerequisites.find((p) => p.status !== 'complete');
                if (firstIncomplete?.action) {
                  firstIncomplete.action.onClick();
                }
              }}
              className="bg-accent-gradient hover:opacity-90 text-white"
            >
              Complete Steps
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
