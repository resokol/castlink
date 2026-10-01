export function videoFitGeometry(frameWidth: number, frameHeight: number, sourceWidth: number, sourceHeight: number, angle: number) {
  if (![frameWidth,frameHeight,sourceWidth,sourceHeight].every(value => Number.isFinite(value) && value > 0)) return null;
  const quarterTurn = angle % 180 !== 0;
  const rotatedWidth = quarterTurn ? sourceHeight : sourceWidth;
  const rotatedHeight = quarterTurn ? sourceWidth : sourceHeight;
  const scale = Math.min(frameWidth / rotatedWidth, frameHeight / rotatedHeight);
  return { width: sourceWidth * scale, height: sourceHeight * scale, rotatedWidth: rotatedWidth * scale, rotatedHeight: rotatedHeight * scale };
}

export function applyContainedVideoFit(video: HTMLVideoElement, frame: HTMLElement, angle: number) {
  const fit = videoFitGeometry(frame.clientWidth,frame.clientHeight,video.videoWidth,video.videoHeight,angle);
  if (!fit) return null;
  Object.assign(video.style, {
    position:"absolute",left:"50%",top:"50%",right:"auto",bottom:"auto",margin:"0",
    width:`${fit.width}px`,height:`${fit.height}px`,maxWidth:"none",maxHeight:"none",aspectRatio:"auto",
    objectFit:"contain",objectPosition:"center center",transformOrigin:"center center",
    translate:"-50% -50%",rotate:`${angle}deg`,scale:"1",
  });
  return fit;
}
