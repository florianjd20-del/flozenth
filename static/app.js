import { isDemo, getShop, listProducts, safeImg, DEFAULT_SHOP } from './data.js';

var state = {shop: Object.assign({}, DEFAULT_SHOP), products: []};
var cart = {}, filter = 'Alle', overlay = null;
var orderText = '', orderErr = '', orderSent = false, sending = false, loaded = false, loadErr = false;
var app = document.getElementById('app');

function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]});}
var fmt = new Intl.NumberFormat('de-DE',{style:'currency',currency:'EUR'});
function eur(n){return fmt.format(Number(n)||0);}
function byId(id){return state.products.find(function(p){return p.id===id});}
function hue(id){var h=5381;for(var i=0;i<id.length;i++)h=((h<<5)+h+id.charCodeAt(i))>>>0;return (h*47)%360;}
function soldOut(p){return p.stock!==null&&p.stock!==undefined&&p.stock<=0;}
function cartCount(){return Object.keys(cart).reduce(function(a,k){return a+cart[k]},0);}
function cartTotal(){return Object.keys(cart).reduce(function(a,k){var p=byId(k);return a+(p?p.price*cart[k]:0)},0);}
function cats(){var s=[];state.products.forEach(function(p){if(p.cat&&s.indexOf(p.cat)<0)s.push(p.cat)});return s;}
function mats(){var s=[];state.products.forEach(function(p){if(p.material&&s.indexOf(p.material)<0)s.push(p.material)});return s;}
function val(id){var el=document.getElementById(id);return el?el.value:'';}

function pic(p){
  var im=safeImg(p.img);
  if(im) return '<img src="'+im+'" alt="'+esc(p.name)+'" loading="lazy">';
  var h=hue(p.id);
  return '<div class="ph" style="background:repeating-linear-gradient(0deg,hsl('+h+' 55% 56%) 0 3px,hsl('+h+' 55% 44%) 3px 6px)"></div>';
}
function card(p){
  var specs=[p.material,p.size].filter(Boolean).map(function(s){return '<span>'+esc(s)+'</span>'}).join('');
  var tag=soldOut(p)?'<span class="tag">Ausverkauft</span>':(p.stock!==null&&p.stock<=3?'<span class="tag low">Nur noch '+p.stock+'</span>':'');
  return '<article class="card"><div class="pic">'+pic(p)+tag+'</div>'+
    '<div class="info"><h3>'+esc(p.name)+'</h3>'+(specs?'<div class="specs">'+specs+'</div>':'')+
    (p.desc?'<p>'+esc(p.desc)+'</p>':'')+
    '<div class="buy"><span class="price">'+eur(p.price)+'</span>'+
    '<button class="btn primary" data-act="add" data-id="'+esc(p.id)+'"'+(soldOut(p)?' disabled':'')+'>'+(soldOut(p)?'Ausverkauft':'In den Korb')+'</button></div></div></article>';
}
function marquee(m){
  var words=['Auf Bestellung gedruckt','Schicht für Schicht','Einzelstücke'].concat(m);
  var grp='<span class="grp">'+words.map(function(w,i){return (i<3?'<span>':'<b>')+esc(w)+(i<3?'</span>':'</b>')+'<i>/</i>'}).join('')+'</span>';
  return '<div class="marq" aria-hidden="true"><div class="tr">'+grp+grp+'</div></div>';
}

