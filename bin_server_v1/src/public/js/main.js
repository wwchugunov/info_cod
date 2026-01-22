document.addEventListener("DOMContentLoaded", () => {
  const payBtn = document.getElementById("pay-btn");
  const bankButtonsWrap = document.getElementById("bankButtons");
  const qrBox = document.getElementById("qrBox");

  const ua = navigator.userAgent.toLowerCase();
  const isMobile = ua.includes("android") || ua.includes("iphone");

  const nbuUrl = payBtn ? payBtn.dataset.nbuUrl || "" : "";
  const linkId = payBtn ? payBtn.dataset.linkId || "" : "";

  const sendLog = (url, payload) => {
    try {
      const body = JSON.stringify(payload || {});
      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(url, blob);
        return;
      }
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    } catch (err) {
      // no-op
    }
  };

  if (isMobile && bankButtonsWrap) {
    bankButtonsWrap.style.display = "block";
  }

  if (!isMobile && qrBox && nbuUrl) {
    qrBox.style.display = "block";
    const qrImg = qrBox.querySelector("img");
const currentPageUrl = window.location.href;

if (qrImg) {
  qrImg.src =
    "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" +
    encodeURIComponent(currentPageUrl);
}

  }

  const banks = {
    mono: { name: "Monobank", android: "com.ftband.mono", ios: "mono" },
    privat24: { name: "Privat24", android: "ua.privatbank.ap24", ios: "privat24" },
    abank: { name: "A-Bank", android: "ua.com.abank", ios: "abank24" },
    pumb: { name: "PUMB", android: "com.fuib.android.spot.online", ios: "pumb" },
  };

  if (linkId) {
    sendLog(`/payment/${linkId}/scan`, {
      platform: navigator.platform || null,
      language: navigator.language || null,
      screen: screen
        ? `${screen.width}x${screen.height}@${window.devicePixelRatio || 1}`
        : null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
      referrer: document.referrer || null,
      device: isMobile ? "mobile" : "desktop",
    });
  }

  if (bankButtonsWrap && nbuUrl) {
    bankButtonsWrap.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-bank]");
      if (!btn) return;
      const code = btn.dataset.bank;
      const bank = banks[code];
      if (!bank) return;

      if (linkId) {
        sendLog(`/payment/${linkId}/bank`, {
          bank_short_name: code,
          bank_name: bank.name || null,
          bank_package_android: bank.android || null,
          bank_package_ios: bank.ios || null,
          platform: ua.includes("android")
            ? "android"
            : ua.includes("iphone")
            ? "ios"
            : "unknown",
          action: "open_app",
        });
      }

      let link = nbuUrl;
      if (ua.includes("android")) {
        link =
          nbuUrl.replace("https://", "intent://") +
          "#Intent;scheme=https;package=" +
          bank.android +
          ";end";
      } else if (ua.includes("iphone")) {
        link = nbuUrl.replace("https://", bank.ios + "://");
      }

      window.location.href = link;
    });
  }
});


// ====== BANK BUTTONS (MOBILE) / QR (DESKTOP) ======
(function () {
  const bankButtons = document.getElementById("bankButtons");
  const qrBox = document.getElementById("qrBox");
  const payBtn = document.getElementById("pay-btn");

  if (!bankButtons || !qrBox || !payBtn) return;

  const ua = navigator.userAgent.toLowerCase();
  const isMobile = /android|iphone|ipad|ipod/.test(ua);

if (isMobile) {
  // 📱 ТЕЛЕФОН
  bankButtons.style.display = "block";
  qrBox.style.display = "none";
  payBtn.style.display = "block";
} else {
  // 🖥 ПК
  bankButtons.style.display = "none";
  qrBox.style.display = "block";
  payBtn.style.display = "none";


    const qrImg = qrBox.querySelector("img");
    const nbuUrl = payBtn.dataset.nbuUrl;

    if (qrImg && nbuUrl) {
      qrImg.src =
        "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" +
        encodeURIComponent(nbuUrl);
    }
  }
})();
