/* ══════════════════════════════════════════════════════
   CLÍNICA – MAPA INTERATIVO  |  localStorage + JSON
══════════════════════════════════════════════════════ */

/* ── STATE ── */
const state = {
  elements: [], editMode: false,
  snapEnabled: true, gridEnabled: false, snapSize: 10,
  zoom: 1, panX: 20, panY: 20,
  selectedId: null, nextId: 1,
};

/* ── DOM ── */
const canvas        = document.getElementById('mapCanvas');
const canvasOuter   = document.getElementById('mapCanvasOuter');
const gridOverlay   = document.getElementById('gridOverlay');
const panelTitle    = document.getElementById('panelTitle');
const panelBody     = document.getElementById('panelBody');
const editToolbar   = document.getElementById('editToolbar');
const btnEditMode   = document.getElementById('btnEditMode');
const btnAddRoom    = document.getElementById('btnAddRoom');
const btnRefresh    = document.getElementById('btnRefresh');
const btnSave       = document.getElementById('btnSave');
const btnZoomIn     = document.getElementById('btnZoomIn');
const btnZoomOut    = document.getElementById('btnZoomOut');
const btnZoomReset  = document.getElementById('btnZoomReset');
const zoomLevel     = document.getElementById('zoomLevel');
const contextMenu   = document.getElementById('contextMenu');
const modalBackdrop = document.getElementById('modalBackdrop');
const modalTitle    = document.getElementById('modalTitle');
const modalBody     = document.getElementById('modalBody');
const modalClose    = document.getElementById('modalClose');
const modalCancel   = document.getElementById('modalCancel');
const modalConfirm  = document.getElementById('modalConfirm');

/* ── PERSISTÊNCIA ── */
function saveLocal() {
  localStorage.setItem('clinic_map_elements', JSON.stringify(state.elements));
  localStorage.setItem('clinic_map_nextId', String(state.nextId));
}
function loadLocal() {
  try {
    const raw = localStorage.getItem('clinic_map_elements');
    const nid = localStorage.getItem('clinic_map_nextId');
    if (raw) {
      state.elements = JSON.parse(raw);
      state.nextId = nid ? parseInt(nid) : state.elements.length + 1;
      return true;
    }
  } catch(e) { console.warn('LocalStorage load failed', e); }
  return false;
}
function exportToFile() {
  const payload = { version:'1.0', savedAt: new Date().toISOString(), nextId: state.nextId, elements: state.elements };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'mapa-clinica.json'; a.click();
  URL.revokeObjectURL(url);
  showToast('✓ mapa-clinica.json baixado!');
}
function importFromFile() {
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json,application/json';
  input.addEventListener('change', () => {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.elements) throw new Error('Arquivo inválido');
        state.elements = data.elements;
        state.nextId = data.nextId || (state.elements.length + 1);
        saveLocal(); renderAll(); updateStats();
        showToast('✓ Mapa importado!');
      } catch(err) { showToast('Erro: ' + err.message, 4000); }
    };
    reader.readAsText(file);
  });
  input.click();
}
let _autoSaveTimer = null;
function autoSaveLocal() {
  clearTimeout(_autoSaveTimer);
  _autoSaveTimer = setTimeout(saveLocal, 800);
}

/* ── DEFAULT LAYOUT ── */
function buildDefaultLayout() {
  const els = []; let id = 1;
  const mk = (obj) => ({
    rotation:0, zIndex:1, name:'', status:'livre',
    roomType:'individual', guest:'', notes:'', label:'', beds:[],
    ...obj, id: id++
  });

  els.push(mk({ type:'recepcao', x:20,  y:80,  w:130, h:300, label:'RECEPÇÃO /\nÁREA LATERAL A' }));
  els.push(mk({ type:'recepcao', x:20,  y:400, w:130, h:220, label:'RECEPÇÃO /\nÁREA LATERAL B' }));
  els.push(mk({ type:'sala',    x:390, y:22, w:100, h:36, label:'SALAS'    }));
  els.push(mk({ type:'text',    x:430, y:60, w:30,  h:30, label:'↑'        }));
  els.push(mk({ type:'banheiro', x:650, y:22, w:120, h:36, label:'BANHEIRO' }));
  els.push(mk({ type:'text',     x:700, y:60, w:30,  h:30, label:'↓'        }));

  const uY=95, uW=112, uG=4, uX=165;
  const r1=[
    {name:'Quarto 01',status:'ocupado',guest:'João Silva'},
    {name:'Quarto 02'},{name:'Quarto 03'},{name:'Quarto 03'},
    {name:'Quarto 04'},{name:'Quarto 06',roomType:'suite'},
  ];
  r1.forEach((r,i) => els.push(mk({type:'room', x:uX+i*(uW+uG), y:uY, w:uW, h:110, ...r})));

  const cY=uY+110+4, tW=r1.length*(uW+uG)-uG;
  els.push(mk({type:'corredor', x:uX, y:cY, w:tW, h:54, label:'← CORREDOR CENTRAL →'}));

  const lW=Math.floor((tW-9*4)/10), lY=cY+54+4;
  const r2=[
    {name:'Quarto 07',status:'ocupado',guest:'Maria Souza'},
    {name:'Quarto 08'},{name:'Quarto 09'},
    {name:'Quarto 10',roomType:'suite'},{name:'Quarto 11'},
    {name:'Quarto 12',status:'ocupado',guest:'Carlos Lima'},
    {name:'Quarto 13'},{name:'Quarto 14'},{name:'Quarto 15'},{name:'Quarto 16'},
  ];
  r2.forEach((r,i) => els.push(mk({type:'room', x:uX+i*(lW+4), y:lY, w:lW, h:100, ...r})));

  state.elements = els; state.nextId = id;
}

