'use strict';
// Approval is scoped to the pending indexes shown in one confirmation. It is
// never persisted or extended to suggestions reopened by undo/new revisions.
function plan(total,isPending){const indexes=[];for(let i=0;i<total;i++)if(isPending(i))indexes.push(i);return indexes;}
function create(){
 let active=false,approved=new Set(),total=0,processed=0;
 return {
  get active(){return active},get total(){return total},get processed(){return processed},
  start(indexes,current){approved=new Set(indexes);approved.delete(current);total=indexes.length;processed=0;active=true},
  stop(){active=false;approved.clear()},
  record(){if(active)processed++},
  decision(index,prepared){
   if(!active)return null;
   if(!approved.has(index)){this.stop();return null}
   if(prepared.suspended){this.stop();throw Object.assign(new Error('review_file_mismatch'),{code:'review_file_mismatch'})}
   approved.delete(index);return {accepted:true,token:prepared.token};
  }
 };
}
module.exports={plan,create};
