import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch, apiFetchForm } from '@/lib/api';
import { 
  Upload, FileText, Link as LinkIcon, Youtube, Twitter, 
  Linkedin, File, X, CheckCircle2, Loader2
} from 'lucide-react';

interface ContentItem {
  id: string;
  title: string;
  type: string;
  size?: number;
  wordCount?: number;
}

type TabType = 'files' | 'text' | 'url' | 'social';

export function OnboardingContentPage() {
  const nav = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('files');
  const [pasteText, setPasteText] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  // Stats calculation
  const totalFiles = items.length;
  const totalWords = items.reduce((sum, item) => sum + (item.wordCount || 0), 0);
  const totalSize = items.reduce((sum, item) => sum + (item.size || 0), 0);
  const estimatedHours = Math.ceil(totalWords / 500); // Rough estimate: 500 words/hour
  const qualityScore = totalWords > 10000 ? 'Excellent' : totalWords > 5000 ? 'Great' : totalWords > 1000 ? 'Good' : 'Needs More';

  const refresh = async () => {
    const r = await apiFetch<{ items: ContentItem[] }>('/api/content/list');
    setItems(r.items || []);
  };

  useEffect(() => { 
    refresh().catch(() => {}); 
  }, []);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      for (const file of files) {
        await uploadFile(file);
      }
    }
  }, []);

  const uploadFile = async (file: File) => {
    // Validate file type
    const allowedTypes = ['.pdf', '.txt', '.md', '.docx', '.doc', '.xlsx', '.csv'];
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedTypes.includes(fileExt)) {
      alert(`File type ${fileExt} not supported. Allowed: ${allowedTypes.join(', ')}`);
      return;
    }

    // Validate file size (25 MB max)
    if (file.size > 25 * 1024 * 1024) {
      alert('File size exceeds 25 MB limit');
      return;
    }

    setLoading(true);
    // Use filename as key so it can match item.title
    const fileId = file.name;
    setUploadProgress(prev => ({ ...prev, [fileId]: 0 }));

    let progressInterval: any = null;

    try {
      const fd = new FormData();
      fd.append('file', file);
      
      // Simulate progress (in real app, use XMLHttpRequest for progress tracking)
      progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const current = prev[fileId] || 0;
          if (current < 90) {
            return { ...prev, [fileId]: current + 10 };
          }
          return prev;
        });
      }, 200);

      await apiFetchForm('/api/content/upload', { method: 'POST', body: fd });
      setUploadProgress(prev => ({ ...prev, [fileId]: 100 }));
      
      await refresh();

      setTimeout(() => {
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          delete newProgress[fileId];
          return newProgress;
        });
      }, 1000);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
    } finally {
      if (progressInterval) clearInterval(progressInterval);
      setLoading(false);
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
      alert('Please enter at least 100 characters');
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
    } catch (error) {
      console.error('Failed to add paste:', error);
    } finally {
      setLoading(false);
    }
  };

  const addYoutube = async () => {
    if (!youtubeUrl.trim()) return;
    setLoading(true);
    try {
      await apiFetch('/api/content/youtube', { 
        method: 'POST', 
        body: JSON.stringify({ url: youtubeUrl, title: 'YouTube' }) 
      });
      setYoutubeUrl('');
      await refresh();
    } catch (error) {
      console.error('Failed to add YouTube:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return '📄';
    if (type.includes('text') || type.includes('markdown')) return '📝';
    if (type.includes('word') || type.includes('doc')) return '📊';
    if (type.includes('sheet') || type.includes('excel')) return '📈';
    return '📁';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-6">
          {/* Main Content Area (70%) */}
          <div className="flex-1 space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">Upload Your Content</h1>
              <p className="text-text-secondary">Add your knowledge base to train your AI</p>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-border-default">
              {[
                { id: 'files' as TabType, label: 'Files', icon: File },
                { id: 'text' as TabType, label: 'Text', icon: FileText },
                { id: 'url' as TabType, label: 'URL', icon: LinkIcon },
                { id: 'social' as TabType, label: 'Social', icon: Twitter },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`px-4 py-2 flex items-center gap-2 border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-accent-primary text-accent-primary'
                        : 'border-transparent text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Tab Content */}
            <div className="min-h-[400px]">
              {activeTab === 'files' && (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`min-h-[300px] rounded-xl border-2 border-dashed transition-all duration-200 ${
                    dragActive
                      ? 'border-accent-primary bg-accent-primary/10 shadow-accent-glow'
                      : 'border-accent-primary/50 bg-bg-secondary hover:border-accent-primary'
                  }`}
                >
                  <div className="flex flex-col items-center justify-center h-full p-8 text-center">
                    <Upload className="h-12 w-12 text-accent-primary mb-4" />
                    <p className="text-lg font-semibold mb-2">
                      Drop files here or click to browse
                    </p>
                    <p className="text-sm text-text-secondary mb-4">
                      Supports: PDF, DOCX, TXT, MD, XLSX, CSV (Max 25 MB per file)
                    </p>
                    <input
                      type="file"
                      multiple
                      onChange={(e) => {
                        if (e.target.files) {
                          Array.from(e.target.files).forEach(uploadFile);
                        }
                      }}
                      className="hidden"
                      id="file-upload"
                      accept=".pdf,.txt,.md,.docx,.doc,.xlsx,.csv"
                    />
                    <label htmlFor="file-upload">
                      <Button className="bg-accent-gradient hover:opacity-90 text-white">
                        Choose Files
                      </Button>
                    </label>
                  </div>

                  {/* Uploaded Files List */}
                  {items.length > 0 && (
                    <div className="p-6 space-y-3 border-t border-border-default">
                      <h3 className="font-semibold mb-4">Uploaded Files</h3>
                      {items.map((item) => {
                        const progress = uploadProgress[item.title];
                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 p-3 rounded-lg bg-bg-tertiary border border-border-default"
                          >
                            <span className="text-2xl">{getFileIcon(item.type)}</span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium truncate">{item.title || item.type}</p>
                                {item.size && (
                                  <span className="text-xs text-text-tertiary">
                                    {formatFileSize(item.size)}
                                  </span>
                                )}
                              </div>
                              {progress !== undefined && progress < 100 && (
                                <div className="mt-2">
                                  <div className="h-1 bg-bg-secondary rounded-full overflow-hidden">
                                    <div
                                      className="h-full bg-accent-gradient transition-all duration-300"
                                      style={{ width: `${progress}%` }}
                                    />
                                  </div>
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => removeItem(item.id)}
                              className="p-1 hover:bg-bg-elevated rounded transition-colors"
                            >
                              <X className="h-4 w-4 text-text-tertiary" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'text' && (
                <div className="space-y-4">
                  <Textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    placeholder="Paste your blog posts, articles, social media content..."
                    className="min-h-[300px] bg-bg-secondary border-border-default text-text-primary placeholder:text-text-muted focus:border-accent-primary"
                    maxLength={50000}
                  />
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-text-tertiary">
                      Min 100 characters • {pasteText.length} / 50,000
                    </span>
                    <Button
                      onClick={addPaste}
                      disabled={loading || pasteText.trim().length < 100}
                      className="bg-accent-gradient hover:opacity-90 text-white"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add Text'}
                    </Button>
                  </div>
                </div>
              )}

              {activeTab === 'url' && (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      value={youtubeUrl}
                      onChange={(e) => setYoutubeUrl(e.target.value)}
                      placeholder="https://youtube.com/... or https://medium.com/... or any URL"
                      className="flex-1 bg-bg-secondary border-border-default text-text-primary placeholder:text-text-muted focus:border-accent-primary"
                    />
                    <Button
                      onClick={addYoutube}
                      disabled={loading || !youtubeUrl.trim()}
                      className="bg-accent-gradient hover:opacity-90 text-white"
                    >
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Add URL'}
                    </Button>
                  </div>
                  <p className="text-sm text-text-tertiary">
                    Supports: YouTube (transcript), Medium/Substack articles, Google Docs (public links), Twitter threads
                  </p>
                </div>
              )}

              {activeTab === 'social' && (
                <div className="space-y-4">
                  <p className="text-text-secondary">
                    Connect your social media accounts to import your content automatically
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    {[
                      { name: 'YouTube Channel', icon: Youtube, color: 'bg-red-600', type: 'youtube' as const },
                      { name: 'Twitter/X', icon: Twitter, color: 'bg-black', type: 'twitter' as const },
                      { name: 'Medium', icon: FileText, color: 'bg-black', type: 'medium' as const },
                      { name: 'LinkedIn', icon: Linkedin, color: 'bg-blue-600', type: 'linkedin' as const },
                    ].map((platform) => {
                      const Icon = platform.icon;
                      return (
                        <button
                          key={platform.name}
                          className={`p-6 rounded-xl border-2 border-border-default bg-bg-secondary hover:border-accent-primary transition-all flex items-center gap-3 ${platform.color} text-white`}
                          onClick={async () => {
                            if (platform.type === 'youtube') {
                              const url = window.prompt('Enter your YouTube channel URL');
                              if (!url) return;
                              try {
                                setLoading(true);
                                await apiFetch('/api/content/social/youtube-channel', {
                                  method: 'POST',
                                  body: JSON.stringify({ channelUrl: url }),
                                });
                                await refresh();
                                alert('YouTube channel saved! Full auto-import will come in the next phase.');
                              } catch (err) {
                                console.error(err);
                                alert('Failed to save YouTube channel.');
                              } finally {
                                setLoading(false);
                              }
                            } else if (platform.type === 'twitter') {
                              const handle = window.prompt('Enter your Twitter/X handle (without @)');
                              if (!handle) return;
                              try {
                                setLoading(true);
                                await apiFetch('/api/content/social/twitter', {
                                  method: 'POST',
                                  body: JSON.stringify({ handle }),
                                });
                                await refresh();
                                alert('Twitter profile saved! Full auto-import will come in the next phase.');
                              } catch (err) {
                                console.error(err);
                                alert('Failed to save Twitter profile.');
                              } finally {
                                setLoading(false);
                              }
                            } else {
                              alert('Medium/LinkedIn import will be added in the next phase.');
                            }
                          }}
                        >
                          <Icon className="h-6 w-6" />
                          <div className="flex-1 text-left">
                            <div className="font-semibold">{platform.name}</div>
                            <div className="text-sm opacity-90">
                              Connect
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-xs text-text-tertiary">
                    🔒 We only read your content, never post on your behalf
                  </p>
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex justify-between pt-6 border-t border-border-default">
              <Button
                variant="ghost"
                onClick={() => nav('/onboarding/quiz')}
                className="text-text-secondary hover:text-text-primary"
              >
                Back
              </Button>
              <Button
                onClick={() => nav('/onboarding/plan')}
                className="bg-accent-gradient hover:opacity-90 text-white px-8"
              >
                Continue
              </Button>
            </div>
          </div>

          {/* Stats Sidebar (30%) */}
          <div className="w-[30%] space-y-4">
            <div className="bg-bg-secondary rounded-xl p-6 border border-border-default sticky top-6">
              <h2 className="text-lg font-semibold mb-4">Content Summary</h2>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-text-secondary mb-1">
                    <File className="h-4 w-4" />
                    <span className="text-sm">Total Files</span>
                  </div>
                  <div className="text-2xl font-bold text-text-primary">{totalFiles}</div>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-text-secondary mb-1">
                    <FileText className="h-4 w-4" />
                    <span className="text-sm">Total Words</span>
                  </div>
                  <div className="text-2xl font-bold text-text-primary">
                    {totalWords.toLocaleString()}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-text-secondary mb-1">
                    <Loader2 className="h-4 w-4" />
                    <span className="text-sm">Estimated Training</span>
                  </div>
                  <div className="text-2xl font-bold text-text-primary">
                    ~{estimatedHours} hours
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-text-secondary mb-1">
                    <Upload className="h-4 w-4" />
                    <span className="text-sm">Storage Used</span>
                  </div>
                  <div className="text-2xl font-bold text-text-primary">
                    {formatFileSize(totalSize)}
                  </div>
                  <div className="text-xs text-text-tertiary mt-1">
                    / 100 MB (Free plan)
                  </div>
                </div>

                <div className="pt-4 border-t border-border-default">
                  <div className="flex items-center gap-2 text-text-secondary mb-2">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="text-sm">AI Quality Score</span>
                  </div>
                  <div className={`text-xl font-bold ${
                    qualityScore === 'Excellent' ? 'text-success' :
                    qualityScore === 'Great' ? 'text-success' :
                    qualityScore === 'Good' ? 'text-warning' :
                    'text-error'
                  }`}>
                    {qualityScore}
                  </div>
                  {qualityScore === 'Needs More' && (
                    <p className="text-xs text-text-tertiary mt-1">
                      Add more content for better AI responses
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
