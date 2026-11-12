/**
 * Synthesised paper-swish for the envelope opening.
 *
 * No audio asset: filtered noise with a rising band-pass gives the paper, a
 * short sine sweep gives it some weight. Called from a click handler, which is
 * the user gesture browsers require before audio may start.
 */

let ctx: AudioContext | null = null;

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!ctx || ctx.state === 'closed') ctx = new Ctor();
  return ctx;
}

export function playPaperOpen(): void {
  try {
    const ac = audioContext();
    if (!ac) return;
    if (ac.state === 'suspended') void ac.resume();

    const now = ac.currentTime;
    const duration = 0.42;

    const frames = Math.floor(ac.sampleRate * duration);
    const buffer = ac.createBuffer(1, frames, ac.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < frames; i += 1) {
      const t = i / frames;
      samples[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2);
    }

    const source = ac.createBufferSource();
    source.buffer = buffer;

    const band = ac.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 1.1;
    band.frequency.setValueAtTime(1200, now);
    band.frequency.exponentialRampToValueAtTime(3200, now + 0.22);
    band.frequency.exponentialRampToValueAtTime(1500, now + duration);

    const paper = ac.createGain();
    paper.gain.setValueAtTime(0.0001, now);
    paper.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
    paper.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    const body = ac.createOscillator();
    body.type = 'sine';
    body.frequency.setValueAtTime(150, now);
    body.frequency.exponentialRampToValueAtTime(70, now + 0.18);

    const bodyGain = ac.createGain();
    bodyGain.gain.setValueAtTime(0.0001, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.055, now + 0.015);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

    source.connect(band).connect(paper).connect(ac.destination);
    body.connect(bodyGain).connect(ac.destination);

    source.onended = () => {
      source.disconnect();
      band.disconnect();
      paper.disconnect();
    };
    body.onended = () => {
      body.disconnect();
      bodyGain.disconnect();
    };

    source.start(now);
    body.start(now);
    source.stop(now + duration);
    body.stop(now + 0.3);
  } catch {
    // Sound is decoration: never let an audio failure interrupt the invitation.
  }
}
