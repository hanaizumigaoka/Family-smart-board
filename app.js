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

// ===== SAKURA API INTEGRATION =====
// Token is entered on this device; it is not hard-coded in this public GitHub Pages source.
const SAKURA_API_URL = "https://script.google.com/macros/s/AKfycbw2oNlueTezHV9DaqetrDh5KGoYom9B5dPHTE36eqTVqtc_aHIFNOZVD-AhBrKffcU/exec";
const SAKURA_TOKEN_KEY = "family-hub-sakura-token-v1";
let sakuraTimeout = null;

function sakuraStatus(message, state="") {
  const el=$("#sakura-status"); el.textContent=message; el.className=`sakura-status ${state}`.trim();
}
function sakuraField(item, names) {
  for (const name of names) if (item[name] !== undefined && item[name] !== null && item[name] !== "") return item[name];
  return "";
}
function sakuraDate(value) {
  if (!value) return "Ngày không xác định";
  const d=new Date(value); return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString("ja-JP",{year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit"});
}
function renderSakura(data) {
  if (!data || data.success !== true) throw new Error(data?.message || "API trả về dữ liệu không hợp lệ");
  const host=$("#sakura-notices"); host.replaceChildren();
  const notices=Array.isArray(data.notices)?data.notices:[];
  if (!notices.length) { const empty=document.createElement("div"); empty.className="empty-state"; empty.textContent="Chưa có thông báo Sakura."; host.append(empty); }
  notices.forEach(item=>{
    const card=document.createElement("article"); card.className="sakura-card";
    const top=document.createElement("div"); top.className="sakura-card-top";
    const title=document.createElement("h3"); title.className="sakura-subject"; title.textContent=String(sakuraField(item,["Tiêu đề","Subject"])||"(Không có tiêu đề)");
    const date=document.createElement("time"); date.className="sakura-date"; const dateValue=sakuraField(item,["Ngày gửi","Date"]); date.textContent=sakuraDate(dateValue); if(dateValue)date.dateTime=String(dateValue);
    top.append(title,date); card.append(top);
    const bodyText=sakuraField(item,["Nội dung","Body"]);
    if(bodyText){const body=document.createElement("p");body.className="sakura-body";body.textContent=String(bodyText);card.append(body);}
    const names=String(sakuraField(item,["File đính kèm","Attachments"])||"");
    const ids=String(sakuraField(item,["PDF Drive IDs","PDF Drive ID"])||"");
    if(names||ids){const files=document.createElement("div");files.className="sakura-attachments";
      if(ids){ids.split(",").map(x=>x.trim()).filter(Boolean).forEach((id,i)=>{const a=document.createElement("a");a.className="sakura-file";a.href=`https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;a.target="_blank";a.rel="noopener noreferrer";a.textContent=`📎 Mở PDF ${ids.split(",").length>1?i+1:""}`.trim();files.append(a);});}
      else {const label=document.createElement("span");label.className="sakura-file";label.textContent=`📎 ${names} · PDF chưa được lưu vào Drive`;files.append(label);}
      card.append(files);
    }
    host.append(card);
  });
  $("#sakura-updated").textContent=`Cập nhật lúc ${new Date().toLocaleString("ja-JP")}`;
  sakuraStatus(`Đã tải ${notices.length} thông báo từ Sakura.`,"ok");
}
function loadSakura() {
  const token=localStorage.getItem(SAKURA_TOKEN_KEY);
  if(!token){sakuraStatus("Chưa thiết lập token. Nhấn Kết nối để nhập token.");return;}
  sakuraStatus("Đang kết nối Sakura...","loading");
  const host=$("#sakura-notices");host.replaceChildren();const wait=document.createElement("div");wait.className="empty-state";wait.textContent="Đang tải thông báo...";host.append(wait);
  return new Promise(resolve=>{
    const cb=`familySakura_${Date.now()}_${Math.floor(Math.random()*1e6)}`;const script=document.createElement("script");let done=false;
    const cleanup=()=>{script.remove();try{delete window[cb];}catch(_){window[cb]=undefined;}if(sakuraTimeout)clearTimeout(sakuraTimeout);};
    const finish=ok=>{if(done)return;done=true;cleanup();resolve(ok);};
    window[cb]=data=>{try{renderSakura(data);finish(true);}catch(err){sakuraStatus(`Lỗi dữ liệu: ${err.message}`,"error");const box=document.createElement("div");box.className="empty-state";box.textContent="API trả về lỗi. Kiểm tra token và Apps Script.";host.replaceChildren(box);finish(false);}};
    script.onerror=()=>{sakuraStatus("Không tải được API. Kiểm tra quyền truy cập Web App và JSONP.","error");const box=document.createElement("div");box.className="empty-state";box.textContent="Kết nối thất bại. Nếu Web App giới hạn Chỉ mình tôi, Google có thể chặn yêu cầu từ website.";host.replaceChildren(box);finish(false);};
    const query=new URLSearchParams({action:"notices",token,callback:cb});script.src=`${SAKURA_API_URL}?${query}`;
    sakuraTimeout=setTimeout(()=>{if(done)return;sakuraStatus("API không phản hồi sau 20 giây.","error");const box=document.createElement("div");box.className="empty-state";box.textContent="Hết thời gian chờ. Kiểm tra kết nối mạng và deployment.";host.replaceChildren(box);finish(false);},20000);
    document.head.append(script);
  });
}
const sakuraDialog=$("#sakura-token-dialog");
$("#sakura-settings").addEventListener("click",()=>{$("#sakura-token-input").value=localStorage.getItem(SAKURA_TOKEN_KEY)||"";sakuraDialog.showModal();});
$("#sakura-token-form").addEventListener("submit",event=>{if(event.submitter?.id==="save-sakura-token"){event.preventDefault();const token=$("#sakura-token-input").value.trim();if(!token){sakuraStatus("Anh chưa nhập token.","error");return;}localStorage.setItem(SAKURA_TOKEN_KEY,token);sakuraDialog.close();loadSakura();}});
$("#refresh-sakura").addEventListener("click",loadSakura);
$("#sakura-disconnect").addEventListener("click",()=>{if(!confirm("Xóa token Sakura khỏi thiết bị này?"))return;localStorage.removeItem(SAKURA_TOKEN_KEY);$("#sakura-notices").replaceChildren();const e=document.createElement("div");e.className="empty-state";e.textContent="Đã xóa token. Nhấn Kết nối để thiết lập lại.";$("#sakura-notices").append(e);sakuraStatus("Chưa thiết lập kết nối Sakura.");$("#sakura-updated").textContent="";});
if(localStorage.getItem(SAKURA_TOKEN_KEY))loadSakura();
setInterval(()=>{if(localStorage.getItem(SAKURA_TOKEN_KEY))loadSakura();},5*60*1000);
