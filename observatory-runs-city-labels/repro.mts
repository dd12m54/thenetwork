import { strict as assert } from "node:assert";
import { chromium } from "./packages/ui/node_modules/playwright/index.mjs";
import { createServer } from "./apps/observatory/src/server.ts";
const mode=process.argv[2] ?? "before";
const out="/workspace/shared/network-1127-runs-pair-smoke-1f15ec2";
const s=await createServer({port:0,mode:"game",development:false,staffRolesUrl:false,peopleUrl:false,game:{seed:4,personas:120,days:14,city:"nyc",network:"stub",pushMs:250,tickMs:250}});
const b=await chromium.launch({executablePath:"/workspace/shared/dot-qa-browser/chromium",args:["--no-sandbox"]});
try {
 const ctx=await b.newContext({viewport:{width:1450,height:945},recordVideo:{dir:out}});
 const p=await ctx.newPage();
 p.setDefaultTimeout(11000);
 await ctx.route("**/*",r=>r.request().url().startsWith(s.url)?r.continue():r.abort());
 await p.goto(s.openUrl);
 await p.getByRole("tab",{name:"Runs",exact:true}).click();
 const runs=p.getByRole("tabpanel",{name:"Runs",exact:true});
 for(let i=0;i<5;i++){
   const resp=p.waitForResponse(r=>r.url().includes("/api/control")&&r.request().postData()?.includes('"type":"step"'));
   await p.getByRole("button",{name:"+1d",exact:true}).click(); await resp; await p.waitForTimeout(220);
 }
 await runs.getByRole("button",{name:"Compare two",exact:true}).click();
 const rows=runs.getByRole("checkbox");
 const labels=runs.locator("label").filter({hasText:"Oct 5, 5:00 AM"});
 const texts=(await labels.allTextContents()).map(s=>s.trim());
 assert.equal(texts.length,2);
 if(mode==="before") assert.equal(texts[0],texts[1]);
 else { assert.match(texts[0],/NYC/); assert.match(texts[1],/SF/); }
 await rows.nth(0).click();
 await labels.last().scrollIntoViewIfNeeded();
 console.log("chooser labels before picking",texts);
 await p.screenshot({path:out+"/"+mode+".png"});
 const heading=runs.getByText(/^A: .*→ B:/).first();
 const requests:string[][]=[];
 p.on("request",request=>{
   const u=new URL(request.url()); if(u.pathname==="/api/runs/diff") requests.push([u.searchParams.get("a")??"",u.searchParams.get("b")??""]);
 });
 const pick=async(city:"NYC"|"SF")=>{
   const locator=mode==="before" ? labels.nth(city==="NYC"?0:1).getByRole("checkbox")
     : runs.getByRole("checkbox",{name:new RegExp("Oct 5, 5:00 AM.*"+city+".*0 proposals")});
   const diff=p.waitForResponse(r=>new URL(r.url()).pathname==="/api/runs/diff"&&r.status()===200);
   await locator.click(); await diff; await heading.waitFor();
   const result=await heading.textContent();
   assert.match(result??"",new RegExp("A: Oct 5.*0 proposals · "+city.toLowerCase()+" → B: Oct 9.* · nyc"));
   console.log("comparison",city,requests.at(-1),result);
   await locator.click();
   await runs.getByText("Pick two runs.",{exact:true}).waitFor();
 };
 await pick("NYC"); await pick("SF");
 assert.equal(requests[0][1],requests[1][1]);
 assert.notEqual(requests[0][0],requests[1][0]);
 const video=p.video(); await ctx.close(); await video?.saveAs(out+"/"+mode+".webm");
} catch(e){console.error(e);throw e;} finally {await b.close();await s.stop();}
