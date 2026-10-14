// ===== خادم نظام العقود: يحفظ كل شيء في Google Drive ويشترك فيه كل المستخدمين =====

// اختياري: الصق هنا رابط النشر الذي ينتهي بـ /exec (من نشر ← إدارة عمليات النشر)
// إذا تركته فارغاً يُستخدم الرابط التلقائي مع تحويله إلى الرابط العام.
var PUBLIC_URL = '';

var PERM={contracts:['admin','sales'],invoices:['admin','accountant'],customers:['admin','accountant','sales'],employees:['admin'],users:['admin'],templates:['admin'],settings:['admin']};

// رابط التطبيق العام: يحوّل رابط النطاق (/a/macros/النطاق/) إلى الرابط العام (/macros/)
function baseUrl(){
  var u = PUBLIC_URL || ScriptApp.getService().getUrl();
  u = u.replace(/\/dev(\?.*)?$/, '/exec'); // رابط التجربة ← الرابط النهائي فقط
  return u;
}

function doGet(e){var t=HtmlService.createTemplateFromFile('index');t.p=JSON.stringify(e.parameter||{});t.u=JSON.stringify(baseUrl());
  return t.evaluate().setTitle('نظام العقود').setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL).addMetaTag('viewport','width=device-width,initial-scale=1');}
function sp(k,v){var p=PropertiesService.getScriptProperties();if(v===undefined)return p.getProperty(k);p.setProperty(k,v);}
function folder(){var id=sp('F');if(id){try{return DriveApp.getFolderById(id);}catch(e){}}var f=DriveApp.createFolder('نظام العقود — الأرشيف');sp('F',f.getId());return f;}
function sub(n){var f=folder(),i=f.getFoldersByName(n);return i.hasNext()?i.next():f.createFolder(n);}
function put(fl,n,t){var i=fl.getFilesByName(n);if(i.hasNext())i.next().setContent(t);else fl.createFile(n,t,'application/json');}
function load(){var i=folder().getFilesByName('db.json'),d={};if(i.hasNext()){try{d=JSON.parse(i.next().getBlob().getDataAsString());}catch(e){}}
  ['users','templates','customers','employees','contracts','invoices'].forEach(function(k){d[k]=d[k]||[];});d.settings=d.settings||{};d.ts=d.ts||0;return d;}
function store(d){d.ts=Date.now();put(folder(),'db.json',JSON.stringify(d));}
function sha(s){return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(s),Utilities.Charset.UTF_8).map(function(b){return ('0'+(b&255).toString(16)).slice(-2);}).join('');}
function canon(o){if(Array.isArray(o))return '['+o.map(canon).join(',')+']';if(o&&typeof o==='object')return '{'+Object.keys(o).sort().map(function(k){return JSON.stringify(k)+':'+canon(o[k]);}).join(',')+'}';return JSON.stringify(o===undefined?null:o);}
function secret(){var s=sp('S');if(!s){s=Utilities.getUuid();sp('S',s);}return s;}
function tokOf(u){return sha(u.username+'|'+u.pass+'|'+secret());}
function safe(u){return {id:u.id,username:u.username,name:u.name,role:u.role};}
function out(d){var o=JSON.parse(JSON.stringify(d));o.users=o.users.map(safe);return o;}
function find(a,id){return a.filter(function(x){return String(x.id)===String(id);})[0];}
function g(x){return x?{name:x.name,role:x.role||'',at:x.at,img:sha(x.img||''),stamp:sha(x.stamp||'')}:null;}
function core(c){var s=c.sig||{},o={id:c.id,no:c.no,title:c.title,value:c.value,cur:c.cur,start:c.start,end:c.end,details:c.details,clauses:c.clauses,signer:c.signer,party:c.party,co:c.co,createdAt:c.createdAt,sig:{company:g(s.company),client:g(s.client)}};if(c.pricing)o.pricing=c.pricing;return o;}
function seal(c){var s=c.sig||{};if(s.company&&s.client&&!c.seal){c.seal={hash:sha(canon(core(c))),at:Date.now()};c.locked=true;}}
function pubC(c){return {id:c.id,no:c.no,title:c.title,value:c.value,cur:c.cur,start:c.start,end:c.end,details:c.details,pricing:c.pricing,clauses:c.clauses,signer:c.signer,party:c.party,co:c.co,createdAt:c.createdAt,sig:c.sig,seal:c.seal};}
function arch(kind,r){try{put(sub(kind==='contracts'?'العقود':'الفواتير'),(r.no||r.id)+(r.seal?'-موثّق':'')+'.json',JSON.stringify(r));}catch(e){}}
function rpc(s){var q=JSON.parse(s),L=LockService.getScriptLock();L.waitLock(25000);
  try{return JSON.stringify(run(q));}catch(e){return JSON.stringify({err:'خطأ في الخادم: '+e.message});}finally{L.releaseLock();}}