/* ── RENDER ── */
function renderAll() {
  Array.from(canvas.querySelectorAll('.map-element')).forEach(el => el.remove());
  state.elements.forEach(el => renderElement(el));
  updateStats(); updateCanvas();
}

function renderElement(el) {
  const div = document.createElement('div');
  div.className = 'map-element';
  div.dataset.id = el.id;
  div.style.cssText = 'left:'+el.x+'px;top:'+el.y+'px;width:'+el.w+'px;height:'+el.h+'px;z-index:'+(el.zIndex||1)+';transform:rotate('+(el.rotation||0)+'deg);';
  div.innerHTML = buildElementHTML(el);

  /* camas clicáveis no card */
  if (el.type === 'room') {
    div.querySelectorAll('.bed-icon').forEach(function(icon) {
      icon.addEventListener('click', function(e) {
        e.stopPropagation();
        var idx = parseInt(icon.dataset.bed);
        if (!Array.isArray(el.beds) || idx >= el.beds.length) return;
        el.beds[idx] = el.beds[idx] === 'emuso' ? 'livre' : 'emuso';
        el.status = el.beds.some(function(b){ return b==='emuso'; }) ? 'ocupado' : 'livre';
        rerenderElement(el); updateStats(); autoSaveLocal();
        if (state.selectedId == el.id) showPanel(el);
      });
    });
  }

  /* drag/resize/rotate — só modo edição */
  if (state.editMode) {
    addDragHandlers(div, el);
    addResizeHandles(div, el);
    addRotateHandle(div, el);
  }

  /* clique → painel lateral */
  if (el.type === 'room') {
    div.addEventListener('click', function(e) {
      if (div.dataset.wasDragged === 'true') { div.dataset.wasDragged='false'; return; }
      e.stopPropagation(); selectElement(el.id);
    });
  }

  div.addEventListener('contextmenu', function(e) { e.preventDefault(); showContextMenu(e, el.id); });
  if (state.selectedId == el.id) div.classList.add('selected');
  canvas.appendChild(div);
}

/* ── HTML BUILDERS ── */
function buildElementHTML(el) {
  switch(el.type) {
    case 'room':     return buildRoomHTML(el);
    case 'recepcao': return buildRecepcaoHTML(el);
    case 'sala':     return '<div class="el-sala" style="width:100%;height:100%;">'+escHtml(el.label||'SALA')+'</div>';
    case 'banheiro': return '<div class="el-banheiro" style="width:100%;height:100%;">'+escHtml(el.label||'BANHEIRO')+'</div>';
    case 'corredor': return buildCorredorHTML(el);
    case 'text':     return '<div class="el-text" style="width:100%;height:100%;font-size:'+(el.w>50?14:20)+'px;">'+escHtml(el.label||'Texto')+'</div>';
    case 'hline':    return '<div class="el-hline" style="width:100%;height:100%;"></div>';
    case 'vline':    return '<div class="el-vline" style="width:100%;height:100%;"></div>';
    default:         return '<div style="width:100%;height:100%;background:#eee;border-radius:6px;"></div>';
  }
}

