(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const STORAGE_URL = "familyBoardApiUrl";
  const STORAGE_TOKEN = "familyBoardApiToken";
  let notices = [];

  function tickClock() {
    const now = new Date();
    $("clock").textContent = now.toLocaleTimeString("ja-JP", {hour:"2-digit", minute:"2-digit", hour12:false});
    $("weekday").textContent = now.toLocaleDateString("ja-JP", {weekday:"long"}).toUpperCase();
    $("dateLine").textContent = now.toLocaleDateString("ja-JP", {year:"numeric", month:"long", day:"numeric", weekday:"long"});
    $("todayChip").textContent = now.toLocaleDateString("vi-VN", {day:"2-digit", month:"2-digit", year:"numeric"});
    $("footerYear").textContent = now.getFullYear();
  }

  function getConfig() {
    return {url: localStorage.getItem(STORAGE_URL) || "", token: localStorage.getItem(STORAGE_TOKEN) || ""};
  }

  function setConnection(message, state) {
    $("connectionText").textContent = message;
    $("connectionDot").className = "state-dot" + (state ? " " + state : "");
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  }

  function jsonp(params) {
    return new Promise((resolve, reject) => {
      const callbackName = "familyBoardCallback_" + Date.now() + "_" + Math.floor(Math.random()*100000);
      const script = document.createElement("script");
      const timer = setTimeout(() => finish(new Error("Hết thời gian chờ API. Kiểm tra URL, quyền triển khai và token.")), 18000);
      function finish(error, data) {
        clearTimeout(timer);
        try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
        script.remove();
        error ? reject(error) : resolve(data);
      }
      window[callbackName] = data => finish(null, data);
      const url = new URL(params.url);
      Object.entries(params.query).forEach(([k,v]) => url.searchParams.set(k, v));
      url.searchParams.set("callback", callbackName);
      script.onerror = () => finish(new Error("Không thể tải API. Kiểm tra Web App URL hoặc quyền truy cập."));
      script.src = url.toString();
      document.head.appendChild(script);
    });
  }

  async function callApi(action, extra = {}) {
    const cfg = getConfig();
    if (!cfg.url || !cfg.token) throw new Error("Chưa cấu hình Apps Script URL và API Token.");
    return jsonp({url:cfg.url, query:{action, token:cfg.token, ...extra}});
  }

  function renderNotices(items) {
    notices = Array.isArray(items) ? items : [];
    $("noticeCount").textContent = `${notices.length} thông báo`;
    if (!notices.length) {
      $("noticeList").innerHTML = `<div class="empty-state"><div class="empty-icon">✉</div><h3>Chưa có thông báo Sakura</h3><p>Kết nối đã hoạt động. Khi Gmail nhận email mới từ trường, thông báo sẽ xuất hiện tại đây.</p></div>`;
      return;
    }
    $("noticeList").innerHTML = notices.map((n, index) => {
      const attachments = Array.isArray(n.attachments) ? n.attachments : [];
      const attachmentHtml = attachments.map((a, ai) => {
        const name = escapeHtml(a.name || "Tệp đính kèm");
        const id = escapeHtml(a.id || "");
        const mime = escapeHtml(a.mimeType || "");
        const isPdf = mime.toLowerCase().includes("pdf") || name.toLowerCase().endsWith(".pdf");
        return `<button class="attachment-button" data-notice="${index}" data-attachment="${ai}" type="button">📎 ${name} ${isPdf ? "· PDF" : ""}</button>`;
      }).join("");
      const body = escapeHtml(n.body || "Nội dung email không có sẵn.");
      const date = escapeHtml(n.date || "");
      const subject = escapeHtml(n.subject || "(Không có tiêu đề)");
      return `<article class="notice-card">
        <div class="notice-top"><div class="eyebrow">さくら連絡 · SCHOOL NOTICE</div><div class="notice-date">${date}</div></div>
        <h3 class="notice-subject">${subject}</h3>
        <div class="notice-body" id="body-${index}">${body}</div>
        <div class="notice-actions">
          ${attachments.length ? `<span class="attachment-label">${attachmentHtml}</span>` : `<span class="hint">Không có file đính kèm</span>`}
          <button class="text-button" data-expand="${index}" type="button">Xem toàn bộ nội dung</button>
        </div>
      </article>`;
    }).join("");
    $("noticeList").querySelectorAll("[data-attachment]").forEach(btn => btn.addEventListener("click", () => {
      const n = notices[Number(btn.dataset.notice)];
      const a = (n.attachments || [])[Number(btn.dataset.attachment)];
      if (a) openAttachment(a);
    }));
    $("noticeList").querySelectorAll("[data-expand]").forEach(btn => btn.addEventListener("click", () => {
      const body = $("body-" + btn.dataset.expand);
      const expanded = body.classList.toggle("expanded");
      btn.textContent = expanded ? "Thu gọn" : "Xem toàn bộ nội dung";
    }));
  }

  function openAttachment(file) {
    const id = file.id;
    if (!id) {
      if (file.url) window.open(file.url, "_blank", "noopener");
      return;
    }
    const previewUrl = `https://drive.google.com/file/d/${encodeURIComponent(id)}/preview`;
    const viewUrl = `https://drive.google.com/file/d/${encodeURIComponent(id)}/view`;
    $("pdfTitle").textContent = file.name || "File đính kèm";
    $("openPdfNewTab").href = viewUrl;
    $("pdfFrameWrap").innerHTML = `<iframe src="${previewUrl}" allow="autoplay" title="File đính kèm"></iframe>`;
    $("pdfDialog").showModal();
  }

  async function refreshNotices() {
    const cfg = getConfig();
    if (!cfg.url || !cfg.token) {
      setConnection("Chưa kết nối Gmail", "");
      renderNotices([]);
      return;
    }
    setConnection("Đang tải thông báo...", "");
    $("refreshButton").disabled = true;
    try {
      const result = await callApi("getNotices", {limit:"60"});
      if (!result || result.ok !== true) throw new Error(result?.error || "API trả về dữ liệu không hợp lệ.");
      renderNotices(result.notices || []);
      setConnection("Đã kết nối Sakura", "ok");
    } catch (error) {
      setConnection("Lỗi kết nối: " + error.message, "error");
    } finally {
      $("refreshButton").disabled = false;
    }
  }

  function openSettings() {
    const cfg = getConfig();
    $("apiUrl").value = cfg.url;
    $("apiToken").value = cfg.token;
    $("settingsMessage").textContent = "";
    $("settingsMessage").className = "settings-message";
    $("settingsDialog").showModal();
  }

  async function saveSettings() {
    const url = $("apiUrl").value.trim();
    const token = $("apiToken").value.trim();
    const msg = $("settingsMessage");
    if (!/^https:\/\/script\.google\.com\/macros\/s\/.+\/exec/.test(url)) {
      msg.textContent = "URL chưa đúng định dạng Web App của Google Apps Script.";
      msg.className = "settings-message error";
      return;
    }
    if (token.length < 20) {
      msg.textContent = "Token quá ngắn hoặc chưa được nhập.";
      msg.className = "settings-message error";
      return;
    }
    localStorage.setItem(STORAGE_URL, url);
    localStorage.setItem(STORAGE_TOKEN, token);
    msg.textContent = "Đã lưu. Đang kiểm tra kết nối...";
    msg.className = "settings-message";
    try {
      const result = await callApi("ping");
      if (!result || result.ok !== true) throw new Error(result?.error || "Không xác thực được.");
      msg.textContent = "Kết nối thành công! Đang tải thông báo...";
      msg.className = "settings-message success";
      await refreshNotices();
      setTimeout(() => $("settingsDialog").close(), 900);
    } catch (error) {
      msg.textContent = error.message;
      msg.className = "settings-message error";
    }
  }

  function clearSettings() {
    localStorage.removeItem(STORAGE_URL);
    localStorage.removeItem(STORAGE_TOKEN);
    $("apiUrl").value = "";
    $("apiToken").value = "";
    $("settingsMessage").textContent = "Đã xóa URL và token khỏi thiết bị này.";
    $("settingsMessage").className = "settings-message";
    setConnection("Chưa kết nối Gmail", "");
    renderNotices([]);
  }

  $("settingsButton").addEventListener("click", openSettings);
  $("setupFromEmpty").addEventListener("click", openSettings);
  $("refreshButton").addEventListener("click", refreshNotices);
  $("saveSettings").addEventListener("click", saveSettings);
  $("clearSettings").addEventListener("click", clearSettings);
  $("closePdf").addEventListener("click", () => $("pdfDialog").close());
  $("pdfDialog").addEventListener("close", () => $("pdfFrameWrap").innerHTML = "");
  tickClock();
  setInterval(tickClock, 1000);
  refreshNotices();
  setInterval(refreshNotices, 5 * 60 * 1000);
})();
