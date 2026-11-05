(function () {
  const KEY = "leave-by-v1";
  const form = document.getElementById("form");
  const prepList = document.getElementById("prepList");
  const timeline = document.getElementById("timeline");
  const countdown = document.getElementById("countdown");
  const list = document.getElementById("list");
  let prep = [];
  let events = [];

  function computeLeaveBy(arriveISO, travelMin, parkMin, bufferMin, prepItems) {
    const arrive = new Date(arriveISO);
    const prepTotal = (prepItems || []).reduce((s, p) => s + Number(p.min || 0), 0);
    const totalBefore = Number(travelMin || 0) + Number(parkMin || 0) + Number(bufferMin || 0) + prepTotal;
    const leave = new Date(arrive.getTime() - totalBefore * 60000);
    const startPrep = new Date(leave.getTime() - prepTotal * 60000);
    // Actually: prep happens before leave. leave = arrive - travel - park - buffer
    // startPrep = leave - prepTotal
    const door = new Date(arrive.getTime() - (Number(travelMin||0)+Number(parkMin||0)+Number(bufferMin||0)) * 60000);
    const prepStart = new Date(door.getTime() - prepTotal * 60000);
    return { arrive, door, prepStart, prepTotal, totalBefore: totalBefore };
  }

  function buildSteps(ev) {
    const steps = [];
    let t = new Date(ev.computed.prepStart);
    if (ev.prep.length) {
      steps.push({ at: new Date(t), label: "Start prep" });
      for (const p of ev.prep) {
        steps.push({ at: new Date(t), label: p.name + ` (${p.min} min)` });
        t = new Date(t.getTime() + p.min * 60000);
      }
    }
    steps.push({ at: ev.computed.door, label: "Leave home / office", leave: true });
    if (ev.park) steps.push({ at: new Date(ev.computed.arrive.getTime() - (ev.travel + ev.park) * 60000 + ev.travel * 60000), label: `Arrive area (+${ev.park}m parking/security)` });
    steps.push({ at: ev.computed.arrive, label: "Appointment start" });
    return steps;
  }

  // Fix compute properly
  function recompute(ev) {
    const arrive = new Date(ev.arrive);
    const prepTotal = ev.prep.reduce((s, p) => s + p.min, 0);
    const door = new Date(arrive.getTime() - (ev.travel + ev.park + ev.buffer) * 60000);
    const prepStart = new Date(door.getTime() - prepTotal * 60000);
    ev.computed = { arrive, door, prepStart, prepTotal };
    return ev;
  }

  function renderPrep() {
    prepList.innerHTML = prep.map((p, i) =>
      `<span class="chip">${esc(p.name)} · ${p.min}m <button type="button" data-i="${i}" class="x">×</button></span>`
    ).join("");
    prepList.querySelectorAll(".x").forEach((b) => b.onclick = () => { prep.splice(+b.dataset.i,1); renderPrep(); });
  }

  function render() {
    events.forEach(recompute);
    events.sort((a, b) => a.computed.door - b.computed.door);
    const next = events.find((e) => e.computed.door > new Date()) || events[0];
    if (next) {
      const ms = next.computed.door - new Date();
      countdown.textContent = ms > 0
        ? `Leave in ${fmtDuration(ms)} for “${next.title}” (by ${fmt(next.computed.door)})`
        : `Leave time passed for “${next.title}” — was ${fmt(next.computed.door)}`;
      const steps = [];
      let t = new Date(next.computed.prepStart);
      if (next.prep.length) {
        steps.push(`<li><strong>${fmt(t)}</strong> — start prep</li>`);
        for (const p of next.prep) {
          steps.push(`<li><strong>${fmt(t)}</strong> — ${esc(p.name)} (${p.min} min)</li>`);
          t = new Date(t.getTime() + p.min * 60000);
        }
      }
      steps.push(`<li><strong class="leave">${fmt(next.computed.door)}</strong> — LEAVE BY</li>`);
      steps.push(`<li><strong>${fmt(next.computed.arrive)}</strong> — arrive / appointment</li>`);
      timeline.innerHTML = steps.join("");
    } else {
      countdown.textContent = "Add an appointment to get your leave-by time.";
      timeline.innerHTML = "";
    }
    list.innerHTML = events.map((e, i) => `<div class="item">
      <div><strong>${esc(e.title)}</strong><div class="hint">Arrive ${fmt(e.computed.arrive)} · travel ${e.travel}m · buffer ${e.buffer}m</div></div>
      <div><span class="leave">Leave by ${fmt(e.computed.door)}</span>
        <button data-i="${i}" class="btn ghost del" type="button">Remove</button></div>
    </div>`).join("") || `<p class="hint">No appointments yet.</p>`;
    list.querySelectorAll(".del").forEach((b) => b.onclick = () => { events.splice(+b.dataset.i,1); persist(); render(); });
  }

  function fmt(d){ return d.toLocaleString(undefined,{weekday:"short",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}); }
  function fmtDuration(ms){
    const m = Math.max(0, Math.round(ms/60000));
    const h = Math.floor(m/60), mm = m%60;
    return h ? `${h}h ${mm}m` : `${mm}m`;
  }
  function esc(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));}
  function persist(){ localStorage.setItem(KEY, JSON.stringify({prep, events})); }

  document.getElementById("addPrep").onclick = () => {
    const name = document.getElementById("prepName").value.trim();
    const min = Number(document.getElementById("prepMin").value) || 5;
    if (!name) return;
    prep.push({ name, min });
    document.getElementById("prepName").value = "";
    renderPrep();
  };
  form.onsubmit = (e) => {
    e.preventDefault();
    events.push({
      title: document.getElementById("title").value.trim(),
      arrive: document.getElementById("arrive").value,
      travel: Number(document.getElementById("travel").value)||0,
      park: Number(document.getElementById("park").value)||0,
      buffer: Number(document.getElementById("buffer").value)||0,
      prep: [...prep]
    });
    persist(); render();
  };
  document.getElementById("clear").onclick = () => { events=[]; prep=[]; persist(); renderPrep(); render(); };
  document.getElementById("demo").onclick = () => {
    const base = new Date();
    base.setHours(base.getHours() + 4, 0, 0, 0);
    const iso = new Date(base.getTime() - base.getTimezoneOffset()*60000).toISOString().slice(0,16);
    prep = [{name:"Shower",min:15},{name:"Pack bag",min:10},{name:"Find keys/wallet",min:5}];
    events = [{
      title: "Client demo call (coffee shop)",
      arrive: iso,
      travel: 22, park: 8, buffer: 12,
      prep: [...prep]
    }];
    document.getElementById("arrive").value = iso;
    persist(); renderPrep(); render();
  };

  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    prep = saved.prep || []; events = saved.events || [];
  } catch(_) {}
  window.LeaveBy = { computeLeaveBy, recompute };
  renderPrep(); render();
  setInterval(render, 30000);
})();
