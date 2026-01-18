# Bill Tracker Skill

A unified CLI skill for tracking bills across multiple providers. Built for [Clawdbot](https://clawd.bot) — other skill agents can import and use this module.

## Features

- 📊 **Unified Dashboard** — View all bills in one table
- 🔄 **Auto-Refresh** — Fetch latest amounts and due dates on demand  
- 🔌 **Extensible Providers** — API, OAuth, Scrape, or Browser access methods
- 🔒 **Secure by Design** — Credentials via `.env`, never committed
- 🤝 **Open Contribution** — Add your own providers via PR

## Quick Start

```bash
# Clone and install
git clone https://github.com/TheSethRose/Bill-Tracker-Skill.git
cd Bill-Tracker-Skill
npm install

# Copy env template and add your credentials
cp .env.example .env
# Edit .env with your provider credentials

# Build and run
npm run build
npm start
```

## Available Commands

```bash
# Show all bills
npm start

# Show overdue bills only
npm start -- --overdue

# Show bills due within N days
npm start -- --due 14

# Export to JSON
npm start -- --json

# Export to CSV  
npm start -- --csv
```

## Provider Methods

| Method | Use When |
|--------|----------|
| `api` | Provider has a direct REST/GraphQL API |
| `oauth` | Modern apps with OAuth 2.0 authentication |
| `scrape` | Simple HTML portals without APIs |
| `browser` | JS-heavy apps, CAPTCHAs, or complex auth |

## Adding a Provider

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the full guide.

## CLI Reference

```
bill-tracker [options]

Options:
  --overdue    Show only overdue bills
  --due <n>    Show bills due within n days (default: 7)
  --category   Filter by category (utility, bank, credit, insurance, subscription, other)
  --json       Output as JSON
  --csv        Output as CSV
  --help       Show this help
```

## Architecture

```
bill-tracker/
├── providers/           # Provider implementations (add yours here!)
├── src/
│   ├── index.ts        # CLI entry point
│   ├── provider.ts     # Provider interface
│   ├── aggregator.ts   # Fetches all providers
│   ├── ui.ts           # Dashboard rendering
│   └── methods/        # Access methods (api, oauth, scrape, browser)
├── .env.example        # Credential template
└── package.json
```

## Contributing

Want to add your utility, bank, or credit card provider? PRs welcome!

1. Fork the repo: https://github.com/TheSethRose/Bill-Tracker-Skill
2. Create your provider in `providers/`
3. Add credentials to your local `.env`
4. Submit a PR

See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## 🙏 Acknowledgments

- **[@clawd.bot](https://clawd.bot)** — The platform this skill was built for. Thank you for empowering agent automation!
- All contributors who add provider support

## License

MIT
