import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { apiFetch, apiFetchForm } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { useAuth } from '@/contexts/AuthContext';
import {
  Upload, FileText, X, Loader2, CheckCircle2, File, AlertCircle
} from 'lucide-react';
import { useOnboardingGuard, useRedirectBack } from '@/hooks/useOnboardingGuard';

interface ContentItem {
  id: string;
  title: string;
  type: string;
  size?: number;
  wordCount?: number;
}

interface StagedFile {
  file: File;
  id: string;
  estimatedWords: number;
}

export function OnboardingUploadPageNew() {
  const nav = useNavigate();
  const { refresh: refreshAuth } = useAuth();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [items, setItems] = useState<ContentItem[]>([]);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [, setUploadProgress] = useState<Record<string, number>>({});

  // Stats calculation
  const uploadedWords = items.reduce((sum, item) => sum + (item.wordCount || 0), 0);
  const stagedWords = stagedFiles.reduce((sum, sf) => sum + sf.estimatedWords, 0);
  const totalWords = uploadedWords + stagedWords;

  const minimumWordsRequired = 500;
  const hasMinimumWords = totalWords >= minimumWordsRequired;

  // Redirect to dashboard if onboarding is already complete
  useOnboardingGuard();

  // ✅ Step2 ke baad back दबाने पर dashboard भेजो (Step2 repeat नहीं)
  useRedirectBack('/dashboard');

  const refresh = async () => {
    const r = await apiFetch<{ items: ContentItem[] }>('/api/content/list');
    setItems(r.items || []);
  };

  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    refresh().catch(() => {});
  }, []);

  const stageFile = (file: File) => {
    const allowedTypes = ['.pdf', '.txt', '.md', '.docx', '.doc', '.xlsx', '.csv'];
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedTypes.includes(fileExt)) {
      showToast(`File type ${fileExt} not supported. Allowed: ${allowedTypes.join(', ')}`, 'error');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      showToast('File size exceeds 25 MB limit', 'error');
      return;
    }

    if (stagedFiles.some(sf => sf.file.name === file.name && sf.file.size === file.size)) {
      showToast('File already added', 'warning');
      return;
    }

    let estimatedWords: number;
    if (fileExt === '.txt' || fileExt === '.md') {
      estimatedWords = Math.ceil(file.size / 5);
    } else if (fileExt === '.pdf') {
      estimatedWords = Math.ceil(file.size / 18);
    } else if (fileExt === '.docx' || fileExt === '.doc') {
      estimatedWords = Math.ceil(file.size / 11);
    } else if (fileExt === '.xlsx' || fileExt === '.csv') {
      estimatedWords = Math.ceil(file.size / 9);
    } else {
      estimatedWords = Math.ceil(file.size / 10);
    }

    const stagedFile: StagedFile = {
      file,
      id: `staged-${Date.now()}-${file.name}`,
      estimatedWords,
    };

    setStagedFiles(prev => [...prev, stagedFile]);
    showToast(`${file.name} added`, 'success', 2000);
  };

  const removeStagedFile = (id: string) => {
    setStagedFiles(prev => prev.filter(sf => sf.id !== id));
  };

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      files.forEach(stageFile);
    }
  }, []);

  const uploadFile = async (file: File) => {
    const fileId = file.name;
    setUploadProgress((prev: Record<string, number>) => ({ ...prev, [fileId]: 0 }));

    let progressInterval: any = null;

    try {
      const fd = new FormData();
      fd.append('file', file);

      progressInterval = setInterval(() => {
        setUploadProgress((prev: Record<string, number>) => {
          const current = prev[fileId] || 0;
          if (current < 90) {
            return { ...prev, [fileId]: current + 10 };
          }
          return prev;
        });
      }, 200);

      await apiFetchForm('/api/content/upload', { method: 'POST', body: fd });
      setUploadProgress((prev: Record<string, number>) => ({ ...prev, [fileId]: 100 }));

      await refresh();

      setTimeout(() => {
        setUploadProgress((prev: Record<string, number>) => {
          const newProgress = { ...prev };
          delete newProgress[fileId];
          return newProgress;
        });
      }, 1000);
    } catch (error) {
      console.error('Upload failed:', error);
      showToast('Upload failed. Please try again.', 'error');
    } finally {
      if (progressInterval) clearInterval(progressInterval);
    }
  };

  const removeItem = async (id: string) => {
    setLoading(true);
    try {
      await apiFetch(`/api/content/${id}`, { method: 'DELETE' });
      await refresh();
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const addPaste = async () => {
    if (pasteText.trim().length < 100) {
      showToast('Please enter at least 100 characters', 'error');
      return;
    }
    setLoading(true);
    try {
      await apiFetch('/api/content/paste', {
        method: 'POST',
        body: JSON.stringify({ title: 'Paste', text: pasteText })
      });
      setPasteText('');
      await refresh();
      showToast('Text added successfully!', 'success');
    } catch (error) {
      console.error('Failed to add paste:', error);
      showToast('Failed to add text', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
    if (type.includes('text') || type.includes('markdown')) return <FileText className="h-5 w-5 text-blue-500" />;
    if (type.includes('word') || type.includes('doc')) return <FileText className="h-5 w-5 text-blue-600" />;
    return <File className="h-5 w-5 text-gray-500" />;
  };


  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex items-center justify-center p-6">
      <Card className="w-full max-w-4xl glass">
        <CardHeader>
          <CardTitle className="text-2xl">Upload Your Content</CardTitle>
          <CardDescription>
            Add at least 500 words to train your AI. The more content, the better your AI performs.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Progress indicator */}
          <div className="flex gap-2">
            {['Start', 'Upload', 'Preview', 'Complete'].map((step, i) => (
              <div
                key={step}
                className={`h-2 flex-1 rounded transition-colors ${
                  i <= 1 ? 'bg-accent-primary' : 'bg-bg-tertiary'
                }`}
              />
            ))}
          </div>

          {/* Word Count Progress */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Content Progress</span>
              <span className={hasMinimumWords ? 'text-green-500 font-semibold' : 'text-text-secondary'}>
                {totalWords.toLocaleString()} / {minimumWordsRequired.toLocaleString()} words
              </span>
            </div>
            <Progress value={Math.min((totalWords / minimumWordsRequired) * 100, 100)} className="h-2" />
            {hasMinimumWords ? (
              <p className="text-xs text-green-500 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                Great! You have enough content to continue
              </p>
            ) : (
              <p className="text-xs text-text-tertiary">
                Add {(minimumWordsRequired - totalWords).toLocaleString()} more words to continue
              </p>
            )}
          </div>

          {/* Upload Area */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`rounded-xl border-2 border-dashed transition-all duration-200 ${
              dragActive
                ? 'border-accent-primary bg-accent-primary/10'
                : 'border-accent-primary/50 bg-bg-secondary hover:border-accent-primary'
            }`}
          >
            <div className="flex flex-col items-center justify-center p-8 text-center">
              <Upload className="h-12 w-12 text-accent-primary mb-4" />
              <p className="text-lg font-semibold mb-2">Drop files here or click to browse</p>
              <p className="text-sm text-text-secondary mb-4">
                Supports: PDF, DOCX, TXT, MD, XLSX, CSV (Max 25 MB)
              </p>
              <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={(e) => {
                  if (e.target.files) {
                    Array.from(e.target.files).forEach(stageFile);
                    e.target.value = '';
                  }
                }}
                className="hidden"
                accept=".pdf,.txt,.md,.docx,.doc,.xlsx,.csv"
              />
              <Button
                type="button"
                className="bg-accent-gradient hover:opacity-90 text-white"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose Files
              </Button>
            </div>

            {/* Staged Files */}
            {stagedFiles.length > 0 && (
              <div className="p-6 space-y-3 border-t border-border-default">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold flex items-center gap-2 text-sm">
                    <AlertCircle className="h-4 w-4 text-yellow-500" />
                    Ready to Upload ({stagedFiles.length})
                  </h3>
                </div>
                {stagedFiles.map((stagedFile) => (
                  <div
                    key={stagedFile.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20"
                  >
                    <div className="flex-shrink-0">{getFileIcon(stagedFile.file.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate text-sm">{stagedFile.file.name}</p>
                        <Badge variant="outline" className="text-xs">
                          ~{stagedFile.estimatedWords.toLocaleString()} words
                        </Badge>
                      </div>
                    </div>
                    <button
                      onClick={() => removeStagedFile(stagedFile.id)}
                      className="p-1 hover:bg-bg-elevated rounded"
                    >
                      <X className="h-4 w-4 text-text-tertiary hover:text-error" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Uploaded Files */}
            {items.length > 0 && (
              <div className="p-6 space-y-3 border-t border-border-default">
                <h3 className="font-semibold flex items-center gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  Uploaded ({items.length})
                </h3>
                {items.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-bg-tertiary border border-border-default"
                  >
                    <div className="flex-shrink-0">{getFileIcon(item.type)}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium truncate text-sm">{item.title || item.type}</p>
                        {item.wordCount && (
                          <Badge variant="outline" className="text-xs">
                            {item.wordCount.toLocaleString()} words
                          </Badge>
                        )}
                      </div>
                    </div>
                    <button onClick={() => removeItem(item.id)} className="p-1 hover:bg-bg-elevated rounded">
                      <X className="h-4 w-4 text-text-tertiary hover:text-error" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* OR Paste Text */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-center text-text-secondary">OR paste text directly</p>
            <Textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste your blog posts, articles, notes, expertise..."
              className="min-h-[150px] bg-bg-secondary border-border-default"
              maxLength={50000}
            />
            <div className="flex justify-between items-center">
              <span className="text-xs text-text-tertiary">{pasteText.length.toLocaleString()} / 50,000</span>
              <Button
                onClick={addPaste}
                disabled={loading || pasteText.trim().length < 100}
                variant="outline"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Text'}
              </Button>
            </div>
          </div>

          {/* Continue Button */}
          <Button
            onClick={async () => {
              try {
                setLoading(true);

                // Upload all staged files first
                if (stagedFiles.length > 0) {
                  showToast(`Uploading ${stagedFiles.length} file(s)...`, 'info', 2000);
                  for (const stagedFile of stagedFiles) {
                    await uploadFile(stagedFile.file);
                  }
                  setStagedFiles([]);
                  showToast('All files uploaded successfully!', 'success', 2000);
                }

                // Update onboarding step
                await apiFetch('/api/creator/onboarding/step', {
                  method: 'POST',
                  body: JSON.stringify({ step: 'preview' }),
                });

                await refreshAuth();

                // ✅ Set "post-step2 window" flag - allows Step3/4 until user leaves onboarding
                sessionStorage.setItem('selflyx_post_step2_window', '1');

                nav('/onboarding/preview');
              } catch (error) {
                console.error('Failed during continue:', error);
                showToast('Something went wrong. Please try again.', 'error');
              } finally {
                setLoading(false);
              }
            }}
            className="w-full bg-accent-gradient hover:opacity-90 text-white"
            size="lg"
            disabled={!hasMinimumWords || loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Processing...
              </>
            ) : (
              <>
                Continue to Preview
                {stagedFiles.length > 0 && (
                  <span className="ml-2 text-xs opacity-75">
                    (Upload {stagedFiles.length} file{stagedFiles.length > 1 ? 's' : ''})
                  </span>
                )}
              </>
            )}
          </Button>

          <p className="text-xs text-text-tertiary text-center">
            Step 2 of 4 - Your content is encrypted and never shared
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
