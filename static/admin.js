import * as D from './data.js';

var app = document.getElementById('app');
var user = null, products = [], shop = Object.assign({}, D.DEFAULT_SHOP);
var editing = null, confirmId = null, loaded = false, busy = false;
var msg = {text:'', cls:''}, loginErr = '', fotoNote = '';

function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]});}
var fmt = new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'});
function eur(n){return fmt.format(Number(n)||0);}
function byId(id){return products.find(function(p){return p.id===id});}
function val(id){var el=document.getElementById(id);return el?el.value:'';}
function setMsg(text,cls){msg={text:text||'',cls:cls||''};}

function render(){
  var scroll=window.scrollY;
  if(!user){
    app.innerHTML='<div class="wrap"><div class="adm"><h1>Verwaltung</h1>'+
      (D.isDemo?'<div class="box"><span class="note">Demo-Modus: Firebase ist noch nicht eingerichtet. Melde dich mit irgendeiner E-Mail und dem Passwort <b>demo</b> an. Alles bleibt nur in diesem Browser.</span></div>':'')+
      '<form id="loginform" class="box"><label>E-Mail<input type="email" id="l-mail" autocomplete="username"></label>'+
      '<label>Passwort<input type="password" id="l-pw" autocomplete="current-password"></label>'+
      (loginErr?'<span class="status err" role="alert">'+esc(loginErr)+'</span>':'')+
      '<button class="btn primary" type="submit"'+(busy?' disabled':'')+'>'+(busy?'Wird angemeldet …':'Anmelden')+'</button></form>'+
      '<a class="lnk" href="index.html">Zur Shop-Seite</a></div></div>';
    return;
  }
  var rows=products.map(function(p){
    var pill=p.stock===null?'<span class="pill">Auf Bestellung</span>':(p.stock<=0?'<span class="pill sold">Ausverkauft</span>':'<span class="pill ok">'+p.stock+' auf Lager</span>');
    var ctl=p.stock===null?
      '<button class="btn small" data-act="stock-set" data-id="'+esc(p.id)+'" data-v="0">Ausverkauft setzen</button>':
      '<div class="qty"><button data-act="stock-d" data-id="'+esc(p.id)+'" data-v="-1" aria-label="Bestand verringern">−</button><span>'+p.stock+'</span><button data-act="stock-d" data-id="'+esc(p.id)+'" data-v="1" aria-label="Bestand erhöhen">+</button></div>';
    return '<div class="arow">'+(p.img?'<img class="thumb" src="'+p.img+'" alt="">':'<span class="thumb"></span>')+
      '<span class="nm">'+esc(p.name)+' <span class="note">'+eur(p.price)+'</span></span>'+pill+ctl+
      '<button class="btn small" data-act="edit" data-id="'+esc(p.id)+'">Bearbeiten</button>'+
      '<button class="btn small danger" data-act="del" data-id="'+esc(p.id)+'">'+(confirmId===p.id?'Wirklich löschen?':'Löschen')+'</button></div>';
  }).join('');
  var ed='';
  if(editing){
    var e=editing;
    ed='<div class="box" id="editor"><h3>'+(e.isNew?'Neuer Artikel':'Artikel bearbeiten')+'</h3><div class="form">'+
      '<label>Name<input type="text" id="e-name" value="'+esc(e.name)+'"></label>'+
      '<div class="two"><label>Preis in Euro<input type="number" id="e-price" min="0" step="0.1" inputmode="decimal" value="'+esc(e.price)+'"></label>'+
      '<label>Bestand (leer = auf Bestellung)<input type="number" id="e-stock" min="0" step="1" inputmode="numeric" value="'+(e.stock===null?'':esc(e.stock))+'"></label></div>'+
      '<div class="two"><label>Kategorie<input type="text" id="e-cat" value="'+esc(e.cat)+'" placeholder="z. B. Deko"></label>'+
      '<label>Material<input type="text" id="e-mat" value="'+esc(e.material)+'" placeholder="PLA, PETG, TPU"></label></div>'+
      '<label>Maße<input type="text" id="e-size" value="'+esc(e.size)+'" placeholder="80 x 40 x 30 mm"></label>'+
      '<label>Beschreibung<textarea id="e-desc">'+esc(e.desc)+'</textarea></label>'+
      '<div style="display:grid;gap:8px"><span class="note">Foto</span><div style="display:flex;gap:8px;flex-wrap:wrap">'+
      '<label class="btn" style="position:relative;flex-direction:row;color:var(--fg);overflow:hidden">Aus Galerie wählen<input type="file" id="e-file" accept="image/*" style="position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer"></label>'+
      '<label class="btn" style="position:relative;flex-direction:row;color:var(--fg);overflow:hidden">Foto aufnehmen<input type="file" id="e-cam" accept="image/*" capture="environment" style="position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer"></label></div>'+
      '<span class="note" id="e-foto-note">'+esc(fotoNote)+'</span></div>'+
      (e.img?'<div><img class="thumb" style="width:90px;height:90px" src="'+e.img+'" alt="Vorschau"> <button class="btn small" data-act="rmimg">Foto entfernen</button></div>':'')+
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-act="save-item"'+(busy?' disabled':'')+'>Artikel speichern</button><button class="btn" data-act="cancel-item">Abbrechen</button></div></div></div>';
  }
  app.innerHTML='<div class="wrap"><div class="adm"><div class="top"><h1>Verwaltung</h1><div><a class="btn small" href="index.html">Zur Shop-Seite</a><button class="btn small" data-act="logout">Abmelden</button></div></div>'+
    (D.isDemo?'<div class="box"><span class="note">Demo-Modus: Firebase ist noch nicht eingerichtet. Änderungen gelten nur in diesem Browser.</span></div>':'')+
    '<span class="status '+msg.cls+'" role="status">'+esc(msg.text)+'</span>'+
    '<div class="box"><div class="phead"><h3>Artikel</h3><button class="btn primary small" data-act="new">Neuer Artikel</button></div>'+
    (!loaded?'<p class="note">Wird geladen …</p>':(rows||'<p class="note">Noch keine Artikel.</p>'))+'</div>'+ed+
    '<div class="box"><h3>Shop-Angaben</h3><div class="form"><label>Shop-Name<input type="text" id="s-name" value="'+esc(shop.name)+'"></label>'+
    '<label>Kurzbeschreibung<textarea id="s-tag">'+esc(shop.tagline)+'</textarea></label>'+
    '<label>Deine E-Mail (wird bei Anfragen angezeigt, wenn der Versand nicht klappt)<input type="email" id="s-mail" value="'+esc(shop.email)+'"></label>'+
    '<label>Fußzeile (z. B. Impressum, Lieferzeit)<textarea id="s-legal">'+esc(shop.legal)+'</textarea></label>'+
    '<div><button class="btn" data-act="save-shop">Shop-Angaben speichern</button></div></div></div></div></div>';
  window.scrollTo(0,scroll);
}

