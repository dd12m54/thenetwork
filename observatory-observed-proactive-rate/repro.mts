import { strict as assert } from "node:assert";
import { chromium } from "./packages/ui/node_modules/playwright/index.mjs";
import { createServer } from "./apps/observatory/src/server.ts";
const s=await createServer({port:0,mode:"game",development:false,staffRolesUrl:false,peopleUrl:false,game:{seed:1,personas:80,days:14,city:"nyc",network:"stub",pushMs:250,tickMs:250}});
const b=await chromium.launch({executablePath:"/workspace/shared/dot-qa-browser/chromium",args:["--no-sandbox"]});
const out="/workspace/shared/network-1127-proactive-rate-1f15ec2";
const mode=process.argv[2] ?? "before";
try {
 const ctx=await b.newContext({viewport:{width:1450,height:945},recordVideo:{dir:out}});
 const p=await ctx.newPage();
 p.setDefaultTimeout(10000);
 await ctx.route("**/*",r=>r.request().url().startsWith(s.url)?r.continue():r.abort());
 await p.goto(s.openUrl);
 await p.getByRole("tab",{name:"Metrics",exact:true}).click();
 const metrics=p.getByRole("tabpanel",{name:"Metrics",exact:true});
 await metrics.waitFor();
 for(let day=0;day<=8;day++){
   if(day===7) await p.waitForTimeout(2650);
   const kpi=metrics.getByText("proactive / member / week",{exact:true}).locator("..");
   const score=metrics.getByRole("row",{name:/^Proactive messages per member per week/});
   await kpi.waitFor(); await score.waitFor();
   console.log("Day",day+1,"KPI",JSON.stringify(await kpi.innerText()),"scorecard",JSON.stringify(await score.innerText()));
   if(day===0 && mode==="after") assert.match(await kpi.innerText(),/^–/);
   if(day===7){
     assert.match(await score.innerText(),/0\.40/);
     assert.match(await kpi.innerText(),mode==="before" ? /^0\.25/ : /^0\.40/);
     await p.screenshot({path:out+"/"+mode+".png"});
     await score.scrollIntoViewIfNeeded();
     await p.screenshot({path:out+"/"+mode+"-scorecard.png"});
     break;
   }
   const resp=p.waitForResponse(r=>r.url().includes("/api/control")&&r.request().postData()?.includes('"type":"step"'));
   await p.getByRole("button",{name:"+1d",exact:true}).click(); await resp; await p.waitForTimeout(400);
 }
 const v=p.video(); await ctx.close(); await v?.saveAs(out+"/"+mode+".webm");
} catch(e){console.error(e);throw e;} finally {await b.close();await s.stop();}
