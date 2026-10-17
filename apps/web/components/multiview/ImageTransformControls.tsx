"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import type { ImageTransform } from "@/lib/multiview-image";
import styles from "./ImageTransformControls.module.css";

const labels = {
  ru: { image: "Изображение", zoom: "Зум", panX: "Сдвиг X", panY: "Сдвиг Y", rotation: "Поворот", crop: "Кадрирование", cropTop: "Сверху", cropRight: "Справа", cropBottom: "Снизу", cropLeft: "Слева", flipX: "Зеркало X", flipY: "Зеркало Y", flipXHelp: "Отразить по горизонтали", flipYHelp: "Отразить по вертикали", reset: "Сброс", resetHelp: "Сбросить изображение" },
  en: { image: "Image", zoom: "Zoom", panX: "Offset X", panY: "Offset Y", rotation: "Rotation", crop: "Crop", cropTop: "Top", cropRight: "Right", cropBottom: "Bottom", cropLeft: "Left", flipX: "Flip X", flipY: "Flip Y", flipXHelp: "Mirror horizontally", flipYHelp: "Mirror vertically", reset: "Reset", resetHelp: "Reset image" },
  "zh-CN": { image: "图像", zoom: "缩放", panX: "水平偏移", panY: "垂直偏移", rotation: "旋转", crop: "裁剪", cropTop: "顶部", cropRight: "右侧", cropBottom: "底部", cropLeft: "左侧", flipX: "水平镜像", flipY: "垂直镜像", flipXHelp: "水平镜像", flipYHelp: "垂直镜像", reset: "重置", resetHelp: "重置图像" },
};

function TransformValue({ label, value, min, max, step, disabled, onChange }: { label: string; value: number; min: number; max: number; step: number; disabled: boolean; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const n = Number(draft);
    const next = draft.trim() && Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : value;
    setDraft(String(next));
    onChange(next);
  };
  return <div className={styles.field}>
    <span>{label}</span>
    <input className={styles.number} aria-label={label} type="number" min={min} max={max} step={step} value={draft} disabled={disabled}
      onChange={event => { setDraft(event.target.value); const n = Number(event.target.value); if (event.target.value.trim() && Number.isFinite(n) && n >= min && n <= max) onChange(n); }}
      onBlur={commit} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); commit(); } if (event.key === "Escape") { event.preventDefault(); setDraft(String(value)); } }} />
    <input className={styles.range} aria-label={label} type="range" min={min} max={max} step={step} value={value} disabled={disabled}
      onChange={event => { setDraft(event.target.value); onChange(Number(event.target.value)); }} />
  </div>;
}

export default function ImageTransformControls({ value = {}, onChange, disabled = false, compact = false }: { value?: ImageTransform; onChange: (value: ImageTransform) => void; disabled?: boolean; compact?: boolean }) {
  const { locale } = useI18n();
  const c = labels[locale];
  const coreFields = [["zoom", 1, 5, .05, 1], ["panX", -1, 1, .01, 0], ["panY", -1, 1, .01, 0], ["rotation", -180, 180, 1, 0]] as const;
  const cropFields = [["cropTop", 0, .45, .01, 0], ["cropRight", 0, .45, .01, 0], ["cropBottom", 0, .45, .01, 0], ["cropLeft", 0, .45, .01, 0]] as const;
  const field = ([key, min, max, step, fallback]: (typeof coreFields)[number] | (typeof cropFields)[number]) => <TransformValue key={key} label={c[key]} min={min} max={max} step={step} value={value[key] ?? fallback} disabled={disabled} onChange={next => onChange({ ...value, [key]: next })} />;
  const body = <div className={styles.body}>
    <div className={styles.fields}>{coreFields.map(field)}</div>
    <details className={styles.crop}>
      <summary>{c.crop}</summary>
      <div className={styles.fields}>{cropFields.map(field)}</div>
    </details>
    <div className={styles.actions}>
      {(["flipX", "flipY"] as const).map(key => <label className={styles.flip} key={key} title={c[`${key}Help`]}>
        <input type="checkbox" aria-label={c[`${key}Help`]} checked={value[key] ?? false} disabled={disabled} onChange={event => onChange({ ...value, [key]: event.target.checked })} />
        <span>{c[key]}</span>
      </label>)}
      <button className={styles.reset} type="button" aria-label={c.resetHelp} disabled={disabled} onClick={() => onChange({})}>{c.reset}</button>
    </div>
  </div>;
  return compact
    ? <div className={styles.controls} role="group" aria-label={c.image}>{body}</div>
    : <details className={styles.controls}><summary>{c.image}</summary>{body}</details>;
}
