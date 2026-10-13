/** A short test tone routed through the chosen output. Never opens a capture device. */
export function startSpeakerTest(outputId = "default") {
  const context = new AudioContext({ latencyHint: "interactive" });
  let audio: HTMLAudioElement | undefined, destination: MediaStreamAudioDestinationNode | undefined;
  let oscillator: OscillatorNode | undefined, gain: GainNode | undefined, timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let finish!: () => void, fail!: (error: unknown) => void;
  const finished = new Promise<void>((resolve, reject) => { finish = resolve; fail = reject; });
  const dispose = () => {
    if (stopped) return;
    stopped = true; if (timer) clearTimeout(timer);
    try { oscillator?.stop(); } catch {}
    for (const node of [oscillator, gain, destination]) { try { node?.disconnect(); } catch {} }
    if (audio) { audio.pause(); audio.srcObject = null; }
    destination?.stream.getTracks().forEach(track => track.stop());
    void context.close().catch(() => undefined);
  };
  const stop = () => { dispose(); finish(); };
  timer = setTimeout(() => { dispose(); fail(new Error("Не удалось запустить тест звука. Проверьте разрешение браузера и устройство вывода.")); }, 2000);
  void (async () => {
    try {
      audio = new Audio(); audio.volume = 1;
      destination = context.createMediaStreamDestination(); audio.srcObject = destination.stream;
      const element = audio as HTMLAudioElement & { setSinkId?: (value: string) => Promise<void> };
      if (typeof element.setSinkId === "function") await element.setSinkId(outputId || "default");
      else if (outputId && outputId !== "default") throw new Error("Этот браузер не поддерживает тест выбранного выхода. Выберите системный выход или другой браузер.");
      if (stopped) return;
      await context.resume();
      if (stopped) return;
      if (context.state !== "running") throw new Error("Браузер не разрешил воспроизведение тестового звука.");
      // A MediaStream element can wait for real samples before resolving play().
      // Start its routed source before awaiting that promise; it has no direct speaker connection.
      const playing = audio.play();
      oscillator = context.createOscillator(); gain = context.createGain();
      oscillator.type = "sine"; oscillator.frequency.value = 440;
      const at = context.currentTime;
      gain.gain.setValueAtTime(0, at); gain.gain.linearRampToValueAtTime(.08, at + .03);
      gain.gain.setValueAtTime(.08, at + .5); gain.gain.linearRampToValueAtTime(0, at + .65);
      oscillator.connect(gain); gain.connect(destination);
      oscillator.onended = () => { dispose(); finish(); };
      oscillator.start(at); oscillator.stop(at + .7);
      await playing;
      if (stopped) return;
      clearTimeout(timer); timer = setTimeout(stop, 1100);
    } catch (error) { if (!stopped) { dispose(); fail(error); } }
  })();
  return { finished, stop };
}
