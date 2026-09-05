import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Image as ImageIcon, Mic, Send, Smile, Square, X } from 'lucide-react';
import { useAuth } from '@/auth/AuthProvider';
import { uploadMedia } from '@/lib/pulseApi';
import { EmojiPicker } from './EmojiPicker';

interface Attachment {
  url: string;
  type: 'image' | 'audio';
  previewUrl: string;
}

interface MessageComposerProps {
  disabled?: boolean;
  placeholder?: string;
  onSend: (text: string, attachment?: { url: string; type: 'image' | 'audio' } | null) => void;
}

export function MessageComposer({ disabled, placeholder = 'Message PULSE…', onSend }: MessageComposerProps) {
  const { user } = useAuth();
  const [value, setValue] = useState('');
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [error, setError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<ReturnType<typeof setInterval>>();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!value.trim() && !attachment) return;
    onSend(value.trim() || (attachment?.type === 'image' ? 'Sent a photo' : 'Sent a voice message'), attachment ? { url: attachment.url, type: attachment.type } : null);
    setValue('');
    setAttachment(null);
  };

  const pickImage = () => fileInputRef.current?.click();

  const onFileChosen = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !user) return;
    setUploading(true); setError('');
    try {
      const url = await uploadMedia(file, 'image', user.id);
      setAttachment({ url, type: 'image', previewUrl: url });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload image');
    } finally {
      setUploading(false);
    }
  };

  const startRecording = async () => {
    if (!user) return;
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (evt) => audioChunksRef.current.push(evt.data);
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(recordTimerRef.current);
        setRecordSeconds(0);
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setUploading(true);
        try {
          const url = await uploadMedia(blob, 'audio', user.id);
          setAttachment({ url, type: 'audio', previewUrl: url });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not upload voice note');
        } finally {
          setUploading(false);
        }
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      setError('Microphone access was denied or is unavailable.');
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const insertEmoji = (emoji: string) => {
    setValue((v) => v + emoji);
    setEmojiOpen(false);
  };

  const busy = disabled || uploading;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md px-3 pb-3">
      {error && <p className="mb-1.5 rounded-lg bg-ember-500/10 px-3 py-1.5 text-xs text-ember-300">{error}</p>}

      {attachment && (
        <div className="mb-1.5 flex items-center gap-2 rounded-xl glass-strong p-2">
          {attachment.type === 'image' ? (
            <img src={attachment.previewUrl} alt="Attached" className="h-10 w-10 rounded-lg object-cover" />
          ) : (
            <audio src={attachment.previewUrl} controls className="h-8 flex-1" />
          )}
          <button type="button" onClick={() => setAttachment(null)} className="icon-btn h-7 w-7 shrink-0"><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      <form onSubmit={submit} className="relative flex items-center gap-1.5 rounded-2xl glass-strong p-1.5 shadow-card">
        <input ref={fileInputRef} type="file" accept="image/*" onChange={onFileChosen} className="hidden" />

        <button type="button" onClick={pickImage} disabled={busy || recording} className="icon-btn h-9 w-9 shrink-0 disabled:opacity-40" aria-label="Upload a picture">
          <ImageIcon className="h-4 w-4" />
        </button>

        {recording ? (
          <div className="flex flex-1 items-center gap-2 px-2 text-sm text-ember-300">
            <span className="h-2 w-2 animate-pulse rounded-full bg-ember-400" /> Recording… {recordSeconds}s
          </div>
        ) : (
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={uploading ? 'Uploading…' : placeholder}
            disabled={busy}
            className="min-w-0 flex-1 bg-transparent text-sm text-ink-50 placeholder:text-ink-500 focus:outline-none"
          />
        )}

        <button type="button" onClick={() => setEmojiOpen((v) => !v)} disabled={busy || recording} className="icon-btn h-9 w-9 shrink-0 border-0 bg-transparent disabled:opacity-40" aria-label="Emoji">
          <Smile className="h-4 w-4" />
        </button>
        {emojiOpen && <EmojiPicker onPick={insertEmoji} onClose={() => setEmojiOpen(false)} />}

        <button
          type="button"
          onClick={recording ? stopRecording : startRecording}
          disabled={busy}
          className={`icon-btn h-9 w-9 shrink-0 border-0 bg-transparent disabled:opacity-40 ${recording ? 'text-ember-400' : ''}`}
          aria-label={recording ? 'Stop recording' : 'Record a voice message'}
        >
          {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </button>

        <button
          type="submit"
          disabled={busy || recording || (!value.trim() && !attachment)}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#7c3aed] to-[#06b6d4] text-white shadow-glow disabled:opacity-30"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
