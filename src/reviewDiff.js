'use strict';
// Use the exact character edits prepared for the editor, rather than a second diff.
function parts(patch, edits) {
 const before=[],after=[],inline=[],combined=[];let offset=0;
 const push=(list,text,kind='equal',previous='')=>{if(text)list.push({text,kind,previous})};
 for(const edit of edits){
  const from=edit.from-patch.from,to=edit.to-patch.from;
  if(from<offset || to<from || to>patch.expected.length || patch.expected.slice(from,to)!==edit.expected)throw new Error('invalid_display_diff');
  const equal=patch.expected.slice(offset,from);
  for(const list of [before,after,inline,combined])push(list,equal);
  push(combined,edit.expected,'removed');push(combined,edit.insert,'added');
  push(before,edit.expected,'removed');push(after,edit.insert,'added',edit.expected);
  if(edit.insert)push(inline,edit.insert,'added',edit.expected);
  else push(inline,edit.expected,'deletion');
  offset=to;
 }
 const equal=patch.expected.slice(offset);for(const list of [before,after,inline,combined])push(list,equal);
 return {before,after,inline,combined};
}
const css='.diff-equal{color:#586673}.diff-added{background:#bceac9;color:#105331;font-weight:700;text-decoration:underline;text-decoration-thickness:2px;text-underline-offset:3px;border-radius:2px}.diff-removed{background:#ffd5c3;color:#8b321b;font-weight:700;text-decoration:line-through;border-radius:2px}.diff-deletion{user-select:none;display:inline-block;background:#ffe1d6;color:#8b321b;font-weight:700;border:1px solid #f0b39d;border-radius:3px;padding:0 3px;margin:0 2px;font-size:.9em}.diff-empty{color:#687888}';
function render(element,parts,labels={}){
 const document=element.ownerDocument,fragment=document.createDocumentFragment();
 for(const part of parts){
  const node=document.createElement(part.kind==='equal'?'span':'mark');node.className='diff-'+part.kind;
  node.textContent=part.kind==='deletion'?'−'+part.text:part.text;
  if(part.kind!=='equal'){
   const label=part.kind==='added'?(part.previous?labels.replaced:labels.added):labels.removed;
   node.title=(label || part.kind)+(part.previous?': '+part.previous:'');
   if(part.kind==='deletion')node.setAttribute('aria-label',(labels.removed || 'Deleted')+': '+part.text);
  }
  fragment.append(node);
 }
 if(!parts.length){const node=document.createElement('span');node.className='diff-empty';node.textContent=labels.empty || '(delete this text)';fragment.append(node)}
 element.replaceChildren(fragment);
}
function compact(parts,context=45){
 const changed=parts.map((p,i)=>p.kind==='equal'?-1:i).filter(i=>i>=0);
 if(!changed.length)return parts;
 const first=changed[0],last=changed[changed.length-1];
 return parts.map((p,i)=>{
  if(p.kind!=='equal')return p;
  const chars=Array.from(p.text);let text=p.text;
  if(i<first&&chars.length>context)text='…'+chars.slice(-context).join('');
  else if(i>last&&chars.length>context)text=chars.slice(0,context).join('')+'…';
  else if(i>first&&i<last&&chars.length>context*2)text=chars.slice(0,context).join('')+' … '+chars.slice(-context).join('');
  return {...p,text};
 });
}
module.exports={parts,render,compact,css};