function run(q){var d=load(),a=q.a,c;
  if(a==='login'){var us=d.users;if(!us.length&&q.u==='admin'){us.push({id:Date.now(),username:'admin',pass:q.p,name:'مدير النظام',role:'admin'});store(d);}
    var u=us.filter(function(x){return x.username===q.u&&x.pass===q.p;})[0];if(!u)return {err:'بيانات الدخول غير صحيحة'};
    return {tok:tokOf(u),me:safe(u),db:out(d),ts:d.ts,folder:folder().getUrl()};}
  if(a==='pubget'||a==='pubsign'||a==='verify'){c=find(d.contracts,q.id);
    if(a==='verify'){if(!c)return {err:'العقد غير موجود'};var ok=c.seal?sha(canon(core(c)))===c.seal.hash:null,s=c.sig||{};
      return {no:c.no,title:c.title,party:(c.party||{}).name,co:(c.co||{}).name,start:c.start,end:c.end,value:c.value,cur:c.cur,sealed:!!c.seal,hash:c.seal&&c.seal.hash,at:c.seal&&c.seal.at,valid:ok,
        sigs:{company:s.company&&{name:s.company.name,at:s.company.at},client:s.client&&{name:s.client.name,at:s.client.at}}};}
    if(!c||!q.k||c.code!==q.k)return {err:'الرابط غير صالح'};
    if(a==='pubget')return {c:pubC(c)};
    if(!c.sig||!c.sig.company)return {err:'العقد بانتظار توقيع الشركة'};
    if(c.sig.client)return {err:'تم توقيع هذا العقد مسبقاً',c:pubC(c)};
    var s2=q.sig;if(!s2||!s2.name||!s2.img||s2.img.length>600000||(s2.stamp&&s2.stamp.length>600000))return {err:'بيانات التوقيع غير مكتملة'};
    c.sig.client={name:String(s2.name).slice(0,100),role:String(s2.role||'').slice(0,100),img:s2.img,stamp:s2.stamp||null,srv:1,at:new Date().toISOString()};
    seal(c);store(d);arch('contracts',c);return {c:pubC(c)};}
  var me=d.users.filter(function(x){return tokOf(x)===q.tok;})[0];if(!me)return {err:'auth'};
  if(a==='get')return (q.since&&q.since===d.ts)?{same:1}:{db:out(d),ts:d.ts,folder:folder().getUrl(),me:safe(me)};
  if(a==='save'){var recs=[];
    for(var i=0;i<q.ops.length;i++){var o=q.ops[i],pm=PERM[o.c];if(!pm||pm.indexOf(me.role)<0)return {err:'لا تملك صلاحية لهذا الإجراء'};
      if(o.c==='settings'){d.settings=o.r;continue;}
      var arr=d[o.c],ex=find(arr,o.d||o.r.id);
      if(o.d){if(ex&&ex.locked)return {err:'لا يمكن حذف عقد موثّق'};d[o.c]=arr.filter(function(x){return x!==ex;});continue;}
      var r=o.r;
      if(o.c==='contracts'){if(ex&&ex.locked){recs.push({c:o.c,r:ex});continue;}
        r.code=(ex&&ex.code)||r.code||Utilities.getUuid().replace(/-/g,'');r.co=ex?ex.co:{name:d.settings.company,cr:d.settings.cr};r.seal=null;r.locked=false;
        r.sig=r.sig||{};if(ex&&ex.sig&&ex.sig.client)r.sig.client=ex.sig.client;else delete r.sig.client;
        if(r.sig.company){var e1=ex&&ex.sig&&ex.sig.company;if(e1&&e1.srv)r.sig.company=e1;else{r.sig.company.srv=1;r.sig.company.at=new Date().toISOString();}}
        seal(r);arch('contracts',r);}
      if(o.c==='users'){if(ex&&!r.pass)r.pass=ex.pass;if(!r.pass)return {err:'كلمة المرور مطلوبة'};}
      if(o.c==='invoices')arch('invoices',r);
      if(ex)arr[arr.indexOf(ex)]=r;else arr.push(r);
      recs.push({c:o.c,r:o.c==='users'?safe(r):r});}
    store(d);return {ok:1,recs:recs,ts:d.ts};}
  return {err:'طلب غير معروف'};}