function render(){
  document.title=state.shop.name||'FLOZENTH';
  var list=state.products.filter(function(p){return filter==='Alle'||p.cat===filter});
  var chips=['Alle'].concat(cats()).map(function(c){return '<button class="chip" data-act="filter" data-v="'+esc(c)+'" aria-pressed="'+(c===filter)+'">'+esc(c)+'</button>'}).join('');
  var m=mats();
  var grid;
  if(!loaded) grid='<p class="empty">Artikel werden geladen …</p>';
  else if(loadErr) grid='<p class="empty">Die Artikel konnten nicht geladen werden. Bitte lade die Seite neu.</p>';
  else if(list.length) grid='<div class="grid">'+list.map(card).join('')+'</div>';
  else grid='<p class="empty">'+(state.products.length?'In dieser Kategorie gibt es noch keine Artikel.':'Hier kommen bald neue Artikel.')+'</p>';
  var demo=isDemo?'<div class="owner"><div class="wrap"><span>Demo-Modus: Firebase ist noch nicht eingerichtet, die Artikel sind Beispiele und gelten nur in diesem Browser. <a href="admin.html" style="color:var(--fg)">Zur Verwaltung</a></span></div></div>':'';
  app.innerHTML=demo+
    '<div class="nav"><div class="wrap"><div class="logo"><i></i><span>'+esc(state.shop.name)+'</span></div>'+
    '<button class="btn small" data-act="open-cart">Warenkorb <span class="count">'+cartCount()+'</span></button></div></div>'+
    '<div class="wrap">'+
    '<section class="hero"><div class="hcopy"><div class="eyebrow">FDM-3D-Druck · auf Bestellung</div><h1><span class="g">'+esc(state.shop.name)+'</span></h1><p>'+esc(state.shop.tagline)+'</p>'+
    '<div class="cta"><button class="btn primary" data-act="scroll">Artikel ansehen</button><button class="btn" data-act="open-cart">Anfrage stellen</button></div>'+
    '<div class="stats"><div><b>'+state.products.length+'</b><span>Artikel</span></div><div><b>'+cats().length+'</b><span>Kategorien</span></div><div><b>'+m.length+'</b><span>Materialien</span></div></div></div>'+
    '<div class="bed"><canvas id="hero-cv" width="480" height="420" role="img" aria-label="Die Artikel des Shops werden Schicht für Schicht gedruckt"></canvas>'+
    '<div class="bedinfo"><span id="hero-layer">Schicht 270 / 300</span><div class="prog"><i id="hero-bar"></i></div><span id="hero-fil" style="color:var(--fg);max-width:42%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span></div></div></section>'+
    marquee(m)+
    '<section class="sec" id="artikel"><h2>Artikel</h2><div class="filters" role="group" aria-label="Kategorien">'+chips+'</div>'+grid+'</section>'+
    '<section class="sec"><h2>So läuft deine Bestellung</h2><div class="steps">'+
    '<div class="step"><div class="n">01</div><h3>Artikel wählen</h3><p>Lege alles in den Warenkorb, was dir gefällt. Wunschfarbe schreibst du später dazu.</p></div>'+
    '<div class="step"><div class="n">02</div><h3>Anfrage senden</h3><p>Du schickst deine Wunschliste direkt über die Seite an uns ab.</p></div>'+
    '<div class="step"><div class="n">03</div><h3>Wir drucken</h3><p>Nach deiner Bestätigung wird dein Artikel gedruckt und zu dir geschickt.</p></div></div></section>'+
    '<footer><span class="legal">'+esc(state.shop.legal)+'</span><a class="lnk" href="admin.html" style="display:inline-block">Verwaltung</a></footer></div>'+
    '<div id="ov"></div>';
  renderOverlay();
  if(reduced) heroDraw(1,0,heroProducts()[0]);
}
function renderOverlay(){
  var ov=document.getElementById('ov'); if(!ov) return;
  var old=ov.querySelector('.panel'), keep=old?old.scrollTop:0;
  ov.innerHTML=overlay==='cart'?cartHtml():'';
  var np=ov.querySelector('.panel'); if(np) np.scrollTop=keep;
}
function cartHtml(){
  if(orderSent) return '<div class="overlay" data-act="close-bg"><div class="panel" role="dialog" aria-label="Anfrage gesendet"><div class="phead"><h2>Danke!</h2><button class="btn small" data-act="close">Schließen</button></div>'+
    '<div class="box"><strong>Deine Anfrage ist bei uns angekommen.</strong><p class="note" style="margin:0">Wir melden uns so bald wie möglich per E-Mail bei dir.</p></div></div></div>';
  var ids=Object.keys(cart).filter(function(k){return byId(k)});
  var lines=ids.map(function(k){var p=byId(k);return '<div class="line"><div><strong>'+esc(p.name)+'</strong><div class="note">'+eur(p.price)+' pro Stück</div></div>'+
    '<div class="qty"><button data-act="dec" data-id="'+esc(k)+'" aria-label="Weniger">−</button><span>'+cart[k]+'</span><button data-act="inc" data-id="'+esc(k)+'" aria-label="Mehr">+</button></div></div>'}).join('');
  var body;
  if(!ids.length){ body='<p class="note">Dein Warenkorb ist leer.</p>'; }
  else{
    body=lines+'<div class="total"><span>Summe</span><span>'+eur(cartTotal())+'</span></div>'+
    '<div class="form"><label>Dein Name<input type="text" id="c-name" autocomplete="name"></label>'+
    '<label>Deine E-Mail<input type="email" id="c-mail" autocomplete="email"></label>'+
    '<label>Wunschfarbe oder Nachricht<textarea id="c-msg"></textarea></label>'+
    '<div style="position:absolute;left:-9999px" aria-hidden="true"><label>Website<input type="text" id="c-web" tabindex="-1" autocomplete="off"></label></div>'+
    (orderErr?'<span class="status err" role="alert">'+esc(orderErr)+'</span>':'')+
    '<button class="btn primary" data-act="send"'+(sending?' disabled':'')+'>'+(sending?'Wird gesendet …':'Anfrage absenden')+'</button></div>';
    if(orderText){
      body+='<div class="box"><strong>Deine Anfrage</strong><textarea class="out" id="c-out" readonly>'+esc(orderText)+'</textarea>'+
      '<div class="note">Kopiere den Text und schicke ihn an '+(state.shop.email?'<strong>'+esc(state.shop.email)+'</strong>':'den Shop-Betreiber')+'.</div>'+
      '<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn primary" data-act="copy">Text kopieren</button>'+
      (state.shop.email?'<a class="btn" href="mailto:'+esc(state.shop.email)+'?subject='+encodeURIComponent('Anfrage '+state.shop.name)+'&body='+encodeURIComponent(orderText)+'">E-Mail-Programm öffnen</a>':'')+
      '</div><span class="status" id="copystat" role="status"></span></div>';
    }
  }
  return '<div class="overlay" data-act="close-bg"><div class="panel" role="dialog" aria-label="Warenkorb"><div class="phead"><h2>Warenkorb</h2><button class="btn small" data-act="close">Schließen</button></div>'+body+'</div></div>';
}

