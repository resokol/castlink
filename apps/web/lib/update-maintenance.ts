import { lstatSync } from 'node:fs';

// Root's updater owns this marker in the existing web-data volume. Reads are
// uncached so admission changes without restarting the verified candidate.
export function maintenanceResponse(method:string,pathname:string,marker='/data/.castlink-update-maintenance'):Response|null {
 if(method==='GET'&&pathname==='/api/version')return null;
 try{lstatSync(marker);}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return null;}
 return Response.json({error:'Сервер обновляется. Повтори попытку через несколько секунд.',code:'server-updating'},{status:503,headers:{'Cache-Control':'no-store','Retry-After':'10'}});
}
