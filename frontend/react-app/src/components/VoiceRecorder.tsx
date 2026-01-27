import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Pause, Play } from 'lucide-react';

interface VoiceRecorderProps {
  onUpload: (blob: Blob) => Promise<void>;
  onSkip?: () => void;
}

export function VoiceRecorder({ onUpload, onSkip }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const MAX_DURATION = 600; // 10 minutes in seconds

  useEffect(() => {
    if (recording && !paused) {
      timerRef.current = setInterval(() => {
        setDuration((d) => {
          if (d >= MAX_DURATION) {
            stopRecording();
            return MAX_DURATION;
          }
          return d + 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [recording, paused]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      mediaRecorder.current = new MediaRecorder(stream);

      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.current.push(e.data);
        }
      };

      mediaRecorder.current.onstop = () => {
        const blob = new Blob(chunks.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.current.start();
      setRecording(true);
      setPaused(false);
      chunks.current = [];
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to access microphone. Please check permissions.');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorder.current && recording && !paused) {
      mediaRecorder.current.pause();
      setPaused(true);
    }
  };

  const resumeRecording = () => {
    if (mediaRecorder.current && paused) {
      mediaRecorder.current.resume();
      setPaused(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && recording) {
      mediaRecorder.current.stop();
      setRecording(false);
      setPaused(false);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
  };

  const handleUpload = async () => {
    if (chunks.current.length === 0) return;

    const blob = new Blob(chunks.current, { type: 'audio/webm' });
    await onUpload(blob);
    setDuration(0);
    setAudioUrl(null);
    chunks.current = [];
  };

  const handleSkip = () => {
    stopRecording();
    if (onSkip) {
      onSkip();
    }
  };

  return (
    <div className="space-y-4 p-6 border rounded-lg">
      <div className="text-center space-y-2">
        <div className="text-2xl font-bold">{formatTime(duration)}</div>
        <div className="text-sm text-muted-foreground">
          Target: 10 minutes • {duration >= MAX_DURATION ? 'Maximum reached' : `${MAX_DURATION - duration}s remaining`}
        </div>
      </div>

      {/* Waveform placeholder */}
      <div className="h-20 bg-muted rounded-lg flex items-center justify-center">
        {recording && !paused ? (
          <div className="flex gap-1 items-end h-12">
            {Array.from({ length: 20 }).map((_, i) => (
              <div
                key={i}
                className="w-1 bg-primary rounded-full animate-pulse"
                style={{
                  height: `${Math.random() * 60 + 20}%`,
                  animationDelay: `${i * 50}ms`,
                }}
              />
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">Waveform visualization</div>
        )}
      </div>

      <div className="flex justify-center gap-2">
        {!recording ? (
          <Button onClick={startRecording} size="lg">
            <Mic className="mr-2 h-4 w-4" />
            Start Recording
          </Button>
        ) : (
          <>
            {paused ? (
              <Button onClick={resumeRecording} variant="outline">
                <Play className="mr-2 h-4 w-4" />
                Resume
              </Button>
            ) : (
              <Button onClick={pauseRecording} variant="outline">
                <Pause className="mr-2 h-4 w-4" />
                Pause
              </Button>
            )}
            <Button onClick={stopRecording} variant="destructive">
              <Square className="mr-2 h-4 w-4" />
              Stop
            </Button>
          </>
        )}
      </div>

      {audioUrl && !recording && (
        <div className="space-y-2">
          <audio controls src={audioUrl} className="w-full" />
          <div className="flex gap-2">
            <Button onClick={handleUpload} className="flex-1">
              Upload Recording
            </Button>
            <Button onClick={handleSkip} variant="outline">
              Record Again
            </Button>
          </div>
        </div>
      )}

      {onSkip && !recording && (
        <Button onClick={handleSkip} variant="ghost" className="w-full">
          Skip for now
        </Button>
      )}
    </div>
  );
}


