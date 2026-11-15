// 広告枠（Google AdSense）の描画。
// config/site.json の adsense.enabled が true かつ client が 'ca-pub-...' のときに
// 各 .ad-slot へ AdSense ユニットを挿入する。未設定ならプレースホルダを表示。
// 各ページは <script>window.SEASONWEAR_ROOT='...'</script> でルートへの相対パスを渡す。
(function () {
  "use strict";
  var ROOT = (typeof window.SEASONWEAR_ROOT === "string") ? window.SEASONWEAR_ROOT : "";
  var slots = document.querySelectorAll(".ad-slot");
  if (!slots.length) return;

  function placeholder() {
    slots.forEach(function (s) {
      s.classList.add("ad-slot--placeholder");
      s.textContent = "広告スペース";
    });
  }

  fetch(ROOT + "config/site.json", { cache: "no-store" })
    .then(function (r) { return r.json(); })
    .then(function (cfg) {
      var ad = cfg && cfg.adsense;
      if (!ad || !ad.enabled || !/^ca-pub-\d+$/.test(ad.client || "")) {
        placeholder();
        return;
      }
      // ローダーを一度だけ挿入
      if (!document.querySelector("script[data-adsense-loader]")) {
        var l = document.createElement("script");
        l.async = true;
        l.setAttribute("data-adsense-loader", "");
        l.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + encodeURIComponent(ad.client);
        l.crossOrigin = "anonymous";
        document.head.appendChild(l);
      }
      slots.forEach(function (s) {
        var slotId = ad.slots && ad.slots[s.dataset.ad];
        var ins = document.createElement("ins");
        ins.className = "adsbygoogle";
        ins.style.display = "block";
        ins.setAttribute("data-ad-client", ad.client);
        if (slotId && !/^0+$/.test(slotId)) ins.setAttribute("data-ad-slot", slotId);
        ins.setAttribute("data-ad-format", "auto");
        ins.setAttribute("data-full-width-responsive", "true");
        s.appendChild(ins);
        try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* noop */ }
      });
    })
    .catch(placeholder);
})();