function buildRoomHTML(el) {
  var isOcc   = el.status === 'ocupado';
  var isSuite = el.roomType === 'suite';
  var cls = 'el-room' + (isOcc?' occupied':'') + (isSuite?' suite':'');
  var badgeClass = isOcc ? 'badge-ocupado' : isSuite ? 'badge-suite' : 'badge-livre';
  var badgeText  = isOcc ? 'Ocupado' : isSuite ? '🛁 Suíte' : 'Livre';
  var guestHTML  = (isOcc && el.guest)
    ? '<div class="room-guest"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'+escHtml(el.guest)+'</div>'
    : '';

  var beds = Array.isArray(el.beds) ? el.beds : [];
  var bedsHTML = '';
  if (beds.length > 0) {
    var inUse = beds.filter(function(b){ return b==='emuso'; }).length;
    var icons = beds.map(function(b, i) {
      var c = b==='emuso' ? '#22c55e' : '#ef4444';
      return '<svg class="bed-icon" data-bed="'+i+'" title="'+(b==='emuso'?'Em uso':'Livre')+'" width="16" height="12" viewBox="0 0 24 16" fill="none" stroke="'+c+'" stroke-width="2" style="cursor:pointer;flex-shrink:0"><rect x="1" y="4" width="22" height="11" rx="2" fill="'+c+'22"/><path d="M4 4V2a2 2 0 0 1 4 0v2M16 4V2a2 2 0 0 1 4 0v2" stroke="'+c+'"/><line x1="1" y1="10" x2="23" y2="10" stroke="'+c+'"/></svg>';
    }).join('');
    var livres = beds.length - inUse;
    bedsHTML = '<div class="beds-row">'+icons+'</div>'
      +'<div class="beds-count"><span class="beds-inuse">'+inUse+' em uso</span> · <span class="beds-free">'+livres+' livre'+(livres!==1?'s':'')+'</span></div>';
  }

  return '<div class="'+cls+'" style="width:100%;height:100%;position:relative;">'
    +'<div class="room-name">'+escHtml(el.name)+'</div>'
    +'<div class="room-badge '+badgeClass+'">'+badgeText+'</div>'
    +bedsHTML+guestHTML
    +'</div>';
}

function buildRecepcaoHTML(el) {
  var lines = (el.label||'RECEPÇÃO').split('\n');
  return '<div class="el-recepcao" style="width:100%;height:100%;">'
    +'<div class="recepcao-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>'
    +'<div class="recepcao-label">'+lines.map(escHtml).join('<br>')+'</div>'
    +'<div class="recepcao-lines"><div class="recepcao-line" style="width:60px;"></div><div class="recepcao-line" style="width:50px;"></div><div class="recepcao-line" style="width:55px;"></div></div>'
    +'</div>';
}

function buildCorredorHTML(el) {
  return '<div class="el-corredor" style="width:100%;height:100%;">'
    +'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>'
    +escHtml(el.label||'CORREDOR')
    +'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#64748b" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>'
    +'</div>';
}

/* ── DRAG ── */
var isDraggingElement = false;

function addDragHandlers(div, el) {
  div.style.cursor = 'grab';
  div.addEventListener('mousedown', function(e) {
    if (e.target.classList.contains('resize-handle') || e.target.classList.contains('rotate-handle')) return;
    if (e.button !== 0) return;
    e.stopPropagation();
    isDraggingElement = true;
    var sx=e.clientX, sy=e.clientY, ox=el.x, oy=el.y, moved=false;
    div.style.cursor = 'grabbing';
    function onMove(ev) {
      var dx=(ev.clientX-sx)/state.zoom, dy=(ev.clientY-sy)/state.zoom;
      if (!moved && Math.abs(dx)<4 && Math.abs(dy)<4) return;
      moved=true; div.classList.add('dragging');
      var nx=ox+dx, ny=oy+dy;
      if (state.snapEnabled) { nx=Math.round(nx/state.snapSize)*state.snapSize; ny=Math.round(ny/state.snapSize)*state.snapSize; }
      nx=Math.max(0,nx); ny=Math.max(0,ny);
      el.x=nx; el.y=ny; div.style.left=nx+'px'; div.style.top=ny+'px';
    }
    function onUp() {
      isDraggingElement=false; div.classList.remove('dragging'); div.style.cursor='grab';
      if (moved) { div.dataset.wasDragged='true'; autoSaveLocal(); }
      document.removeEventListener('mousemove',onMove);
      document.removeEventListener('mouseup',onUp);
    }
    document.addEventListener('mousemove',onMove);
    document.addEventListener('mouseup',onUp);
  });
}

/* ── RESIZE ── */
function addResizeHandles(div, el) {
  var handle = document.createElement('div');
  handle.className = 'resize-handle se';
  handle.addEventListener('mousedown', function(e) {
    e.stopPropagation(); e.preventDefault(); isDraggingElement=true;
    var sx=e.clientX, sy=e.clientY, ow=el.w, oh=el.h;
    function onMove(ev) {
      var nw=Math.max(60,ow+(ev.clientX-sx)/state.zoom);
      var nh=Math.max(40,oh+(ev.clientY-sy)/state.zoom);
      if (state.snapEnabled) { nw=Math.round(nw/state.snapSize)*state.snapSize; nh=Math.round(nh/state.snapSize)*state.snapSize; }
      el.w=nw; el.h=nh; div.style.width=nw+'px'; div.style.height=nh+'px';
      div.innerHTML=buildElementHTML(el); addResizeHandles(div,el); addRotateHandle(div,el);
    }
    function onUp() { isDraggingElement=false; document.removeEventListener('mousemove',onMove); document.removeEventListener('mouseup',onUp); autoSaveLocal(); }
    document.addEventListener('mousemove',onMove);
    document.addEventListener('mouseup',onUp);
  });
  div.appendChild(handle);
}

