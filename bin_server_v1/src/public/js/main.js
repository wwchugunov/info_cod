document.addEventListener("DOMContentLoaded", () => {
  const payBtn = document.getElementById("pay-btn");
  const bankButtonsWrap = document.getElementById("bankButtons");
  const qrBox = document.getElementById("qrBox");

  const ua = navigator.userAgent.toLowerCase();
  const isMobile = ua.includes("android") || ua.includes("iphone");

  const nbuUrl = payBtn ? payBtn.dataset.nbuUrl || "" : "";

  if (isMobile && bankButtonsWrap) {
    bankButtonsWrap.style.display = "block";
  }

  if (!isMobile && qrBox && nbuUrl) {
    qrBox.style.display = "block";
    const qrImg = qrBox.querySelector("img");
    if (qrImg) {
      qrImg.src =
        "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=" +
        encodeURIComponent(nbuUrl);
    }
  }

  const banks = {
    mono: { android: "com.ftband.mono", ios: "mono" }, // моно 
    privat24: { android: "ua.privatbank.ap24", ios: "privat24" }, // привват 
    abank: { android: "ua.com.abank", ios: "abank24" },  //  абанк
    pumb: { android: "com.fuib.android.spot.online", ios: "pumb" }, // привват 

  };

  if (bankButtonsWrap && nbuUrl) {
    bankButtonsWrap.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-bank]");
      if (!btn) return;
      const code = btn.dataset.bank;
      const bank = banks[code];
      if (!bank) return;

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
