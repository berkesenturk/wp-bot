/**
 * Seed script: 100 mesajlık grup sohbeti
 * Sigma Geliştirme Ekibi: Berke, Ahmed, Leyla, Mehmet
 * Proje: Meridian CRM platformu
 * Kapsam: Kasım 2024 – Nisan 2025
 *
 * Çalıştır:          node src/test/seed-100.js
 * Önce temizle:      node src/test/seed-100.js --clean
 */

import { initDb }                from "../db/index.js";
import { insertMessage }         from "../db/messages.js";
import { activate, deactivate }  from "../db/chatSettings.js";
import { deleteVectorsByChat }   from "../workers/vectorStore.js";

const CHAT_ID   = "seed_group_100";
const CHAT_TYPE = "group";

const MSGS = [
  // ── Kasım 2024 ─────────────────────────────────────────────────────────────
  { id:"g01",  sender:"Berke",  ts:1730419200, text:"Günaydın herkese! Meridian CRM projesini bugün başlatıyoruz. Heyecanlıyım, hepinizle çalışacağım için mutluyum." },
  { id:"g02",  sender:"Ahmed",  ts:1730422800, text:"Günaydın! Hazırım. Gereksinim dokümanını inceledim — kapsam beklediğimden daha geniş." },
  { id:"g03",  sender:"Leyla",  ts:1730426400, text:"Ben de aynı şeyi düşündüm. 28 Şubat teslim tarihine kadar 14 haftamız var. Odaklı kalırsak yeterli olur." },
  { id:"g04",  sender:"Mehmet", ts:1730430000, text:"Ben bugün veritabanı şemasını başlatacağım. Ahmed, entity diyagramını paylaşabilir misin?" },
  { id:"g05",  sender:"Ahmed",  ts:1730433600, text:"E-postana gönderdim. Ayrıca — Meridian bütçeyi teyit etti: tam platform için toplam 85.000 Euro." },
  { id:"g06",  sender:"Berke",  ts:1730437200, text:"Bütçe dağılımı: 30k geliştirme, 20k tasarım, 15k QA, 10k altyapı, 10k acil. Verimli kullanalım." },
  { id:"g07",  sender:"Leyla",  ts:1730512800, text:"Anlaşıldı. Bugün proje takibini kuruyorum. İlk milestone: auth modülü, teslim tarihi 30 Kasım." },
  { id:"g08",  sender:"Mehmet", ts:1730685600, text:"Veritabanı şeması taslağı hazır. Üç ana entity: Account, Contact, Deal. Drive'daki inceleme linkine bakın." },
  { id:"g09",  sender:"Ahmed",  ts:1730689200, text:"İnceledim. Temiz görünüyor. Bir öneri: çağrı kayıtları ve e-postalar için Activities tablosu ekleyelim." },
  { id:"g10",  sender:"Mehmet", ts:1730692800, text:"Güzel öneri. Ekliyorum. Güncellenmiş şema yarın sabah hazır olur." },
  { id:"g11",  sender:"Berke",  ts:1731034800, text:"Yarın 8 Kasım saat 10'da ekip toplantısı — ilk iki hafta için sprint planlaması. Kaçırmayın." },
  { id:"g12",  sender:"Leyla",  ts:1731038400, text:"Orada olacağım. Backlog'u inceleme için hazırlayayım mı?" },
  { id:"g13",  sender:"Berke",  ts:1731042000, text:"Evet lütfen, timeline'ı da getir." },
  { id:"g14",  sender:"Ahmed",  ts:1731290400, text:"Sprint 1 görevleri atandı. Ben auth'ta, Mehmet DB migration'larda, Leyla UI componentlerde." },
  { id:"g15",  sender:"Mehmet", ts:1731294000, text:"Migration'lar çalışıyor. Foreign key constraint'lerde küçük bir sorun var — şu an düzeltiyorum." },
  { id:"g16",  sender:"Leyla",  ts:1731643200, text:"UI kiti hazır — Tailwind kullanıyoruz. Component library'de şu an: Button, Input, Table, Modal, Sidebar var." },
  { id:"g17",  sender:"Ahmed",  ts:1731646800, text:"Auth modülü bitti — 7 günlük refresh token'lı JWT. Testler geçiyor. Code review için hazır." },
  { id:"g18",  sender:"Berke",  ts:1731650400, text:"Güzel iş Ahmed! Mehmet bugün incelesen iyi olur." },
  { id:"g19",  sender:"Mehmet", ts:1731907200, text:"Auth incelendi ve onaylandı. Temiz implementation. Main'e merge edildi." },
  { id:"g20",  sender:"Leyla",  ts:1732140000, text:"İlk milestone tamamlandı! Auth modülü 20 Kasım'da teslim edildi — takvimin iki gün önünde 🎉" },

  // ── Aralık 2024 ─────────────────────────────────────────────────────────────
  { id:"g21",  sender:"Berke",  ts:1733062800, text:"Günaydın! Aralık sprinti bugün başlıyor. Ana odak: Contact ve Deal modülleri." },
  { id:"g22",  sender:"Ahmed",  ts:1733066400, text:"Ayrıca: Meridian CSV dosyaları için toplu import özelliği istiyor. Bu sprinte ekleyelim mi?" },
  { id:"g23",  sender:"Berke",  ts:1733070000, text:"Şimdilik backlog'a alalım. Düzgün estimate olmadan bu sprinte eklemek riskli." },
  { id:"g24",  sender:"Leyla",  ts:1733073600, text:"Katılıyorum. Zaten elimizde yeterince iş var. Aralık teslimi 20 Aralık'ta contact CRUD." },
  { id:"g25",  sender:"Mehmet", ts:1733152800, text:"Kısa soru — contact arama fuzzy matching mi desteklemeli yoksa exact mi?" },
  { id:"g26",  sender:"Ahmed",  ts:1733156400, text:"Fuzzy matching. Meridian bunu kickoff'ta özellikle istedi. Postgres'te trigram indeks işe yarar." },
  { id:"g27",  sender:"Berke",  ts:1733760000, text:"Heads up — Meridian ile müşteri check-in görüşmesi 12 Aralık saat 15'te. Güncellemelerinizi hazırlayın." },
  { id:"g28",  sender:"Leyla",  ts:1733763600, text:"UI ilerlemenin demosunu hazırlayacağım. Contact listesi, detay sayfası ve düzenleme formu hazır." },
  { id:"g29",  sender:"Ahmed",  ts:1733846400, text:"Ben API endpoint'lerini ve Postman koleksiyonunu göstereceğim." },
  { id:"g30",  sender:"Berke",  ts:1734001200, text:"Meridian görüşmesi harika geçti! UI'yi sevdiler. Ayrıca Deal'lar için pipeline board view (Kanban tarzı) istediler." },
  { id:"g31",  sender:"Mehmet", ts:1734004800, text:"Kanban board yapılabilir, belki 3 günlük iş. Ocak sprinti için uygun olur." },
  { id:"g32",  sender:"Leyla",  ts:1734008400, text:"Ben yapabilirim. Daha önce dnd-kit ile drag-and-drop yaptım." },
  { id:"g33",  sender:"Ahmed",  ts:1734344400, text:"Contact modülü bitti ve test edildi. 47 unit test, hepsi yeşil. Staging'e deploy edildi." },
  { id:"g34",  sender:"Berke",  ts:1734348000, text:"Mükemmel! 20 Aralık milestone'ı tam zamanında tutturuldu. Milestone ödemesi 21.250 Euro fatura edilecek." },
  { id:"g35",  sender:"Leyla",  ts:1734351600, text:"Meridian'a ilk fatura bugün gidiyor: milestone 1 (auth + contact) için 21.250 Euro. Son ödeme tarihi 15 Ocak." },
  { id:"g36",  sender:"Ahmed",  ts:1734868800, text:"Herkese iyi tatiller! Molayı hak ettik." },
  { id:"g37",  sender:"Mehmet", ts:1734872400, text:"İyi tatiller ekip! 🎄" },
  { id:"g38",  sender:"Leyla",  ts:1734876000, text:"İyi tatiller! Ocak'ta görüşürüz." },
  { id:"g39",  sender:"Berke",  ts:1734879600, text:"Herkese iyi tatiller! Dinlenin, Ocak yoğun geçecek." },

  // ── Ocak 2025 ──────────────────────────────────────────────────────────────
  { id:"g40",  sender:"Berke",  ts:1735635600, text:"İyi Yıllar ekip! 2025, hadi gidelim 🚀" },
  { id:"g41",  sender:"Ahmed",  ts:1735639200, text:"İyi Yıllar! Güçlü bitirmeye hazırım." },
  { id:"g42",  sender:"Mehmet", ts:1735642800, text:"Ben de. Bugün aslında masada oturuyorum, erken başladım." },
  { id:"g43",  sender:"Leyla",  ts:1736157600, text:"Herkes döndü mü? Ocak sprinti kick-off'u bu Cuma 10 Ocak saat 10'da." },
  { id:"g44",  sender:"Berke",  ts:1736161200, text:"Harika. Gündem: Deal modülü, Kanban board, CSV import kapsamı." },
  { id:"g45",  sender:"Ahmed",  ts:1736244000, text:"Meridian birinci faturayı ödedi! 21.250 Euro 7 Ocak'ta geldi. Zamanında." },
  { id:"g46",  sender:"Berke",  ts:1736247600, text:"Mükemmel. Kasım ve Aralık maliyetlerini karşılıyor. Bütçe açısından yolundayız." },
  { id:"g47",  sender:"Mehmet", ts:1736424000, text:"Deal modülüne başladım. Pipeline aşamaları hesap bazında yapılandırılabilir olacak." },
  { id:"g48",  sender:"Leyla",  ts:1736427600, text:"Kanban board'u paralelde yapıyorum. Stage'ler arası drag-and-drop neredeyse tamam." },
  { id:"g49",  sender:"Ahmed",  ts:1736431200, text:"CSV import'u kapsıyorum. Tahmin: import + validation + hata raporlama için 4 gün." },
  { id:"g50",  sender:"Berke",  ts:1736514000, text:"O zaman CSV import'u da bu sprinte ekleyelim. Meridian sürekli soruyor." },
  { id:"g51",  sender:"Ahmed",  ts:1737029400, text:"CSV import hazır. 50.000 satıra kadar async işleme yapıyor, progress göstergesi var." },
  { id:"g52",  sender:"Leyla",  ts:1737033000, text:"Kanban board teslim edildi! Drag-and-drop sorunsuz çalışıyor, Chrome/Firefox/Safari'de test edildi." },
  { id:"g53",  sender:"Mehmet", ts:1737036600, text:"Deal modülü %80 hazır. Gelir tahmin paneli son kalan kısım." },
  { id:"g54",  sender:"Berke",  ts:1737122400, text:"22 Ocak'ta Meridian'a demo. Kendi parçalarınızı hazırlayın." },
  { id:"g55",  sender:"Ahmed",  ts:1737212400, text:"Staging ortamı stabil. Demo hazır." },
  { id:"g56",  sender:"Berke",  ts:1737298800, text:"22 Ocak demosu çok iyi geçti! Meridian ekibi çok memnun. Deal modülü spec'ini onayladılar." },
  { id:"g57",  sender:"Leyla",  ts:1737302400, text:"Kanban board'u özellikle sevdiler. Eklemek doğru karardı." },
  { id:"g58",  sender:"Mehmet", ts:1737820800, text:"Deal modülü tamamen bitti ve test edildi. Gelir tahmin paneli dahil. Review için hazır." },
  { id:"g59",  sender:"Ahmed",  ts:1737824400, text:"İncelendi. Sağlam iş. Main'e merge edildi." },
  { id:"g60",  sender:"Berke",  ts:1738166400, text:"Milestone 2 tamamlandı! Deal + kanban + CSV import için Meridian'a 21.250 Euro fatura kesiyorum. Son ödeme tarihi 28 Şubat." },

  // ── Şubat 2025 ────────────────────────────────────────────────────────────
  { id:"g61",  sender:"Leyla",  ts:1738368000, text:"Şubat sprinti odakları: raporlama modülü, e-posta entegrasyonu ve performans optimizasyonu." },
  { id:"g62",  sender:"Ahmed",  ts:1738371600, text:"E-posta entegrasyonu SendGrid kullanacak. Meridian'dan API key gerekiyor — Berke takip edebilir misin?" },
  { id:"g63",  sender:"Berke",  ts:1738375200, text:"Hallederim. Bugün CTO'larına mail atıyorum." },
  { id:"g64",  sender:"Mehmet", ts:1738540800, text:"Contact listesi profiling yaptım. 10.000 contact yükleme şu an 4,2 saniye — 1 saniyenin altında olması lazım." },
  { id:"g65",  sender:"Ahmed",  ts:1738544400, text:"Pagination ve virtual scrolling düzeltir bunu. Gerekirse yardım ederim." },
  { id:"g66",  sender:"Mehmet", ts:1738634400, text:"İyi haber — veritabanı indexleri ve virtual scrolling ekledikten sonra contact'lar 0,6 saniyede yükleniyor." },
  { id:"g67",  sender:"Leyla",  ts:1738638000, text:"Bu muazzam bir iyileşme. Aferin Mehmet!" },
  { id:"g68",  sender:"Berke",  ts:1739030400, text:"Meridian SendGrid API key'ini gönderdi. Ahmed e-posta entegrasyonuna devam edebilirsin." },
  { id:"g69",  sender:"Ahmed",  ts:1739034000, text:"Entegrasyonu zaten kurdum. Şu an test e-postaları gönderiyorum." },
  { id:"g70",  sender:"Leyla",  ts:1739037600, text:"Raporlama modülü şekilleniyor — döneme göre gelir, pipeline dönüşüm oranı ve aktivite logu var." },
  { id:"g71",  sender:"Berke",  ts:1739282400, text:"27 Şubat — tüm özellikler tamamlandı ve staging'de. Son QA haftası başlıyor." },
  { id:"g72",  sender:"Ahmed",  ts:1739286000, text:"Tam regresyon süiti çalışıyor. 312 test, şu an 308'i geçiyor." },
  { id:"g73",  sender:"Mehmet", ts:1739289600, text:"Başarısız olan 4 test e-posta modülünün timezone edge case'iyle ilgili. Şu an düzeltiyorum." },
  { id:"g74",  sender:"Ahmed",  ts:1739368800, text:"Meridian 2. faturayı ödedi — 21.250 Euro alındı. Leyla takip için teşekkürler." },
  { id:"g75",  sender:"Leyla",  ts:1739372400, text:"Toplam alınan: 42.500 Euro. Proje tamamlandığında bir milestone ödemesi daha: 42.500 Euro." },
  { id:"g76",  sender:"Berke",  ts:1739376000, text:"Yani son ödeme kabul üzerine 42.500 Euro. Bu sözleşmeyle örtüşüyor." },

  // ── Mart 2025 ─────────────────────────────────────────────────────────────
  { id:"g77",  sender:"Mehmet", ts:1740787200, text:"312 testin tamamı geçiyor. QA tamamlandı." },
  { id:"g78",  sender:"Ahmed",  ts:1740790800, text:"Prodüksiyon deployment başarılı. Meridian CRM canlıya geçti! 🚀" },
  { id:"g79",  sender:"Berke",  ts:1740794400, text:"İnanılmaz iş ekip! Zamanında ve bütçede. Müşteri teslim görüşmesi 5 Mart saat 14'te." },
  { id:"g80",  sender:"Leyla",  ts:1740798000, text:"Kullanıcı dokümantasyonu ve teslim notlarını hazırlıyorum." },
  { id:"g81",  sender:"Ahmed",  ts:1741003200, text:"Teslim görüşmesi mükemmel geçti. Meridian ekibi platforma eğitildi." },
  { id:"g82",  sender:"Berke",  ts:1741006800, text:"Son fatura gönderildi: 42.500 Euro. Son ödeme tarihi 31 Mart." },
  { id:"g83",  sender:"Mehmet", ts:1741010400, text:"Meridian'dan küçük bir bug raporu: başlıklarda özel karakter olduğunda CSV import bozuluyor." },
  { id:"g84",  sender:"Ahmed",  ts:1741014000, text:"Hallederim. Hızlı bir fix olmalı — en fazla 30 dakika." },
  { id:"g85",  sender:"Ahmed",  ts:1741096800, text:"Bug düzeltildi ve deploy edildi. Parse öncesi başlıklar normalize ediliyor." },
  { id:"g86",  sender:"Leyla",  ts:1741100400, text:"Meridian fixi onayladıklarını bildirdi. Resmi kabul mektubu geliyor." },
  { id:"g87",  sender:"Berke",  ts:1741600800, text:"Başarılı teslimi kutlamak için 14 Mart'ta ekip yemeği! 4 kişilik masa ayırtıyorum." },
  { id:"g88",  sender:"Ahmed",  ts:1741604400, text:"Varım! Hakkıyla kazanıldı." },
  { id:"g89",  sender:"Mehmet", ts:1741608000, text:"Kesinlikle geliyorum. Saat kaçta?" },
  { id:"g90",  sender:"Berke",  ts:1741611600, text:"Öğleden sonra 1'de Nazar Restaurant. Özel odaları var." },
  { id:"g91",  sender:"Leyla",  ts:1741960800, text:"Meridian son faturayı ödedi — 42.500 Euro 18 Mart'ta alındı!" },
  { id:"g92",  sender:"Berke",  ts:1741964400, text:"Toplam proje geliri: 85.000 Euro. Sözleşme değeriyle birebir. Harika iş herkese 🎉" },
  { id:"g93",  sender:"Ahmed",  ts:1741968000, text:"Üstelik geliştirme tarafında bütçenin altında kaldık — ayrılan 30k'ya karşın 28k harcadık." },

  // ── Nisan 2025 ────────────────────────────────────────────────────────────
  { id:"g94",  sender:"Berke",  ts:1743465600, text:"Yeni proje adayı geliyor — Nexus Lojistik benzer bir platform istiyor. 3 Nisan'da görüşme." },
  { id:"g95",  sender:"Leyla",  ts:1743469200, text:"Aynı stack mi? Bu süreci önemli ölçüde hızlandırır." },
  { id:"g96",  sender:"Berke",  ts:1743472800, text:"Muhtemelen evet. Bütçeye taahhüt vermeden önce gereksinimleri alacağım." },
  { id:"g97",  sender:"Ahmed",  ts:1743724800, text:"3 Nisan görüşmesi tamamlandı. Nexus Lojistik tam platform artı mobil uygulama desteği istiyor." },
  { id:"g98",  sender:"Mehmet", ts:1743728400, text:"Mobil uygulama desteği React Native ile yapılabilir, API iyi yapılandırılmışsa çok karmaşık olmaz." },
  { id:"g99",  sender:"Leyla",  ts:1743732000, text:"Nexus için bütçe tahmini mobil kapsam göz önüne alındığında yaklaşık 110.000 Euro. Teklifi hazırlayacağım." },
  { id:"g100", sender:"Berke",  ts:1746057600, text:"Teklif bugün Nexus Lojistik'e gönderildi. Tahmini proje başlangıcı: 15 Mayıs. Parmaklar çapraz!" },
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
  console.log("\n=== seed-100: grup sohbeti (Sigma Geliştirme Ekibi) ===\n");

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
  console.log("Proje: Meridian CRM platformu — toplam 85.000 Euro");
  console.log("\nGömme: uygulamayı (yeniden) başlatın — backfill() tüm mesajları otomatik olarak kuyruğa alır.\n");
  process.exit(0);
}

run().catch(err => {
  console.error("\n[HATA]", err.message);
  process.exit(1);
});
