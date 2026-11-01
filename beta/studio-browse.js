/* Keep view navigation independent of opening a take in the processing engine. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const reason = 'Record or import a vocal to use this control.';
  const empty = () => !S.main && !S.song?.tracks.find(t=>t.id===S.song.activeTrack)?.regions.some(r => r.selected);
  const browsing = () => RC.step === 'polish' && empty();
  const cards = [];
  const guarded = new Map(),named = new Set();
  let openingEditor = null, recordDestination = null;
  function destination() {
    if (!browsing()) return null;
    const windowState = WorkWindows.state();
    return {tab:DAW.tab, dock:DAW.dock, windowMode:windowState.open ? windowState.mode : null};
  }
  async function resume(view) {
    const track = S.song && SongCore.track(S.song);
    sync();if (!view || !track?.regions.some(r=>r.selected)) return;
    if (!await SongPolish.open(track.id)) return;
    dawTab(view.tab,true);dawDock(view.dock);
    if (view.windowMode && !WorkWindows.state().open) await WorkWindows.launch(view.windowMode);
    sync();
  }
  function recorded() {
    const view = recordDestination;recordDestination=null;
    return resume(view);
  }
  function action(id) {
    if (id==='record') {
      recordDestination=destination();
      if (recordDestination) { if (WorkWindows.state().open) WorkWindows.close(); RC.go('rc'); }
      SongStudio.record(false);
    } else if (id==='import') $('sgImportFile').click();
    else SongStudio.openProject();
  }
  function card(parent,inside) {
    const box=document.createElement('section');box.className='studio-empty';box.hidden=true;
    const text=document.createElement('p');text.textContent='No vocal yet. Record a take, import audio or open a saved project.';box.append(text);
    const actions=document.createElement('div');
    for(const [id,label] of [['record','Record a vocal'],['import','Import a vocal'],['open','Open a project']]) {
      const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=()=>action(id);actions.append(b);
    }
    box.append(actions);if(inside==='record')parent.querySelector('.sg-transport').after(box);else parent.prepend(box);cards.push({box,inside});
  }
  function enableGuards(on) {
    if (!on) {
      for(const [el,old] of guarded){el.inert=old.inert;el.title=old.title;if(old.aria===null)el.removeAttribute('aria-disabled');else el.setAttribute('aria-disabled',old.aria);}
      guarded.clear();return;
    }
    function guard(el){
      if (!el || el.closest('.studio-empty') || el.matches('[data-open-detail],[data-etab]') ||
          ['noteRouteOpen','polishWave','polishBackToControls','polishReturn','polishNotes','rgLaunchPolish','rgLaunchReference'].includes(el.id) ||
          el.closest('.ww-inline-open') || guarded.has(el))return;
      guarded.set(el,{inert:el.inert,title:el.title,aria:el.getAttribute('aria-disabled')});
      el.inert=true;el.setAttribute('aria-disabled','true');el.title=reason;
    }
    for(const area of document.querySelectorAll('.ipanel,.dpanel,#trackPolishBar,.tlisten')){
      for(const el of area.querySelectorAll('button,input,select,[role="slider"],canvas'))guard(el);
    }
    for(const el of document.querySelectorAll('.mdrop [data-save-proxy],.mdrop [data-act="reset"],.mdrop [data-act="loadComp"]'))guard(el);
    if(!S.beat)for(const id of ['playBtn','dawStop','dawLoop'])guard($(id));
  }
  function sync() {
    const isEmpty=empty(), browse=browsing();
    for(const {box,inside} of cards)box.hidden=inside==='record'?!isEmpty:!browse;
    document.body.classList.toggle('browsing-studio',browse);
    // Recording already has a start panel in the dock; its window has a compact copy above the timeline.
    const hasProject=SongStudio.hasWork();
    for (const id of ['workspacePop','workWindowPop','recordWindowPop']){
      const el=$(id);el.disabled=!hasProject;el.title=hasProject?'Open workspace in a separate window':'Open or record a vocal first';
    }
    for(const el of named){if(!el.disabled){el.removeAttribute('title');named.delete(el);}}
    for (const el of document.querySelectorAll('#songStudio button:disabled,#rcSteps button:disabled')){
      if (!el.title && isEmpty) { el.title=el.id.includes('Undo')||el.id.includes('Redo')?'No edit in history.':reason;named.add(el); }
    }
    enableGuards(browse);
    $('popEmptyHint').hidden=hasProject;
    for(const id of ['workWindowPlay','workWindowStop']){
      const btn=$(id);btn.disabled=browse;
      btn.title=browse?reason:(id==='workWindowPlay'?'Play the vocal':'Stop playback');
    }
    if (browse && DAW.dock==='notes' && !openingEditor && !$('noteEditorFrame')) {
      openingEditor=NoteTuner.editor().then(()=>WorkWindows.sync()).catch(e=>{if(browsing())SongStudio.notify(e.message,true);}).finally(()=>{openingEditor=null;});
    }
    if (browse) NoteTuner.ui();
  }
  for(const panel of document.querySelectorAll('.ipanel,.dpanel'))card(panel,'polish');
  card($('songStudio').querySelector('.sg-transport').parentElement,'record');
  const hint=document.createElement('small');hint.id='popEmptyHint';hint.textContent='Pop out becomes available after you open or record a project.';$('workspaceTools').append(hint);
  for(const id of ['workspacePop','workWindowPop','recordWindowPop'])$(id).setAttribute('aria-describedby',hint.id);
  window.StudioBrowse={empty,browsing,sync,destination,resume,recorded,cancelRecording:()=>{recordDestination=null;}};
  sync();
})();