/* ── ROTATE ── */
function addRotateHandle(div, el) {
  var handle = document.createElement('div');
  handle.className='rotate-handle'; handle.innerHTML='↻'; handle.title='Rotacionar';
  handle.addEventListener('mousedown', function(e) {
    e.stopPropagation(); e.preventDefault(); isDraggingElement=true;
    var rect=div.getBoundingClientRect(), cx=rect.left+rect.width/2, cy=rect.top+rect.height/2;
    function onMove(ev) {
      var angle=Math.atan2(ev.clientY-cy,ev.clientX-cx)*(180/Math.PI)+90;
      if (state.snapEnabled) angle=Math.round(angle/15)*15;
      el.rotation=angle; div.style.transform='rotate('+angle+'deg)';
    }
    function onUp() { isDraggingElement=false; document.removeEventListener('mousemove',onMove); document.removeEventListener('mouseup',onUp); autoSaveLocal(); }
    document.addEventListener('mousemove',onMove);
    document.addEventListener('mouseup',onUp);
  });
  div.appendChild(handle);
}

/* ── PAN & ZOOM ── */
var isPanning=false, panStart={x:0,y:0};

canvasOuter.addEventListener('mousedown', function(e) {
  if (isDraggingElement) return;
  if (e.button===1) {
    e.preventDefault(); isPanning=true;
    panStart={x:e.clientX-state.panX, y:e.clientY-state.panY};
    canvasOuter.classList.add('panning'); return;
  }
  if (e.button!==0) return;
  if (state.editMode && e.target.closest('.map-element')) return;
  e.preventDefault(); isPanning=true;
  panStart={x:e.clientX-state.panX, y:e.clientY-state.panY};
  canvasOuter.classList.add('panning');
});
document.addEventListener('mousemove', function(e) {
  if (!isPanning || isDraggingElement) return;
  state.panX=e.clientX-panStart.x; state.panY=e.clientY-panStart.y; updateCanvas();
});
document.addEventListener('mouseup', function() { isPanning=false; canvasOuter.classList.remove('panning'); });
canvasOuter.addEventListener('wheel', function(e) {
  e.preventDefault(); setZoom(state.zoom+(e.deltaY>0?-0.08:0.08));
}, {passive:false});

function setZoom(z) { state.zoom=Math.min(2,Math.max(0.3,z)); zoomLevel.textContent=Math.round(state.zoom*100)+'%'; updateCanvas(); }
function updateCanvas() { canvas.style.transform='translate('+state.panX+'px,'+state.panY+'px) scale('+state.zoom+')'; }

/* ── GRID ── */
function renderGrid() {
  var W=parseInt(canvas.style.width)||1600, H=parseInt(canvas.style.height)||900, s=state.snapSize;
  var svg='';
  for(var x=0;x<=W;x+=s) svg+='<line x1="'+x+'" y1="0" x2="'+x+'" y2="'+H+'" stroke="#e2e8f0" stroke-width="0.5"/>';
  for(var y=0;y<=H;y+=s) svg+='<line x1="0" y1="'+y+'" x2="'+W+'" y2="'+y+'" stroke="#e2e8f0" stroke-width="0.5"/>';
  gridOverlay.innerHTML=svg;
  gridOverlay.setAttribute('viewBox','0 0 '+W+' '+H);
  gridOverlay.setAttribute('width',W); gridOverlay.setAttribute('height',H);
}

/* ── SELECTION ── */
function selectElement(id) {
  state.selectedId=id;
  Array.from(canvas.querySelectorAll('.map-element')).forEach(function(d){ d.classList.toggle('selected', String(d.dataset.id)===String(id)); });
  var el=state.elements.find(function(e){ return e.id==id; });
  if (el) showPanel(el);
  updateStatInfo(el);
}
function deselectAll() {
  state.selectedId=null;
  Array.from(canvas.querySelectorAll('.map-element')).forEach(function(d){ d.classList.remove('selected'); });
  showIdlePanel(); updateStatInfo(null);
}
canvas.addEventListener('click', function(e) { if(e.target===canvas||e.target===gridOverlay) deselectAll(); });

/* ── PANEL ── */
function showIdlePanel() {
  panelTitle.textContent='Editar Quarto';
  panelBody.innerHTML='<div class="panel-idle"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" stroke-width="1.5"><path d="M15 3H9a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><p>Clique em um quarto para editar suas informações.</p></div>';
}
function showPanel(el) {
  panelTitle.textContent=el.type==='room'?'Editar Quarto':'Editar Elemento';
  panelBody.innerHTML=buildPanelForm(el);
  bindPanelForm(el);
}

