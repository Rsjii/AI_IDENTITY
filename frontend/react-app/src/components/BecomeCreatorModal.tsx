import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Sparkles, Zap, DollarSign, Clock, Check } from 'lucide-react';

interface BecomeCreatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function BecomeCreatorModal({ isOpen, onClose }: BecomeCreatorModalProps) {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleStartCreating = () => {
    setLoading(true);
    // Navigate to onboarding
    nav('/onboarding/quiz');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Sparkles className="w-6 h-6 text-primary" />
            Start Your AI Clone Journey
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            Create your own AI clone and start earning. Join thousands of creators monetizing their expertise.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Benefits */}
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-2 bg-primary/10 rounded-lg">
                <Check className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="font-medium">You'll keep your current account</div>
                <div className="text-sm text-muted-foreground">
                  All your subscriptions and chats stay intact
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-2 bg-primary/10 rounded-lg">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="font-medium">Switch between creator/user modes anytime</div>
                <div className="text-sm text-muted-foreground">
                  Manage your AI and browse the marketplace seamlessly
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-2 bg-primary/10 rounded-lg">
                <DollarSign className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="font-medium">Keep 75% of your earnings</div>
                <div className="text-sm text-muted-foreground">
                  Get paid for subscriptions and pay-per-chat conversations
                </div>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="mt-0.5 p-2 bg-primary/10 rounded-lg">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <div className="font-medium">Setup takes 10 minutes</div>
                <div className="text-sm text-muted-foreground">
                  No technical skills required - just upload your content
                </div>
              </div>
            </div>
          </div>

          {/* What happens next */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <div className="font-medium text-sm">What happens next:</div>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
              <li>Answer a few questions about your expertise</li>
              <li>Upload your knowledge (docs, PDFs, links)</li>
              <li>Set your pricing (subscriptions & pay-per-chat)</li>
              <li>Choose your plan and go live!</li>
            </ol>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button onClick={onClose} variant="outline" disabled={loading}>
            Maybe Later
          </Button>
          <Button onClick={handleStartCreating} disabled={loading} size="lg">
            {loading ? (
              'Starting...'
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Start Setup
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
