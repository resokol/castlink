export type ImageTransform = { zoom?: number; panX?: number; panY?: number; rotation?: number; flipX?: boolean; flipY?: boolean; cropTop?: number; cropRight?: number; cropBottom?: number; cropLeft?: number };
export function validateImageTransform(value: unknown): ImageTransform {
 if(!value || typeof value!=='object' || Array.isArray(value)) throw new Error('Invalid image transform');
 const input=value as Record<string,unknown>, result:Record<string,number|boolean>={};
 for(const [key,min,max] of [['zoom',1,5],['panX',-1,1],['panY',-1,1],['rotation',-180,180],['cropTop',0,.45],['cropRight',0,.45],['cropBottom',0,.45],['cropLeft',0,.45]] as const){const n=input[key];if(n===undefined)continue;if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max)throw new Error('Invalid image transform');result[key]=n;}
 for(const key of ['flipX','flipY']){if(input[key]===undefined)continue;if(typeof input[key]!=='boolean')throw new Error('Invalid image transform');result[key]=input[key];}
 return result;
}
export function imageTransformStyle(t:ImageTransform={}) {
 const z=t.zoom??1;
 return {transform:`translate(${(t.panX??0)*100}%, ${(t.panY??0)*100}%) rotate(${t.rotation??0}deg) scale(${t.flipX?-z:z}, ${t.flipY?-z:z})`,clipPath:`inset(${(t.cropTop??0)*100}% ${(t.cropRight??0)*100}% ${(t.cropBottom??0)*100}% ${(t.cropLeft??0)*100}%)`,transformOrigin:'center'};
}

/** Source fractions retained by cropping; shared by viewport rendering and handles. */
export function imageCropBounds(t: ImageTransform = {}) {
 const left=t.cropLeft??0,top=t.cropTop??0;
 return {left,top,width:1-left-(t.cropRight??0),height:1-top-(t.cropBottom??0)};
}

/** Expand the uncropped source behind a viewport whose edges are the crop. */
export function croppedImageStyle(t: ImageTransform = {}) {
 const crop=imageCropBounds(t);
 return {...imageTransformStyle({...t,panX:(t.panX??0)*crop.width,panY:(t.panY??0)*crop.height}),
  position:'absolute' as const,left:`${-crop.left/crop.width*100}%`,top:`${-crop.top/crop.height*100}%`,
  width:`${100/crop.width}%`,height:`${100/crop.height}%`,
  transformOrigin:`${(crop.left+crop.width/2)*100}% ${(crop.top+crop.height/2)*100}%`};
}
