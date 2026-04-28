# Cowork'te Eklenmesi Gereken Skiller — Tek Tikla Liste

Cowork'te kendi pencerenden **+ Add skill** butonuna bas, acilan **Directory** penceresinde her birinin yaninda **+** ikonu var, sirayla tikla.

## Eklenmesi Gerekenler (8 adet)

| # | Skill adi | Niye lazim (ObservAI) |
|---|-----------|----------------------|
| 1 | **webapp-testing** | Cowork'ten ObservAI frontend'ini Playwright ile test et |
| 2 | **web-artifacts-builder** | Cowork'un live HTML artifact'lerine uyumlu (dashboard mockup) |
| 3 | **mcp-builder** | Python analytics'i MCP server olarak expose etme |
| 4 | **theme-factory** | UI theme/branding artifact'leri |
| 5 | **doc-coauthoring** | Yapisal dokuman (rapor, ADR, RFC) yazimi |
| 6 | **brand-guidelines** | ObservAI marka kurallari (eger varsa) |
| 7 | **internal-comms** | Slack/email mesaji yazimi |
| 8 | **slack-gif-creator** | Slack icin animated GIF (release duyurulari) |

## Adim Adim

1. Cowork'te **Customize** > **Skills** ekraninda **"+"** butonuna bas (sag ust, "Skills" basliginin yaninda)
2. Acilan **Directory** dialog'unda **Anthropic & Partners** sekmesi sectili
3. Yukaridaki listedeki her skill'in yanindaki **"+"** butonuna tikla
4. Eklediklerin **Personal skills** listene dusup otomatik aktif olacak

## Bonus — Toplu Plugin Kurulumu

Sol sidebar'daki **Engineering**, **Marketing**, **Productivity**, **Design** etiketleri **plugin paket**leri:

- **Engineering** → Bir tıkla 8-10 muhendislik skill'i (debug, code-review, system-design vb.)
- **Productivity** → Memory management + task management + start
- **Design** → Design critique + accessibility + UX copy

ObservAI gelistirici icin **Engineering** plugin'ini eklemen onerilir — yukaridaki tek tek listeden cok daha kapsamli.

## Eklemeyi Unutma!

Cowork'te skill ekleme **kullanici hesabina** bagli (Anthropic hesabi). Hesabini degistirdikten sonra tekrar Cowork'e girince bu skiller hesabin ile birlikte gelir.

Claude Code tarafi ise dosya sistemine bagli (`~/.claude/skills/`) — orada zaten 22 skill kurulu, hesabi degistirsen bile kalir.
