// Thin wrapper around the Web Speech API. Browser-only.
// start() returns a controller; callbacks: onText(fullTextSoFar), onEnd(), onError(kind) where
// kind is 'denied' | 'unsupported' | 'failed'.

export function speechSupported(win = globalThis) {
  return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
}

export function startSpeech({ lang, baseText, onText, onEnd, onError }, win = globalThis) {
  const Ctor = win.SpeechRecognition || win.webkitSpeechRecognition;
  if (!Ctor) { onError('unsupported'); return null; }
  let rec;
  try {
    rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 1;
  } catch { onError('unsupported'); return null; }

  const prefix = baseText && !/\s$/.test(baseText) ? baseText + ' ' : (baseText || '');
  let finalText = '';
  let errored = false;

  let ctrl = null;
  let detached = false;
  rec.onresult = (ev) => {
    if (detached) return;
    let interim = '';
    finalText = '';
    for (let i = 0; i < ev.results.length; i++) {
      const r = ev.results[i];
      if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript;
    }
    onText(prefix + finalText + interim);
  };
  rec.onerror = (ev) => {
    if (detached) return;
    errored = true;
    const code = ev && ev.error;
    if (code === 'not-allowed' || code === 'service-not-allowed') onError('denied');
    else if (code === 'no-speech' || code === 'aborted') errored = false; // benign; onend follows
    else onError('failed');
  };
  rec.onend = () => { if (!detached) onEnd(errored, ctrl); };
  try { rec.start(); } catch { onError('failed'); return null; }
  ctrl = {
    stop() { try { rec.stop(); } catch { /* ignore */ } },
    // Detach all handlers so late results/ends cannot touch the UI, then abort.
    cancel() {
      detached = true;
      rec.onresult = rec.onerror = rec.onend = null;
      try { rec.abort(); } catch { /* ignore */ }
    },
  };
  return ctrl;
}
