interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult:
    ((e: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

type Ctor = new () => SpeechRecognitionLike;

function recognitionCtor(): Ctor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: Ctor; webkitSpeechRecognition?: Ctor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const captionsSupported = () => recognitionCtor() !== null;

/**
 * Live captions of the local speaker via the Web Speech API. Each participant transcribes
 * their own microphone and shares the text, so everyone sees captions for everyone.
 * Note: some browsers send audio to a cloud speech service to do this.
 */
export class LiveCaptions {
  private rec?: SpeechRecognitionLike;
  private running = false;

  constructor(private readonly onText: (text: string, final: boolean) => void) {}

  start(lang = typeof navigator !== "undefined" ? navigator.language : "en-US") {
    const Rec = recognitionCtor();
    if (!Rec || this.running) return false;
    const rec = new Rec();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;
    rec.onresult = (e) => {
      let text = "";
      let final = false;
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
        final = final || e.results[i].isFinal;
      }
      if (text.trim()) this.onText(text.trim().slice(-300), final);
    };
    // Recognition stops on silence; keep it going while captions are on.
    rec.onend = () => this.running && rec.start();
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") this.stop();
    };
    this.rec = rec;
    this.running = true;
    rec.start();
    return true;
  }

  stop() {
    this.running = false;
    this.rec?.stop();
    this.rec = undefined;
  }
}
