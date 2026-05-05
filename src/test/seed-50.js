/**
 * Seed script: 50 mesajlık kişisel sohbet
 * Berke ↔ Tarık (malzeme tedarikçisi)
 * Proje: Nexus Ofis Yenileme
 * Kapsam: Kasım 2024 – Nisan 2025
 *
 * Çalıştır:          node src/test/seed-50.js
 * Önce temizle:      node src/test/seed-50.js --clean
 */

import { initDb }                from "../db/index.js";
import { insertMessage }         from "../db/messages.js";
import { activate, deactivate }  from "../db/chatSettings.js";
import { deleteVectorsByChat }   from "../workers/vectorStore.js";

const CHAT_ID   = "seed_personal_50";
const CHAT_TYPE = "personal";

const MSGS = [
  // ── Kasım 2024 ─────────────────────────────────────────────────────────────
  { id:"p01", sender:"Tarık",  ts:1730419200, text:"Merhaba Berke, haber vermek istedim — kereste siparişi onaylandı. Teslimat 15 Kasım olarak planlandı." },
  { id:"p02", sender:"Berke",  ts:1730422800, text:"Harika haber! Toplam hacim ve fiyat ne kadar?" },
  { id:"p03", sender:"Tarık",  ts:1730426400, text:"28 metreküp, nakliye dahil toplam fatura 4.200 Euro." },
  { id:"p04", sender:"Berke",  ts:1730512800, text:"Günaydın Tarık! Fatura hazır olunca e-postama gönderir misin?" },
  { id:"p05", sender:"Tarık",  ts:1730685600, text:"Fatura gönderildi. Toplam 4.200 Euro, son ödeme tarihi 30 Kasım." },
  { id:"p06", sender:"Berke",  ts:1730689200, text:"Aldım, teşekkürler. Bu Cuma sonuna kadar ödemeyi hallederim." },
  { id:"p07", sender:"Tarık",  ts:1731034800, text:"Teyit etmek istedim — teslimat adresi Atatürk Caddesi No:14 mi?" },
  { id:"p08", sender:"Berke",  ts:1731038400, text:"Evet, doğru adres. Yükleme rampası yan sokakta." },
  { id:"p09", sender:"Tarık",  ts:1731643200, text:"Kamyon yolda, tahmini varış 09:30. Ekibiniz yükleme rampasında hazır olsun." },
  { id:"p10", sender:"Berke",  ts:1731650400, text:"Kereste alındı — 28 metreküp anlaşıldığı gibi. Kalite iyi, sahada Mehmet imzaladı." },
  { id:"p11", sender:"Tarık",  ts:1731654000, text:"Mükemmel. Makbuz kısa süre içinde e-postayla gelecek." },
  { id:"p12", sender:"Berke",  ts:1732140000, text:"Tarık, 4.200 Euro ödemeyi bu sabah banka havalesiyle gönderdim." },
  { id:"p13", sender:"Tarık",  ts:1732143600, text:"Alındı, teşekkürler! Seninle çalışmak her zaman keyifli." },

  // ── Aralık 2024 ─────────────────────────────────────────────────────────────
  { id:"p14", sender:"Berke",  ts:1733062800, text:"Günaydın Tarık! Zemin döşeme siparişine hazırız — 400 metrekare İtalyan seramik gerekiyor." },
  { id:"p15", sender:"Tarık",  ts:1733066400, text:"Günaydın! Stokta mevcut. Metrekaresi 18 Euro, toplamda 7.200 Euro. Teslimat 18 Aralık'a kadar olur." },
  { id:"p16", sender:"Berke",  ts:1733070000, text:"Tamam. Ayrıca konferans odaları için 150 akustik panel gerekiyor." },
  { id:"p17", sender:"Tarık",  ts:1733080800, text:"Akustik panel adeti 12 Euro — 1.800 Euro. Seramikle aynı sevkiyatta gönderebilirim. Toplam 9.000 Euro." },
  { id:"p18", sender:"Berke",  ts:1733084400, text:"Harika, güncellenmiş faturayı gönderir misin?" },
  { id:"p19", sender:"Tarık",  ts:1733152800, text:"Fatura gönderildi. Toplam 9.000 Euro, son ödeme tarihi 31 Aralık." },
  { id:"p20", sender:"Berke",  ts:1733156400, text:"Teyit ettim, ödeme onaylandı." },
  { id:"p21", sender:"Tarık",  ts:1734520800, text:"Bugün teslimat var — seramikler ve akustik paneller kamyonda. Tahmini varış sabah 10." },
  { id:"p22", sender:"Berke",  ts:1734524400, text:"Ekip hazır, ana kapıdan gelin." },
  { id:"p23", sender:"Tarık",  ts:1734528000, text:"Teslimat tamamlandı ve imzalandı. 400 metrekare seramik ve 150 panel eksiksiz teslim edildi." },
  { id:"p24", sender:"Berke",  ts:1734531600, text:"Kalite mükemmel! Müşteri sahaya geldi ve seramikleri hemen beğendi." },
  { id:"p25", sender:"Berke",  ts:1734880800, text:"Tarık, 9.000 Euro ödemeyi şimdi gönderiyorum — İyi tatiller!" },
  { id:"p26", sender:"Tarık",  ts:1734966000, text:"Ödeme alındı! Mutlu Noeller Berke, tatil iznini keyifle geçir." },
  { id:"p27", sender:"Berke",  ts:1734969600, text:"Sana ve ailene mutlu Noeller! Yeni yılda görüşürüz." },

  // ── Ocak 2025 ──────────────────────────────────────────────────────────────
  { id:"p28", sender:"Berke",  ts:1735635600, text:"İyi Yıllar Tarık! Umarım 2025 işleriniz için harika bir yıl olur." },
  { id:"p29", sender:"Tarık",  ts:1735639200, text:"İyi Yıllar Berke! Sen ve ekibine en iyisini dilerim." },
  { id:"p30", sender:"Berke",  ts:1736244000, text:"İşe dönüş! Lobi için 80 adet cam panel gerekiyor — özel yapım 90x180 cm." },
  { id:"p31", sender:"Tarık",  ts:1736247600, text:"Stokta var. Panel başı 145 Euro, 80 adet 11.600 Euro. 20 Ocak'a kadar teslim ederim." },
  { id:"p32", sender:"Berke",  ts:1736251200, text:"20 Ocak mükemmel. Siparişi teyit eder misin?" },
  { id:"p33", sender:"Tarık",  ts:1736254800, text:"Sipariş teyit edildi: 80 adet cam panel, teslimat 20 Ocak, fatura 11.600 Euro." },
  { id:"p34", sender:"Tarık",  ts:1737208800, text:"Cam paneller hazırlandı ve paketlendi. Yarın yani 20 Ocak'ta teslimat teyit edildi." },
  { id:"p35", sender:"Tarık",  ts:1737295200, text:"Teslim edildi — 80 panel, tamamı sağlam. Ustanız Kemal imzaladı." },
  { id:"p36", sender:"Berke",  ts:1737298800, text:"Mükemmel durumda alındı. Montaj ekibi Pazartesi 27 Ocak'ta başlıyor." },
  { id:"p37", sender:"Tarık",  ts:1737388800, text:"Cam paneller faturası: 11.600 Euro, son ödeme tarihi 28 Şubat." },

  // ── Şubat 2025 ────────────────────────────────────────────────────────────
  { id:"p38", sender:"Berke",  ts:1738581600, text:"Tarık, lobi montajı bitti. Müşteri cam panellere bayıldı." },
  { id:"p39", sender:"Tarık",  ts:1738585200, text:"Harika! Önümüzdeki dönemde başka malzeme ihtiyacı var mı?" },
  { id:"p40", sender:"Berke",  ts:1738756800, text:"Evet — asma kat yapısı için 8 ton çelik donatı çubuğu gerekiyor." },
  { id:"p41", sender:"Tarık",  ts:1738760400, text:"Ton başı 1.400 Euro, 8 ton toplamda 11.200 Euro. 27 Şubat'a kadar teslim ederim." },
  { id:"p42", sender:"Berke",  ts:1738764000, text:"Onaylandı. Siparişi işleme alır mısın?" },
  { id:"p43", sender:"Tarık",  ts:1739282400, text:"Çelik donatılar 27 Şubat'ta söz verildiği gibi teslim edildi. 8 tonun tamamı." },
  { id:"p44", sender:"Berke",  ts:1739286000, text:"Sahada alındı. Ayrıca cam panel ödemesini bugün gönderiyorum — 11.600 Euro transfer edildi." },
  { id:"p45", sender:"Tarık",  ts:1739289600, text:"Cam panel ödemesi alındı, teşekkürler!" },

  // ── Mart 2025 ─────────────────────────────────────────────────────────────
  { id:"p46", sender:"Berke",  ts:1741428000, text:"Tarık, proje yolunda. Nihai müşteri kontrolü 15 Nisan. Kapı kasalarına ihtiyacım var." },
  { id:"p47", sender:"Tarık",  ts:1741431600, text:"Kaç adet ve hangi kaplama?" },
  { id:"p48", sender:"Berke",  ts:1741435200, text:"20 adet kapı kasası, meşe kaplama. Fiyat ve temin süresi ne kadar?" },
  { id:"p49", sender:"Tarık",  ts:1741438800, text:"Adeti 85 Euro, toplamda 1.700 Euro. 29 Mart'a kadar sahanda olur." },

  // ── Nisan 2025 ────────────────────────────────────────────────────────────
  { id:"p50", sender:"Berke",  ts:1743854400, text:"Tarık — proje tamamlandı! 15 Nisan kesin kontrolü geçti. Çelik donatı 11.200 Euro ve kapı kasaları 1.700 Euro ödemelerini bu hafta sonuna kadar göndereceğim. Seninle çalışmak büyük bir zevkti!" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

async function cleanSeedData(db) {
  db.prepare("DELETE FROM messages WHERE chat_id = ?").run(CHAT_ID);
  deactivate(CHAT_ID);
  await deleteVectorsByChat(CHAT_ID);
  console.log("  Mevcut test verisi temizlendi:", CHAT_ID);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function run() {
  const clean = process.argv.includes("--clean");
  console.log("\n=== seed-50: kişisel sohbet (Berke ↔ Tarık) ===\n");

  const db = initDb();

  if (clean) {
    await cleanSeedData(db);
    console.log("  Tamamlandı. Yeniden seed için --clean olmadan çalıştırın.\n");
    process.exit(0);
  }

  activate(CHAT_ID, "seed");
  console.log("  Sohbet aktifleştirildi:", CHAT_ID);

  console.log(MSGS.length, "mesaj ekleniyor, sohbet:", CHAT_ID);
  let inserted = 0;
  for (const m of MSGS) {
    insertMessage({
      id:        m.id,
      chatId:    CHAT_ID,
      chatType:  CHAT_TYPE,
      sender:    m.sender,
      timestamp: m.ts,
      type:      "text",
      text:      m.text,
      status:    "done",
    });
    inserted++;
    process.stdout.write(".");
  }

  console.log("\n\nTamamlandı.", inserted, "mesaj eklendi.");
  console.log("Sohbet ID:", CHAT_ID);
  console.log("Kapsam: Kasım 2024 – Nisan 2025");
  console.log("\nGömme: uygulamayı (yeniden) başlatın — backfill() tüm mesajları otomatik olarak kuyruğa alır.\n");
  process.exit(0);
}

run().catch(err => {
  console.error("\n[HATA]", err.message);
  process.exit(1);
});