function syncEditor(){
  if(!editing||!document.getElementById('e-name')) return;
  editing.name=val('e-name'); editing.price=Math.max(0,parseFloat(val('e-price'))||0);
  var sv=val('e-stock').trim(); editing.stock=sv===''?null:Math.max(0,parseInt(sv,10)||0);
  editing.cat=val('e-cat').trim(); editing.material=val('e-mat').trim(); editing.size=val('e-size').trim(); editing.desc=val('e-desc').trim();
}

function reload(){
  return Promise.all([D.listProducts(),D.getShop()]).then(function(r){products=r[0];shop=r[1];loaded=true;}).catch(function(e){loaded=true;setMsg(D.friendlyError(e),'err');});
}
function run(promise,okText){
  busy=true; render();
  return promise.then(function(){setMsg(okText,'ok');return reload();}).catch(function(e){setMsg(D.friendlyError(e),'err');}).then(function(){busy=false;render();});
}

function resizeImage(file,cb,fail){
  var r=new FileReader();
  r.onerror=function(){fail();};
  r.onload=function(){var im=new Image();im.onerror=function(){fail();};im.onload=function(){
    var max=800,s=Math.min(1,max/Math.max(im.width,im.height));
    var c=document.createElement('canvas');c.width=Math.round(im.width*s);c.height=Math.round(im.height*s);
    var x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,0,0,c.width,c.height);
    var q=0.82,d=c.toDataURL('image/jpeg',q);
    while(d.length>700000&&q>0.4){q-=0.1;d=c.toDataURL('image/jpeg',q);}
    cb(d);};
    im.src=r.result;};
  r.readAsDataURL(file);
}

