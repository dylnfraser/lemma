// Plays the clips behind pronunciation buttons (see convertPronunciations). One clip at a time across the page.

let audio: HTMLAudioElement | null = null;
let playingButton: HTMLElement | null = null;

export function stopPronunciation() {
  audio?.pause();
  playingButton?.classList.remove("playing");
  playingButton = null;
}

function play(button: HTMLElement) {
  const wasPlaying = button === playingButton;
  stopPronunciation();
  if (wasPlaying || !button.dataset.audio) return;

  audio = new Audio(button.dataset.audio);
  playingButton = button;
  button.classList.add("playing");
  audio.addEventListener("ended", stopPronunciation, { once: true });
  audio.addEventListener("error", stopPronunciation, { once: true });
  audio.play().catch(stopPronunciation);
}

/** Click handler for containers of Wikipedia HTML. Returns true when the click was a pronunciation button. */
export function handlePronunciationClick(event: MouseEvent): boolean {
  const button = (event.target as Element).closest<HTMLElement>("button.pronounce");
  if (!button) return false;
  event.preventDefault();
  play(button);
  return true;
}
