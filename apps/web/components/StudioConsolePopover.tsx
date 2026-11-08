'use client';
import {forwardRef,type ReactNode} from 'react';
import {useI18n} from './I18nProvider';
import {StudioConsoleIcon} from './StudioConsoleIcon';
/** Native top-layer disclosure. Its children and control owners stay mounted. */
export const StudioConsolePopover=forwardRef<HTMLDivElement,{id:string;title:string;children:ReactNode;className?:string;onOpenChange?:(open:boolean)=>void}>(function StudioConsolePopover({id,title,children,className='',onOpenChange},ref){
 const {t}=useI18n();
 return <div ref={ref} id={id} popover="auto" role="dialog" aria-labelledby={`${id}-title`} className={`studio-console-popover ${className}`} onToggle={event=>onOpenChange?.(event.newState==='open')}><header className="studio-console-popover-heading"><h2 id={`${id}-title`}>{title}</h2><button type="button" popoverTarget={id} popoverTargetAction="hide" aria-label={t('Закрыть')}><StudioConsoleIcon kind="close"/></button></header>{children}</div>;
});
