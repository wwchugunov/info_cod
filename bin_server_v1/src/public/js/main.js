(function () {
  const config = window.paymentConfig || {};
  const payBtn = document.getElementById("pay-btn");
  const bankButtonsWrap = document.getElementById("bankButtons");
  const qrBox = document.getElementById("qrBox");
  const qrImg = qrBox ? qrBox.querySelector("img") : null;
  const amountInput = document.getElementById("editable-amount");
  const amountDisplay = document.getElementById("amount-value");
  const commissionDisplay = document.getElementById("commission-value");
  const totalDisplay = document.getElementById("total-value");
  const ua = navigator.userAgent.toLowerCase();
  const isMobile = /android|iphone|ipad|ipod/.test(ua);
  const linkId = config.linkId || "";
  const allowAmountEdit = Boolean(config.allowAmountEdit);
  const pageUrl = window.location.href;
  let amountSyncTimer = null;
  let lastSyncedAmount = Number(config.originalAmount || 0);

  const sendLog = (url, payload) => {
    if (!url) return;
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
      // ignore
    }
  };

  const formatMoney = (value) =>
    Number.isFinite(Number(value)) ? Number(value).toFixed(2) : "0.00";

  const round2 = (value) =>
    Math.round((Number(value) + Number.EPSILON) * 100) / 100;

  const calculateCommission = (amount) => {
    const parsedAmount = Number(amount) || 0;
    const usePercent = Boolean(config.usePercentCommission);
    const useFixed = Boolean(config.useFixedCommission);
    const percentBase = Number(config.commissionPercentValue || 0);
    const fixedValue = Number(config.commissionFixedValue || 0);
    const commissionPercentVal = usePercent
      ? round2((percentBase / 100) * parsedAmount)
      : 0;
    const commissionFixedVal = useFixed ? round2(fixedValue) : 0;
    const finalAmount = round2(parsedAmount + commissionPercentVal + commissionFixedVal);
    return {
      commissionPercentVal,
      commissionFixedVal,
      finalAmount,
    };
  };

  const encodeWin1251 = (str) => {
    const table = {
      А: 0xc0,
      Б: 0xc1,
      В: 0xc2,
      Г: 0xc3,
      Д: 0xc4,
      Е: 0xc5,
      Ж: 0xc6,
      З: 0xc7,
      И: 0xc8,
      Й: 0xc9,
      К: 0xca,
      Л: 0xcb,
      М: 0xcc,
      Н: 0xcd,
      О: 0xce,
      П: 0xcf,
      Р: 0xd0,
      С: 0xd1,
      Т: 0xd2,
      У: 0xd3,
      Ф: 0xd4,
      Х: 0xd5,
      Ц: 0xd6,
      Ч: 0xd7,
      Ш: 0xd8,
      Щ: 0xd9,
      Ъ: 0xda,
      Ы: 0xdb,
      Ь: 0xdc,
      Э: 0xdd,
      Ю: 0xde,
      Я: 0xdf,
      а: 0xe0,
      б: 0xe1,
      в: 0xe2,
      г: 0xe3,
      д: 0xe4,
      е: 0xe5,
      ж: 0xe6,
      з: 0xe7,
      и: 0xe8,
      й: 0xe9,
      к: 0xea,
      л: 0xeb,
      м: 0xec,
      н: 0xed,
      о: 0xee,
      п: 0xef,
      р: 0xf0,
      с: 0xf1,
      т: 0xf2,
      у: 0xf3,
      ф: 0xf4,
      х: 0xf5,
      ц: 0xf6,
      ч: 0xf7,
      ш: 0xf8,
      щ: 0xf9,
      ъ: 0xfa,
      ы: 0xfb,
      ь: 0xfc,
      э: 0xfd,
      ю: 0xfe,
      я: 0xff,
      Ґ: 0xa5,
      ґ: 0xb4,
      І: 0xb2,
      і: 0xb3,
      Ї: 0xaf,
      ї: 0xbf,
      Є: 0xaa,
      є: 0xba,
    };
    const bytes = [];
    for (const ch of str) {
      if (ch.charCodeAt(0) < 128) {
        bytes.push(ch.charCodeAt(0));
      } else if (table[ch]) {
        bytes.push(table[ch]);
      } else {
        bytes.push(63);
      }
    }
    return bytes;
  };

  const base64UrlEncode = (bytes) => {
    let binary = "";
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    const base64 = btoa(binary);
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };

  const sanitizeText = (value) =>
    String(value || "").replace(/["“”«»]/g, "").replace(/\s+/g, " ").trim();

  const validatePaymentData = ({ name, iban, amount, edrpo }) => {
    if (!name || !iban || !amount || !edrpo) throw new Error("Неповні дані для платежу");
    if (!/^UA\d{25,30}$/.test(iban)) throw new Error("Некоректний IBAN");
    if (!/^(\d{8}|\d{10})$/.test(edrpo)) throw new Error("ЄДРПОУ повинен бути 8 або 10 цифр");
    if (isNaN(Number(amount))) throw new Error("Сума має бути числом");
  };

  const generateNbuLink = (amount) => {
    const name = sanitizeText(config.companyName);
    const purpose = sanitizeText(config.purpose);
    const iban = String(config.companyIban || "").trim();
    const edrpo = String(config.companyEdrpo || "").trim();
    const finalAmount = Number(amount || 0);
    validatePaymentData({ name, iban, amount: finalAmount, edrpo });
    const amountStr = Number.isFinite(finalAmount) && finalAmount % 1 === 0
      ? `UAH${finalAmount}`
      : `UAH${finalAmount.toFixed(2)}`;
    const qrLines = [
      "BCD",
      "002",
      "2",
      "UCT",
      "",
      name,
      iban,
      amountStr,
      edrpo,
      "",
      "",
      purpose,
    ];
    const text = qrLines.join("\n");
    const encoded = base64UrlEncode(encodeWin1251(text));
    return encoded;
  };

  const buildPaymentUrl = (finalAmount) => {
    const code = generateNbuLink(finalAmount);
    const base = config.bankQrBase || "";
    return base ? `${base}/${code}` : code;
  };

  const updateQr = (url) => {
    if (!qrImg || !url) return;
    qrImg.src =
      "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" +
      encodeURIComponent(url);
  };

  const updatePayLink = (finalAmount) => {
    const url = buildPaymentUrl(finalAmount);
    if (payBtn) {
      payBtn.href = url;
      payBtn.dataset.nbuUrl = url;
      payBtn.dataset.linkId = linkId;
    }
    updateQr(isMobile ? url : pageUrl);
  };

  const refreshDisplay = (amount) => {
    const parsedAmount = Number(amount) || 0;
    const { commissionPercentVal, commissionFixedVal, finalAmount } =
      calculateCommission(parsedAmount);
    const totalCommission = round2(commissionPercentVal + commissionFixedVal);
    if (amountDisplay && !allowAmountEdit) {
      amountDisplay.textContent = `${formatMoney(parsedAmount)} грн`;
    }
    if (commissionDisplay) {
      commissionDisplay.textContent = `${formatMoney(totalCommission)} грн`;
    }
    if (totalDisplay) {
      totalDisplay.textContent = `${formatMoney(finalAmount)} грн`;
    }
    updatePayLink(finalAmount);
  };

  const syncAmount = (amount) => {
    const parsedAmount = Number(amount);
    if (!allowAmountEdit || !linkId) return;
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return;
    if (Math.abs(parsedAmount - lastSyncedAmount) < 0.0001) return;

    fetch(`/payment/${encodeURIComponent(linkId)}/amount`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: parsedAmount }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && data.ok) {
          lastSyncedAmount = parsedAmount;
        }
      })
      .catch(() => {});
  };

  if (allowAmountEdit && amountInput) {
    amountInput.addEventListener("input", (event) => {
      const value = parseFloat(event.target.value);
      if (Number.isNaN(value) || value <= 0) return;
      refreshDisplay(value);
      if (amountSyncTimer) {
        clearTimeout(amountSyncTimer);
      }
      amountSyncTimer = setTimeout(() => syncAmount(value), 600);
    });
    amountInput.addEventListener("blur", (event) => {
      const value = parseFloat(event.target.value);
      if (Number.isNaN(value) || value <= 0) return;
      syncAmount(value);
    });
  }

  if (!allowAmountEdit && amountDisplay) {
    refreshDisplay(Number(config.originalAmount || 0));
  } else if (allowAmountEdit) {
    refreshDisplay(Number(amountInput?.value || config.originalAmount || 0));
  }

  if (payBtn && linkId) {
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

  const banks = {
    mono: { name: "Monobank", android: "com.ftband.mono", ios: "mono" },
    privat24: { name: "Privat24", android: "ua.privatbank.ap24", ios: "privat24" },
    abank: { name: "A-Bank", android: "ua.com.abank", ios: "abank24" },
    pumb: { name: "PUMB", android: "com.fuib.android.spot.online", ios: "pumb" },
  };

  if (bankButtonsWrap && payBtn) {
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

      let link = payBtn.dataset.nbuUrl || payBtn.href;
      if (ua.includes("android")) {
        link = link.replace("https://", "intent://") +
          `#Intent;scheme=https;package=${bank.android};end`;
      } else if (ua.includes("iphone")) {
        link = link.replace("https://", `${bank.ios}://`);
      }

      window.location.href = link;
    });
  }

  const updateLayout = () => {
    if (isMobile) {
      if (bankButtonsWrap) bankButtonsWrap.style.display = "block";
      if (qrBox) qrBox.style.display = "none";
      if (payBtn) payBtn.style.display = "block";
    } else {
      if (bankButtonsWrap) bankButtonsWrap.style.display = "none";
      if (qrBox) qrBox.style.display = "block";
      if (payBtn) payBtn.style.display = "none";
    }
  };

  updateLayout();
})();
