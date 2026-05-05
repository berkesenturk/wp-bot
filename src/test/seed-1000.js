/**
 * Seed script: ~1000 mesajlık grup sohbeti
 * Acme Solutions — operasyon ve proje grubu
 * Katılımcılar: Berke, Ahmed, Leyla, Mehmet, Sara, Kemal
 * Kapsam: Kasım 2024 – Nisan 2025
 *
 * Çalıştır:          node src/test/seed-1000.js
 * Önce temizle:      node src/test/seed-1000.js --clean
 */

import { initDb }                from "../db/index.js";
import { insertMessage }         from "../db/messages.js";
import { activate, deactivate }  from "../db/chatSettings.js";
import { deleteVectorsByChat }   from "../workers/vectorStore.js";

const CHAT_ID   = "seed_group_1000";
const CHAT_TYPE = "group";

const GAP = 1500; // episode içinde mesajlar arası ~25 dakika

const EPISODES = [

  // ═══ KASIM 2024 ═══════════════════════════════════════════════════════════

  { baseTs: 1730419200, msgs: [
    { sender:"Berke",  text:"Günaydın herkese! Acme Solutions'ın günlük operasyon grubunu kuruyorum. Proje güncellemeleri, faturalar, toplantı notları — her şey burada olsun." },
    { sender:"Ahmed",  text:"Günaydın! Güzel fikir. Sonunda her şey tek yerde." },
    { sender:"Leyla",  text:"Harika. Şirket takvimini buraya sabitlerim." },
    { sender:"Mehmet", text:"Merhaba herkese 👋 Haydi başlayalım." },
    { sender:"Sara",   text:"Merhaba! Ekipte olmak için sabırsızlanıyorum." },
    { sender:"Kemal",  text:"Günaydın. Zamanında kuruldu — üç farklı sohbette üç ayrı konuyu takip ediyordum." },
    { sender:"Berke",  text:"Tam sorunu bu. Her şeyi burada tutalım. İlk gündem: iki aktif projemiz — Artisan Mobilya CRM ve Horizon lojistik platformu." },
    { sender:"Ahmed",  text:"Artisan için: geçen hafta gereksinim dokümanını bitirdim. Toplam kapsam 72.000 Euro. Sözleşmeyi imzaladılar." },
    { sender:"Leyla",  text:"Horizon daha büyük — 118.000 Euro, 5 aylık takvim. Kickoff görüşmesi 5 Kasım." },
    { sender:"Mehmet", text:"Her iki projede backend'i ben yönetiyorum. Zamanımı dikkatli bölmem gerekecek." },
    { sender:"Sara",   text:"Her ikisi için UI'da benim. Küçük olduğu için Artisan önce?" },
    { sender:"Berke",  text:"Evet. Artisan kickoff 4 Kasım, Horizon 5 Kasım. Kapasite konusunda disiplinli olalım." },
    { sender:"Kemal",  text:"Horizon için tech stack ne?" },
    { sender:"Ahmed",  text:"React + Node + Postgres. Artisan gibi aynı. Tutarlılık işe yarar." },
  ]},

  { baseTs: 1730512800, msgs: [
    { sender:"Sara",   text:"Artisan UI tasarımları üzerinde çalışıyorum. Çok temiz, minimal bir görünüm istiyorlar." },
    { sender:"Leyla",  text:"Güzel brief. Marka rehberi gönderdiler mi?" },
    { sender:"Sara",   text:"Evet. Ana renk sıcak ceviz kahvesi, ikincil renk kırık beyaz. Tipografi: başlıklar için Playfair Display." },
    { sender:"Mehmet", text:"Yarına kadar veritabanı şemasını hazırlarım. Ana entity'ler: Ürünler, Siparişler, Müşteriler, Tedarikçiler." },
    { sender:"Ahmed",  text:"Stok takip modülünü unutma — sözleşmede özellikle belirtilmiş." },
    { sender:"Mehmet", text:"Var zaten. Stok yönetimi WebSocket üzerinden gerçek zamanlı güncellemelerle ayrı bir servis olacak." },
    { sender:"Berke",  text:"İyi. İlk milestone 30 Kasım — kimlik doğrulama ve ürün kataloğu. Teslimde 18.000 Euro fatura." },
    { sender:"Kemal",  text:"QA'yı kim yapıyor?" },
    { sender:"Berke",  text:"Artisan'da QA'yı sen yönetiyorsun Kemal. Ahmed Horizon'un QA stratejisini yapıyor." },
    { sender:"Kemal",  text:"Anlaşıldı. Bu hafta test planını yazacağım." },
    { sender:"Sara",   text:"İlk wireframe grubunu bu gece paylaşıyorum, geri bildirim verin." },
  ]},

  { baseTs: 1730685600, msgs: [
    { sender:"Berke",  text:"Artisan kickoff görüşmesi 30 dakika sonra. İyi izlenim bırakalım." },
    { sender:"Ahmed",  text:"Hazırım. Proje yol haritası slaytlarını hazırladım." },
    { sender:"Leyla",  text:"Ayrıca — gelecek Pazartesi yazılım geliştirici Emre ekibe katılıyor! 🎉" },
    { sender:"Mehmet", text:"Harika, fazladan ellere ihtiyacımız vardı." },
    { sender:"Sara",   text:"Heyecanlı! Frontend mi yoksa backend mi?" },
    { sender:"Leyla",  text:"Full-stack, 2 yıl deneyim. Artisan ile başlayacak." },
    { sender:"Ahmed",  text:"Artisan görüşmesi bitti! Çok verimli geçti. Müşteri takvimi seviyor. Her Salı sabah 11'de haftalık check-in istediler." },
    { sender:"Berke",  text:"Kabul. Leyla Salıları tekrarlayan takvim davetleri gönderir misin?" },
    { sender:"Leyla",  text:"Yapıldı. Ayrıca ön ödeme için ilk fatura gönderiyorum: 7.200 Euro (sözleşmenin %10'u). Son ödeme 20 Kasım." },
    { sender:"Kemal",  text:"Test planının ilk taslağı hazır. 48 test case, temel akışları kapsıyor." },
    { sender:"Berke",  text:"İyi iş Kemal. Drive'a yükle, yarın incelerim." },
  ]},

  { baseTs: 1730772000, msgs: [
    { sender:"Berke",  text:"Horizon Lojistik kickoff görüşmesi mükemmeldi. Büyük bir şirket — 180 çalışan, 6 şehirde operasyon." },
    { sender:"Ahmed",  text:"CTO'ları çok teknik biri. Mimarimiz hakkında güzel sorular sordu." },
    { sender:"Mehmet", text:"Microservices mi monolith mi diye sordular. Monolitik başlayıp gerekince servis çıkardığımızı anlattım." },
    { sender:"Sara",   text:"Tasarım Direktörleri çok detaylı bir marka rehberi paylaştı. Renkler, tipografi, ikon stili, her şey." },
    { sender:"Leyla",  text:"Sözleşme geçen hafta imzalandı. Ön ödeme 11.800 Euro bugün faturalandı, son ödeme 25 Kasım." },
    { sender:"Berke",  text:"Bu ay 19.000 Euro bekliyoruz. Kasım için güçlü bir başlangıç." },
    { sender:"Kemal",  text:"İki gün üst üste iki proje kickoff'u. Yoğun hafta!" },
    { sender:"Ahmed",  text:"Sprint halinde geçecek. İletişimi sıkı tutalım." },
    { sender:"Mehmet", text:"Bir endişem var: her iki proje de Kasım'da yoğun veritabanı işi istiyor. Destek lazım." },
    { sender:"Berke",  text:"Emre Pazartesi başlıyor, Artisan migration'larını senin gözetiminde yapabilir." },
    { sender:"Mehmet", text:"Mükemmel, işe yarar." },
  ]},

  { baseTs: 1731034800, msgs: [
    { sender:"Berke",  text:"Haftalık standup — bu hafta herkes ne bitirdi, ne engel var?" },
    { sender:"Ahmed",  text:"Artisan API yapısı tamamlandı. 34 endpoint Swagger'da belgelendi. Engel yok." },
    { sender:"Mehmet", text:"Her iki proje şeması bitti. Migration'ları bugün çalıştırıyorum. Engel: Horizon'un production DB spesifikasyonları lazım." },
    { sender:"Sara",   text:"Artisan wireframe'leri hazır — 12 ekran. Şimdi paylaşıyorum. Çarşamba'ya kadar geri bildirim gerekiyor." },
    { sender:"Kemal",  text:"Artisan test planı tamamlandı. Otomatik testler yazmaya başlıyorum. Engel yok." },
    { sender:"Leyla",  text:"Muhasebe güncellemesi: Artisan ön ödemesi 7.200 Euro Pazartesi bekleniyor. Horizon ön ödemesi 11.800 Euro 25 Kasım'a kadar." },
    { sender:"Berke",  text:"İyi ilerleme. Sara'nın wireframe'leri harika görünüyor — çok temiz. Leyla bugün Artisan'dan ön ödemeyi takip eder misin?" },
    { sender:"Leyla",  text:"Zaten mail attım. Yanıt bekliyorum." },
    { sender:"Ahmed",  text:"Horizon arada DB spesifikasyonlarını gönderdi, Mehmet'e iletiyorum." },
    { sender:"Mehmet", text:"Mükemmel, tam ihtiyacım olan buydu." },
    { sender:"Sara",   text:"Hızlı tasarım sorusu: Artisan ürün görsellerinin çok hızlı yüklenmesini istiyor. Görüntü optimizasyon pipeline'ı kuralım mı?" },
    { sender:"Mehmet", text:"Evet. Otomatik WebP dönüşümlü CDN kuruyorum. Uzun sürmez." },
  ]},

  { baseTs: 1731294000, msgs: [
    { sender:"Leyla",  text:"İyi haber: Artisan ön ödemesi geldi! 7.200 Euro bu sabah hesaba yattı." },
    { sender:"Berke",  text:"Mükemmel. Kasım finansal olarak güzel gidiyor." },
    { sender:"Ahmed",  text:"Horizon'un ön ödemesi hâlâ bekleniyor mu?" },
    { sender:"Leyla",  text:"Evet, son tarih 25 Kasım. Önümüzdeki hafta hatırlatma gönderirim." },
    { sender:"Berke",  text:"Kasım toplam gelir hedefi: 19.000 Euro. Şu an 7.200 Euro'dayız. Yolundayız." },
    { sender:"Mehmet", text:"Hızlı güncelleme: Artisan için görüntü CDN'i kuruldu. Yükleme süreleri 3,2 saniyeden 0,4 saniyeye düştü." },
    { sender:"Sara",   text:"İnanılmaz. Müşteri çok mutlu olacak." },
    { sender:"Kemal",  text:"Otomatik testler çalışıyor. 48 test case'den 41'i geçiyor. 7 başarısızlık auth edge case'lerinde." },
    { sender:"Ahmed",  text:"O auth edge case'lerini bugün düzelteceğim. Gün sonuna kadar hazır olur." },
    { sender:"Kemal",  text:"Acelesi yok, sadece bilgi vermek istedim. Sprint için blocker değil." },
  ]},

  { baseTs: 1731470400, msgs: [
    { sender:"Mehmet", text:"Horizon için mimari soru: teslimat kamyonlarının gerçek zamanlı takibini istiyorlar. En iyi yaklaşım ne?" },
    { sender:"Ahmed",  text:"Canlı güncellemeler için WebSocket, coğrafi veriler için PostGIS'li Postgres." },
    { sender:"Kemal",  text:"Kaç saniyede bir polling yapacak? Her saniye mi, her 10 saniyede mi?" },
    { sender:"Mehmet", text:"Her 30 saniye yeterli onlar için. Hassas takip değil, yaklaşık konum istiyorlar." },
    { sender:"Berke",  text:"WebSocket push ile 30 saniyelik aralık güzel. 180 kamyon, 30 saniyelik aralık, 12 saatlik vardiya için depolama maliyeti ne kadar?" },
    { sender:"Ahmed",  text:"Günde yaklaşık 2,1 milyon kayıt. PostGIS sıkıştırmayla belki 500 MB/gün. Yönetilebilir." },
    { sender:"Mehmet", text:"Otomatik temizleme ekleyeceğim — 90 günden eski verileri sil. DB boyutunu makul tutar." },
    { sender:"Sara",   text:"Canlı harita görünümü en etkileyici özellik olacak. Tasarlamak için sabırsızlanıyorum." },
    { sender:"Leyla",  text:"Horizon geçmiş rota oynatma da isteyebileceğini söyledi — bu kapsam dahilinde mi?" },
    { sender:"Berke",  text:"Mevcut sözleşmede yok. İlave bütçeyle faz 2 özelliği olarak önerebiliriz." },
    { sender:"Ahmed",  text:"Akıllıca. Kapsam kayması tehlikeli — önce faz 1'i mükemmel teslim edelim." },
    { sender:"Kemal",  text:"Katılıyorum. Faz 2 önerileri şimdi belgelenmeliki, unutmayalım." },
    { sender:"Berke",  text:"İyi fikir Kemal. Drive'da Faz 2 fikirleri belgesi aç." },
  ]},

  { baseTs: 1731643200, msgs: [
    { sender:"Berke",  text:"Emre'ye hoş geldin! Artık Acme Solutions grubundasın. Kendini tanıt 👋" },
    { sender:"Ahmed",  text:"Hoş geldin Emre! Ekibimize katıldığın için iyi oldu." },
    { sender:"Leyla",  text:"Merhaba Emre! Ben finans ve idari işlerle ilgileniyorum — bir şeye ihtiyacın olursa söyle." },
    { sender:"Sara",   text:"Hoş geldin! Ben Sara, baş tasarımcıyım." },
    { sender:"Mehmet", text:"Merhaba Emre. Ben Mehmet, backend lideriyim. Bu hafta benimle çalışacaksın." },
    { sender:"Kemal",  text:"Ekibe hoş geldin Emre!" },
    { sender:"Berke",  text:"Emre İstanbul'dan geliyor, bir SaaS startup'ında 2 yıl deneyimi var. Artisan ürün kataloğu modülüyle başlayacak." },
    { sender:"Mehmet", text:"GitHub erişimini ve onboarding dokümanını gönderdim. README'ye bak, sonra görüşme yaparız." },
    { sender:"Sara",   text:"Tasarım dosyaları erişimini de paylaşıyorum — ürün kataloğu düzeni için referans alman gerekecek." },
  ]},

  { baseTs: 1731816000, msgs: [
    { sender:"Ahmed",  text:"Artisan görüşmesi yarın 11'de. Kim ne sunacak?" },
    { sender:"Sara",   text:"Ben UI ilerlemesini göstereceğim — ürün katalog sayfaları %70 hazır." },
    { sender:"Mehmet", text:"Ben veritabanı ve API durumunu anlatacağım." },
    { sender:"Kemal",  text:"Test ilerlemesini kısaca paylaşacağım." },
    { sender:"Berke",  text:"Ben açış ve kapanışı yapacağım. Maksimum 30 dakika tutalım. Müşteriler saatlik toplantı istemez." },
    { sender:"Ahmed",  text:"Katılıyorum. Ana mesaj: milestone 1, 30 Kasım teslimatı için yolundayız." },
    { sender:"Sara",   text:"Görüşme öncesi birileri ekranımı kontrol edebilir mi? Fontların doğru render edildiğinden emin olmak istiyorum." },
    { sender:"Kemal",  text:"Bu gece hızlıca kontrol ederim. Ekran paylaşım linkini gönder." },
    { sender:"Sara",   text:"Gönderildi. Teşekkürler Kemal!" },
    { sender:"Berke",  text:"Artisan'a ayrıca entegrasyon için ürün fotoğraflarını 22 Kasım'a kadar yüklemeleri gerektiğini belirt." },
    { sender:"Ahmed",  text:"İyi nokta. Gündeme ekleyeyim." },
  ]},

  { baseTs: 1731992400, msgs: [
    { sender:"Ahmed",  text:"Artisan görüşmesi iyi geçti. İlerlemeyi beğendiler. Yeni bir istek: ürün kataloğunda Excel'e toplu dışa aktarım." },
    { sender:"Berke",  text:"Bu kapsam dahilinde mi?" },
    { sender:"Ahmed",  text:"Açıkça belirtilmemiş ama makul — belki 1 günlük iş. İyi niyet olarak ekleyebilirim." },
    { sender:"Mehmet", text:"Ekleyebilirim. xlsx kütüphanesiyle Excel dışa aktarımı hızlı yapılır." },
    { sender:"Leyla",  text:"Artisan ürün fotoğraflarını 22 Kasım'a kadar yükleyeceğini söyledi. Görüşmede teyit edildi." },
    { sender:"Sara",   text:"Harika. Onları almaya hazır medya kütüphanesi componentini kuruyorum." },
    { sender:"Kemal",  text:"Testler şu an 45/48 geçiyor. Yaklaşıyoruz." },
    { sender:"Berke",  text:"Güzel tempo. Hafta sonuna kadar 48'in tamamını hedefle." },
    { sender:"Leyla",  text:"Hatırlatma: Horizon ön ödemesi (11.800 Euro) son tarihi 25 Kasım. Hatırlatma göndereceğim." },
    { sender:"Berke",  text:"Evet, bugün nazik bir hatırlatma maili at." },
  ]},

  { baseTs: 1732190400, msgs: [
    { sender:"Berke",  text:"Ekip — ofis kiramız 31 Ocak'ta bitiyor. Yeni yerler araştırıyorum." },
    { sender:"Leyla",  text:"Ekip büyüdükçe mevcut ofis daralmaya başladı." },
    { sender:"Ahmed",  text:"Kaç kişilik düşünüyoruz?" },
    { sender:"Berke",  text:"10-12 kişilik. Şu an Emre ile birlikte 7'yiz, büyümeye yer bırakmak istiyorum." },
    { sender:"Sara",   text:"Bütçe aralığı ne?" },
    { sender:"Berke",  text:"Aylık 3.500-4.500 Euro. İki seçenek buldum: Boğaziçi İş Merkezi (3.800 Euro, 180 metrekare) ve Maslak Tower (4.200 Euro, 220 metrekare)." },
    { sender:"Mehmet", text:"Maslak Tower konumu ekip için çok daha iyi." },
    { sender:"Kemal",  text:"Otopark var mı? Ümraniye'den araba ile geliyorum." },
    { sender:"Berke",  text:"Maslak'ta 2 rezerve park yeri ve misafir parkı var. Boğaziçi'nde hiç yok." },
    { sender:"Ahmed",  text:"Maslak daha iyi görünüyor. Aylık fazladan 400 Euro ekip için buna değer." },
    { sender:"Leyla",  text:"Her ikisi için görüntüleme randevuları ayarlayayım mı?" },
    { sender:"Berke",  text:"Evet, gelecek hafta her ikisi için bak. Karar vermeden önce görelim." },
  ]},

  { baseTs: 1732449600, msgs: [
    { sender:"Berke",  text:"Kasım sona eriyor — hızlı ilerleme kontrolü. Herkes nerede?" },
    { sender:"Ahmed",  text:"Artisan: Auth modülü tamamlandı, ürün katalog API'si %90 hazır. 30 Kasım hedefinde yolundayız." },
    { sender:"Sara",   text:"Tasarım: tüm katalog ekranları hazır, stok ekranları %60 hazır." },
    { sender:"Mehmet", text:"Backend yolunda. Excel dışa aktarımı bugün eklendi. Tüm DB migration'ları temiz." },
    { sender:"Kemal",  text:"48/48 test geçiyor! Milestone 1 için QA onayı hazır." },
    { sender:"Leyla",  text:"Finans güncellemesi: Artisan ön ödemesi 7.200 Euro ✅. Horizon ön ödemesi 11.800 Euro bugün alındı ✅. Toplam Kasım geliri: 19.000 Euro." },
    { sender:"Berke",  text:"Olağanüstü. Tam olması gereken yerindeyiz. Horizon ön ödemesi son gün geldi ama zamanında." },
    { sender:"Ahmed",  text:"Horizon backend'i ilerliyor — güzergah yönetimi ve sürücü atama modülleri %40 hazır." },
    { sender:"Berke",  text:"Harika. Aralık planı: Artisan milestone 1 teslimatı, Horizon'u %60'a çekmek ve yeni ofis alanlarını gezmek." },
    { sender:"Sara",   text:"Aralık sonu yavaşlamasına da hazırlanmak lazım — müşteriler geç Aralık'ta daha az dönüt verir." },
    { sender:"Berke",  text:"İyi nokta. Aralık çalışmasını mümkün olduğunca öne çekelim." },
  ]},

  // ═══ ARALIK 2024 ═══════════════════════════════════════════════════════════

  { baseTs: 1733062800, msgs: [
    { sender:"Ahmed",  text:"Artisan milestone 1 dün, 30 Kasım'da tam zamanında teslim edildi! Kimlik doğrulama + ürün kataloğu + stok görünümleri." },
    { sender:"Kemal",  text:"QA onayı tamamlandı. Tüm kabul kriterleri karşılandı." },
    { sender:"Leyla",  text:"Fatura gönderildi: milestone 1 için 18.000 Euro. Son ödeme tarihi 20 Aralık." },
    { sender:"Berke",  text:"Tebrikler ekip! İlk büyük teslimat. Artisan'ın geri bildirimi harikaydı — ürün kataloğunu 'tam hayal ettiğimiz gibi' diye tanımladılar." },
    { sender:"Sara",   text:"Bu en güzel geri bildirim. Ceviz kahvesi tasarımı gerçekten güzel oldu." },
    { sender:"Mehmet", text:"Şimdi daha zor kısım — siparişler ve sipariş karşılama modülü. Daha karmaşık veri akışları var." },
    { sender:"Ahmed",  text:"Aralık sprinti: siparişler, ödeme entegrasyonu ve tedarikçi yönetimi. İddialı ama yapılabilir." },
    { sender:"Kemal",  text:"Yeni modüller için test planını bugün güncelleyeceğim." },
    { sender:"Leyla",  text:"Ayrıca — ofis gezisi planlandı. Boğaziçi İş Merkezi Perşembe 15'te, Maslak Tower Cuma 14'te." },
    { sender:"Berke",  text:"Mükemmel. Geziyi görmek isteyenler bekler." },
    { sender:"Ahmed",  text:"Maslak'a en azından geleceğim." },
  ]},

  { baseTs: 1733241600, msgs: [
    { sender:"Sara",   text:"Hızlı konu: bu yıl ekip Noel yemeği yapacak mıyız?" },
    { sender:"Kemal",  text:"Evet! Geçen yılki yemek harikaydı." },
    { sender:"Leyla",  text:"Bu sefer güzel bir restoran, güzel manzara istiyorum." },
    { sender:"Ahmed",  text:"Bebek'teki Sunset Terrace? Özel Aralık menüleri var." },
    { sender:"Mehmet", text:"Ben de aynı fikirdeyim. Harika yemek ve yakınında otopark var." },
    { sender:"Berke",  text:"Hadi yapalım. 19 Aralık Perşembe nasıl? O gün iş 15'te bitiyor." },
    { sender:"Sara",   text:"Tamam! Emre, senin için uygun mu?" },
    { sender:"Leyla",  text:"Emre özel mesajda evet dedi. Katılıyor." },
    { sender:"Berke",  text:"Mükemmel. Leyla rezervasyon yapar mısın? 7 kişilik masa, saat 19'da, 19 Aralık." },
    { sender:"Leyla",  text:"Hallederim! Ayrıca — yemek şirketten, bütçe 700 Euro." },
    { sender:"Ahmed",  text:"Çok cömert, teşekkürler Berke!" },
    { sender:"Kemal",  text:"Sabırsızlanıyorum!" },
  ]},

  { baseTs: 1733414400, msgs: [
    { sender:"Ahmed",  text:"Artisan ödeme entegrasyonunda teknik sorun var. Kullandıkları Türk ödeme altyapısının (PayTR) dökümantasyonu güncel değil." },
    { sender:"Mehmet", text:"PayTR ile daha önce çalıştım. 2023'te webhook formatı değişti ama dokümantasyon güncellenmedi. Yardım edebilirim." },
    { sender:"Ahmed",  text:"Harika olur. Sorun: callback imza doğrulaması başarısız oluyor." },
    { sender:"Mehmet", text:"Eski dökümanların söylediği MD5 değil, gizli anahtar HMAC-SHA256 olmalı. Yaygın hata." },
    { sender:"Ahmed",  text:"Şimdi deniyorum..." },
    { sender:"Ahmed",  text:"Düzeldi! Ödemeler çalışıyor. Teşekkürler Mehmet, bu bana saatler alırdı." },
    { sender:"Mehmet", text:"Yardımcı olmaktan memnunum. 2 yıl önce aynı sorunda tam bir gün harcamıştım." },
    { sender:"Kemal",  text:"Bunu iç bilgi tabanımıza eklesek olmaz mı, gelecekteki geliştiriciler aynı sorunla karşılamasın?" },
    { sender:"Berke",  text:"Kesinlikle. Kemal belgeler misin?" },
    { sender:"Kemal",  text:"Şu an yazıyorum." },
    { sender:"Berke",  text:"Güzel tespit ve güzel ekip çalışması. Bu grup sohbeti tam bunun için." },
  ]},

  { baseTs: 1733587200, msgs: [
    { sender:"Berke",  text:"Dün her iki ofisi de gezdim. Özet: Boğaziçi kurumsal hissettiriyor ve dar. Maslak Tower mükemmel — açık plan, harika doğal ışık, 220 metrekare." },
    { sender:"Ahmed",  text:"Maslak'taki doğal ışık gerçekten güzeldi." },
    { sender:"Leyla",  text:"Metro yakınlığı da ekip için çok daha iyi." },
    { sender:"Sara",   text:"Maslak'ta müşteri sunumları için cam duvarlı o büyük toplantı odası var." },
    { sender:"Kemal",  text:"Otopark durumu da çok daha iyi." },
    { sender:"Berke",  text:"Maslak'a yöneliyorum. Aylık 4.200 Euro ama değer. 2 yıllık sözleşme için indirim almak üzere bina yöneticisiyle pazarlık ediyorum." },
    { sender:"Mehmet", text:"4.000 Euro'ya çekebilir misin?" },
    { sender:"Berke",  text:"3.950 Euro hedefliyorum. 2 yıllık taahhüt karşılığında %6 indirim. Göreceğiz." },
    { sender:"Leyla",  text:"İmzalarsak Şubat'ın ilk veya ikinci haftasında taşınmamız gerekir. Proje açısından endişe var mı?" },
    { sender:"Ahmed",  text:"Hafta sonu olursa sorun olmaz." },
    { sender:"Berke",  text:"8-9 Şubat hafta sonu planlıyorum. Cumartesi nakliyat, Pazar masaları kurulum." },
  ]},

  { baseTs: 1733846400, msgs: [
    { sender:"Berke",  text:"Horizon proje orta nokta değerlendirme görüşmesi bugün 14'te. Yönetim kuruluna ilerleme güncellemesi istiyorlar." },
    { sender:"Ahmed",  text:"%45 tamamlandık. 2. ayın planlanmış %50'sinin biraz gerisindeyiz." },
    { sender:"Mehmet", text:"Kamyon takibi gerçek zamanlı sistemi beklenenden uzun sürdü — PostGIS öğrenme eğrisi benim için zordu." },
    { sender:"Berke",  text:"Dürüstçe söyle, ne kadar gerideyiz?" },
    { sender:"Mehmet", text:"Yaklaşık 1 hafta. Odaklı kalırsak Ocak'ta telafi edebiliriz." },
    { sender:"Ahmed",  text:"Horizon ile şeffaf olalım. Sürpriz yaşatmak yerine dürüstlüğü tercih ediyorlar." },
    { sender:"Berke",  text:"Kabul. Küçük gecikmeyi kabul edip gözden geçirilmiş milestone sunacağım: 24 Ocak yerine 31 Ocak." },
    { sender:"Sara",   text:"Dashboard tasarımları aslında takvimin önünde — bu görüntüye yardımcı olur." },
    { sender:"Leyla",  text:"Horizon görüşme güncellemesi: küçük gecikmeyi sorun etmediler. Genel ilerlemeyle ilgili memnunlar. 31 Ocak'a uzatılmış takvimi onayladılar." },
    { sender:"Berke",  text:"İyi. Beklenmedik durum yok — profesyonel bir ekip. 31 Ocak'ı kesinlikle tutturalım." },
    { sender:"Kemal",  text:"Ayarlanmış takvime QA'nın ayak uydurabileceğinden emin olmak için Mehmet ile sync olacağım." },
    { sender:"Mehmet", text:"Yarın sabah sync olalım." },
  ]},

  { baseTs: 1734091200, msgs: [
    { sender:"Sara",   text:"Öneri: tüm projelerde yeniden kullandığımız dahili bir tasarım sistemi oluşturalım. Yeni proje başına UI zamanından %30-40 tasarruf eder." },
    { sender:"Ahmed",  text:"Bu fikri seviyorum. Tüm ürünlerimizde tutarlı componentler." },
    { sender:"Berke",  text:"Uzun vadede mantıklı. Ne zaman yaparsın?" },
    { sender:"Sara",   text:"Artisan QA aşamasındayken Ocak'ta paralelde çalışabilirim. Düşük riskli zamanlama." },
    { sender:"Mehmet", text:"Framework kararı vermemiz lazım — React component kütüphanesi, dokümantasyon için Storybook?" },
    { sender:"Sara",   text:"Evet, React + Storybook. Tailwind tabanlı, üstüne özel componentler." },
    { sender:"Kemal",  text:"Görsel regresyon testi için Chromatic ekleyelim." },
    { sender:"Sara",   text:"Güzel fikir Kemal! Yanlışlıkla yapılan stil değişikliklerini yakalar." },
    { sender:"Berke",  text:"Bunu dahili yatırım projesi olarak onaylıyorum. Sara'nın sorumluluğunda. Müşteri faturalandırması yok, yalnızca dahili zaman." },
    { sender:"Ahmed",  text:"Haftada maksimum 2 gün gibi bir zaman sınırı koyalım mı?" },
    { sender:"Sara",   text:"Tamam. Ocak iyi zamanlama." },
  ]},

  { baseTs: 1734278400, msgs: [
    { sender:"Mehmet", text:"⚠️ Artisan staging sunucusu çöktü. Şu an araştırıyorum." },
    { sender:"Ahmed",  text:"Ben de görüyorum. Tüm API istekleri 502 döndürüyor." },
    { sender:"Kemal",  text:"Müşteri henüz fark etmedi ama 2 saat sonra görüşme var." },
    { sender:"Berke",  text:"Görüşmeden önce düzelt. Sebep ne?" },
    { sender:"Mehmet", text:"Disk dolmuş görünüyor. Log'lar çok ayrıntılıydı ve tüm diski doldurdu." },
    { sender:"Ahmed",  text:"Ah. Log rotasyonu yapılandırmak gerekiyor. Klasik sorun." },
    { sender:"Mehmet", text:"8 GB eski log'u temizledim. Sunucu yeniden geliyor." },
    { sender:"Berke",  text:"Ne kadar süredir çöküktü?" },
    { sender:"Mehmet", text:"Yaklaşık 40 dakika. Şu an log rotasyonu ve disk uyarıları ekliyorum." },
    { sender:"Kemal",  text:"Sunucu ayakta. Smoke test'leri çalıştırıyorum." },
    { sender:"Kemal",  text:"Her şey iyi. Ana akışlar çalışıyor." },
    { sender:"Berke",  text:"İyi kurtarma. Tekrar etmemesi için kısa bir olay raporu yaz." },
    { sender:"Mehmet", text:"Yazıyorum. Ayrıca %70 ve %90 disk kullanım uyarıları kuruyorum." },
  ]},

  { baseTs: 1734520800, msgs: [
    { sender:"Berke",  text:"Tatillerden önceki son tam çalışma haftası. 20 Aralık'a kadar yapabildiğimiz her şeyi teslim edelim." },
    { sender:"Ahmed",  text:"Artisan siparişler modülü bitti ve test edildi. PayTR fiksinden sonra ödeme entegrasyonu stabil." },
    { sender:"Leyla",  text:"Harika! Artisan'a milestone 1 için 18.000 Euro bugün fatura kesiyorum — son tarih 20 Aralık." },
    { sender:"Sara",   text:"Bekle, bunu daha önce faturalandırmıştık?" },
    { sender:"Leyla",  text:"Özür dilerim, yanlış anlattım. Fatura daha önce gönderilmişti. Bugün son tarih yaklaştığı için ödeme hatırlatması gönderiyorum." },
    { sender:"Ahmed",  text:"Horizon için: canlı kamyon takibi çalışıyor. Sahte GPS verisiyle test ettik. Çok etkileyici görünüyor." },
    { sender:"Berke",  text:"Yarın ekibe hızlı bir demo yapabilir misin?" },
    { sender:"Ahmed",  text:"Kesinlikle. Yarın 11'de, 15 dakika." },
    { sender:"Mehmet", text:"Sabırsızlanıyorum!" },
    { sender:"Kemal",  text:"Artisan siparişlerinde son regresyonu çalıştırıyorum. Bu gece bitirmeli." },
  ]},

  { baseTs: 1734700800, msgs: [
    { sender:"Leyla",  text:"🎉 Artisan milestone 1 için 18.000 Euro ödedi! Para hesaba girdi." },
    { sender:"Berke",  text:"Mükemmel! Aralık güçlü geçiyor. Toplam şimdiye kadar: 19.000 (Kasım) + 18.000 (Aralık) = 37.000 Euro." },
    { sender:"Ahmed",  text:"Üstelik iki projede 54.000 + 106.200 Euro daha kalmış. Güçlü pipeline." },
    { sender:"Sara",   text:"Bu yıl ne kadar büyüdüğümüze inanamıyorum. Heyecanlı!" },
    { sender:"Kemal",  text:"Hatırlatma: şirket Noel yemeği bu akşam saat 19'da Sunset Terrace Bebek!" },
    { sender:"Mehmet", text:"Sabırsızlanıyorum! Trafiğe takılmamak için 17'de çıkıyorum ofisten." },
    { sender:"Berke",  text:"Herkes bugün 16'da işi bırakın. Yemek şirketten — hepinizi 19'da görüyorum!" },
    { sender:"Leyla",  text:"Ayrıca: dışarıda kalma mesajları ayarlandı. Ofis 24 Aralık - 1 Ocak arası kapalı." },
  ]},

  { baseTs: 1734966000, msgs: [
    { sender:"Berke",  text:"Ekip — inanılmaz bir 2024 için teşekkürler. İki büyük proje başlattık, ilk iki ayda 37.000 Euro kazandık ve gurur duyduğum bir ekip kurdum. Hepinize mutlu Noeller! 🎄" },
    { sender:"Ahmed",  text:"Mutlu Noeller Berke ve herkese! Ne yıldı." },
    { sender:"Leyla",  text:"Mutlu Noeller! Molayı keyifle geçirin — hepiniz hak ettiniz." },
    { sender:"Mehmet", text:"Mutlu Noeller ekip! 🎄" },
    { sender:"Sara",   text:"Herkese iyi tatiller! 2025'te görüşürüz 🥂" },
    { sender:"Kemal",  text:"Mutlu Noeller! Dinlenin, Ocak yoğun geçecek!" },
    { sender:"Berke",  text:"Tatil yemeklerinin tadını çıkarın 😄 2 Ocak'a kadar iş mesajı yok." },
  ]},

  // ═══ OCAK 2025 ════════════════════════════════════════════════════════════

  { baseTs: 1735635600, msgs: [
    { sender:"Berke",  text:"İyi Yıllar ekip! 2025 — hadi gidelim 🚀" },
    { sender:"Ahmed",  text:"İyi Yıllar! Güçlü bitirmeye hazırım." },
    { sender:"Leyla",  text:"İyi Yıllar herkese! 🥂" },
    { sender:"Mehmet", text:"İyi 2025! Horizon'ın mimari iyileştirmelerini düşünmeye başladım bile." },
    { sender:"Sara",   text:"İyi Yıllar! Tasarım sistemi çalışması için heyecanlıyım." },
    { sender:"Kemal",  text:"İyi Yıllar herkese!" },
    { sender:"Berke",  text:"2 Ocak'ta işe dönüş. 3 Ocak 10'da sprint planlama toplantısı. Geç kalmayın 😄" },
  ]},

  { baseTs: 1735896000, msgs: [
    { sender:"Berke",  text:"Ocak sprint planlaması. İki ana hedef: Artisan'ı 31 Ocak'a kadar bitirmek ve Horizon 31 Ocak milestone'ına ulaşmak." },
    { sender:"Ahmed",  text:"Artisan'da kalan iş: tedarikçi yönetimi modülü ve raporlama dashboard'u." },
    { sender:"Mehmet", text:"Horizon'da kalan: güzergah optimizasyonu, raporlama ve mobil API katmanı." },
    { sender:"Sara",   text:"Artisan tedarikçi UI'sı ve Horizon mobil ekranları üzerimde. Paralelde tasarım sistemini başlatıyorum." },
    { sender:"Kemal",  text:"QA yoğun olacak. Ay sonuna kadar iki proje için tam regresyon döngüsü." },
    { sender:"Leyla",  text:"Finans notu: Artisan milestone 2 faturası (18.000 Euro) 31 Ocak teslimatında çıkıyor. Horizon milestone 2 de 31 Ocak, 23.600 Euro." },
    { sender:"Berke",  text:"Yani teslim edersek Ocak'ta 41.600 Euro. Çok motive edici." },
    { sender:"Ahmed",  text:"Hafta hafta planlayalım. 1. hafta: devam eden tüm özellikleri bitir. 2. hafta: entegrasyon testi. 3. hafta: bug düzeltme. 4. hafta: son inceleme ve teslimat." },
    { sender:"Mehmet", text:"Sıkı ama ulaşılabilir bir plan." },
    { sender:"Berke",  text:"Şu an dile getirmemiz gereken risk ya da endişe var mı?" },
    { sender:"Sara",   text:"Artisan tedarikçi modülü tasarımlarını henüz onaylamadı. Bugün takip edeceğim." },
    { sender:"Ahmed",  text:"Horizon mobil API katmanı sıfırdan başlıyor. En riskli kalem bu." },
    { sender:"Berke",  text:"Mehmet ve Ahmed, Pazartesi'den itibaren Horizon mobil API'de birlikte çalışın." },
    { sender:"Mehmet", text:"Anlaşıldı. Bu hafta bitiririz." },
  ]},

  { baseTs: 1736244000, msgs: [
    { sender:"Berke",  text:"Büyük haber: Maslak Tower ofis anlaşması kapandı! Aylık 3.960 Euro ile 2 yıllık sözleşme. Taşınma 8-9 Şubat." },
    { sender:"Ahmed",  text:"Harika pazarlık! Talep fiyatının 240 Euro altında." },
    { sender:"Leyla",  text:"Sözleşme boyunca 2.880 Euro tasarruf. Fena değil!" },
    { sender:"Sara",   text:"Çok heyecanlı. Taşınmadan önce ekip turu yapabilir miyiz?" },
    { sender:"Berke",  text:"Evet, 25 Ocak için ekip ziyareti planlıyorum. Masa düzenini birlikte planlayabiliriz." },
    { sender:"Kemal",  text:"Yeni mobilya almamız gerekecek mi?" },
    { sender:"Leyla",  text:"Birkaç yeni masa ve sandalye — mevcutlar yıpranmış. Mobilya için yaklaşık 8.000 Euro bütçe." },
    { sender:"Berke",  text:"Makul. İyi bir ofis yatırımı. Leyla ofis mobilyası tedarikçilerini araştırabilir misin?" },
    { sender:"Leyla",  text:"Zaten bakıyorum. Ikea Business ve birkaç yerli tedarikçiyi kontrol ediyorum." },
  ]},

  { baseTs: 1736424000, msgs: [
    { sender:"Sara",   text:"Harika haber — Artisan bu sabah tedarikçi modülü tasarımlarını onayladı! Geliştirmeye yeşil ışık." },
    { sender:"Ahmed",  text:"Mükemmel zamanlama. Öğleden sonra backend'e başlıyorum." },
    { sender:"Mehmet", text:"Horizon mobil API katmanı hızlı ilerleme kaydediyor — dün Ahmed ile sağlam bir temel attık." },
    { sender:"Kemal",  text:"Artisan için test ilerleme: 78/95 yeni test geçiyor. 17 başarısız sipariş-tedarikçi akışında." },
    { sender:"Ahmed",  text:"O başarısızlıklar bekleniyor — tedarikçi modülü henüz tam bağlanmadı. Endpoint'leri bitirince geçecek." },
    { sender:"Kemal",  text:"Anlaşıldı. Bilgi verdim ama blocker değil." },
    { sender:"Berke",  text:"İyi momentum. Devam edin." },
    { sender:"Sara",   text:"Tasarım sistemi component sayısı: Button, Input, Select, Modal, Table, Badge, Avatar, Sidebar, Topbar = 9 component hazır." },
    { sender:"Mehmet", text:"Bu zaten kullanışlı. Horizon'ın frontend'ini buna migrate etmeliyiz." },
    { sender:"Sara",   text:"Plan bu zaten — faz 2'de migration kılavuzu dahil." },
  ]},

  { baseTs: 1736856000, msgs: [
    { sender:"Berke",  text:"Horizon haftalık görüşmesi bugün — yönetim kuruluna canlı takip demosunu göstermek istiyorlar." },
    { sender:"Ahmed",  text:"Demo hazır. Soru-cevap dahil 15 dakika." },
    { sender:"Leyla",  text:"Hızlı finans güncellemesi: Artisan Aralık faturasını hâlâ ödemedi. Bugün ikinci hatırlatmayı gönderiyorum." },
    { sender:"Berke",  text:"Son tarihi 20 Aralık'tı — şu an 14 Ocak. Gecikmiş. 17 Ocak'a kadar ödeme gelmezse doğrudan arayacağım." },
    { sender:"Ahmed",  text:"Horizon görüşmesi harikaydı! Yönetim kurulu canlı takip demosunu çok beğendi. CTO 'sınıfının en iyisi' dedi." },
    { sender:"Berke",  text:"Bu tür geri bildirimler referansa yol açar. Ahmed ve Mehmet'e harika implementasyon için tebrikler." },
    { sender:"Mehmet", text:"PostGIS çalışması sonunda meyvesini verdi. Tereyağı gibi akıyor." },
    { sender:"Kemal",  text:"Bir şey daha: Artisan API'sinde güvenlik açığı bulduk — sipariş endpoint'leri sahiplik kontrolü yapmıyor. 30 dakikada düzeltildi ama güvenlik denetimi yapmalıyız." },
    { sender:"Berke",  text:"İyi tespit Kemal! Evet, önümüzdeki hafta tam güvenlik denetimi yapalım. Sprint'e ekle." },
    { sender:"Ahmed",  text:"Güvenlik incelemesini ben yönetirim. OWASP top 10 kontrol listesi temelleri kapsar." },
  ]},

  { baseTs: 1737036600, msgs: [
    { sender:"Leyla",  text:"Artisan Aralık faturasını ödedi — 18.000 Euro alındı! 27 gün gecikti ama geldi." },
    { sender:"Berke",  text:"Sonunda. Bu sabah finans direktörleriyle konuştum, iç onay gecikmesi olduğu için özür dilediler." },
    { sender:"Ahmed",  text:"Geldi güzel. Ama gelecek faturalara gecikme faizi şartı ekleyelim." },
    { sender:"Leyla",  text:"Katılıyorum. Vadesi geçmiş faturalar için standart ay başına %2. Fatura şablonumuzu güncelliyorum." },
    { sender:"Berke",  text:"Artisan ile ödeme süreci hakkında da konuşmak gerekiyor. 27 gün bekleyemeyiz." },
    { sender:"Sara",   text:"Farklı bir konu — Artisan ürün kataloğu hakkında övgü maili gönderdi. Satış ekipleri kullanıyor ve 'dönüştürücü' diyorlar." },
    { sender:"Berke",  text:"Harika duymak güzel. Kaliteli teslimatlar ödeme gecikmesinden en iyi koruma." },
  ]},

  { baseTs: 1737208800, msgs: [
    { sender:"Berke",  text:"31 Ocak'a 13 gün kaldı. Teslimatlar nerede?" },
    { sender:"Ahmed",  text:"Artisan: tedarikçi modülü %85 hazır. Raporlama dashboard'u %60 hazır. Yolundayız." },
    { sender:"Mehmet", text:"Horizon: güzergah optimizasyonu %70, raporlama %50, mobil API %90 hazır. Sıkışık ama olası." },
    { sender:"Kemal",  text:"Artisan QA iyi durumda. Horizon QA önümüzdeki hafta başlaması lazım." },
    { sender:"Sara",   text:"Her iki projenin tüm UI tasarımları bitti. Geliştirme tamamlanınca son inceleme yapabilirim." },
    { sender:"Berke",  text:"Bu hafta ve önümüzdeki herkes tam sprint modunda. Teslimattan sonra Şubat'ta biraz daha rahat olabiliriz." },
    { sender:"Leyla",  text:"Ofis mobilyası siparişi verildi — 28 Ocak teslimi, 8 Şubat taşınmaya hazır olur." },
    { sender:"Ahmed",  text:"Ayrıca — OWASP güvenlik denetimini tamamladım. 2 orta bulguda, 0 kritik bulguda. İkisi de düzeltildi." },
    { sender:"Kemal",  text:"Her iki müşteri için güvenlik denetim raporu yazıyorum. Teslim dokümanlarına iyi eklenti." },
  ]},

  { baseTs: 1737384000, msgs: [
    { sender:"Ahmed",  text:"Cumartesi birkaç saat çalıştım — Artisan raporlama dashboard'u bitti! 15 grafik, tamamı gerçek veriye bağlı." },
    { sender:"Mehmet", text:"Ben de — Horizon güzergah optimizasyonu tamamlandı. Testler geçiyor." },
    { sender:"Berke",  text:"Hafta sonu çalışmak zorunda değildiniz ama vay be, bu adanmışlık. Teşekkürler." },
    { sender:"Sara",   text:"Raporlama grafikleri harika Ahmed — interaktif yapman çok güzel." },
    { sender:"Kemal",  text:"Artisan tedarikçi modülü %100 hazır ve merge edildi. Tam regresyon geçiyor." },
    { sender:"Ahmed",  text:"Artisan tedarikçi modülü bitti ve birleştirildi. Tam regresyon geçiyor." },
    { sender:"Berke",  text:"31 Ocak yerine 29'da erken teslim edebilir miyiz?" },
    { sender:"Mehmet", text:"Horizon için 31'e ihtiyacım var. Mobil API'nin biraz cilalanması lazım." },
    { sender:"Ahmed",  text:"Artisan'ı 28'inde teslim edebilirim. Onları sürpriz yapalım." },
  ]},

  { baseTs: 1737720000, msgs: [
    { sender:"Kemal",  text:"Artisan tam QA tamamlandı: 127 test, hepsi geçiyor. Güvenlik denetimi tamam. Teslime hazır." },
    { sender:"Ahmed",  text:"Artisan prodüksiyon deployment tamamlandı. Her şey canlı ve stabil." },
    { sender:"Berke",  text:"İnanılmaz. Artisan'ı 3 gün erken teslim ediyoruz. Bu çok güven oluşturacak." },
    { sender:"Leyla",  text:"Bugün fatura gidiyor: Artisan milestone 2 — 18.000 Euro. Son tarih 15 Şubat." },
    { sender:"Sara",   text:"Artisan müşterisi beni aradı, tedarikçi modülünden çok etkilendiklerini söyledi. Mobil uygulama geliştirme yapıp yapmadığımızı sordular 👀" },
    { sender:"Berke",  text:"Artık yapıyoruz 😄 Pazartesi olası faz 2 hakkında takip edeceğim." },
    { sender:"Mehmet", text:"Horizon son sprinti: güzergah optimizasyonu bitti, raporlama bitti, mobil API son testi yapılıyor." },
    { sender:"Kemal",  text:"Horizon QA'ya bugün başlıyorum. 180 test case'in tamamını çalıştırıyorum." },
  ]},

  { baseTs: 1737892800, msgs: [
    { sender:"Mehmet", text:"Horizon tamamlandı! Mobil API, raporlama, güzergah optimizasyonu — hepsi test edildi ve deploy edildi." },
    { sender:"Kemal",  text:"Horizon QA geçti! 180/180 test. Blocker sorun yok." },
    { sender:"Berke",  text:"Her iki proje de teslim edildi! Artisan 28 Ocak, Horizon 28 Ocak. Olağanüstü iş." },
    { sender:"Leyla",  text:"Bugün Horizon milestone 2 faturalanıyor: 23.600 Euro. Son tarih 20 Şubat." },
    { sender:"Ahmed",  text:"Ocak'ta toplam fatura: planlanan 41.600 Euro. Yıl harika başladı." },
    { sender:"Sara",   text:"Artisan zaten mobil uygulama sordu. Horizon CTO'su da sürücü mobil uygulaması istediklerinden bahsetti." },
    { sender:"Berke",  text:"Her ikisi de faz 2 projesi olabilir. Önümüzdeki hafta kapsam görüşmeleri planlıyorum." },
    { sender:"Mehmet", text:"React Native her ikisi için de verimli olur — mümkün olduğunca paylaşılan kod." },
    { sender:"Kemal",  text:"Bu sprintte iyi ve kötü ne vardı? Hızlı bir retrospektif?" },
    { sender:"Berke",  text:"İyi fikir. Çarşamba 30 dakika — retrospektif, fazlası değil." },
  ]},

  // ═══ ŞUBAT 2025 ══════════════════════════════════════════════════════════

  { baseTs: 1738368000, msgs: [
    { sender:"Berke",  text:"Şubat kick-off'u. Ana öncelikler: ofis taşıması, her iki müşteri için faz 2 kapsamı ve onaylanan yeni işlerin başlatılması." },
    { sender:"Ahmed",  text:"Geçen sprint retrospektif eylem kalemleri de var — onları gözden geçirelim." },
    { sender:"Leyla",  text:"Finans güncellemesi: bekleyen faturalar Artisan 18.000 Euro (son tarih 15 Şubat) ve Horizon 23.600 Euro (son tarih 20 Şubat). Beklenen toplam: 41.600 Euro." },
    { sender:"Berke",  text:"Bu ay faz 2 projelerini kapsamlandırırken kapasitemiz var. İç araçlar ve tasarım sistemi için iyi zaman." },
    { sender:"Sara",   text:"Tasarım sistemi şu an 15 component. Bu hafta dokümantasyonu yazıyorum." },
    { sender:"Mehmet", text:"Retrospektiften teknik borç listesi: 1. API rate limiting ekle, 2. Hata mesajlarını iyileştir, 3. Staging-prodüksiyon deploy pipeline'ı kur." },
    { sender:"Kemal",  text:"Deploy pipeline'ını ben üstleniyorum. Bu sürtüşmeye yol açıyordu." },
    { sender:"Ahmed",  text:"Rate limiting ve hata mesajlarını alıyorum — her ikisi de yarım günlük iş." },
    { sender:"Berke",  text:"Mükemmel. Artisan ve Horizon ile faz 2 kapsam görüşmeleri önümüzdeki hafta planlandı." },
  ]},

  { baseTs: 1738540800, msgs: [
    { sender:"Ahmed",  text:"Retrospektif eylem kalemleri tamamlandı: rate limiting eklendi, hata mesajları iyileştirildi. Toplam 4 saat." },
    { sender:"Kemal",  text:"Deploy pipeline kuruldu! Main'e push → 3 dakikada otomatik staging deploy. Prodüksiyon deploy CI'da tek tıklama." },
    { sender:"Berke",  text:"Bu deploy pipeline'ı haftada saatler kazandıracak. İyi iş Kemal." },
    { sender:"Sara",   text:"Tasarım sistemi dokümantasyonu bitti! Storybook linkini drive'a paylaştım. 15 component tam belgelenmiş." },
    { sender:"Mehmet", text:"Prototipte Button ve Input componentlerini kullanıyorum. Sıfırdan yazmaktan belirgin şekilde daha hızlı." },
    { sender:"Berke",  text:"Artisan faz 2 görüşmesi tamamlandı! İstiyorlar: iOS/Android mobil uygulama, müşteri self-servis portalı, gelişmiş analitik. Tahmini bütçe: 65.000 Euro." },
    { sender:"Ahmed",  text:"Bu büyük bir faz 2! En az 6 aylık proje." },
    { sender:"Leyla",  text:"Teklif göndermeli miyim?" },
    { sender:"Berke",  text:"Evet, bugün taslak yapıyorum. 14 Şubat'a kadar teklif istiyorlar." },
  ]},

  { baseTs: 1738756800, msgs: [
    { sender:"Leyla",  text:"Artisan milestone 2'yi ödedi — 18.000 Euro alındı! Geçen seferden 10 gün erken. Büyük iyileşme." },
    { sender:"Berke",  text:"Gecikme konuşması işe yaradı. Harika haber." },
    { sender:"Ahmed",  text:"Horizon faz 2 kapsam görüşmesi ilginçti — sürücü mobil uygulaması, müşteri takip portalı ve analitik dashboard istiyorlar. Bütçe: 95.000 Euro." },
    { sender:"Berke",  text:"95 bin Euro! Bugüne kadarki en büyük tek proje kapsamımız." },
    { sender:"Mehmet", text:"Her iki faz 2 projesini de alırsak insan gücüne ihtiyaç var. Mevcut ekiple 6 aylık 95 bin Euro projesi çok zorlar." },
    { sender:"Berke",  text:"Katılıyorum. Her iki faz 2'yi alırsak 2 geliştirici daha almamız gerekiyor. Leyla işe alım sürecini başlatabilir misin?" },
    { sender:"Leyla",  text:"Hemen. LinkedIn, Kariyer.net ve İşKur'a ilan versem mi?" },
    { sender:"Berke",  text:"Evet, üçüne de. 3+ yıl deneyimli mid-level full-stack geliştiriciler." },
    { sender:"Sara",   text:"Heyecan verici zamanlar! Büyümenin acıları iyi acılardır." },
    { sender:"Kemal",  text:"Daha fazla geliştirici demek QA sürecini de ölçeklendirmem gerekiyor. Yeni işe alımlar için test framework'lerini belgelemeye başlıyorum." },
  ]},

  { baseTs: 1738944000, msgs: [
    { sender:"Sara",   text:"Yarın Sevgililer Günü 💕 Herkese iyi tatiller 😊" },
    { sender:"Ahmed",  text:"Ah, yarın 14 Şubat. Özellik geliştirirken zaman uçuyor." },
    { sender:"Kemal",  text:"Planların ne Mehmet? 😄" },
    { sender:"Mehmet", text:"Eşimi Karaköy'de akşam yemeğine götürüyorum. Sen?" },
    { sender:"Kemal",  text:"Aynı fikir. Cihangir'de yeni bir yer keşfettim." },
    { sender:"Sara",   text:"Hepiniz ne kadar romantiksiniz 😊 Ben arkadaşlarımla gidiyorum." },
    { sender:"Berke",  text:"İsteyenler yarın öğleden sonra izin alabilir. Çalışmalar takvimin önünde." },
    { sender:"Ahmed",  text:"Takdir edildi Berke, teşekkürler!" },
    { sender:"Leyla",  text:"Çok nazik, teşekkürler!" },
  ]},

  { baseTs: 1739196000, msgs: [
    { sender:"Berke",  text:"8-9 Şubat hafta sonu taşınma harika geçti! Yeni ofis inanılmaz." },
    { sender:"Ahmed",  text:"Gerçekten öyle. 14. kattaki manzara muhteşem." },
    { sender:"Sara",   text:"Buradaki ışığı seviyorum. Çok daha verimli hissettiriyor." },
    { sender:"Kemal",  text:"Ayrı toplantı odası müşteri görüşmeleri için çok işe yarayacak." },
    { sender:"Mehmet", text:"Yükseklik ayarlı masalar da büyük fark yaratıyor. Bunlar için ısrar ettiğin için teşekkürler Berke." },
    { sender:"Leyla",  text:"Mobilya maliyeti 7.800 Euro geldi — 8.000 Euro bütçenin biraz altında." },
    { sender:"Berke",  text:"Mükemmel. Şimdi yerleştik, Artisan ve Horizon tekliflerine odaklanalım." },
  ]},

  { baseTs: 1739372400, msgs: [
    { sender:"Berke",  text:"Her iki faz 2 teklifi bugün gönderildi. Artisan 65 bin Euro, Horizon 95 bin Euro. Toplam potansiyel: 160.000 Euro." },
    { sender:"Ahmed",  text:"Her ikisini alırsak bu önemli bir ekip genişlemesini karşılar." },
    { sender:"Leyla",  text:"Horizon da milestone 2 faturasını ödedi — 23.600 Euro tam zamanında alındı!" },
    { sender:"Berke",  text:"Şubat çok güçlü görünüyor. Bu ay toplam gelir: 41.600 Euro. Bekleyen teklifler: 160.000 Euro." },
    { sender:"Mehmet", text:"Tekliflerin yanıtı ne kadar sürer?" },
    { sender:"Berke",  text:"Artisan 1 hafta dedi. Horizon 2 hafta — 50 bin Euro üstü her şey için yönetim kurulu onayı gerekiyor." },
    { sender:"Sara",   text:"Parmaklar çapraz! Horizon mobil uygulama tasarımını yapmak istiyorum." },
    { sender:"Kemal",  text:"Büyük ölçekte otomatik test konusunda sessizce heyecanlıyım. Daha fazla proje = daha ilginç QA zorlukları." },
  ]},

  { baseTs: 1739548800, msgs: [
    { sender:"Mehmet", text:"🚨 Artisan'da prodüksiyon sorunu. 10 MB üzeri dosyalarda toplu sipariş import başarısız oluyor." },
    { sender:"Ahmed",  text:"Hallederim. Hata ne?" },
    { sender:"Mehmet", text:"30 saniyede request timeout. Dosya parse işlemi senkron ve event loop'u bloke ediyor." },
    { sender:"Ahmed",  text:"Klasik. Background job queue'ya taşınması gerekiyor. 2 saatte düzeltebilirim." },
    { sender:"Mehmet", text:"Müşteri haberdar. Gün sonuna kadar düzeltme olacağını söyledim." },
    { sender:"Berke",  text:"Bilgi verin. Şimdilik geçici çözüm var mı?" },
    { sender:"Ahmed",  text:"Evet — dosyayı 10 MB'den küçük parçalara bölsünler. Müşteriye söyleyeceğim." },
    { sender:"Kemal",  text:"Bu test case'lerde olmalıydı. Benim hatam — standart süitimize büyük dosya testleri ekliyorum." },
    { sender:"Ahmed",  text:"Fix deploy edildi. Bull kullanarak background job queue. Artık dosya boyutundan bağımsız timeout yok." },
    { sender:"Mehmet", text:"Müşteri çalıştığını doğruladı. 45 MB dosyayı başarıyla import ettiler." },
    { sender:"Berke",  text:"Güzel kurtarma. Bu şeyler olur. Önemli olan hızlı çözüm." },
  ]},

  { baseTs: 1739880000, msgs: [
    { sender:"Leyla",  text:"8 günde 47 iş başvurusu aldık! LinkedIn en iyi performans gösteriyor — 35 başvurucu oradan geldi." },
    { sender:"Berke",  text:"İyi yanıt. Leyla lütfen ilk elemeyi yap ve en iyi 10'u bana gönder." },
    { sender:"Ahmed",  text:"Görüşmelerde ne arıyoruz? Teknik test?" },
    { sender:"Berke",  text:"Evet — 4 saatlik ev ödevi testi. Auth içeren basit bir REST API yap. Ardından 1 saatlik teknik görüşme." },
    { sender:"Mehmet", text:"Teknik testi ben tasarlıyorum. Algoritma bulmacaları değil, gerçek dünya senaryosu." },
    { sender:"Sara",   text:"İletişim becerilerini de değerlendirmeli miyiz? Müşteriye dönük çalışmalar için önemli." },
    { sender:"Berke",  text:"Evet, kısa bir kültür uyumu görüşmesi ekle. Benimle 20 dakika." },
    { sender:"Leyla",  text:"Hedef: 31 Mart'a kadar 2 yeni işe alım, faz 2 projeleri başlamadan önce onboarding bitsin." },
    { sender:"Ahmed",  text:"Sıkışık ama yapılabilir. Yeni işe alımları mentörlük yapmaya hazırım." },
  ]},

  { baseTs: 1740124800, msgs: [
    { sender:"Berke",  text:"🎉 Artisan faz 2'yi kabul etti! 65.000 Euro, kickoff 10 Mart. Sözleşme taslaklanıyor." },
    { sender:"Ahmed",  text:"İnanılmaz haber!! Mobil uygulama + self-servis portal + analitik." },
    { sender:"Sara",   text:"Evet!! Mobil uygulamayı tasarlamak için sabırsızlanıyorum." },
    { sender:"Kemal",  text:"Tebrikler ekip! Faz 1'deki kaliteyle bunu hak ettik." },
    { sender:"Mehmet", text:"Horizon faz 2'yi hâlâ bekliyoruz?" },
    { sender:"Berke",  text:"Evet, yönetim kurulları 28 Şubat'ta toplanıyor. 3 Mart'a kadar haber geliriz." },
    { sender:"Leyla",  text:"Artisan sözleşmesi %15 ön ödeme gerektiriyor: imzada 9.750 Euro." },
    { sender:"Ahmed",  text:"Faz 2 zamanlaması güzel — önce faz 1'de kalan noktaları kapatmamıza izin veriyor." },
    { sender:"Sara",   text:"Kickoff beklerken mobil uygulama için ön tasarım araştırması yapmaya başlıyorum." },
  ]},

  { baseTs: 1740355200, msgs: [
    { sender:"Berke",  text:"Şubat sonu kontrol. Her şey ne durumda?" },
    { sender:"Ahmed",  text:"Her iki faz 1 projesi teslim edildi ve ödendi. Bekleyen sorun yok." },
    { sender:"Mehmet", text:"Teknik borç temizlendi. Deploy pipeline sorunsuz çalışıyor." },
    { sender:"Sara",   text:"Tasarım sistemi 18 component'te. Artisan faz 2 için mobil ön çalışmaya başladım." },
    { sender:"Kemal",  text:"QA dokümantasyonu yazıldı ve yeni ekip üyeleri için hazır." },
    { sender:"Leyla",  text:"Finans özeti: Şubat geliri 41.600 Euro. Yıl başından bu yana toplam: 96.600 Euro. 250 bin Euro+ yıl için yolundayız." },
    { sender:"Berke",  text:"Benim beklentilerimi aştı. İlk 4 ayda inanılmaz iş." },
    { sender:"Ahmed",  text:"Hâlâ Horizon faz 2 bekleniyor. Güncellemen var mı?" },
    { sender:"Berke",  text:"Yönetim kurulu toplantısı Cuma. Hafta sonuna kadar biliriz." },
    { sender:"Leyla",  text:"Ayrıca: geliştirici pozisyonları için 8 aday listeye alındı. Görüşmeler önümüzdeki hafta." },
    { sender:"Berke",  text:"Horizon faz 2 gelirse mükemmel zamanlama." },
  ]},

  // ═══ MART 2025 ═══════════════════════════════════════════════════════════

  { baseTs: 1740787200, msgs: [
    { sender:"Berke",  text:"Horizon faz 2 onaylandı! Yönetim kurulu kabul etti. 95.000 Euro, kickoff 17 Mart. Sözleşme imza için gönderildi." },
    { sender:"Ahmed",  text:"Bir haftada 160.000 Euro yeni sözleşme. İnanılmaz." },
    { sender:"Sara",   text:"O zaman ek işe alım ASAP gerekiyor." },
    { sender:"Mehmet", text:"Katılıyorum. Bu ölçekteki iki eş zamanlı proje daha fazla el gerektirir." },
    { sender:"Leyla",  text:"Artisan ön ödemesi 9.750 Euro bugün alındı! Horizon imzada 14.250 Euro gönderecek." },
    { sender:"Berke",  text:"Bu hafta en iyi 2 adaya teklif gönderiliyor. 24 Mart'ta başlamalarını istiyorum." },
    { sender:"Kemal",  text:"Onboarding materyallerini hazırlıyorum — geliştirici ortamı kurulum dokümanları, kod tabanı turu vb." },
    { sender:"Ahmed",  text:"İlk günlerinde atayabilmem için 23 Mart'a kadar ilk görevlerini hazırlayacağım." },
    { sender:"Sara",   text:"Tasarım sistemi tanıtım oturumu yapacağım. 1 saat yeterli." },
  ]},

  { baseTs: 1740960000, msgs: [
    { sender:"Leyla",  text:"Bugün arka arkaya iki görüşme. Emir ve Zeynep. CV incelemesinden çok umut verici gözüktüler." },
    { sender:"Ahmed",  text:"Teknik görüşmeleri ben yaptım. Emir güçlü — temiz kod, iyi mimari içgüdüsü. Zeynep daha junior ama çok keskin." },
    { sender:"Mehmet", text:"Zeynep'in ev ödevi testi aslında harikaydı. Kodu Emir'inkinden daha iyi yapılandırılmıştı." },
    { sender:"Berke",  text:"İlginç. İkisine de teklif verelim — zaten 2 işe alım yapmamız lazım." },
    { sender:"Sara",   text:"Kültür uyumu görüşmesini ben yaptım. Her ikisi de harika ekip arkadaşları olur." },
    { sender:"Kemal",  text:"Maaş beklentileri ne?" },
    { sender:"Leyla",  text:"Emir: aylık 2.800 Euro. Zeynep: aylık 2.400 Euro. Ek bordro: 5.200 Euro/ay." },
    { sender:"Berke",  text:"Yeni sözleşmelerle karşılayabiliriz. Teklifler bugün gönderiliyor." },
    { sender:"Ahmed",  text:"Daha fazla insan olması için heyecanlıyım. Ekip gerçekten ürünün ta kendisi." },
  ]},

  { baseTs: 1741244400, msgs: [
    { sender:"Leyla",  text:"Hem Emir hem Zeynep kabul etti! 24 Mart'ta başlıyorlar. 🎉" },
    { sender:"Berke",  text:"Harika! Ekip Emre ile birlikte 9 kişiye ulaşıyor. Hedefe yaklaştık." },
    { sender:"Sara",   text:"Onboarding hazırlığına bugün başlıyorum — tasarım sistemi erişimi, marka rehberleri, proje bağlamı dokümanları." },
    { sender:"Mehmet", text:"Bu hafta geliştirici ortamlarını ve GitHub erişimlerini kuruyorum." },
    { sender:"Kemal",  text:"Onboarding kontrol listesini güncelledim. 24 maddelik liste: donanım kurulumu, hesaplar, repo erişimi, ilk görev." },
    { sender:"Ahmed",  text:"23 Mart'a kadar ilk görevleri hazır olacak, 1. günde atayabiliriz." },
    { sender:"Berke",  text:"İlk haftalarını harika yapalım. İlk izlenimler önemlidir." },
  ]},

  { baseTs: 1741428000, msgs: [
    { sender:"Ahmed",  text:"Artisan faz 2 kickoff 10 Mart. İki gün kaldı. Teknik kararlar: mobil için React Native, evet mi?" },
    { sender:"Mehmet", text:"Evet, React Native. Web uygulamasıyla paylaşılan logic sayesinde daha hızlı geliştirme." },
    { sender:"Sara",   text:"Mobil uygulama Figma tasarımları zaten %40 hazır. Önceden çalışıyordum." },
    { sender:"Berke",  text:"Sara'nın inisiyatifi her zaman etkileyici." },
    { sender:"Kemal",  text:"Mobil test stratejisi: E2E için Detox, unit için Jest. Kurulum bende." },
    { sender:"Ahmed",  text:"Self-servis portal mevcut platformun subdomaini olacak. Aynı auth sistemi." },
    { sender:"Mehmet", text:"Analitik dashboard — grafik kütüphanesi mi kullanıyoruz yoksa özel mi?" },
    { sender:"Sara",   text:"Recharts kullandık Meridian'da. Güzel görünüyor ve temiz çalışıyor." },
    { sender:"Ahmed",  text:"Kabul. Ürünlerimizde tutarlılık değerli." },
    { sender:"Berke",  text:"Her şey iyi görünüyor. 10 Mart kickoff hazır." },
  ]},

  { baseTs: 1741600800, msgs: [
    { sender:"Berke",  text:"Artisan faz 2 kickoff görüşmesi bitti! Mobil uygulama için çok heyecanlılar. CEO görüşmedeydi — büyük şey." },
    { sender:"Ahmed",  text:"CEO iOS mu Android önceliği sorusunu sordu." },
    { sender:"Berke",  text:"React Native ile her ikisini eş zamanlı yapıyoruz dedik. Bu onu etkiledi." },
    { sender:"Sara",   text:"İlk check-in'de mobil prototipleri görmek istedi özellikle. Baskı var!" },
    { sender:"Mehmet", text:"Önümüzdeki hafta uygulamanın çalışan iskeletini hazırlarım." },
    { sender:"Leyla",  text:"Artisan faz 2 ilk milestone: 31 Mayıs. Tutar: 21.667 Euro. Son zamanlarda harika ödeme yapıyorlar." },
    { sender:"Berke",  text:"Bu ilişkiyi dikkatle koruyalım." },
  ]},

  { baseTs: 1741860000, msgs: [
    { sender:"Berke",  text:"Horizon faz 2 kickoff Pazartesi 17 Mart! Sözleşme bugün imzalandı." },
    { sender:"Leyla",  text:"Horizon ön ödemesi 14.250 Euro imzayla birlikte alındı." },
    { sender:"Ahmed",  text:"Sürücü mobil uygulaması harika bir ürün olacak. Gerçek dünya etkisi." },
    { sender:"Mehmet", text:"Faz 1'deki gerçek zamanlı takip sürücü uygulamasıyla mükemmel bütünleşecek." },
    { sender:"Sara",   text:"Sürücü uygulaması UX araştırması yapıyorum — çevremdeki 3 gerçek kamyon sürücüsüyle konuştum." },
    { sender:"Kemal",  text:"İki mobil uygulama için eş zamanlı QA ilginç olacak. Cihaz test matrisi hakkında düşünmem lazım." },
    { sender:"Berke",  text:"BrowserStack lisanslarımız var. 100'den fazla gerçek cihazda test yapabiliyoruz." },
    { sender:"Ahmed",  text:"İyi. Öncelikli cihazlar: iPhone 14, Samsung S23, Xiaomi Redmi — kullanıcılarımızın çoğunu kapsıyor." },
  ]},

  { baseTs: 1742119200, msgs: [
    { sender:"Berke",  text:"Emir ve Zeynep ofiste! Ekibe resmen hoş geldiniz 🎉" },
    { sender:"Ahmed",  text:"Kod tabanı turunu az önce bitirdim. Her ikisi de harika sorular sordu — iyi işaret." },
    { sender:"Sara",   text:"Tasarım sistemi oturumu bitti. Zeynep frontend'de harika olacak." },
    { sender:"Mehmet", text:"Emir geliştirici ortamını kurdu ve ilk PR'ını gönderdi bile. Temiz kod." },
    { sender:"Kemal",  text:"Zeynep'e ilk görevi atadım: yeni modüller için test suite'ini güncelle." },
    { sender:"Leyla",  text:"İK evrakları tamamlandı. Her ikisi de 1 Nisan'dan itibaren bordrodan." },
    { sender:"Berke",  text:"Harika onboarding. Çok değerli katkılar katacaklar." },
  ]},

  { baseTs: 1742400000, msgs: [
    { sender:"Berke",  text:"Gelecek projeler için fiyatlandırma stratejisini konuşmak istiyorum. Zımni saatlik ücretimiz 70-80 Euro civarında. Kalitemiz için pazar fiyatı 90-110 Euro." },
    { sender:"Ahmed",  text:"Eksik fiyatlandırdığımızı düşünüyorum. Artisan ve Horizon teslimatlarının kalitesi premium seviyede." },
    { sender:"Leyla",  text:"Ücretleri %20 artırırsak aynı iş yükünde yıllık gelir hedefi 250 bin'den 300 bine çıkıyor." },
    { sender:"Mehmet", text:"Yeni müşteriler için fiyatları artıralım. Artisan ve Horizon'a sadakat olarak mevcut fiyatları koruyalım." },
    { sender:"Sara",   text:"Akıllıca. Önce güven kur, sonra değere göre fiyatla." },
    { sender:"Kemal",  text:"Kademeli bir model ne olur? Standart / Premium / Kurumsal?" },
    { sender:"Berke",  text:"İlginç fikir Kemal. Üzerine çalışalım. Önümüzdeki hafta 1 saatlik fiyatlandırma stratejisi oturumu kuracağım." },
    { sender:"Ahmed",  text:"Ayrıca — kurduğumuz tasarım sistemi ve dahili araçlar gerçek farklılaştırıcılar. Pitch'lerde öne çıkarmalıyız." },
    { sender:"Berke",  text:"Harika nokta. Leyla şirket yetenek sunumunu günceller misin?" },
    { sender:"Leyla",  text:"Hallederim! Cuma'ya kadar taslak hazır olur." },
  ]},

  { baseTs: 1742640000, msgs: [
    { sender:"Berke",  text:"Mart hızlı gidiyor. Milestone kontrolü — Artisan faz 2 ve Horizon faz 2 ilerlemesi?" },
    { sender:"Ahmed",  text:"Artisan mobil: temel bitti, ana ekranlar %40 tasarlanmış ve geliştirilmiş." },
    { sender:"Mehmet", text:"Horizon sürücü uygulaması: mimari sağlam, gerçek zamanlı konum paylaşımı prototipte çalışıyor." },
    { sender:"Sara",   text:"Her iki proje için mobil tasarımlar iyi gidiyor. Zeynep yardım ediyor ve çok hızlı." },
    { sender:"Kemal",  text:"Emir dün otomatik cihaz testini kurdu. Her push'ta 8 cihazda çalışıyor." },
    { sender:"Leyla",  text:"Finans: Artisan/Horizon faz 1'den tüm ödemeler tamamlandı. Yeni ön ödemeler: 24.000 Euro alındı." },
    { sender:"Berke",  text:"Yıl için gelir öngörüleri güçlü görünüyor. 280-300 bin Euro hedefinde yolundayız." },
    { sender:"Ahmed",  text:"Yeni müşteriler için ücret artışıyla daha da yüksek olabilir." },
  ]},

  { baseTs: 1742985600, msgs: [
    { sender:"Berke",  text:"Bugün gelen sorgu — Vega Perakende zinciri çok mağazalı stok yönetim sistemi istiyor. 22 mağaza, 140.000 Euro proje tahmini." },
    { sender:"Ahmed",  text:"Bugüne kadarki en büyük potansiyel projemiz. Kapasitemiz var mı?" },
    { sender:"Berke",  text:"Emir ve Zeynep ile evet. Ama zamanlama önemli — önce Artisan ve Horizon faz 2 rayında olmalı." },
    { sender:"Mehmet", text:"Vega başlangıcını Haziran'a atabilir miyiz?" },
    { sender:"Berke",  text:"15 Mayıs başlamak istiyorlar. 2 Haziran için pazarlık yapacağım." },
    { sender:"Sara",   text:"Perakende stok sistemi farklı bir domain. Portföy çeşitlendirmesi için iyi." },
    { sender:"Leyla",  text:"Kapsam görüşmesinden önce Vega'yı araştırasım var. Yıllık gelir, çalışan sayısı vb.?" },
    { sender:"Berke",  text:"Evet lütfen. O görüşmeye hazırlıklı girmek istiyorum." },
    { sender:"Kemal",  text:"22 mağaza farklı ölçek ve güvenilirlik gereksinimleri demek. Teklifte belirtmek gerekir." },
    { sender:"Ahmed",  text:"Çok kiracılı sağlam bir mimari gerektirir. Düşünmeye başlayabilirim." },
  ]},

  // ═══ NİSAN 2025 ══════════════════════════════════════════════════════════

  { baseTs: 1743465600, msgs: [
    { sender:"Berke",  text:"Q2 bugün başlıyor. Üç aktif hat: Artisan faz 2, Horizon faz 2 ve Vega kapsamı. İddialı ama yönetilebilir." },
    { sender:"Ahmed",  text:"Artisan mobil uygulama harika görünüyor — ilk dahili demo çok olumlu geçti." },
    { sender:"Mehmet", text:"Horizon sürücü uygulaması: konum paylaşımı, rota görüntüleme ve durum güncellemeleri çalışıyor. Önümüzdeki hafta QA." },
    { sender:"Leyla",  text:"Q1 nihai rakamlar: 96.600 Euro gelir. Q2 hedefi: 120.000 Euro. Çok ulaşılabilir." },
    { sender:"Sara",   text:"Mobil tasarımlarda Zeynep'e liderlik ettim — harika iş çıkardı. Büyük verimlilik artışı." },
    { sender:"Kemal",  text:"Emir ilk 2 haftasında 8 özellik gönderdi. Yeni katılımcı için inanılmaz." },
    { sender:"Berke",  text:"Harika ekip. Buraya kadar geldiğimizden gurur duyuyorum." },
    { sender:"Ahmed",  text:"Vega kapsam görüşmesi ne zaman tam olarak?" },
    { sender:"Berke",  text:"7 Nisan Pazartesi. Sabah 10'da." },
    { sender:"Leyla",  text:"Yarın herkese Vega hakkında ön bilgi özeti göndereceğim." },
  ]},

  { baseTs: 1743638400, msgs: [
    { sender:"Ahmed",  text:"Artisan mobil uygulama ilk beta TestFlight ve Google Play Internal'a deploy edildi! 🎉" },
    { sender:"Sara",   text:"iPhone'umda test ettim — çok cilalı hissettiriyor. Akıcı animasyonlar." },
    { sender:"Kemal",  text:"Otomatik test suitini çalıştırıyorum — 94/100 geçiyor. 6 edge case düzeltilecek." },
    { sender:"Mehmet", text:"6 başarısızlık ne?" },
    { sender:"Kemal",  text:"Hepsi offline mod ile ilgili — ağ kesildiğinde uygulama düzgün davranmıyor." },
    { sender:"Ahmed",  text:"Offline desteği spesifikasyonda var. Bugün üstleniyorum." },
    { sender:"Berke",  text:"Artisan CEO'su önümüzdeki hafta görmek istiyor. 10 Nisan demo görüşmesi." },
    { sender:"Sara",   text:"Demo senaryosunu hazırlıyorum. Ana kullanıcı yolculuğunda götürelim onları." },
    { sender:"Emir",   text:"Merhaba — Artisan demo hazırlığına katılabilir miyim? Güzel bir öğrenme fırsatı." },
    { sender:"Berke",  text:"Kesinlikle Emir! Harika inisiyatif. 8 Nisan'da Sara'nın hazırlık görüşmesine katıl." },
  ]},

  { baseTs: 1743897600, msgs: [
    { sender:"Leyla",  text:"Vega Perakende araştırması: 5 şehirde 22 mağaza, 850 çalışan, gelir yaklaşık 28 milyon Euro/yıl. İyi fonlanmış, dijitalleşmeye geçen aile şirketi." },
    { sender:"Ahmed",  text:"İyi bağlam. 28 milyon Euro gelirde çok mağazalı stok yönetimi ciddi SKU hacimleri demek." },
    { sender:"Mehmet", text:"50.000-100.000 aktif SKU tahmin ederim. Uygun veritabanı tasarımı şart." },
    { sender:"Berke",  text:"İyi analiz. Pazartesi için temel sorular: şu anki tech stack, gerekli entegrasyonlar (ERP, POS), ve takvim esnekliği." },
    { sender:"Sara",   text:"Mevcut sistemleri görünüşe göre Excel. Klasik dijitalleşme fırsatı." },
    { sender:"Kemal",  text:"O ölçekte Excel... Çok acı çekiyor olmalılar." },
    { sender:"Ahmed",  text:"Bu yüzden motive alıcılar olacaklar." },
    { sender:"Berke",  text:"Tam olarak. Ve motive alıcılar proje teslimatını daha kolay hale getirir." },
  ]},

  { baseTs: 1744070400, msgs: [
    { sender:"Berke",  text:"Vega görüşmesi bitti! Çok iyi geçti. Neredeyse hiç teknolojileri yok — sadece Excel ve bir muhasebe yazılımı. Büyük fırsat." },
    { sender:"Ahmed",  text:"Takvim ne?" },
    { sender:"Berke",  text:"Esnek. Hâlâ 15 Mayıs başlamak istiyorlar ama gerekirse Haziran da olur dedi." },
    { sender:"Mehmet", text:"Haziran bizim için çok daha iyi. Yeni işe alımlar o zamana kadar tam onboarded olur." },
    { sender:"Leyla",  text:"Teklif 18 Nisan'a kadar gitmeli. Ben ticari koşulları taslaklaştırıyorum." },
    { sender:"Ahmed",  text:"Ben teknik kısımları yazıyorum — mimari öneri ve teslimat planı." },
    { sender:"Sara",   text:"Artisan demo hazırlık görüşmesi Emir ile bitti. Çok iyi hazırlandı." },
    { sender:"Kemal",  text:"Offline mod fixi deploy edildi. Artık 100/100 mobil test geçiyor." },
    { sender:"Berke",  text:"Her cephede harika ilerleme." },
  ]},

  { baseTs: 1744329600, msgs: [
    { sender:"Berke",  text:"Artisan CEO demosu ayakta alkışlandı. Görüşme sırasında telefonda uygulamayı açtı ve 'satış ekibimin tam ihtiyacı bu' dedi." },
    { sender:"Ahmed",  text:"Bu tepki paha biçilmez. Demo çok iyi geçti." },
    { sender:"Sara",   text:"Tasarım mükemmel indi. Basit, hızlı, güzel." },
    { sender:"Emir",   text:"İlk müşteri demomduydu. İnanılmaz bir deneyim, dahil ettiğin için teşekkürler Berke." },
    { sender:"Berke",  text:"Hazırlığa sen de katkı sağladın Emir, orada bulunmayı hak ettin." },
    { sender:"Leyla",  text:"Artisan az önce faz 3 hakkında soran bir mail gönderdi — son kullanıcıları için müşteri uygulaması." },
    { sender:"Berke",  text:"Faz 2 bitmeden faz 3 😄 Önce faz 2'yi teslim edelim." },
    { sender:"Mehmet", text:"Horizon sürücü uygulaması: tüm özellikler tamamlandı. Bugün son QA başlıyor." },
  ]},

  { baseTs: 1744588800, msgs: [
    { sender:"Kemal",  text:"Horizon sürücü uygulaması QA devam ediyor. 145 test case, şu an 138 geçiyor, 7 GPS edge case'inde başarısız." },
    { sender:"Mehmet", text:"GPS edge case'leri — özellikle neler?" },
    { sender:"Kemal",  text:"Uygulama kısa süreliğine bağlantıyı kaybediyor ve yeniden sync etmiyor. Yeniden bağlanmada konum atlıyor." },
    { sender:"Mehmet", text:"Ne olduğunu biliyorum — konum tamponu implement edip yeniden bağlanmada GPS verisini düzeltmem lazım. 4 saatlik iş." },
    { sender:"Ahmed",  text:"Ayrıca: Horizon faz 2 güzergah optimizasyonunu inceliyordum. Algoritma zarif ama %15 verimlilik iyileştirmesi buldum." },
    { sender:"Berke",  text:"Bunu sonraki Horizon görüşmesinde sun — inisiyatifi takdir edecekler." },
    { sender:"Zeynep", text:"Merhaba ekip — Artisan self-servis portal giriş ve dashboard ekranlarını bitirdim! Şimdi drive'a paylaşıyorum." },
    { sender:"Sara",   text:"Zeynep bunlar çok temiz! Harika iş. Portal çok güzel olacak." },
    { sender:"Berke",  text:"Zeynep çok iyi adapte oluyorsun." },
  ]},

  { baseTs: 1744848000, msgs: [
    { sender:"Leyla",  text:"Vega teklifi bugün gönderildi! Toplam: 22 mağazalı stok sistemi için 138.000 Euro. Önerilen başlangıç tarihi 2 Haziran." },
    { sender:"Ahmed",  text:"Harika teknik öneri hazırladık. Mimari bölümü kapsamlı." },
    { sender:"Berke",  text:"Vega CEO'su 25 Nisan'a kadar ekibiyle inceleyeceğini söyledi." },
    { sender:"Mehmet", text:"GPS fixi deploy edildi. Tüm 145 Horizon sürücü uygulaması testi şimdi geçiyor." },
    { sender:"Kemal",  text:"Sürücü uygulamasında tam regresyon tamamlandı: 145/145. Teslime hazır." },
    { sender:"Berke",  text:"Horizon sürücü uygulaması bitti! Teslim görüşmesini 22 Nisan için planlıyorum." },
    { sender:"Sara",   text:"Bir başka büyük milestone. Bu ekip ateş gibi." },
    { sender:"Ahmed",  text:"Bu yıl teslim ettiklerimiz: Artisan faz 1 + faz 2 (kısmi), Horizon faz 1 + faz 2 sürücü uygulaması. İnanılmaz." },
  ]},

  { baseTs: 1745107200, msgs: [
    { sender:"Mehmet", text:"Pazar akşamı ve bir şekilde Berke'nin paylaştığı Vega mimari dokümanlarına bakıyorum 😅" },
    { sender:"Ahmed",  text:"Ben de! Çok mağazalı stok problemi gerçekten ilginç." },
    { sender:"Sara",   text:"İkinizdeki çalışkanlığa bir isim lazım 😄" },
    { sender:"Kemal",  text:"Ben de perakende stok sistemleri okuyorum. Sara'ya söyleme." },
    { sender:"Sara",   text:"Hepiniz aynısınız! Film izliyorum. Görüşürüz." },
    { sender:"Berke",  text:"Haha. Tutkuyu seviyorum. Ama gerçekten, hafta sonları dinlenin. Uzun bir yolumuz var." },
    { sender:"Mehmet", text:"Haklısın. Laptopu kapatıyorum." },
    { sender:"Ahmed",  text:"Ben de. Pazartesi görüşürüz!" },
  ]},

  { baseTs: 1745280000, msgs: [
    { sender:"Berke",  text:"Horizon sürücü uygulaması teslim edildi! Müşteri çok mutlu — CTO'ları görüşme bitmeden sürücüler sabah uygulamayı kullanmaya başladı dedi." },
    { sender:"Ahmed",  text:"Teslimattan saatler içinde gerçek kullanıcı adaptasyonu. Bu mümkün olan en iyi sonuç." },
    { sender:"Leyla",  text:"Horizon sürücü uygulaması faturası gönderildi: 28.500 Euro (faz 2'nin ilk milestone'ı). Son tarih 15 Mayıs." },
    { sender:"Mehmet", text:"PostGIS ve gerçek zamanlı WebSocket'ler — 1. aydaki teknik kararların hepsi meyvesini verdi." },
    { sender:"Sara",   text:"Gerçek kamyon sürücüleriyle yapılan UX araştırması büyük fark yarattı. Uygulama onlar için yapılmış gibi hissettiriyor." },
    { sender:"Kemal",  text:"145/145 geçiyor, teslim sonrası sıfır kritik bug. Temiz teslimat." },
    { sender:"Emir",   text:"Bu sadece ikinci ayım ve bu ekibin neler teslim ettiğine inanamıyorum. İlham verici." },
    { sender:"Berke",  text:"Artık sen de bir parçasısın Emir! Test yardımcı araçlarına harika katkı sağladın." },
    { sender:"Zeynep", text:"Dürüstçe söylemek gerekirse bu şirkete katılmak için aldığım en iyi karar 😊" },
  ]},

  { baseTs: 1745539200, msgs: [
    { sender:"Berke",  text:"Az önce Vega'dan kalktım. Teklifimizi kabul ettiler. 138.000 Euro, 2 Haziran başlangıcı." },
    { sender:"Ahmed",  text:"Bu DEV ALICI. İmzaladığımız en büyük sözleşme." },
    { sender:"Leyla",  text:"Haziran sonuna kadar YTD geliri 250 bin Euro+ olacak. Bu tüm yıllık hedefimizdi!" },
    { sender:"Sara",   text:"Yıllık hedefimize 8 ayda ulaştık. Hedefleri güncelleme zamanı." },
    { sender:"Mehmet", text:"Vega'nın yanı sıra Artisan ve Horizon için de başka bir işe alım gerekecek." },
    { sender:"Berke",  text:"Katılıyorum. Bu hafta kıdemli backend geliştirici için yeni arayış başlıyor." },
    { sender:"Kemal",  text:"Şirket çok hızlı büyüyor. Heyecanlı ve biraz ürkütücü 😄" },
    { sender:"Berke",  text:"Bu his büyüdüğünüz anlamına gelir. Girişimciliğe hoş geldiniz." },
    { sender:"Emir",   text:"Tebrikler herkese! Ne bir ekip." },
    { sender:"Zeynep", text:"🎉🎉🎉" },
  ]},

  { baseTs: 1745798400, msgs: [
    { sender:"Leyla",  text:"Nisan kapanışı: gelir 67.250 Euro (Artisan + Horizon teslimatları + ön ödemeler). Şimdiye kadarki en iyi ay." },
    { sender:"Berke",  text:"YTD: Q1 96.600 Euro + Q2 Nisan 67.250 Euro = 6 ayda toplam 163.850 Euro gelir." },
    { sender:"Ahmed",  text:"Pipeline: Artisan faz 2 devam ediyor, Horizon faz 2 devam ediyor, Vega Haziran'da başlıyor. Çok güçlü pozisyon." },
    { sender:"Mehmet", text:"Teknik açıdan iyi durumdayız. Kurduğumuz sistemler gerçek kullanımda dayanıklı." },
    { sender:"Sara",   text:"Tasarım sistemi artık üç aktif projede kullanılıyor. Yatırımın geri dönüşü açık." },
    { sender:"Kemal",  text:"Tüm projelerde QA kapsamı şimdiye kadarki en yüksek seviyede. Bu ay prodüksiyonda sıfır kritik bug." },
    { sender:"Emir",   text:"Önümüzdeki hafta deneme süresi incelemem — heyecanlıyım!" },
    { sender:"Zeynep", text:"Ben de! Biraz gergin ama çoğunlukla heyecanlı." },
    { sender:"Berke",  text:"İkisi de büyük bir güvenle girmelisiniz. Beklentilerin üzerinde performans gösterdiniz." },
    { sender:"Ahmed",  text:"Burada olmaktan mutluyum. Acme'ye ne kadar iyi bir şey kurduğumuzu düşününce." },
    { sender:"Berke",  text:"Aynı şeyi hissediyorum. Mayıs daha da büyük olacak. Hadi gidelim! 💪" },
  ]},

];

