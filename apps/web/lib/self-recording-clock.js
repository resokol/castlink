// The next tick is requested after the previous frame has been drawn.
self.onmessage = () => setTimeout(() => self.postMessage(null), 40);
