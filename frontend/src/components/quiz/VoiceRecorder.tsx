"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Square, Loader2, AlertCircle } from "lucide-react";
import { apiClient, getErrorMessage } from "@/lib/api";

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
  className?: string;
}

type RecordingState = "idle" | "requesting" | "recording" | "transcribing" | "error";

interface VoiceRecorderError {
  message: string;
  type: "permission" | "not_supported" | "transcription" | "unknown";
}

export function VoiceRecorder({
  onTranscription,
  disabled = false,
  className = "",
}: VoiceRecorderProps) {
  const [state, setState] = useState<RecordingState>("idle");
  const [error, setError] = useState<VoiceRecorderError | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getByteFrequencyData = (analyser: AnalyserNode, dataArray: Uint8Array | any) => {
    analyser.getByteFrequencyData(dataArray);
  };
  const animationFrameRef = useRef<number | null>(null);
  const [audioLevels, setAudioLevels] = useState<number[]>([0, 0, 0, 0, 0]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRecording();
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Update waveform based on audio analysis
  const updateWaveform = useCallback(() => {
    if (!analyserRef.current || !dataArrayRef.current) {
      // Fallback: animate bars with sine wave pattern
      setAudioLevels(prev =>
        prev.map((_, i) => {
          const time = Date.now() / 200;
          const base = Math.sin(time + i * 0.8) * 0.3 + 0.4;
          const noise = Math.random() * 0.3;
          return Math.min(1, Math.max(0.1, base + noise));
        })
      );
      animationFrameRef.current = requestAnimationFrame(updateWaveform);
      return;
    }

    getByteFrequencyData(analyserRef.current, dataArrayRef.current);

    // Sample 5 frequency bands
    const levels = [0, 1, 2, 3, 4].map(i => {
      const start = Math.floor((dataArrayRef.current!.length / 5) * i);
      const end = Math.floor((dataArrayRef.current!.length / 5) * (i + 1));
      let sum = 0;
      for (let j = start; j < end; j++) {
        sum += dataArrayRef.current![j];
      }
      const average = sum / (end - start);
      return Math.min(1, Math.max(0.1, average / 128));
    });

    setAudioLevels(levels);
    animationFrameRef.current = requestAnimationFrame(updateWaveform);
  }, []);

  const startRecording = async () => {
    setError(null);
    setState("requesting");

    try {
      // Check browser support
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Your browser doesn't support audio recording");
      }

      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      streamRef.current = stream;

      // Set up audio analysis for waveform
      try {
        const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
        audioContextRef.current = audioContext;

        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 256;
        analyserRef.current = analyser;

        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        dataArrayRef.current = new Uint8Array(bufferLength);
      } catch (audioErr) {
        // Audio analysis not critical - continue without it
        console.warn("Audio analysis not available:", audioErr);
      }

      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "audio/mp4"
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop duration timer
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
          durationIntervalRef.current = null;
        }

        // Stop waveform animation
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }

        // Create audio blob
        const audioBlob = new Blob(audioChunksRef.current, {
          type: mediaRecorder.mimeType
        });

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;

        // Transcribe
        await transcribeAudio(audioBlob);
      };

      mediaRecorder.onerror = () => {
        setError({
          message: "Recording error occurred",
          type: "unknown"
        });
        setState("error");
        stopRecording();
      };

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      setState("recording");
      setRecordingDuration(0);

      // Start duration timer
      durationIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);

      // Start waveform animation
      updateWaveform();

    } catch (err) {
      const errMsg = getErrorMessage(err);

      if (err instanceof Error) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setError({
            message: "Microphone permission denied. Please allow access and try again.",
            type: "permission"
          });
        } else if (err.name === "NotFoundError") {
          setError({
            message: "No microphone found. Please connect a microphone and try again.",
            type: "not_supported"
          });
        } else {
          setError({
            message: errMsg,
            type: "unknown"
          });
        }
      } else {
        setError({
          message: errMsg,
          type: "unknown"
        });
      }

      setState("error");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (state === "recording") {
      setState("transcribing");
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    setState("transcribing");

    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const response = await apiClient.postFormData("/voice/transcribe", formData);

      if (response.text) {
        onTranscription(response.text);
        setState("idle");
      } else {
        throw new Error("No transcription received");
      }
    } catch (err) {
      setError({
        message: `Transcription failed: ${getErrorMessage(err)}`,
        type: "transcription"
      });
      setState("error");
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleDismissError = () => {
    setError(null);
    setState("idle");
  };

  const isRecording = state === "recording";
  const isBusy = state === "requesting" || state === "transcribing";

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Error display */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-3 rounded-lg bg-semantic-error/10 border border-semantic-error/30 text-semantic-error text-sm flex items-start gap-2"
          >
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p>{error.message}</p>
              <button
                onClick={handleDismissError}
                className="text-xs underline mt-1 hover:no-underline"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recording controls */}
      <div className="flex items-center gap-4">
        {/* Mic button */}
        <motion.button
          onClick={isRecording ? stopRecording : startRecording}
          disabled={disabled || isBusy}
          whileHover={disabled || isBusy ? undefined : { scale: 1.05 }}
          whileTap={disabled || isBusy ? undefined : { scale: 0.95 }}
          className={`
            relative flex items-center justify-center
            w-12 h-12 rounded-full
            transition-all duration-200
            disabled:opacity-50 disabled:cursor-not-allowed
            ${isRecording
              ? "bg-[var(--semantic-error)] text-white shadow-[0_0_15px_rgba(239,68,68,0.4)]"
              : "bg-[var(--brand-primary)] text-[var(--surface-dark)] hover:bg-opacity-90 shadow-[0_0_15px_rgba(205,119,106,0.25)]"
            }
          `}
        >
          {isBusy ? (
            <Loader2 size={20} className="animate-spin" />
          ) : isRecording ? (
            <Square size={18} fill="currentColor" />
          ) : (
            <Mic size={20} />
          )}

          {/* Recording indicator ring */}
          {isRecording && (
            <motion.span
              className="absolute inset-0 rounded-full border-2 border-[var(--semantic-error)]"
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
          )}
        </motion.button>

        {/* Waveform visualization (shown during recording) */}
        <AnimatePresence>
          {isRecording && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              className="flex items-center gap-1 overflow-hidden"
            >
              {audioLevels.map((level, i) => (
                <motion.div
                  key={i}
                  className="w-1.5 rounded-full bg-brand-primary"
                  animate={{
                    height: `${Math.max(8, level * 40)}px`,
                    opacity: 0.6 + level * 0.4,
                  }}
                  transition={{
                    duration: 0.1,
                    ease: "easeOut",
                  }}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Duration display */}
        <AnimatePresence>
          {isRecording && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-sm font-mono text-text-muted tabular-nums"
            >
              {formatDuration(recordingDuration)}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Transcribing indicator */}
        <AnimatePresence>
          {state === "transcribing" && (
            <motion.span
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="text-sm text-text-muted flex items-center gap-2"
            >
              <Loader2 size={14} className="animate-spin" />
              Transcribing...
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* Helper text */}
      <p className="text-xs text-text-muted">
        {state === "idle" && "Click the mic to record your answer"}
        {state === "recording" && "Recording... Click stop when done"}
        {state === "transcribing" && "Converting speech to text..."}
        {state === "requesting" && "Requesting microphone access..."}
      </p>
    </div>
  );
}
