const $ = (s) => document.querySelector(s);
const now = new Date();
let shownMonth = new Date(now.getFullYear(), now.getMonth(), 1);
function updateClock(){
  const d = new Date();
  $("#clock").textContent = d.toLocaleTimeString("ja-JP",{hour:"2-digit",minute:"2-digit"});
  $("#today").textContent = d.toLocaleDateString("vi-VN",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
}
function renderCalendar(){
  const y=shownMonth.getFullYear(), m=shownMonth.getMonth();
  $("#month-label").textContent=shownMonth.toLocaleDateString("vi-VN",{month:"long",year:"numeric"});
  const names=["T2","T3","T4","T5","T6","T7","CN"];
  const first=(new Date(y,m,1).getDay()+6)%7, count=new Date(y,m+1,0).getDate();
  const cells=[...names.map(n=>`<div class="day-name">${n}</div>`)];
  for(let i=0;i<first;i++) cells.push('<div class="day blank"></div>');
  for(let d=1;d<=count;d++){
    const isToday=y===now.getFullYear()&&m===now.getMonth()&&d===now.getDate();
    cells.push(`<div class="day ${isToday?'today':''}">${d}</div>`);
  }
  $("#calendar").innerHTML=cells.join("");
}
$("#prev-month").addEventListener("click",()=>{shownMonth.setMonth(shownMonth.getMonth()-1);renderCalendar()});
$("#next-month").addEventListener("click",()=>{shownMonth.setMonth(shownMonth.getMonth()+1);renderCalendar()});
document.querySelectorAll(".child-card").forEach(btn=>btn.addEventListener("click",()=>{
  $("#dialog-title").textContent=btn.dataset.child;
  $("#detail-dialog").showModal();
}));
$("#add-event").addEventListener("click",()=>{
  const title=prompt("Tên sự kiện:");
  if(!title)return;
  const date=prompt("Ngày (ví dụ 2026-11-12):");
  if(!date)return;
  const el=document.createElement("div");el.className="empty-state";el.textContent=`${date} · ${title}`;
  $("#events").replaceChildren(el);
});
$("#add-task").addEventListener("click",()=>{
  const title=prompt("Việc cần làm:");
  if(!title)return;
  const li=document.createElement("li");li.textContent="□ "+title;
  if($("#tasks").querySelector(".empty-state"))$("#tasks").replaceChildren();
  $("#tasks").append(li);
});
const note=$("#family-note");
note.value=localStorage.getItem("family-note")||"";
note.addEventListener("input",()=>localStorage.setItem("family-note",note.value));
updateClock();setInterval(updateClock,30000);renderCalendar();