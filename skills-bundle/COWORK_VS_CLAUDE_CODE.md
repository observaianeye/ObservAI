# Cowork vs Claude Code — Iki Ayri Skill Sistemi

**TL;DR:** Yukledigin 22 skill **Claude Code CLI**'da calisir. **Cowork mode** ise farkli bir kayitli skill sistemi kullanir — orada skill eklemek icin uygulamanin **Directory** ekranindan "+" tiklamak gerek.

---

## Iki Sistem Nasil Farkli?

| Boyut | Claude Code CLI | Cowork Mode (desktop app) |
|-------|------------------|---------------------------|
| Skill kayit yeri | `C:\Users\Gaming\.claude\skills\` (dosya sistemi) | Cowork uygulamasinin kendi registry'si |
| Kurulum yontemi | `npx skills add ... -g -a claude-code` | Directory > "+" tikla, ya da plugin install |
| Tetikleme | Skill description'a uyan prompt yazınca otomatik | "/" prompt'unda manuel sec, ya da otomatik tetikleme |
| Versiyon | Klasordeki SKILL.md dosyasi | Plugin marketplace surumu |

`install.bat`'in yaptigi: **Sadece Claude Code CLI tarafini** kurdu. Cowork tarafi senin desktop app'inde manuel acilmasi gereken ayri bir cep.

---

## Cowork'te Skill Acma — Adim Adim

### 1) Cowork'u ac

Sol tarafta sidebar gorunmuyorsa, sol ust kose menusunden ac.

### 2) Customize > Skills

- Sidebar'da **Customize** butonu
- Sonra ust sekmelerden **Skills**

### 3) Directory'yi ac

Sag panelin altinda **+ Add skill** veya **Manage skills** butonuna bas. Bu **Directory** dialog'u acar (3. ekran goruntundeki ekran).

### 4) Skilleri "+" ile ekle

Anthropic & Partners listesinde gri **+** butonu olan her skill, eklenebilir. Suunlari **+ tikla** (Cowork'te isine yarayacaklar):

**Acilmasi onerilen Cowork skilleri:**
- `webapp-testing` — Frontend test (Cowork'te ObservAI'i kontrol etmek icin)
- `web-artifacts-builder` — Cowork'un live HTML artifact'lerine uyumlu
- `mcp-builder` — MCP server insasi
- `theme-factory` — UI theming
- `doc-coauthoring` — Yapisal dok yazma
- `brand-guidelines` — Marka kurallari (eger ObservAI marka kit'i varsa)
- `internal-comms` — Slack/email mesaji yazimi
- `slack-gif-creator` — Slack icin animated GIF

Bunlar zaten **gear icon** ile gosteriliyorsa Cowork'te kurulu (algorithmic-art, canvas-design, skill-creator). Onlara dokunma.

### 5) Filter by → "Tools"

Eger sadece spesifik kategori gormek istersen, ust filtreden kategori sec.

### 6) Test et

Yeni bir Cowork chat ac, **"/"** bas. Yeni eklenenler listede gorunmeli.

---

## Hangi Skili Nereye Kurmali?

| Senaryo | Hedef | Komut/Ad |
|---------|-------|----------|
| Terminal'de `claude` calistirip kod yaziyorum | Claude Code | install.bat (zaten yapildi) |
| Cowork desktop app'te ObservAI uzerinde calisiyorum | Cowork | Directory > + |
| Hem CLI hem Cowork ayni skill'i kullansin | Her ikisi | install.bat + Cowork Directory'den de ekle |

Genel kural: **iki yere de kur** — boylece nerede calisirsan calis (terminalden mi, desktop app'ten mi) skill hazir.

---

## Eksik Kalan 2 Skill Icin (Claude Code tarafi)

verify.bat sana `[EKSIK] test-driven-development` ve `[EKSIK] skill-creator` dedi. Bu Claude Code CLI tarafinda gercek bir eksiklik — kurulumda gecici bir hata olmus. Hizli duzeltme:

```bat
cd C:\Users\Gaming\Desktop\Project\ObservAI\skills-bundle
retry-missing.bat
```

Bu sadece o iki skill'i tekrar kurar.

---

## Cowork ve Claude Code'u Ayni Anda Kullanma

ObservAI'da pratik kullanim ornegi:

**Cowork acık, ObservAI uzerinde browse ediyorsun:**
```
/ webapp-testing 
> Staffing sayfasini test et, form validation calisiyor mu kontrol et
```
Cowork'in webapp-testing skill'i (Directory'den ekledikten sonra) Playwright komutlari calistirir.

**Ayni anda terminal'de Claude Code:**
```bat
cd C:\Users\Gaming\Desktop\Project\ObservAI
claude
> systematic-debugging skill'i ile Python OOM crash'i incele
```
Claude Code CLI'ndaki systematic-debugging skill'i (install.bat ile kurulu) devreye girer.

Iki ayri context, iki ayri skill seti, paralel calisma.

---

## Bir Skil Hem Cowork Hem Claude Code'da

Eger ayni skill'i ikisinde de istiyorsan, su yaklasimi kullan:

1) install.bat ile Claude Code'a kur (zaten yapildi)
2) Cowork Directory'den ayni skill'i "+" ile ekle

Bu iki ayri kopyaya yol acar (biri dosya sisteminde, digeri Cowork registry'sinde) — ama her zaman senkron tutmak icin ayda bir su komutlari calistir:

```bat
:: Claude Code tarafi:
npx skills update -g -y

:: Cowork tarafi:
:: Cowork uygulamasinda Directory > skill > Update (manuel)
```

---

## Niye Bu Kadar Karmasik?

Skills ekosistemi yeni (Vercel'in skills.sh, Anthropic'in skills, Cowork'un kendi kayitli sistemi — hepsi ayri ayri tasariland). Henuz tek bir merkezi yer yok. Onumuzdeki aylarda muhtemelen unify olacak ama simdilik:
- Terminal CLI ise → `~/.claude/skills/` dosya sistemi
- Cowork desktop app ise → Cowork Directory UI

**Iyi haber:** Iki taraf da ayni SKILL.md formatini kullaniyor. Yani bir skill yazarsan, iki yerde de calisir.

---

## Fast Reference

```bat
:: Claude Code CLI'a yeni skill ekle
npx skills add <repo> --skill <skill-adi> -g -a claude-code -y --copy

:: Claude Code'da kurulu skiller listesi
npx skills list -g

:: Skill icerigi gor
type "%USERPROFILE%\.claude\skills\<skill-adi>\SKILL.md"

:: Cowork'e ekle: 
:: Cowork app -> Customize -> Skills -> + Add skill -> Directory
```
