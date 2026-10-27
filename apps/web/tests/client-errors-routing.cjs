const test=require("node:test"),assert=require("node:assert/strict");
const {load}=require("./load-typescript.cjs");
const {getMiddlewareMatchers}=require("next/dist/build/analysis/get-page-static-info");
const {getMiddlewareRouteMatcher}=require("next/dist/shared/lib/router/utils/middleware-route-matcher");

test("crash intake bypasses middleware body cloning without bypassing other API maintenance",()=>{
 const middleware=load("../middleware.ts",{"./lib/update-maintenance":{maintenanceResponse:()=>null}});
 const match=getMiddlewareRouteMatcher(getMiddlewareMatchers(middleware.config.matcher,{}));
 for(const pathname of ["/api/client-errors","/api/client-errors/","/api/presentation-file","/api/presentation-file/"])assert.equal(match(pathname,{},{}),false,pathname);
 for(const pathname of ["/api","/api/version","/api/token","/api/client-errors-extra","/api/client-errors/child"])assert.equal(match(pathname,{},{}),true,pathname);
});

test("intake checks maintenance before touching streamed request bodies",async()=>{
 let reads=0,checked;
 const route=load("../app/api/client-errors/route.ts",{"../../../lib/update-maintenance":{maintenanceResponse(method,pathname){checked=[method,pathname];return new Response(null,{status:503});}}});
 const request={method:"POST",headers:new Headers({origin:"https://castlink.ru","content-type":"application/json"}),nextUrl:new URL("https://castlink.ru/api/client-errors"),get body(){reads++;throw Error("must not read");}};
 assert.equal((await route.POST(request)).status,503);assert.deepEqual(checked,["POST","/api/client-errors"]);assert.equal(reads,0);
});
