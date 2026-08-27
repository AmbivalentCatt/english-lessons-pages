export function adminHtml(nonce: string) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex,nofollow,noarchive">
  <title>Lesson applications</title>
  <style nonce="${nonce}">
    :root{font-family:ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#17151c;background:#f5f3f7}
    *{box-sizing:border-box}body{margin:0}main{width:min(1180px,calc(100% - 32px));margin:40px auto 80px}
    header{display:flex;align-items:end;justify-content:space-between;gap:24px;margin-bottom:24px}h1{font-size:clamp(2rem,5vw,4.5rem);letter-spacing:-.055em;margin:0}header p{max-width:38rem;color:#605b69;margin:0}
    .notice{padding:16px 18px;border-radius:16px;background:#fff;border:1px solid #ded9e5;margin-bottom:16px}.notice[data-error=true]{border-color:#a9394b;color:#7c1d2d}
    .grid{display:grid;gap:16px}.card{background:#fff;border:1px solid #ded9e5;border-radius:22px;padding:20px;box-shadow:0 14px 34px rgba(38,24,58,.07)}
    .card-head{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:12px}.reference{font:700 1.05rem ui-monospace,SFMono-Regular,Menlo,monospace}.timestamp{color:#6d6675;font-size:.9rem}
    dl{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:20px 0}dt{font-size:.72rem;text-transform:uppercase;letter-spacing:.09em;color:#756d7e}dd{margin:4px 0 0;white-space:pre-wrap;overflow-wrap:anywhere}
    .wide{grid-column:span 3}.controls{display:grid;grid-template-columns:minmax(170px,.3fr) 1fr auto;gap:12px;align-items:end}label{display:grid;gap:7px;font-size:.78rem;text-transform:uppercase;letter-spacing:.08em;color:#665f70}select,textarea,button{font:inherit}select,textarea{width:100%;padding:11px 12px;border:1px solid #cfc8d7;border-radius:12px;background:#fff;color:#17151c}textarea{min-height:84px;resize:vertical}button{border:0;border-radius:999px;padding:12px 18px;background:#28202f;color:#fff;font-weight:700;cursor:pointer}button:disabled{opacity:.55;cursor:wait}
    @media(max-width:780px){main{width:min(100% - 20px,1180px);margin-top:24px}header{display:block}header p{margin-top:10px}dl{grid-template-columns:1fr}.wide{grid-column:auto}.controls{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <main>
    <header><div><h1>Applications</h1><p>Private applicant data. This surface requires Cloudflare Access and validates its signed identity token again inside the Worker.</p></div></header>
    <p class="notice" id="notice" role="status">Loading protected records…</p>
    <section class="grid" id="applications" aria-live="polite"></section>
  </main>
  <script nonce="${nonce}">
    const notice=document.getElementById('notice');const container=document.getElementById('applications');
    const labels={new:'New',contacted:'Contacted',lesson_booked:'Lesson booked',closed:'Closed'};
    function cell(label,value,wide=false){const wrap=document.createElement('div');if(wide)wrap.className='wide';const dt=document.createElement('dt');dt.textContent=label;const dd=document.createElement('dd');dd.textContent=value||'—';wrap.append(dt,dd);return wrap}
    function renderRecord(record){const card=document.createElement('article');card.className='card';const head=document.createElement('div');head.className='card-head';const ref=document.createElement('strong');ref.className='reference';ref.textContent=record.publicReference;const time=document.createElement('time');time.className='timestamp';time.dateTime=record.submittedAt;time.textContent=new Date(record.submittedAt).toLocaleString();head.append(ref,time);const dl=document.createElement('dl');dl.append(cell('Contact person',record.parentName),cell('Learner',record.learnerName),cell('Class / course',record.learnerAgeOrGrade),cell('English level',record.englishLevel),cell('Tariff / package',record.tariffId+' · '+record.packageLessons),cell('Format',record.lessonFormat),cell('Preferred schedule',record.preferredSchedule,true),cell('Goals',record.goals,true),cell('Applicant note',record.applicantNotes,true),cell(record.contactMethod,record.contactValue,true));
      const controls=document.createElement('div');controls.className='controls';const statusLabel=document.createElement('label');statusLabel.textContent='Status';const select=document.createElement('select');for(const status of Object.keys(labels)){const option=document.createElement('option');option.value=status;option.textContent=labels[status];option.selected=status===record.status;select.append(option)}statusLabel.append(select);const notesLabel=document.createElement('label');notesLabel.textContent='Private internal notes';const textarea=document.createElement('textarea');textarea.maxLength=4000;textarea.value=record.internalNotes||'';notesLabel.append(textarea);const button=document.createElement('button');button.type='button';button.textContent='Save';button.addEventListener('click',async()=>{button.disabled=true;notice.dataset.error='false';notice.textContent='Saving '+record.publicReference+'…';try{const response=await fetch('/admin/api/applications/'+encodeURIComponent(record.publicReference),{method:'PATCH',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({status:select.value,internalNotes:textarea.value})});const body=await response.json();if(!response.ok||!body.ok)throw new Error('Update was not accepted.');record.status=body.application.status;record.internalNotes=body.application.internalNotes;notice.textContent=record.publicReference+' saved.'}catch(error){notice.dataset.error='true';notice.textContent=error instanceof Error?error.message:'Update failed.'}finally{button.disabled=false}});controls.append(statusLabel,notesLabel,button);card.append(head,dl,controls);return card}
    async function load(){try{const response=await fetch('/admin/api/applications?limit=100',{headers:{Accept:'application/json'},cache:'no-store'});const body=await response.json();if(!response.ok||!body.ok)throw new Error('Protected records could not be loaded.');container.replaceChildren(...body.applications.map(renderRecord));notice.textContent=body.applications.length?body.applications.length+' application(s) loaded.':'No applications yet.'}catch(error){notice.dataset.error='true';notice.textContent=error instanceof Error?error.message:'Load failed.'}}load();
  </script>
</body>
</html>`;
}