app.addEventListener('click',function(ev){
  var t=ev.target.closest('[data-act]'); if(!t) return;
  var a=t.getAttribute('data-act'), id=t.getAttribute('data-id'), p;
  if(a==='close-bg'){ if(ev.target!==t) return; a='close'; }
  switch(a){
    case 'filter': filter=t.getAttribute('data-v'); render(); break;
    case 'scroll': var s=document.getElementById('artikel'); if(s) s.scrollIntoView({behavior:reduced?'auto':'smooth'}); break;
    case 'add':
      p=byId(id); if(!p||soldOut(p)) break;
      if(p.stock!==null&&(cart[id]||0)+1>p.stock) break;
      cart[id]=(cart[id]||0)+1; orderText=''; orderErr=''; orderSent=false; render(); break;
    case 'open-cart': overlay='cart'; orderErr=''; renderOverlay(); break;
    case 'close': overlay=null; render(); break;
    case 'inc':
      p=byId(id); if(!p) break;
      if(p.stock!==null&&cart[id]+1>p.stock) break;
      cart[id]++; orderText=''; render(); break;
    case 'dec': cart[id]--; if(cart[id]<=0) delete cart[id]; orderText=''; render(); break;
    case 'send':
      if(sending) break;
      var n0=val('c-name').trim(), m0=val('c-mail').trim(), g0=val('c-msg').trim(), w0=val('c-web');
      var keep=function(){var a1=document.getElementById('c-name'),b1=document.getElementById('c-mail'),c1=document.getElementById('c-msg');if(a1)a1.value=n0;if(b1)b1.value=m0;if(c1)c1.value=g0;};
      if(!n0||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m0)){orderErr='Bitte gib deinen Namen und eine gültige E-Mail-Adresse an.';renderOverlay();keep();break;}
      var ids0=Object.keys(cart).filter(byId);
      var l0=ids0.map(function(k){var q=byId(k);return cart[k]+' × '+q.name+' – '+eur(q.price)+' = '+eur(q.price*cart[k]);});
      var txt0='Anfrage an '+state.shop.name+'\n\nName: '+n0+'\nE-Mail: '+m0+'\n\nArtikel:\n'+l0.join('\n')+'\n\nSumme: '+eur(cartTotal())+(g0?'\n\nNachricht: '+g0:'');
      orderErr=''; sending=true; renderOverlay(); keep();
      var body0=new URLSearchParams({'form-name':'anfrage','bot-field':w0,name:n0,email:m0,message:g0,order:txt0}).toString();
      fetch('/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:body0}).then(function(r){
        if(!r.ok) throw new Error('http '+r.status);
        sending=false; orderSent=true; cart={}; orderText=''; render();
      }).catch(function(){
        sending=false; orderText=txt0;
        orderErr='Der direkte Versand ist gerade nicht möglich. Du kannst die Anfrage unten kopieren und selbst per E-Mail schicken.';
        renderOverlay(); keep();
      });
      break;
    case 'copy':
      var out=document.getElementById('c-out'),st=document.getElementById('copystat');
      var done=function(ok){if(st)st.textContent=ok?'Kopiert.':'Text markiert, bitte mit Strg+C kopieren.';};
      try{navigator.clipboard.writeText(orderText).then(function(){done(true)},function(){out.select();done(false)});}catch(e){out.select();done(false);}
      break;
  }
});
document.addEventListener('keydown',function(ev){ if(ev.key==='Escape'&&overlay){overlay=null;render();} });
app.addEventListener('pointermove',function(ev){
  var c=ev.target.closest&&ev.target.closest('.card'); if(!c) return;
  var r=c.getBoundingClientRect();
  c.style.setProperty('--mx',(ev.clientX-r.left)+'px'); c.style.setProperty('--my',(ev.clientY-r.top)+'px');
});

  /* ---- Hero: die Artikel des Shops werden live gedruckt ---- */
  var reduced=false;
  try{reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;}catch(e){}
  var CX=240, BASE=372, PRINT_MS=7000, CYCLE_MS=9800;
  var NS=[300,190,270,240];
  var tmp=document.createElement('canvas');
  var cols={bed:'#1C222A',line:'#272E38'}, colTick=0;
  var imgs={};
  function readCols(){
    try{var cs=getComputedStyle(document.documentElement);
      cols.bed=cs.getPropertyValue('--surface2').trim()||cols.bed;
      cols.line=cs.getPropertyValue('--line').trim()||cols.line;}catch(e){}
  }
  function prof(p){var h=0,s=String(p.id);for(var i=0;i<s.length;i++)h=(h*17+s.charCodeAt(i))%97;return h%4;}
  function rad(t,pf){
    if(pf===0) return 62+30*Math.sin(t*6.2+0.4)+16*t;
    if(pf===1) return 58+8*t+4*Math.sin(t*20);
    if(pf===2) return 12+78*(1-t);
    return 44+30*Math.cos(t*6.2832);
  }
  function getImg(p){
    if(!p.img) return null;
    var c=imgs[p.id];
    if(!c||c.src!==p.img){c=imgs[p.id]={src:p.img,im:new Image()};c.im.src=p.img;}
    return (c.im.complete&&c.im.naturalWidth)?c.im:null;
  }
  function heroProducts(){return state.products.length?state.products:[{id:'demo',name:'Vase',price:0,img:''}];}
  function nozzle(ctx,nx,ny,done,glow){
    if(!done&&glow){
      var gl=ctx.createRadialGradient(nx,ny,0,nx,ny,18);
      gl.addColorStop(0,'rgba(255,210,63,.95)'); gl.addColorStop(1,'rgba(255,210,63,0)');
      ctx.fillStyle=gl; ctx.beginPath(); ctx.arc(nx,ny,18,0,6.2832); ctx.fill();
    }
    ctx.fillStyle='#6B7686'; ctx.fillRect(nx-15,ny-46,30,20);
    ctx.fillStyle='#A5AFBD'; ctx.beginPath(); ctx.moveTo(nx-9,ny-26); ctx.lineTo(nx+9,ny-26); ctx.lineTo(nx+2.5,ny-3); ctx.lineTo(nx-2.5,ny-3); ctx.closePath(); ctx.fill();
  }
  function heroDraw(p,ts,prod){
    var cv=document.getElementById('hero-cv'); if(!cv||!prod) return;
    var dpr=Math.min(window.devicePixelRatio||1,2);
    if(cv.getAttribute('data-r')!==String(dpr)){cv.width=Math.round(480*dpr);cv.height=Math.round(420*dpr);cv.setAttribute('data-r',String(dpr));}
    if(tmp.width!==cv.width){tmp.width=cv.width;tmp.height=cv.height;}
    if(colTick++%90===0) readCols();
    var ctx=cv.getContext('2d'); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,480,420);
    ctx.fillStyle=cols.bed; ctx.strokeStyle=cols.line; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.ellipse(CX,BASE+8,176,48,0,0,6.2832); ctx.fill(); ctx.stroke();
    var done=p>=1, k, total, im=getImg(prod);
    if(im){
      var FW=280, FH=280, FX=CX-FW/2, FY=BASE-FH-6;
      var rh=Math.max(2,Math.floor(p*FH)); k=rh; total=FH;
      ctx.save(); ctx.setLineDash([6,6]); ctx.strokeStyle=cols.line; ctx.lineWidth=1.5; ctx.strokeRect(FX,FY,FW,FH); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(FX,FY+FH-rh,FW,rh); ctx.clip();
      var s=Math.max(FW/im.naturalWidth,FH/im.naturalHeight), dw=im.naturalWidth*s, dh=im.naturalHeight*s;
      ctx.drawImage(im,CX-dw/2,FY+FH/2-dh/2,dw,dh);
      ctx.fillStyle='rgba(0,0,0,.22)';
      for(var y=FY+FH-rh;y<FY+FH;y+=4) ctx.fillRect(FX,y,FW,1);
      ctx.restore();
      var ly=FY+FH-rh, nx=FX+FW*(0.5+0.5*Math.sin(ts/260));
      if(!done){ctx.fillStyle='rgba(255,255,255,.75)'; ctx.fillRect(FX,ly-1,FW,2);}
      nozzle(ctx,nx,ly-(done?46:0),done,true);
    } else {
      var pf=prof(prod), N=NS[pf], hb=hue(String(prod.id));
      k=Math.max(1,Math.min(N,Math.floor(p*N))); total=N;
      ctx.fillStyle='rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(CX,BASE+8,96,26,0,0,6.2832); ctx.fill();
      var t2=tmp.getContext('2d'); t2.setTransform(dpr,0,0,dpr,0,0); t2.clearRect(0,0,480,420);
      for(var i=0;i<k;i++){
        var t=i/N, r=rad(t,pf);
        t2.fillStyle='hsl('+(hb+t*40)+',72%,'+(i%3===0?40:50)+'%)';
        t2.beginPath(); t2.ellipse(CX,BASE-i,r,r*0.26,0,0,6.2832); t2.fill();
      }
      t2.globalCompositeOperation='source-atop';
      var g=t2.createLinearGradient(CX-100,0,CX+100,0);
      g.addColorStop(0,'rgba(0,0,0,.62)'); g.addColorStop(.32,'rgba(255,255,255,.06)');
      g.addColorStop(.55,'rgba(255,255,255,.2)'); g.addColorStop(1,'rgba(0,0,0,.66)');
      t2.fillStyle=g; t2.fillRect(0,0,480,420);
      t2.globalCompositeOperation='source-over';
      ctx.drawImage(tmp,0,0,480,420);
      var ty=BASE-k, tr=rad(k/N,pf), a=ts/240;
      var nx2=CX+tr*Math.cos(a), ny=ty+tr*0.26*Math.sin(a)-(done?46:0);
      if(!done){
        ctx.strokeStyle='rgba(255,255,255,.6)'; ctx.lineWidth=1.5;
        ctx.beginPath(); ctx.ellipse(CX,ty,tr,tr*0.26,0,0,6.2832); ctx.stroke();
      }
      nozzle(ctx,nx2,ny,done,true);
    }
    var lb=document.getElementById('hero-layer'), br=document.getElementById('hero-bar'), fl=document.getElementById('hero-fil');
    if(lb) lb.textContent='Schicht '+k+' / '+total;
    if(br) br.style.width=(k/total*100)+'%';
    if(fl) fl.textContent=prod.name+(prod.price>0?' · '+eur(prod.price):'');
  }
  var t0=null;
  function loop(ts){
    if(t0===null) t0=ts-0.9*PRINT_MS;
    var list=heroProducts();
    var idx=Math.floor((ts-t0)/CYCLE_MS)%list.length;
    var e=(ts-t0)%CYCLE_MS;
    heroDraw(Math.min(1,e/PRINT_MS),ts,list[idx]);
    requestAnimationFrame(loop);
  }

render();
if(!reduced) requestAnimationFrame(loop);
Promise.all([getShop(),listProducts()]).then(function(r){
  state.shop=r[0]; state.products=r[1]; loaded=true; render();
}).catch(function(e){ console.error(e); loaded=true; loadErr=true; render(); });
