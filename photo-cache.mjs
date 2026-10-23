// Keep a bounded set of recent photos between sections, instead of rereading
// IndexedDB and decoding a new blob URL on every visit. Visible photos stay pinned.
export class PhotoCache{
 constructor(read,{limit=64,create=blob=>URL.createObjectURL(blob),revoke=url=>URL.revokeObjectURL(url)}={}){
  this.read=read;this.limit=limit;this.create=create;this.revoke=revoke;this.entries=new Map();
 }
 get(id){
  let entry=this.entries.get(id);
  if(entry){this.entries.delete(id);this.entries.set(id,entry);return entry.promise;}
  entry={url:null};this.entries.set(id,entry);
  entry.promise=Promise.resolve().then(()=>this.read(id)).then(blob=>{
   if(!blob||this.entries.get(id)!==entry)return null;
   return entry.url=this.create(blob);
  }).catch(()=>null);
  return entry.promise;
 }
 trim(active=new Set()){
  for(const id of this.entries.keys()){
   if(this.entries.size<=this.limit)break;
   if(!active.has(id))this.remove(id);
  }
 }
 remove(id){const entry=this.entries.get(id);this.entries.delete(id);if(entry?.url)this.revoke(entry.url);}
 clear(){for(const id of this.entries.keys())this.remove(id);}
}
