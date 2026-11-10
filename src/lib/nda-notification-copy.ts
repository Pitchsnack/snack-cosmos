export function ndaNotificationCopy(n:{title:string;message:string|null},thai:boolean){
 if(!thai)return n;
 if(n.title==='NDA invitation withdrawn')return {title:'ถอนคำเชิญ NDA แล้ว',message:n.message?.replace(/^(.+) withdrew the NDA invitation it sent you on (.+)\.$/,'$1 ถอนคำเชิญ NDA ที่ส่งถึงท่านเมื่อ $2')??null};
 if(n.title==='NDA request withdrawn')return {title:'ถอนคำขอ NDA แล้ว',message:n.message?.replace(/^(.+) withdrew their NDA request for (.+)\.$/,'$1 ถอนคำขอ NDA สำหรับ $2')??null};
 return n;
}