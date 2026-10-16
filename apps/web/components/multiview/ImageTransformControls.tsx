"use client";
import { useEffect, useState } from "react";
import { useI18n } from '@/components/I18nProvider';
import type { ImageTransform } from '@/lib/multiview-image';
import styles from './MultiviewEditor.module.css';
function TransformValue({label,value,min,max,step,disabled,onChange}:{label:string;value:number;min:number;max:number;step:number;disabled:boolean;onChange:(value:number)=>void}) {
 const [draft,setDraft]=useState(String(value));
 useEffect(()=>setDraft(String(value)),[value]);
 const commit=()=>{const n=Number(draft);const next=draft.trim()&&Number.isFinite(n)?Math.max(min,Math.min(max,n)):value;setDraft(String(next));onChange(next);};
 return <div className={styles.transformField}><span>{label}</span><div className={styles.transformValue}>
 <input aria-label={label} type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={e=>{setDraft(e.target.value);onChange(Number(e.target.value));}}/>
 <input aria-label={label} type="number" min={min} max={max} step={step} value={draft} disabled={disabled} onChange={e=>{setDraft(e.target.value);const n=Number(e.target.value);if(e.target.value.trim()&&Number.isFinite(n)&&n>=min&&n<=max)onChange(n);}} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commit();}if(e.key==='Escape'){e.preventDefault();setDraft(String(value));}}}/>
 </div></div>;
}
export default function ImageTransformControls({value={},onChange,disabled=false}:{value?:ImageTransform;onChange:(value:ImageTransform)=>void;disabled?:boolean}){
 const {locale}=useI18n();const c=locale==='en'?['Image','Zoom','Horizontal offset','Vertical offset','Rotation','Crop top','Crop right','Crop bottom','Crop left','Mirror horizontally','Mirror vertically','Reset image']:locale==='zh-CN'?['图像','缩放','水平偏移','垂直偏移','旋转','顶部裁剪','右侧裁剪','底部裁剪','左侧裁剪','水平镜像','垂直镜像','重置图像']:['Изображение','Зум','Сдвиг по горизонтали','Сдвиг по вертикали','Поворот','Кроп сверху','Кроп справа','Кроп снизу','Кроп слева','Отразить по горизонтали','Отразить по вертикали','Сбросить изображение'];
 const fields=[['zoom',1,5,.05,1],['panX',-1,1,.01,0],['panY',-1,1,.01,0],['rotation',-180,180,1,0],['cropTop',0,.45,.01,0],['cropRight',0,.45,.01,0],['cropBottom',0,.45,.01,0],['cropLeft',0,.45,.01,0]] as const;
 return <details><summary>{c[0]}</summary><div className={styles.transformFields}>{fields.map(([key,min,max,step,fallback],i)=><TransformValue key={key} label={c[i+1]} min={min} max={max} step={step} value={value[key]??fallback} disabled={disabled} onChange={n=>onChange({...value,[key]:n})}/>)}</div>{(['flipX','flipY'] as const).map((key,i)=><label className={styles.field} key={key}><span>{c[9+i]}</span><input type="checkbox" checked={value[key]??false} disabled={disabled} onChange={e=>onChange({...value,[key]:e.target.checked})}/></label>)}<button type="button" disabled={disabled} onClick={()=>onChange({})}>{c[11]}</button></details>;
}