// ── Timestamp atama ve mesaj oluşturma ───────────────────────────────────────

function buildMessages() {
  const out = [];
  let msgIndex = 0;

  for (const ep of EPISODES) {
    const { baseTs, msgs } = ep;
    for (let i = 0; i < msgs.length; i++) {
      const jitter  = Math.floor((i * 17 + 3) % 7) * 60;
      const ts      = baseTs + i * GAP + jitter;
      const { sender, text } = msgs[i];
      msgIndex++;
      out.push({
        id:        "a" + String(msgIndex).padStart(4, "0"),
        chatId:    CHAT_ID,
        chatType:  CHAT_TYPE,
        sender,
        timestamp: ts,
        type:      "text",
        text,
        status:    "done",
      });
    }
  }

  return out;
}

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
  console.log("\n=== seed-1000: grup sohbeti (Acme Solutions) ===\n");

  const db = initDb();

  if (clean) {
    await cleanSeedData(db);
    console.log("  Tamamlandı. Yeniden seed için --clean olmadan çalıştırın.\n");
    process.exit(0);
  }

  activate(CHAT_ID, "seed");
  console.log("  Sohbet aktifleştirildi:", CHAT_ID);

  const messages = buildMessages();
  console.log(messages.length, "mesaj ekleniyor, sohbet:", CHAT_ID);

  let inserted = 0;
  for (const m of messages) {
    insertMessage(m);
    inserted++;
    if (inserted % 50 === 0) process.stdout.write(".");
  }

  console.log("\n\nTamamlandı.", inserted, "mesaj eklendi.");
  console.log("Sohbet ID:", CHAT_ID);
  console.log("Kapsam: Kasım 2024 – Nisan 2025");
  console.log("Katılımcılar: Berke, Ahmed, Leyla, Mehmet, Sara, Kemal, Emir, Zeynep");
  console.log("\nTest için örnek sorular:");
  console.log("  - 'Vega Perakende proje bütçesi ne kadar'");
  console.log("  - 'Artisan faz 2 ne zaman başladı'");
  console.log("  - 'CSV import bug'unu kim düzeltti'");
  console.log("  - 'Yeni ofise ne zaman taşındık'");
  console.log("  - 'Q1 toplam gelir ne kadar'");
  console.log("\nGömme: uygulamayı (yeniden) başlatın — backfill() tüm mesajları otomatik olarak kuyruğa alır.\n");
  process.exit(0);
}

run().catch(err => {
  console.error("\n[HATA]", err.message);
  process.exit(1);
});
