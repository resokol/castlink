"use client";

type WebkitDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type WebkitElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

const cssClass = "castlink-css-fullscreen";
const lockClass = "castlink-fullscreen-lock";

export function isElementFullscreen(element: HTMLElement) {
  const doc = document as WebkitDocument;
  return document.fullscreenElement === element || doc.webkitFullscreenElement === element || element.classList.contains(cssClass);
}

export function exitCssFullscreen(element: HTMLElement) {
  element.classList.remove(cssClass);
  if (!document.querySelector(`.${cssClass}`)) {
    document.documentElement.classList.remove(lockClass);
    document.body.classList.remove(lockClass);
  }
}

export async function toggleElementFullscreen(element: HTMLElement) {
  const doc = document as WebkitDocument;
  const webkitElement = element as WebkitElement;

  if (element.classList.contains(cssClass)) {
    exitCssFullscreen(element);
    return;
  }
  if (document.fullscreenElement === element) {
    await document.exitFullscreen();
    return;
  }
  if (doc.webkitFullscreenElement === element && doc.webkitExitFullscreen) {
    await doc.webkitExitFullscreen();
    return;
  }

  const request = element.requestFullscreen?.bind(element) || webkitElement.webkitRequestFullscreen?.bind(element);
  if (request) {
    try {
      await request();
      return;
    } catch {}
  }

  element.classList.add(cssClass);
  document.documentElement.classList.add(lockClass);
  document.body.classList.add(lockClass);
}
