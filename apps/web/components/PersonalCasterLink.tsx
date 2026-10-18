"use client";
import {useState} from "react";
import {useI18n} from "./I18nProvider";
export function PersonalCasterLink({path}:{path:string}){
 const{t}=useI18n(),[copied,setCopied]=useState(false);
 const url=typeof window==="undefined"?path:new URL(path,window.location.origin).href;
 return <div className="personal-caster-link"><label>{t("Ваша постоянная ссылка для следующего входа")}<input readOnly value={url} onFocus={e=>e.target.select()}/></label><button type="button" className="button-secondary" onClick={()=>{void navigator.clipboard.writeText(url).then(()=>setCopied(true)).catch(()=>setCopied(false));}}>{t(copied?"Ссылка скопирована":"Копировать")}</button></div>;
}
