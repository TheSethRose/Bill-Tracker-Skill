# Contributing to Bill Tracker Skill

Thank you for your interest in contributing! 🎉

This project is built for [Clawdbot](https://clawd.bot) and welcomes contributions from the community. Whether you're adding a new provider or improving the core, your PRs make this tool better for everyone.

## Table of Contents

- [Ways to Contribute](#ways-to-contribute)
- [Adding a Provider](#adding-a-provider)
- [Development Setup](#development-setup)
- [Code Style](#code-style)
- [Submitting a PR](#submitting-a-pr)

## Ways to Contribute

1. **Add a new provider** — Your bank, utility, credit card, or subscription
2. **Improve access methods** — Better scraping, browser automation, or API handling
3. **UI enhancements** — Better formatting, export options, or visualizations
4. **Documentation** — Improve READMEs, add examples, translate

## Adding a Provider

### Step 1: Create Your Provider File

Copy the template to create your provider:

```bash
cp providers/_template.json providers/your-provider.json
```

### Step 2: Configure the Provider

Edit `providers/your-provider.json`:

```json
{
  "name": "Your Provider Name",
  "category": "utility",
  "method": "api",
  "config": {
    "loginUrl": "https://provider.com/login",
    "apiBase": "https://api.provider.com",
    "envVars": ["PROVIDER_USER", "PROVIDER_PASS"],
    "endpoints": {
      "balance": "/v1/account/balance",
      "dueDate": "/v1/account/due-date"
    }
  },
  "auth": {
    "type": "basic"
  }
}
```

### Step 3: Add Your Credentials

Add to `.env`:

```env
PROVIDER_USER=your-username
PROVIDER_PASS=your-password
```

### Step 4: Implement the Fetcher

Create `src/methods/your-provider.ts` or extend an existing method class.

### Step 5: Test

```bash
npm run build
npm start
```

Your provider should appear in the dashboard!

## Development Setup

```bash
# Fork and clone
git clone https://github.com/YOUR_USERNAME/Bill-Tracker-Skill.git
cd Bill-Tracker-Skill

# Install dependencies
npm install

# Create your provider
cp providers/_template.json providers/my-provider.json

# Develop
npm run dev
```

## Code Style

- TypeScript strict mode enabled
- Use ES modules (`import`/`export`)
- Run `npm run build` before committing
- Add JSDoc for public methods
- Keep methods focused and small

## Submitting a PR

1. **Fork** the repo at https://github.com/TheSethRose/Bill-Tracker-Skill
2. **Branch** from `main`: `git checkout -b feature/my-provider`
3. **Commit** your changes with clear messages
4. **Push** to your fork
5. **Open a PR** against `main`

### PR Checklist

- [ ] Provider file follows the template schema
- [ ] `.env.example` updated with new variables
- [ ] `README.md` updated with provider info (optional)
- [ ] Code builds without errors (`npm run build`)
- [ ] No sensitive data committed

## Provider Schema Reference

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Display name for the provider |
| `category` | Yes | utility, bank, credit, insurance, subscription, other |
| `method` | Yes | api, oauth, scrape, browser |
| `config.loginUrl` | Maybe | Login page URL (scrape/browser) |
| `config.apiBase` | Maybe | API base URL (api/oauth) |
| `config.envVars` | Yes | Array of env var names for credentials |
| `config.endpoints` | Maybe | API endpoints for balance/dueDate |
| `config.auth.type` | Maybe | basic, bearer, cookie, session |

## Questions?

Open an issue or reach out. Happy to help! 🚀
