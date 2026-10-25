/* Presentation-only domain. No network, mail transport or production persistence. */
(function(root){
 'use strict';
 const email=v=>String(v||'').trim().toLowerCase();
 const unique=values=>[...new Set(values.map(email).filter(Boolean))];
 function lineup(game){
  const yes=game.invitees.filter(p=>p.answer==='yes').sort((a,b)=>a.order-b.order);
  const room=game.hostPlays?3:4;
  return {players:[...(game.hostPlays?[{email:game.hostEmail,name:game.hostName,host:true}]:[]),...yes.slice(0,room)],waiting:yes.slice(room),pending:game.invitees.filter(p=>!p.answer),declined:game.invitees.filter(p=>p.answer==='no')};
 }
 function reconcile(game){
  game.tickets ||= Array.from({length:4},(_,i)=>({number:i+1,holder:null,version:0}));
  const players=lineup(game).players,holders=new Set(players.map(p=>email(p.email)));
  for(const t of game.tickets)if(t.holder&&!holders.has(t.holder))t.holder=null;
  for(const p of players){const key=email(p.email);if(!game.tickets.some(t=>t.holder===key)){const t=game.tickets.find(t=>!t.holder);if(!t)throw Error('ticket_capacity');t.holder=key;t.version++;}}
  return game;
 }
 function addInvitees(game,people){
  const seen=new Set([email(game.hostEmail),...game.invitees.map(p=>email(p.email))]);
  for(const p of people){const key=email(p.email);if(!key||seen.has(key))continue;seen.add(key);game.invitees.push({email:key,name:p.name||key,answer:null,order:null});}
  return reconcile(game);
 }
 function respond(game,address,answer){
  if(!['yes','no'].includes(answer))throw Error('invalid_answer');
  const p=game.invitees.find(p=>email(p.email)===email(address));if(!p)throw Error('not_invited');
  if(p.answer!==answer){p.answer=answer;p.order=answer==='yes'?++game.sequence:null;}
  reconcile(game);return lineup(game);
 }
 function setHost(game,plays){
  if(plays&&!game.hostPlays&&lineup(game).players.length===4)throw Error('Die vier Plätze sind bereits vergeben. Zuerst muss ein Spieler absagen.');
  game.hostPlays=!!plays;return reconcile(game);
 }
 function ticketFor(game,address){return game.tickets.find(t=>t.holder===email(address))||null;}
 root.PBMeetDemoDomain=Object.freeze({email,unique,lineup,reconcile,addInvitees,respond,setHost,ticketFor});
})(globalThis);
