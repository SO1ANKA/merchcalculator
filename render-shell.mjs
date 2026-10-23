const shells=new WeakMap();

// Only reconcile the surrounding chrome. The working area is deliberately fresh:
// forms there must reflect the current state, including live input properties.
export function renderShell(root,markup,key){
 const template=root.ownerDocument.createElement('template');
 template.innerHTML=markup;
 if(shells.get(root)!==key){root.replaceChildren(template.content);shells.set(root,key);return;}
 syncChildren(root,template.content);
}
function syncChildren(current,next){
 const oldNodes=[...current.childNodes],newNodes=[...next.childNodes];
 for(let i=0;i<Math.max(oldNodes.length,newNodes.length);i++){
  const old=oldNodes[i],fresh=newNodes[i];
  if(!fresh){old.remove();continue;}
  if(!old){current.append(fresh);continue;}
  if(old.nodeType!==fresh.nodeType||old.nodeName!==fresh.nodeName||fresh.id==='main'){
   old.replaceWith(fresh);continue;
  }
  // Keep existing image nodes and star animations attached to the document.
  if(old.isEqualNode(fresh)&&!old.querySelector?.('#main'))continue;
  if(old.nodeType!==1){old.nodeValue=fresh.nodeValue;continue;}
  for(const attr of [...old.attributes])if(!fresh.hasAttribute(attr.name))old.removeAttribute(attr.name);
  for(const attr of fresh.attributes)if(old.getAttribute(attr.name)!==attr.value)old.setAttribute(attr.name,attr.value);
  syncChildren(old,fresh);
 }
}