function buildPanelForm(el) {
  if (el.type==='room') {
    var beds=Array.isArray(el.beds)?el.beds:[];
    return '<div class="form-group"><label class="form-label">Quarto</label>'
      +'<input class="form-input" id="pName" value="'+escHtml(el.name)+'" placeholder="Ex: Quarto 01"></div>'
      +'<div class="form-group"><label class="form-label">Tipo</label>'
      +'<div class="type-selector">'
      +'<button class="type-btn '+(el.roomType==='individual'?'active':'')+'" data-rtype="individual">'
      +'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Individual</button>'
      +'<button class="type-btn '+(el.roomType==='suite'?'active':'')+'" data-rtype="suite">'
      +'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 6L9 2M15 6L15 2M4 10h16M4 10a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2"/></svg> Suíte</button>'
      +'</div></div>'
      +'<div class="form-group"><label class="form-label">Status</label>'
      +'<select class="form-select" id="pStatus">'
      +'<option value="livre"'+(el.status==='livre'?' selected':'')+'>🔵 Livre</option>'
      +'<option value="ocupado"'+(el.status==='ocupado'?' selected':'')+'>🟢 Ocupado</option>'
      +'</select></div>'
      +'<div class="form-group"><label class="form-label">Quantidade de Camas</label>'
      +'<div class="beds-qty-row">'
      +'<button class="beds-qty-btn" id="bedsQtyMinus">−</button>'
      +'<span class="beds-qty-val" id="bedsQtyVal">'+beds.length+'</span>'
      +'<button class="beds-qty-btn" id="bedsQtyPlus">+</button>'
      +'</div></div>'
      +'<div id="bedsEditorWrap">'+buildBedsEditorHTML(beds)+'</div>'
      +'<div class="form-group"><label class="form-label">Hóspede</label>'
      +'<input class="form-input" id="pGuest" value="'+escHtml(el.guest)+'" placeholder="Nome do hóspede"></div>'
      +'<div class="form-group"><label class="form-label">Observações</label>'
      +'<textarea class="form-textarea" id="pNotes" placeholder="Ex: Acompanhante...">'+escHtml(el.notes)+'</textarea></div>'
      +'<div class="form-group prop-row">'
      +'<div class="form-group"><label class="form-label">X</label><input class="form-input" id="pX" type="number" value="'+el.x+'"></div>'
      +'<div class="form-group"><label class="form-label">Y</label><input class="form-input" id="pY" type="number" value="'+el.y+'"></div></div>'
      +'<div class="form-group prop-row">'
      +'<div class="form-group"><label class="form-label">Largura</label><input class="form-input" id="pW" type="number" value="'+el.w+'"></div>'
      +'<div class="form-group"><label class="form-label">Altura</label><input class="form-input" id="pH" type="number" value="'+el.h+'"></div></div>'
      +'<div class="form-actions">'
      +'<button class="btn btn-outline" id="pCancel">Cancelar</button>'
      +'<button class="btn btn-primary" id="pSave">Salvar</button></div>';
  } else {
    return '<div class="form-group"><label class="form-label">Rótulo</label>'
      +'<input class="form-input" id="pLabel" value="'+escHtml(el.label||el.name)+'" placeholder="Texto"></div>'
      +'<div class="form-group prop-row">'
      +'<div class="form-group"><label class="form-label">X</label><input class="form-input" id="pX" type="number" value="'+el.x+'"></div>'
      +'<div class="form-group"><label class="form-label">Y</label><input class="form-input" id="pY" type="number" value="'+el.y+'"></div></div>'
      +'<div class="form-group prop-row">'
      +'<div class="form-group"><label class="form-label">Largura</label><input class="form-input" id="pW" type="number" value="'+el.w+'"></div>'
      +'<div class="form-group"><label class="form-label">Altura</label><input class="form-input" id="pH" type="number" value="'+el.h+'"></div></div>'
      +'<div class="form-group"><label class="form-label">Rotação (°)</label>'
      +'<input class="form-input" id="pRot" type="number" value="'+(el.rotation||0)+'"></div>'
      +'<div class="form-actions">'
      +'<button class="btn btn-outline" id="pCancel">Cancelar</button>'
      +'<button class="btn btn-primary" id="pSave">Salvar</button></div>';
  }
}

function buildBedsEditorHTML(beds) {
  if (!beds || beds.length===0) return '';
  var items = beds.map(function(b,i){
    var inUse=b==='emuso';
    return '<button class="bed-toggle-btn '+(inUse?'bed-inuse':'bed-free')+'" data-bedpanel="'+i+'">'
      +'<svg width="14" height="10" viewBox="0 0 24 16" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="11" rx="2"/><path d="M4 4V2a2 2 0 0 1 4 0v2M16 4V2a2 2 0 0 1 4 0v2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>'
      +'<span>Cama '+(i+1)+'</span><small>'+(inUse?'Em uso':'Livre')+'</small>'
      +'</button>';
  }).join('');
  return '<div class="form-group"><label class="form-label">Camas <span style="font-weight:400;color:#6b7280">(clique para alternar)</span></label>'
    +'<div class="beds-panel-grid">'+items+'</div></div>';
}

