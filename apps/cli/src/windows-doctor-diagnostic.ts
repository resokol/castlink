import fs from 'node:fs';
/* Finite failure provenance only. No error, worker response or path is accepted. */
export function windowsDoctorDiagnostic(operation:8|14,stage:80|81|82|83|84|85|86,status:4|5):void{
 if(![8,14].includes(operation)||![80,81,82,83,84,85,86].includes(stage)||![4,5].includes(status))return;
 try{fs.writeSync(2,JSON.stringify({schemaVersion:1,operation,stage,status})+'\n');}catch{}
}
