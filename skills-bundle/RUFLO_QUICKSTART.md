# RuFlo Quick Start (ObservAI)

RuFlo (eski adi Claude-Flow) — Claude Code uzerinde calisir, multi-agent orchestration saglar. v3.5.82.

## 30 saniyede baslangic

```bat
cd C:\Users\Gaming\Desktop\Project\ObservAI
npx ruflo@latest init --wizard
```

Wizard sorulari:

| Soru | ObservAI icin onerim |
|------|---------------------|
| LLM provider? | `Anthropic Claude` (veya `Ollama` — ObservAI'nin Ollama'si zaten var) |
| Workspace? | `C:\Users\Gaming\Desktop\Project\ObservAI` |
| Topology? | `hierarchical` (queen + workers) |
| Agent count? | `6` (architect, 2 coder, tester, reviewer, security) |
| Memory backend? | `sqlite` (basit) veya `vector` (semantic search) |
| Claude Code MCP entegrasyon? | `Yes` |
| Hooks? | `Yes` (otomatik dispatch) |

Init bitince `.ruflo/` klasoru ve `.mcp.json` guncellemesi olusur.

## Ilk komut

```bat
npx ruflo@latest swarm "Hello from ObservAI"
```

Eger calisirsa: kurulum basarili, RuFlo sana hangi agent'in cevap verdigini gosterir.

## ObservAI ile Pratik Komutlar

### Yeni feature gelistirme (ROADMAP adimi)

```bat
npx ruflo@latest swarm ^
  "ROADMAP ADIM 18: Sube bazli heatmap raporu - API + frontend + DB migration"
```

RuFlo:
1. **Architect** agent: ADR yazar, yapisi karar verir
2. **DB agent**: `prisma/schema.prisma` + migration
3. **Backend agent**: Express route + controller
4. **Frontend agent**: React component + chart
5. **Tester agent**: integration + E2E test
6. **Reviewer agent**: hepsini birlestirir, PR mesaji

Sen Claude'la konusurken arka planda 6 ajan paralel calisir, ortak memory'de state share eder.

### Bug hunting

```bat
npx ruflo@latest swarm "Production OOM crash root cause analizi" --memory persistent
```

`--memory persistent`: bu hunt'tan elde edilen bilgi sonraki bug hunt'lara aktarilir (RuFlo'nun ReasoningBank ozelligi).

### Performance audit

```bat
npx ruflo@latest audit performance --target packages/camera-analytics
```

RuFlo: profiler calistirir, hot path'leri bulur, optimize.py'a oneri yazar, ROADMAP'a ekleyecek action item olusturur.

### Security audit

```bat
npx ruflo@latest audit security --include backend/src
```

OWASP top 10 + injection + auth flaws + secret leakage tarar.

### Test coverage artirma

```bat
npx ruflo@latest swarm "ObservAI test coverage'i %70'e cikar"
```

Tester agent + Coder agent paralel: bos test'leri tamamlar, edge case'leri bulur, fixtures uretir.

## Claude Code icinde RuFlo MCP

`init --wizard` Claude Code MCP entegrasyonu kurarsa `.mcp.json` icine RuFlo eklenir:

```json
{
  "mcpServers": {
    "ruflo": {
      "command": "npx",
      "args": ["-y", "ruflo@latest", "mcp", "start"]
    }
  }
}
```

Sonra Claude Code icinde:

```
> ObservAI'nin son 30 commit'ine baktim, 4 farkli feature paralel ilerliyor.
  RuFlo ile 4 agent ac, her birine bir feature ata, status board olarak
  bana raporla.
```

Claude RuFlo MCP tools'larini cagirir, sen takip edersin.

## Hooks - Otomatik Aktivasyon

`init` ile gelen hooks otomatik calisir:

| Hook | Tetiklenince |
|------|--------------|
| `pre-task` | Her gorev oncesi: gerekli context'i memory'den getirir |
| `post-task` | Gorev sonrasi: ogrenilen pattern'i ReasoningBank'a yazar |
| `routing` | Q-Learning Router: hangi agent'a gidecek karar verir |
| `consensus` | Birden fazla agent farkli cevap verirse Raft/BFT ile karar |

## Sik Komutlar Cheat Sheet

```bat
:: Status
npx ruflo@latest status
npx ruflo@latest agents list

:: Memory
npx ruflo@latest memory query "ObservAI camera setup"
npx ruflo@latest memory clear --confirm

:: Logs
npx ruflo@latest logs --tail 100

:: Hooks
npx ruflo@latest hooks list
npx ruflo@latest hooks intelligence --status

:: Provider degistir
npx ruflo@latest config set provider ollama

:: Update
npm update -g ruflo
```

## Maliyet Kontrolu

RuFlo Claude API kullaniyorsa cost izle:

```bat
npx ruflo@latest cost report --period 7d
```

Eger Ollama kullaniyorsan ucretsiz (ObservAI zaten qwen3:14b/llama3.1:8b ile lokal calisiyor):

```bat
npx ruflo@latest config set provider ollama
npx ruflo@latest config set ollama.url http://localhost:11434
npx ruflo@latest config set ollama.model qwen3:14b
```

## Sorun Giderme

```bat
:: Init bozulduysa
rmdir /s /q .ruflo
npx ruflo@latest init --wizard --force

:: Agent'lar takildiysa
npx ruflo@latest swarm cancel --all

:: Memory corrupted
npx ruflo@latest memory rebuild
```

## Kaynak

- GitHub: https://github.com/ruvnet/ruflo
- npm: https://www.npmjs.com/package/ruflo (alias: claude-flow)
- Wiki: https://github.com/ruvnet/ruflo/wiki

## Onemli Not

RuFlo guclu ama **karmasık**. ObservAI gibi orta olcekli projelerde su use case'lerde maksimum yarar:
- 3+ paralel feature ayni anda gelistirilirken
- Buyuk refactor (CameraFeed.tsx 1400 satir gibi)
- Production incident (paralel investigation + fix + comm)
- Sprint planning'de ROADMAP adimlarini hizla decompose etme

Tek kisilik task'larda (kucuk bug fix, tek dosya degistir) RuFlo overkill — direkt Claude Code yeterli.
