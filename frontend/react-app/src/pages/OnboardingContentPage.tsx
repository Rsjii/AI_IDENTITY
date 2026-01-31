import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { apiFetch, apiFetchForm } from '@/lib/api';
import {
  Upload, FileText, Link as LinkIcon, Youtube, Twitter,
  Linkedin, Instagram, File, X, CheckCircle2, Loader2, AlertCircle,
  FileImage, FileSpreadsheet, Star, Sparkles, TrendingUp,
  Check, ExternalLink
} from 'lucide-react';

interface ContentItem {
  id: string;
  title: string;
  type: string;
  size?: number;
  wordCount?: number;
}

interface SocialConnection {
  platform: string;
  connected: boolean;
  username?: string;
  itemCount?: number;
}

type TabType = 'files' | 'text' | 'url' | 'social';

const QUALITY_THRESHOLDS = {
  excellent: { min: 10000, label: 'Excellent', color: 'from-emerald-500 to-emerald-600', bg: 'bg-emerald-500' },
  great: { min: 5000, label: 'Great', color: 'from-green-500 to-green-600', bg: 'bg-green-500' },
  good: { min: 2000, label: 'Good', color: 'from-yellow-500 to-yellow-600', bg: 'bg-yellow-500' },
  fair: { min: 500, label: 'Fair', color: 'from-orange-500 to-orange-600', bg: 'bg-orange-500' },
  needsMore: { min: 0, label: 'Needs More', color: 'from-red-500 to-red-600', bg: 'bg-red-500' }
};