app.addEventListener('click',function(ev){
  var t=ev.target.closest('[data-act]'); if(!t) return;
  var a=t.getAttribute('data-act'), id=t.getAttribute('data-id'), p;
  if(editing) syncEditor();
  switch(a){
    case 'logout': D.logout().then(function(){user=null;editing=null;render();}); break;
    case 'new':
      editing={id:D.newId(),isNew:true,name:'',price:0,cat:'',material:'',size:'',desc:'',img:'',stock:1}; fotoNote=''; setMsg(''); render();
      var ei=document.getElementById('editor'); if(ei) ei.scrollIntoView({behavior:'smooth',block:'start'}); break;
    case 'edit':
      p=byId(id); if(!p) break; editing=Object.assign({},p,{isNew:false}); fotoNote=''; setMsg(''); render();
      var e2=document.getElementById('editor'); if(e2) e2.scrollIntoView({behavior:'smooth',block:'start'}); break;
    case 'cancel-item': editing=null; render(); break;
    case 'rmimg': editing.img=''; render(); break;
    case 'save-item':
      if(!editing.name.trim()){setMsg('Bitte gib dem Artikel einen Namen.','err');render();break;}
      var item=editing;
      run(D.saveProduct(item),'Artikel gespeichert.').then(function(){ if(msg.cls==='ok'){editing=null;render();} });
      break;
    case 'stock-d':
      p=byId(id); if(!p||p.stock===null) break;
      run(D.saveProduct(Object.assign({},p,{stock:Math.max(0,p.stock+Number(t.getAttribute('data-v')))})),'Bestand aktualisiert.'); break;
    case 'stock-set':
      p=byId(id); if(!p) break;
      run(D.saveProduct(Object.assign({},p,{stock:Number(t.getAttribute('data-v'))})),'Bestand aktualisiert.'); break;
    case 'del':
      if(confirmId!==id){confirmId=id;render();break;}
      confirmId=null; run(D.deleteProduct(id),'Artikel gelöscht.'); break;
    case 'save-shop':
      run(D.saveShop({name:val('s-name'),tagline:val('s-tag'),email:val('s-mail'),legal:val('s-legal')}),'Shop-Angaben gespeichert.'); break;
  }
});
app.addEventListener('submit',function(ev){
  if(ev.target.id!=='loginform') return;
  ev.preventDefault();
  var em=val('l-mail').trim(), pw=val('l-pw');
  if(!pw){loginErr='Bitte gib dein Passwort ein.';render();return;}
  busy=true; loginErr=''; render();
  D.login(em,pw).then(function(){ busy=false; }).catch(function(e){ busy=false; loginErr=D.friendlyError(e); render();
    var m=document.getElementById('l-mail'); if(m) m.value=em; });
});
app.addEventListener('change',function(ev){
  if((ev.target.id==='e-file'||ev.target.id==='e-cam')&&ev.target.files[0]){
    syncEditor();
    var note=document.getElementById('e-foto-note'); if(note) note.textContent='Foto wird verarbeitet …';
    resizeImage(ev.target.files[0],function(d){editing.img=d;fotoNote='';render();},function(){
      var n2=document.getElementById('e-foto-note'); if(n2) n2.textContent='Das Foto konnte nicht gelesen werden. Versuche ein anderes Bild.';});
  }
});

render();
D.onAuth(function(u){
  user=u; if(u){ render(); reload().then(render); } else { render(); }
}).catch(function(e){ loginErr=D.friendlyError(e); render(); });