function bindPanelForm(el) {
  if (!Array.isArray(el.beds)) el.beds=[];

  panelBody.querySelectorAll('[data-rtype]').forEach(function(btn){
    btn.addEventListener('click', function(){
      panelBody.querySelectorAll('[data-rtype]').forEach(function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });

  if (el.type==='room') {
    var minus=document.getElementById('bedsQtyMinus');
    var plus =document.getElementById('bedsQtyPlus');
    if (minus) minus.addEventListener('click', function(){
      if (el.beds.length===0) return;
      el.beds.pop();
      document.getElementById('bedsQtyVal').textContent=el.beds.length;
      document.getElementById('bedsEditorWrap').innerHTML=buildBedsEditorHTML(el.beds);
      bindBedsPanelButtons(el);
      rerenderElement(el); autoSaveLocal();
    });
    if (plus) plus.addEventListener('click', function(){
      if (el.beds.length>=20) return;
      el.beds.push('livre');
      document.getElementById('bedsQtyVal').textContent=el.beds.length;
      document.getElementById('bedsEditorWrap').innerHTML=buildBedsEditorHTML(el.beds);
      bindBedsPanelButtons(el);
      rerenderElement(el); autoSaveLocal();
    });
    bindBedsPanelButtons(el);
  }

  var pCancel=document.getElementById('pCancel');
  if (pCancel) pCancel.addEventListener('click', deselectAll);

  var pSave=document.getElementById('pSave');
  if (pSave) pSave.addEventListener('click', function(){
    if (el.type==='room') {
      var nm=document.getElementById('pName'); if(nm) el.name=nm.value.trim()||el.name;
      var st=document.getElementById('pStatus'); if(st) el.status=st.value;
      var gu=document.getElementById('pGuest'); el.guest=gu?gu.value.trim():'';
      var no=document.getElementById('pNotes'); el.notes=no?no.value.trim():'';
      var rt=panelBody.querySelector('[data-rtype].active'); if(rt) el.roomType=rt.dataset.rtype;
    } else {
      var lb=document.getElementById('pLabel'); if(lb&&lb.value.trim()){ el.label=lb.value.trim(); el.name=el.label; }
      var ro=document.getElementById('pRot'); if(ro) el.rotation=parseFloat(ro.value)||0;
    }
    var pX=document.getElementById('pX'), pY=document.getElementById('pY');
    var pW=document.getElementById('pW'), pH=document.getElementById('pH');
    if(pX) el.x=parseFloat(pX.value)||el.x;
    if(pY) el.y=parseFloat(pY.value)||el.y;
    if(pW) el.w=parseFloat(pW.value)||el.w;
    if(pH) el.h=parseFloat(pH.value)||el.h;
    rerenderElement(el); updateStats(); autoSaveLocal();
    showPanel(el); showToast('✓ Alterações salvas');
  });
}

function bindBedsPanelButtons(el) {
  panelBody.querySelectorAll('[data-bedpanel]').forEach(function(btn){
    btn.addEventListener('click', function(){
      var i=parseInt(btn.dataset.bedpanel);
      el.beds[i]=el.beds[i]==='emuso'?'livre':'emuso';
      btn.className='bed-toggle-btn '+(el.beds[i]==='emuso'?'bed-inuse':'bed-free');
      var sm=btn.querySelector('small'); if(sm) sm.textContent=el.beds[i]==='emuso'?'Em uso':'Livre';
      el.status=el.beds.some(function(b){ return b==='emuso'; })?'ocupado':'livre';
      var sel=document.getElementById('pStatus'); if(sel) sel.value=el.status;
      rerenderElement(el); autoSaveLocal();
    });
  });
}

function rerenderElement(el) {
  var ex=canvas.querySelector('[data-id="'+el.id+'"]');
  if (ex) ex.remove();
  renderElement(el);
  if (state.selectedId==el.id) {
    var nd=canvas.querySelector('[data-id="'+el.id+'"]');
    if (nd) nd.classList.add('selected');
  }
}

/* ── STATS ── */
function updateStats() {
  var rooms  = state.elements.filter(function(e){ return e.type==='room'; });
  var occ    = rooms.filter(function(e){ return e.status==='ocupado'; }).length;
  var suites = rooms.filter(function(e){ return e.roomType==='suite'; }).length;
  var tBeds  = rooms.reduce(function(s,r){ return s+(Array.isArray(r.beds)?r.beds.length:0); },0);
  var uBeds  = rooms.reduce(function(s,r){ return s+(Array.isArray(r.beds)?r.beds.filter(function(b){ return b==='emuso'; }).length:0); },0);
  document.getElementById('statTotal').textContent   =rooms.length;
  document.getElementById('statOccupied').textContent=occ;
  document.getElementById('statFree').textContent    =rooms.length-occ;
  document.getElementById('statSuites').textContent  =suites;
  var tb=document.getElementById('statTotalBeds'); if(tb) tb.textContent=tBeds;
  var ib=document.getElementById('statInUseBeds'); if(ib) ib.textContent=uBeds+' em uso / '+(tBeds-uBeds)+' livres';
}
function updateStatInfo(el) {
  var info=document.getElementById('statInfo'); if(!info) return;
  if (!el||el.type!=='room') { info.textContent='Clique em um quarto para editar suas informações.'; return; }
  info.textContent=el.name+' — '+(el.status==='ocupado'?'Ocupado por '+(el.guest||'—'):'Livre')+' | '+(el.roomType==='suite'?'Suíte':'Individual');
}

/* ── CONTEXT MENU ── */
var contextTargetId=null;
function showContextMenu(e, id) {
  contextTargetId=id;
  contextMenu.style.display='block';
  contextMenu.style.left=e.clientX+'px';
  contextMenu.style.top=e.clientY+'px';
}
contextMenu.querySelectorAll('.ctx-item').forEach(function(item){
  item.addEventListener('click', function(){
    var id=contextTargetId;
    var el=state.elements.find(function(e){ return e.id==id; });
    var act=item.dataset.action;
    if (act==='edit'&&el) selectElement(id);
    else if (act==='duplicate'&&el) duplicateElement(el);
    else if (act==='delete') deleteElement(id);
    contextMenu.style.display='none';
  });
});
document.addEventListener('click', function(){ contextMenu.style.display='none'; });

/* ── ADD / DUPLICATE / DELETE ── */
function duplicateElement(el) {
  var clone=Object.assign({},el,{id:state.nextId++,x:el.x+20,y:el.y+20,beds:(el.beds||[]).slice()});
  state.elements.push(clone); renderElement(clone); updateStats(); autoSaveLocal();
  showToast('Elemento duplicado');
}
function deleteElement(id) {
  var idx=state.elements.findIndex(function(e){ return e.id==id; }); if(idx===-1) return;
  state.elements.splice(idx,1);
  var div=canvas.querySelector('[data-id="'+id+'"]'); if(div) div.remove();
  if (state.selectedId==id) deselectAll();
  updateStats(); autoSaveLocal(); showToast('Elemento excluído');
}

/* toolbar type buttons */
document.querySelectorAll('.tool-btn[data-type]').forEach(function(btn){
  btn.addEventListener('click', function(){ openAddModal(btn.dataset.type); });
});
btnAddRoom.addEventListener('click', function(){ openAddModal('room'); });

function openAddModal(type) {
  var labels={room:'Quarto',sala:'Sala',banheiro:'Banheiro',recepcao:'Recepção',corredor:'Corredor',text:'Texto',hline:'Linha H',vline:'Linha V'};
  modalTitle.textContent='Novo '+(labels[type]||type);
  var extra='';
  var roomCount=state.elements.filter(function(e){ return e.type==='room'; }).length;
  if (type==='room') {
    extra='<div class="form-group"><label class="form-label">Nome</label>'
      +'<input class="form-input" id="mName" value="Quarto '+(roomCount+1)+'"></div>'
      +'<div class="form-group"><label class="form-label">Tipo</label>'
      +'<div class="type-selector">'
      +'<button class="type-btn active" data-rtype="individual">Individual</button>'
      +'<button class="type-btn" data-rtype="suite">Suíte</button>'
      +'</div></div>'
      +'<div class="form-group"><label class="form-label">Status</label>'
      +'<select class="form-select" id="mStatus"><option value="livre">Livre</option><option value="ocupado">Ocupado</option></select></div>'
      +'<div class="form-group"><label class="form-label">Hóspede</label>'
      +'<input class="form-input" id="mGuest" placeholder="Nome do hóspede"></div>';
  } else {
    extra='<div class="form-group"><label class="form-label">Rótulo</label>'
      +'<input class="form-input" id="mLabel" value="'+(labels[type]||type)+'"></div>';
  }
  modalBody.innerHTML=extra
    +'<div class="form-group prop-row">'
    +'<div class="form-group"><label class="form-label">X</label><input class="form-input" id="mX" type="number" value="200"></div>'
    +'<div class="form-group"><label class="form-label">Y</label><input class="form-input" id="mY" type="number" value="200"></div></div>';

  modalBody.querySelectorAll('[data-rtype]').forEach(function(b){
    b.addEventListener('click', function(){
      modalBody.querySelectorAll('[data-rtype]').forEach(function(x){ x.classList.remove('active'); });
      b.classList.add('active');
    });
  });

  modalBackdrop.style.display='flex';
  modalConfirm.onclick=function(){
    var sizes={room:{w:110,h:110},sala:{w:100,h:36},banheiro:{w:120,h:36},recepcao:{w:130,h:260},corredor:{w:400,h:60},text:{w:120,h:30},hline:{w:200,h:4},vline:{w:4,h:200}};
    var sz=sizes[type]||{w:110,h:90};
    var rt=modalBody.querySelector('[data-rtype].active');
    var mX=document.getElementById('mX'), mY=document.getElementById('mY');
    var mName=document.getElementById('mName'), mLabel=document.getElementById('mLabel');
    var mStatus=document.getElementById('mStatus'), mGuest=document.getElementById('mGuest');
    var newEl={
      id:state.nextId++, type:type, beds:[],
      x:mX?parseFloat(mX.value)||100:100,
      y:mY?parseFloat(mY.value)||100:100,
      w:sz.w, h:sz.h, rotation:0, zIndex:2,
      name:type==='room'?(mName?mName.value.trim():''):'',
      label:type!=='room'?(mLabel?mLabel.value.trim():''):'',
      status:mStatus?mStatus.value:'livre',
      roomType:rt?rt.dataset.rtype:'individual',
      guest:mGuest?mGuest.value.trim():'',
      notes:'',
    };
    state.elements.push(newEl); renderElement(newEl); updateStats(); autoSaveLocal();
    closeModal(); showToast('✓ '+(labels[type]||type)+' criado');
  };
}
function closeModal(){ modalBackdrop.style.display='none'; }
modalClose.addEventListener('click', closeModal);
modalCancel.addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', function(e){ if(e.target===modalBackdrop) closeModal(); });

/* ── EDIT MODE ── */
btnEditMode.addEventListener('click', function(){
  state.editMode=!state.editMode;
  btnEditMode.classList.toggle('active', state.editMode);
  btnEditMode.innerHTML='<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> '+(state.editMode?'✓ Modo Edição':'Modo Edição');
  editToolbar.style.display=state.editMode?'flex':'none';
  renderAll();
  showToast(state.editMode?'Modo edição ativado':'Modo edição desativado');
});

/* ── TOOLBAR CONTROLS ── */
var chkGrid=document.getElementById('chkGrid');
var chkSnap=document.getElementById('chkSnap');
var selSnap=document.getElementById('snapSize');
var selCanvas=document.getElementById('canvasSize');
var btnImport=document.getElementById('btnImport');

if (chkGrid) chkGrid.addEventListener('change', function(){
  state.gridEnabled=chkGrid.checked;
  gridOverlay.style.display=state.gridEnabled?'block':'none';
  if (state.gridEnabled) renderGrid();
});
if (chkSnap) chkSnap.addEventListener('change', function(){ state.snapEnabled=chkSnap.checked; });
if (selSnap) selSnap.addEventListener('change', function(){
  state.snapSize=parseInt(selSnap.value);
  if (state.gridEnabled) renderGrid();
  showToast('Snap: '+selSnap.value+'px');
});
if (selCanvas) selCanvas.addEventListener('change', function(){
  var parts=selCanvas.value.split('x');
  canvas.style.width=parts[0]+'px'; canvas.style.height=parts[1]+'px';
  if (state.gridEnabled) renderGrid();
  showToast('Fundo: '+parts[0]+' × '+parts[1]+'px');
});
if (btnImport) btnImport.addEventListener('click', importFromFile);

/* ── ZOOM / SAVE / REFRESH ── */
btnZoomIn.addEventListener('click',    function(){ setZoom(state.zoom+0.1); });
btnZoomOut.addEventListener('click',   function(){ setZoom(state.zoom-0.1); });
btnZoomReset.addEventListener('click', function(){ state.zoom=1; state.panX=20; state.panY=20; setZoom(1); });

btnSave.addEventListener('click', function(){ saveLocal(); exportToFile(); });
btnRefresh.addEventListener('click', function(){
  btnRefresh.disabled=true;
  if (!loadLocal()) buildDefaultLayout();
  renderAll(); btnRefresh.disabled=false; showToast('Mapa atualizado');
});

/* ── TOAST ── */
var _toastTimer=null;
function showToast(msg, duration) {
  duration=duration||2000;
  var t=document.querySelector('.toast'); if(t) t.remove();
  t=document.createElement('div'); t.className='toast'; t.textContent=msg;
  document.body.appendChild(t);
  clearTimeout(_toastTimer);
  _toastTimer=setTimeout(function(){ t.classList.add('hide'); setTimeout(function(){ if(t.parentNode) t.remove(); },300); }, duration);
}

/* ── UTILS ── */
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ── BOOT ── */
function boot() {
  if (!loadLocal()) buildDefaultLayout();
  renderAll(); renderGrid(); updateCanvas();
}
boot();
