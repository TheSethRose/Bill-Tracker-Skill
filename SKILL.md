# Bill Tracker Skill for Clawdbot

**Unified CLI skill for tracking bills across multiple providers.**

## Usage

```bash
# Run the bill tracker
clawdbot bill-tracker status

# Show overdue bills
clawdbot bill-tracker overdue

# Export to JSON
clawdbot bill-tracker export --json
```

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

2. **Add your provider config** to the `providers/` directory following the template.

3. **Configure credentials** in your `.env` file:
   ```
   PROVIDER_USER=your-username
   PROVIDER_PASS=your-password
   ```

4. **Submit a PR** to share your provider with the community!

## Want to Contribute?

If you've built a provider for a bank, utility, or service:

1. Fork the repo: https://github.com/TheSethRose/Bill-Tracker-Skill
2. Add your provider file to `providers/`
3. Update `.env.example` with required credentials
4. Open a Pull Request

Your provider will be available to all Clawdbot users!

## 🙏 Acknowledgments

- **[@clawd.bot](https://clawd.bot)** — Thank you for building the platform this skill runs on! Made possible by Clawdbot's agent automation ecosystem.
- This skill can be imported and used by other Clawdbot skill agents.

## License

MIT
