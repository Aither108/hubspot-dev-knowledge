# HubSpot Dev Knowledge MCP

A Model Context Protocol (MCP) server that gives AI assistants comprehensive, up-to-date knowledge of **HubSpot CMS development** — HubL templating, modules, themes, templates, CLI, HubDB, and serverless functions.

> Integrate this once and your AI will know HubSpot CMS the way a senior HubSpot developer does.

---

## What's Covered

| Knowledge Area | Details |
|---|---|
| **HubL Variables** | All template variables: global, page, blog, email, HTTP request, HubDB, CRM, menu, editor |
| **HubL Filters** | 80+ filters with syntax, params, return types, and examples |
| **HubL Functions** | 50+ built-in functions: blog, CRM, HubDB, file, color, menu, format, and more |
| **HubL Tags** | Standard tags: blog, forms, images, CTAs, DnD areas, gallery, language switcher |
| **HubL Syntax** | Delimiters, statements (if/for/macro/set/import/extends/block), operators, expression tests, common patterns |
| **Template Types** | All 17+ template types with required variables, annotations, and file structures |
| **Modules** | Full anatomy: meta.json, fields.json, module.html — all 30+ field types with examples |
| **Themes** | theme.json config, fields.json for theme editor, CSS variable usage, directory structure |
| **CLI Commands** | Full `@hubspot/cli` reference across all groups with workflows |
| **HubDB** | Table structure, 14 column types, HubL query syntax, filter operators, dynamic pages |
| **Serverless Functions** | File structure, serverless.json, context/response objects, secrets, examples |

---

## Installation

### Option 1: npx (no setup required)

```json
{
  "mcpServers": {
    "hubspot-dev-knowledge": {
      "command": "npx",
      "args": ["-y", "hubspot-dev-knowledge-mcp"]
    }
  }
}
```

### Option 2: Clone and run locally

```bash
git clone https://github.com/Aither108/hubspot-dev-knowledge.git
cd hubspot-dev-knowledge
npm install
npm run build
```

Then configure in your MCP client (`claude_desktop_config.json` or `.claude/claude.json`):

```json
{
  "mcpServers": {
    "hubspot-dev-knowledge": {
      "command": "node",
      "args": ["C:/path/to/hubspot-dev-knowledge/dist/index.js"]
    }
  }
}
```

**Claude Code CLI** — add to `~/.claude/claude.json`:

```json
{
  "mcpServers": {
    "hubspot-dev-knowledge": {
      "command": "node",
      "args": ["/path/to/hubspot-dev-knowledge/dist/index.js"]
    }
  }
}
```

---

## Available MCP Tools

| Tool | Description |
|---|---|
| `search_hubspot_docs` | Full-text search across all knowledge categories |
| `get_hubl_variables` | Variables by section (global, blog, email, http, hubdb, etc.) |
| `get_hubl_filters` | All filters — searchable by name or keyword |
| `get_hubl_functions` | All functions — searchable by name or category |
| `get_hubl_tags` | Tags by category (blog, DnD, form, image, etc.) |
| `get_hubl_syntax` | Statements, operators, expression tests, common patterns |
| `get_template_types` | All template types with required variables and annotations |
| `get_module_reference` | Module anatomy, all field types, meta.json, CSS/JS patterns |
| `get_theme_reference` | Theme structure, theme.json, fields.json, CSS variable usage |
| `get_cli_commands` | CLI commands by group — searchable |
| `get_hubdb_reference` | HubDB tables, column types, HubL queries, dynamic pages |
| `get_serverless_reference` | Serverless functions, structure, examples, secrets |
| `list_topics` | List all available knowledge categories |

---

## Usage Examples

Once integrated, ask your AI assistant:

- *"How do I create a repeating group field in a HubSpot module?"*
- *"What HubL variables are available in blog post templates?"*
- *"Show me the syntax for hubdb_table_rows with filter operators"*
- *"Generate a page template with a drag-and-drop area"*
- *"What CLI command watches for file changes and auto-uploads?"*
- *"Write a serverless function that fetches from an external API"*
- *"What are all the HubL filters for string manipulation?"*
- *"How do I create a dynamic page powered by HubDB?"*

---

## Knowledge Sources

All knowledge is sourced from official HubSpot developer documentation:

- https://developers.hubspot.com/docs/cms/hubl/variables
- https://developers.hubspot.com/docs/cms/hubl/filters
- https://developers.hubspot.com/docs/cms/hubl/functions
- https://developers.hubspot.com/docs/cms/hubl/tags
- https://developers.hubspot.com/docs/cms/building-blocks/templates/overview
- https://developers.hubspot.com/docs/cms/building-blocks/modules/overview
- https://developers.hubspot.com/docs/cms/building-blocks/themes
- https://developers.hubspot.com/docs/cms/developer-reference/local-development-cms-cli
- https://developers.hubspot.com/docs/cms/data/hubdb
- https://developers.hubspot.com/docs/cms/data/serverless-functions

---

## Contributing / Updating

To update the knowledge base as HubSpot releases new features:

1. Edit the relevant file in `src/knowledge/`
2. Run `npm run build`
3. Commit and push

Knowledge files are plain JSON — no compilation needed for content changes, only for code changes.

---

## License

MIT