export function OnboardingContentPage() {
  const nav = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('files');
  const [pasteText, setPasteText] = useState('');
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [socialConnections, setSocialConnections] = useState<SocialConnection[]>([
    { platform: 'youtube', connected: false },
    { platform: 'twitter', connected: false },
    { platform: 'instagram', connected: false },
    { platform: 'linkedin', connected: false },
    { platform: 'medium', connected: false },
  ]);

  // Stats calculation
  const totalFiles = items.length;
  const totalWords = items.reduce((sum, item) => sum + (item.wordCount || 0), 0);
  const totalSize = items.reduce((sum, item) => sum + (item.size || 0), 0);
  const estimatedHours = Math.ceil(totalWords / 500);
  const minimumItemsRequired = 3;
  const hasMinimumItems = totalFiles >= minimumItemsRequired;

  // Quality score calculation
  const getQualityTier = () => {
    if (totalWords >= QUALITY_THRESHOLDS.excellent.min) return QUALITY_THRESHOLDS.excellent;
    if (totalWords >= QUALITY_THRESHOLDS.great.min) return QUALITY_THRESHOLDS.great;
    if (totalWords >= QUALITY_THRESHOLDS.good.min) return QUALITY_THRESHOLDS.good;
    if (totalWords >= QUALITY_THRESHOLDS.fair.min) return QUALITY_THRESHOLDS.fair;
    return QUALITY_THRESHOLDS.needsMore;
  };

  const qualityTier = getQualityTier();
  const qualityProgress = Math.min((totalWords / QUALITY_THRESHOLDS.excellent.min) * 100, 100);

  // Content breakdown by type
  const contentBreakdown = items.reduce((acc, item) => {
    const type = item.type.includes('pdf') ? 'pdf'
      : item.type.includes('word') || item.type.includes('doc') ? 'doc'
      : item.type.includes('text') || item.type.includes('markdown') ? 'text'
      : item.type.includes('sheet') || item.type.includes('excel') || item.type.includes('csv') ? 'spreadsheet'
      : item.type.includes('youtube') ? 'youtube'
      : item.type.includes('paste') ? 'paste'
      : 'other';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

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
    const allowedTypes = ['.pdf', '.txt', '.md', '.docx', '.doc', '.xlsx', '.csv'];
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!allowedTypes.includes(fileExt)) {
      alert(`File type ${fileExt} not supported. Allowed: ${allowedTypes.join(', ')}`);
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      alert('File size exceeds 25 MB limit');
      return;
    }

    setLoading(true);
    const fileId = file.name;
    setUploadProgress(prev => ({ ...prev, [fileId]: 0 }));

    let progressInterval: any = null;

    try {
      const fd = new FormData();
      fd.append('file', file);

      progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          const current = prev[fileId] || 0;
          if (current < 90) {
            return { ...prev, [fileId]: current + 10 };
          }
          return prev;
        });
      }, 200);

      // ✅ apiFetchForm already handles X-CSRF-Token header automatically
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
      const input = youtubeUrl.trim();
      const isYouTube = /(^https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\//i.test(input);
      const endpoint = isYouTube ? '/api/content/youtube' : '/api/content/url';

      await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({ url: input, title: isYouTube ? 'YouTube' : 'URL' })
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
    if (type.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
    if (type.includes('text') || type.includes('markdown')) return <FileText className="h-5 w-5 text-blue-500" />;
    if (type.includes('word') || type.includes('doc')) return <FileText className="h-5 w-5 text-blue-600" />;
    if (type.includes('sheet') || type.includes('excel') || type.includes('csv')) return <FileSpreadsheet className="h-5 w-5 text-green-500" />;
    if (type.includes('youtube')) return <Youtube className="h-5 w-5 text-red-500" />;
    if (type.includes('paste')) return <FileText className="h-5 w-5 text-purple-500" />;
    return <File className="h-5 w-5 text-gray-500" />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const handleSocialConnect = async (platform: string) => {
    if (platform === 'youtube') {
      const url = window.prompt('Enter your YouTube channel URL');
      if (!url) return;
      try {
        setLoading(true);
        await apiFetch('/api/content/social/youtube-channel', {
          method: 'POST',
          body: JSON.stringify({ channelUrl: url }),
        });
        setSocialConnections(prev => prev.map(c =>
          c.platform === 'youtube' ? { ...c, connected: true, username: url } : c
        ));
        await refresh();
        alert('YouTube channel saved! Content will be imported shortly.');
      } catch (err) {
        console.error(err);
        alert('Failed to save YouTube channel.');
      } finally {
        setLoading(false);
      }
    } else if (platform === 'twitter') {
      try {
        setLoading(true);
        window.location.href = '/api/content/social/twitter/authorize';
      } catch (err) {
        console.error(err);
        alert('Failed to connect Twitter.');
        setLoading(false);
      }
    } else if (platform === 'instagram') {
      try {
        setLoading(true);
        window.location.href = '/api/content/social/instagram/authorize';
      } catch (err) {
        console.error(err);
        alert('Failed to connect Instagram.');
        setLoading(false);
      }
    } else if (platform === 'linkedin') {
      alert(
        'LinkedIn import uses Extension (official API is restricted). Go to Account → create Extension Token → install extension → paste token → click Import.'
      );
      nav('/account');
    } else {
      alert(`${platform.charAt(0).toUpperCase() + platform.slice(1)} import will be added in the next phase.`);
    }
  };

  const getSocialIcon = (platform: string) => {
    switch (platform) {
      case 'youtube': return <Youtube className="h-6 w-6" />;
      case 'twitter': return <Twitter className="h-6 w-6" />;
      case 'instagram': return <Instagram className="h-6 w-6" />;
      case 'medium': return <FileText className="h-6 w-6" />;
      case 'linkedin': return <Linkedin className="h-6 w-6" />;
      default: return <ExternalLink className="h-6 w-6" />;
    }
  };

  const getSocialColor = (platform: string) => {
    switch (platform) {
      case 'youtube': return 'bg-red-600 hover:bg-red-700';
      case 'twitter': return 'bg-black hover:bg-gray-900';
      case 'instagram': return 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700';
      case 'medium': return 'bg-black hover:bg-gray-900';
      case 'linkedin': return 'bg-blue-600 hover:bg-blue-700';
      default: return 'bg-gray-600 hover:bg-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex gap-6">
          {/* Main Content Area (70%) */}
          <div className="flex-1 space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">Upload Your Content</h1>
              <p className="text-text-secondary">Add your knowledge base to train your AI clone</p>
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
                      ref={fileInputRef}
                      onChange={(e) => {
                        if (e.target.files) {
                          Array.from(e.target.files).forEach(uploadFile);
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

                  {/* Uploaded Files List */}
                  {items.length > 0 && (
                    <div className="p-6 space-y-3 border-t border-border-default">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold">Uploaded Content ({items.length})</h3>
                        <Badge variant="outline" className="text-xs">
                          {formatFileSize(totalSize)} total
                        </Badge>
                      </div>
                      {items.map((item) => {
                        const progress = uploadProgress[item.title];
                        return (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 p-3 rounded-lg bg-bg-tertiary border border-border-default hover:border-accent-primary/50 transition-colors"
                          >
                            <div className="flex-shrink-0">
                              {getFileIcon(item.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium truncate">{item.title || item.type}</p>
                                {item.size && (
                                  <Badge variant="outline" className="text-xs">
                                    {formatFileSize(item.size)}
                                  </Badge>
                                )}
                                {item.wordCount && (
                                  <Badge variant="outline" className="text-xs bg-accent-primary/10">
                                    {item.wordCount.toLocaleString()} words
                                  </Badge>
                                )}
                              </div>
                              {progress !== undefined && progress < 100 && (
                                <div className="mt-2">
                                  <Progress value={progress} className="h-1" />
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => removeItem(item.id)}
                              className="p-1 hover:bg-bg-elevated rounded transition-colors"
                            >
                              <X className="h-4 w-4 text-text-tertiary hover:text-error" />
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
                    placeholder="Paste your blog posts, articles, social media content, notes, expertise..."
                    className="min-h-[300px] bg-bg-secondary border-border-default text-text-primary placeholder:text-text-muted focus:border-accent-primary"
                    maxLength={50000}
                  />
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-text-tertiary">
                        Min 100 characters
                      </span>
                      <Badge variant={pasteText.length >= 100 ? 'default' : 'outline'} className="text-xs">
                        {pasteText.length.toLocaleString()} / 50,000
                      </Badge>
                      {pasteText.length >= 100 && (
                        <Badge className="text-xs bg-green-500/10 text-green-500 border-green-500/20">
                          <Check className="h-3 w-3 mr-1" />
                          Ready to add
                        </Badge>
                      )}
                    </div>
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
                      placeholder="https://youtube.com/... or any URL with content"
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
                  <div className="rounded-lg bg-bg-secondary border border-border-default p-4">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-accent-primary" />
                      Supported URL Types
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-text-secondary">
                        <Youtube className="h-4 w-4 text-red-500" />
                        YouTube videos (transcript)
                      </div>
                      <div className="flex items-center gap-2 text-text-secondary">
                        <FileText className="h-4 w-4 text-green-500" />
                        Medium / Substack articles
                      </div>
                      <div className="flex items-center gap-2 text-text-secondary">
                        <FileText className="h-4 w-4 text-blue-500" />
                        Google Docs (public links)
                      </div>
                      <div className="flex items-center gap-2 text-text-secondary">
                        <Twitter className="h-4 w-4 text-black dark:text-white" />
                        Twitter/X threads
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'social' && (
                <div className="space-y-6">
                  <div className="rounded-lg bg-gradient-to-r from-accent-primary/10 to-purple-500/10 border border-accent-primary/20 p-4">
                    <h4 className="font-medium mb-1 flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-accent-primary" />
                      Import from Social Media
                    </h4>
                    <p className="text-sm text-text-secondary">
                      Connect your accounts to automatically import your best content
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {socialConnections.map((connection) => {
                      const isConnected = connection.connected;
                      return (
                        <button
                          key={connection.platform}
                          onClick={() => handleSocialConnect(connection.platform)}
                          className={`relative p-6 rounded-xl border-2 transition-all ${
                            isConnected
                              ? 'border-green-500/50 bg-green-500/5'
                              : 'border-border-default bg-bg-secondary hover:border-accent-primary/50'
                          }`}
                        >
                          {isConnected && (
                            <div className="absolute top-3 right-3">
                              <Badge className="bg-green-500 text-white text-xs">
                                <Check className="h-3 w-3 mr-1" />
                                Connected
                              </Badge>
                            </div>
                          )}
                          <div className={`inline-flex p-3 rounded-lg mb-3 ${getSocialColor(connection.platform)} text-white`}>
                            {getSocialIcon(connection.platform)}
                          </div>
                          <div className="text-left">
                            <div className="font-semibold capitalize mb-1">
                              {connection.platform === 'twitter' ? 'Twitter / X' : connection.platform}
                            </div>
                            <div className="text-sm text-text-secondary">
                              {isConnected
                                ? `${connection.itemCount || 0} items imported`
                                : 'Click to connect'}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2 text-xs text-text-tertiary bg-bg-secondary rounded-lg p-3">
                    <AlertCircle className="h-4 w-4" />
                    We only read your public content. We never post on your behalf.
                  </div>
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
              <div className="flex flex-col items-end gap-2">
                <Button
                  onClick={() => nav('/onboarding/plan')}
                  className="bg-accent-gradient hover:opacity-90 text-white px-8"
                  disabled={!hasMinimumItems}
                >
                  Continue
                </Button>
                {!hasMinimumItems && (
                  <span className="text-xs text-text-tertiary">
                    Add at least {minimumItemsRequired} items to continue
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats Sidebar (30%) */}
          <div className="w-[30%] space-y-4">
            {/* Quality Score Card */}
            <div className="bg-bg-secondary rounded-xl p-6 border border-border-default sticky top-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Star className="h-5 w-5 text-accent-primary" />
                AI Quality Score
              </h2>

              {/* Visual Quality Gauge */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-2xl font-bold bg-gradient-to-r ${qualityTier.color} bg-clip-text text-transparent`}>
                    {qualityTier.label}
                  </span>
                  <span className="text-sm text-text-tertiary">
                    {Math.round(qualityProgress)}%
                  </span>
                </div>
                <div className="h-3 bg-bg-tertiary rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-gradient-to-r ${qualityTier.color} transition-all duration-500`}
                    style={{ width: `${qualityProgress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-text-tertiary mt-1">
                  <span>0</span>
                  <span>2K</span>
                  <span>5K</span>
                  <span>10K+ words</span>
                </div>
              </div>

              {/* Quality Tips */}
              {totalWords < 5000 && (
                <div className="mb-6 rounded-lg bg-accent-primary/10 border border-accent-primary/20 p-3">
                  <div className="flex items-start gap-2">
                    <TrendingUp className="h-4 w-4 text-accent-primary mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium text-accent-primary">Improve your AI</p>
                      <p className="text-text-secondary text-xs mt-1">
                        {totalWords < 1000
                          ? 'Add more content for better responses. Aim for at least 2,000 words.'
                          : totalWords < 2000
                          ? 'Good start! Add more content to reach "Good" quality.'
                          : 'Great progress! Aim for 5,000+ words for best results.'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Stats */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center gap-2 text-text-secondary mb-1">
                    <File className="h-4 w-4" />
                    <span className="text-sm">Content Items</span>
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
                    <span className="text-sm">Est. Training Time</span>
                  </div>
                  <div className="text-2xl font-bold text-text-primary">
                    ~{estimatedHours} {estimatedHours === 1 ? 'hour' : 'hours'}
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
                  <div className="mt-1">
                    <Progress
                      value={(totalSize / (100 * 1024 * 1024)) * 100}
                      className="h-1.5"
                    />
                    <div className="text-xs text-text-tertiary mt-1">
                      / 100 MB (Free plan)
                    </div>
                  </div>
                </div>
              </div>

              {/* Content Breakdown */}
              {Object.keys(contentBreakdown).length > 0 && (
                <div className="mt-6 pt-4 border-t border-border-default">
                  <h3 className="text-sm font-medium text-text-secondary mb-3">Content Breakdown</h3>
                  <div className="space-y-2">
                    {Object.entries(contentBreakdown).map(([type, count]) => (
                      <div key={type} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          {type === 'pdf' && <FileText className="h-3.5 w-3.5 text-red-500" />}
                          {type === 'doc' && <FileText className="h-3.5 w-3.5 text-blue-500" />}
                          {type === 'text' && <FileText className="h-3.5 w-3.5 text-gray-500" />}
                          {type === 'spreadsheet' && <FileSpreadsheet className="h-3.5 w-3.5 text-green-500" />}
                          {type === 'youtube' && <Youtube className="h-3.5 w-3.5 text-red-500" />}
                          {type === 'paste' && <FileText className="h-3.5 w-3.5 text-purple-500" />}
                          {type === 'other' && <File className="h-3.5 w-3.5 text-gray-400" />}
                          <span className="capitalize text-text-secondary">{type}</span>
                        </div>
                        <Badge variant="outline" className="text-xs">{count}</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
