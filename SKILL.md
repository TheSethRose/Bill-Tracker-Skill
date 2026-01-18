# Bill Tracker Skill for Clawdbot

**Unified CLI skill for tracking bills across multiple providers.**

## Usage

```bash
# Run configured providers (from BILL_PROVIDERS in .env)
npm start

# Run a single provider for testing
npm start -- --provider=atmos

# Force refresh data (ignore cache)
npm start -- --force

# Run specific provider with fresh data
npm start -- --provider=att --force
```

## Configuration

Set `BILL_PROVIDERS` in `.env` to specify which providers to run:

```bash
# Run only Atmos
BILL_PROVIDERS=atmos

# Run AT&T and Atmos
BILL_PROVIDERS=att,atmos
```

## Data Caching

- Data is cached in `data/` directory (gitignored)
- Cached data is reused if less than 24 hours old
- Use `--force` to bypass cache and fetch fresh data

## Overview

This skill provides a unified dashboard for tracking:
- Utility bills (electric, gas, water, internet)
- Credit cards and bank accounts
- Insurance premiums
- Subscriptions and recurring charges

All data stays local. Credentials are accessed via `.env` only.

## Adding Your Providers

1. **Fork and clone the provider repo:**
   https://github.com/TheSethRose/Bill-Tracker-Skill

2. **Add your provider** to `src/providers/` directory following existing patterns.

3. **Configure credentials** in your `.env` file:
   ```
   PROVIDER_USER=your-username
   PROVIDER_PASS=your-password
   ```

4. **Add provider name to BILL_PROVIDERS** in your `.env`

5. **Submit a PR** to share your provider with the community!

## Want to Contribute?

If you've built a provider for a bank, utility, or service:

1. Fork the repo: https://github.com/TheSethRose/Bill-Tracker-Skill
2. Add your provider file to `src/providers/`
3. Update `.env.example` with required credentials
4. Open a Pull Request

Your provider will be available to all Clawdbot users!

## 🙏 Acknowledgments

- **[@clawd.bot](https://clawd.bot)** — Thank you for building the platform this skill runs on! Made possible by Clawdbot's agent automation ecosystem.
- This skill can be imported and used by other Clawdbot skill agents.

## License

MIT
