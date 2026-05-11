#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import hublVariables from "./knowledge/hubl-variables.json";
import hublFilters from "./knowledge/hubl-filters.json";
import hublFunctions from "./knowledge/hubl-functions.json";
import hublTags from "./knowledge/hubl-tags.json";
import hublSyntax from "./knowledge/hubl-syntax.json";
import templates from "./knowledge/templates.json";
import modules from "./knowledge/modules.json";
import themes from "./knowledge/themes.json";
import cliCommands from "./knowledge/cli-commands.json";
import hubdb from "./knowledge/hubdb.json";
import serverless from "./knowledge/serverless.json";

const knowledgeBase: Record<string, unknown> = {
  "hubl-variables": hublVariables,
  "hubl-filters": hublFilters,
  "hubl-functions": hublFunctions,
  "hubl-tags": hublTags,
  "hubl-syntax": hublSyntax,
  templates,
  modules,
  themes,
  "cli-commands": cliCommands,
  hubdb,
  serverless,
};

function searchInObject(obj: unknown, query: string): boolean {
  const text = JSON.stringify(obj).toLowerCase();
  return query
    .toLowerCase()
    .split(" ")
    .every((term) => text.includes(term));
}

function searchKnowledge(query: string, category?: string): unknown[] {
  const results: unknown[] = [];
  const sources = category ? { [category]: knowledgeBase[category] } : knowledgeBase;

  for (const [cat, data] of Object.entries(sources)) {
    if (!data || typeof data !== "object") continue;

    // Search arrays within the data
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (searchInObject(item, query)) {
            results.push({ category: cat, section: key, item });
          }
        }
      } else if (typeof value === "object" && value !== null) {
        for (const [subKey, subValue] of Object.entries(value as Record<string, unknown>)) {
          if (Array.isArray(subValue)) {
            for (const item of subValue) {
              if (searchInObject(item, query)) {
                results.push({ category: cat, section: `${key}.${subKey}`, item });
              }
            }
          } else if (searchInObject(subValue, query)) {
            results.push({ category: cat, section: key, item: { [subKey]: subValue } });
          }
        }
      }
    }
  }

  return results;
}

const server = new Server(
  {
    name: "hubspot-dev-knowledge",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
);

server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: Object.keys(knowledgeBase).map((key) => ({
      uri: `hubspot://knowledge/${key}`,
      name: `HubSpot CMS: ${key}`,
      description: (knowledgeBase[key] as Record<string, string>).description || key,
      mimeType: "application/json",
    })),
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const uri = request.params.uri;
  const key = uri.replace("hubspot://knowledge/", "");
  const data = knowledgeBase[key];

  if (!data) {
    throw new Error(`Unknown resource: ${uri}`);
  }

  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
});

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "search_hubspot_docs",
        description:
          "Search across all HubSpot CMS developer documentation. Returns matching entries for HubL variables, filters, functions, tags, templates, modules, themes, CLI commands, HubDB, and serverless functions.",
        inputSchema: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "Search query — e.g. 'blog recent posts', 'image field', 'dnd_area', 'serverless fetch'",
            },
            category: {
              type: "string",
              description:
                "Optional: limit search to a specific category",
              enum: [
                "hubl-variables",
                "hubl-filters",
                "hubl-functions",
                "hubl-tags",
                "hubl-syntax",
                "templates",
                "modules",
                "themes",
                "cli-commands",
                "hubdb",
                "serverless",
              ],
            },
          },
          required: ["query"],
        },
      },
      {
        name: "get_hubl_variables",
        description:
          "Get HubL variables available in HubSpot CMS templates. Filter by section: global, website_page, http_request, blog, email, hubdb, crm_dynamic, menu, editor.",
        inputSchema: {
          type: "object",
          properties: {
            section: {
              type: "string",
              description: "Optional variable section to retrieve",
              enum: [
                "global",
                "website_page",
                "http_request",
                "blog",
                "email",
                "hubdb",
                "crm_dynamic",
                "menu",
                "editor",
                "all",
              ],
            },
          },
        },
      },
      {
        name: "get_hubl_filters",
        description:
          "Get HubL filters for transforming output. Optionally search by filter name or keyword.",
        inputSchema: {
          type: "object",
          properties: {
            search: {
              type: "string",
              description: "Optional: filter name or keyword to search for",
            },
          },
        },
      },
      {
        name: "get_hubl_functions",
        description:
          "Get HubL built-in functions with syntax, parameters, and examples. Optionally search by function name or category (blog, crm, hubdb, file, color, etc.).",
        inputSchema: {
          type: "object",
          properties: {
            search: {
              type: "string",
              description: "Optional: function name or keyword (e.g. 'blog', 'crm_object', 'hubdb')",
            },
          },
        },
      },
      {
        name: "get_hubl_tags",
        description:
          "Get HubL standard tags (blog, form, image, dnd_area, widget_container, etc.) with syntax and parameters.",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Optional tag category filter",
              enum: [
                "blog",
                "content-input",
                "interactive",
                "layout",
                "media",
                "multilanguage",
                "email",
                "drag-and-drop",
                "asset-loading",
                "required",
                "editor",
                "all",
              ],
            },
          },
        },
      },
      {
        name: "get_hubl_syntax",
        description:
          "Get HubL language syntax reference: delimiters, statements (if/for/macro/set), operators, expression tests, and common code patterns.",
        inputSchema: {
          type: "object",
          properties: {
            section: {
              type: "string",
              description: "Optional syntax section",
              enum: ["delimiters", "statements", "operators", "expression_tests", "common_patterns", "all"],
            },
          },
        },
      },
      {
        name: "get_template_types",
        description:
          "Get all HubSpot CMS template types with required variables, annotations, and file structures. Includes page, blog_listing, blog_post, email, partial, global_partial, error_page, membership pages, etc.",
        inputSchema: {
          type: "object",
          properties: {
            type: {
              type: "string",
              description: "Optional: specific template type to get details for",
            },
          },
        },
      },
      {
        name: "get_module_reference",
        description:
          "Get HubSpot CMS module structure reference: file anatomy (meta.json, fields.json, module.html), all field types with examples, and patterns for accessing field values in templates.",
        inputSchema: {
          type: "object",
          properties: {
            section: {
              type: "string",
              description: "Optional section",
              enum: ["file_structure", "meta_json", "fields_json", "field_types", "css_js_patterns", "all"],
            },
            field_type: {
              type: "string",
              description: "Optional: get details for a specific field type (text, image, richtext, color, font, group, link, etc.)",
            },
          },
        },
      },
      {
        name: "get_theme_reference",
        description:
          "Get HubSpot CMS theme structure: theme.json config, fields.json for theme editor, directory structure, CSS usage with theme variables, and boilerplate info.",
        inputSchema: {
          type: "object",
          properties: {
            section: {
              type: "string",
              description: "Optional section",
              enum: ["structure", "theme_json", "fields_json", "theme_css_usage", "cli_commands", "boilerplate", "localization", "all"],
            },
          },
        },
      },
      {
        name: "get_cli_commands",
        description:
          "Get HubSpot CMS CLI commands. Filter by group: general, account, cms, projects, hubdb, custom_objects. Also includes common development workflows.",
        inputSchema: {
          type: "object",
          properties: {
            group: {
              type: "string",
              description: "Optional command group",
              enum: ["general", "account", "cms", "projects", "hubdb", "custom_objects", "all"],
            },
            search: {
              type: "string",
              description: "Optional: search for specific command keyword",
            },
          },
        },
      },
      {
        name: "get_hubdb_reference",
        description:
          "Get HubDB reference: table structure, column types, HubL usage with filter operators, dynamic pages setup, and CLI commands.",
        inputSchema: {
          type: "object",
          properties: {
            section: {
              type: "string",
              description: "Optional section",
              enum: ["overview", "column_types", "limits", "hubl_usage", "filter_operators", "dynamic_pages", "cli_commands", "all"],
            },
          },
        },
      },
      {
        name: "get_serverless_reference",
        description:
          "Get HubSpot CMS serverless functions reference: structure, serverless.json config, function signature, context object, response format, secrets, and code examples.",
        inputSchema: {
          type: "object",
          properties: {
            section: {
              type: "string",
              description: "Optional section",
              enum: ["overview", "limits", "structure", "serverless_json", "function_signature", "context_object", "response_object", "secrets_usage", "examples", "calling_from_frontend", "debugging", "all"],
            },
          },
        },
      },
      {
        name: "list_topics",
        description: "List all available knowledge topics and categories in this HubSpot CMS developer knowledge base.",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  const a = (args || {}) as Record<string, string>;

  switch (name) {
    case "search_hubspot_docs": {
      if (!a.query) throw new Error("query is required");
      const results = searchKnowledge(a.query, a.category);
      const limited = results.slice(0, 20);
      return {
        content: [
          {
            type: "text",
            text: limited.length
              ? `Found ${results.length} result(s) (showing ${limited.length}):\n\n${JSON.stringify(limited, null, 2)}`
              : `No results found for "${a.query}"${a.category ? ` in category "${a.category}"` : ""}.`,
          },
        ],
      };
    }

    case "get_hubl_variables": {
      const section = a.section || "all";
      const data = hublVariables as { sections: Record<string, unknown>; cache_disabling_variables: string[] };

      if (section === "all") {
        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      }

      const sectionData = data.sections[section];
      if (!sectionData) {
        return {
          content: [
            {
              type: "text",
              text: `Section "${section}" not found. Available sections: ${Object.keys(data.sections).join(", ")}`,
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify(sectionData, null, 2) }],
      };
    }

    case "get_hubl_filters": {
      const data = hublFilters as { filters: Array<Record<string, unknown>> };
      let filters = data.filters;

      if (a.search) {
        const q = a.search.toLowerCase();
        filters = filters.filter(
          (f) =>
            f.name?.toString().toLowerCase().includes(q) ||
            f.description?.toString().toLowerCase().includes(q) ||
            f.syntax?.toString().toLowerCase().includes(q)
        );
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ filters, total: filters.length }, null, 2),
          },
        ],
      };
    }

    case "get_hubl_functions": {
      const data = hublFunctions as { functions: Array<Record<string, unknown>>; notes: string[] };
      let fns = data.functions;

      if (a.search) {
        const q = a.search.toLowerCase();
        fns = fns.filter(
          (f) =>
            f.name?.toString().toLowerCase().includes(q) ||
            f.description?.toString().toLowerCase().includes(q) ||
            f.syntax?.toString().toLowerCase().includes(q)
        );
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ notes: data.notes, functions: fns, total: fns.length }, null, 2),
          },
        ],
      };
    }

    case "get_hubl_tags": {
      const data = hublTags as { tags: Array<Record<string, unknown>> };
      let tags = data.tags;
      const cat = a.category;

      if (cat && cat !== "all") {
        tags = tags.filter((t) => t.category === cat);
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ tags, total: tags.length }, null, 2) }],
      };
    }

    case "get_hubl_syntax": {
      const section = a.section || "all";
      const data = hublSyntax as { sections: Record<string, unknown> };

      if (section === "all") {
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      const sectionData = (data.sections as Record<string, unknown>)[section];
      return {
        content: [{ type: "text", text: JSON.stringify(sectionData || `Section "${section}" not found.`, null, 2) }],
      };
    }

    case "get_template_types": {
      const data = templates as { template_types: Array<Record<string, unknown>> };

      if (a.type) {
        const found = data.template_types.find(
          (t) => t.type === a.type || t.annotation?.toString().includes(a.type)
        );
        return {
          content: [
            {
              type: "text",
              text: found
                ? JSON.stringify(found, null, 2)
                : `Template type "${a.type}" not found. Available: ${data.template_types.map((t) => t.type).join(", ")}`,
            },
          ],
        };
      }

      return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
    }

    case "get_module_reference": {
      const data = modules as Record<string, unknown>;
      const section = a.section || "all";

      if (a.field_type) {
        const fieldTypes = (data.fields_json as { field_types: Array<Record<string, unknown>> }).field_types;
        const found = fieldTypes.find((f) => f.type === a.field_type);
        return {
          content: [
            {
              type: "text",
              text: found
                ? JSON.stringify(found, null, 2)
                : `Field type "${a.field_type}" not found. Available: ${fieldTypes.map((f) => f.type).join(", ")}`,
            },
          ],
        };
      }

      if (section === "all") {
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data[section] || `Section "${section}" not found.`, null, 2),
          },
        ],
      };
    }

    case "get_theme_reference": {
      const data = themes as Record<string, unknown>;
      const section = a.section || "all";

      if (section === "all") {
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data[section] || `Section "${section}" not found.`, null, 2),
          },
        ],
      };
    }

    case "get_cli_commands": {
      const data = cliCommands as { groups: Record<string, { label: string; commands: Array<Record<string, string>> }>; common_workflows: unknown[] };
      const group = a.group || "all";

      if (a.search) {
        const q = a.search.toLowerCase();
        const matches: Array<{ group: string; command: Record<string, string> }> = [];
        for (const [grp, grpData] of Object.entries(data.groups)) {
          for (const cmd of grpData.commands) {
            if (cmd.command.toLowerCase().includes(q) || cmd.description.toLowerCase().includes(q)) {
              matches.push({ group: grp, command: cmd });
            }
          }
        }
        return { content: [{ type: "text", text: JSON.stringify({ matches, total: matches.length }, null, 2) }] };
      }

      if (group === "all") {
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      const grpData = data.groups[group];
      return {
        content: [
          {
            type: "text",
            text: grpData
              ? JSON.stringify(grpData, null, 2)
              : `Group "${group}" not found. Available: ${Object.keys(data.groups).join(", ")}`,
          },
        ],
      };
    }

    case "get_hubdb_reference": {
      const data = hubdb as Record<string, unknown>;
      const section = a.section || "all";

      if (section === "all") {
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      if (section === "filter_operators") {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify((data.hubl_usage as { filter_operators: unknown[] }).filter_operators, null, 2),
            },
          ],
        };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data[section] || `Section "${section}" not found.`, null, 2),
          },
        ],
      };
    }

    case "get_serverless_reference": {
      const data = serverless as Record<string, unknown>;
      const section = a.section || "all";

      if (section === "all") {
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data[section] || `Section "${section}" not found.`, null, 2),
          },
        ],
      };
    }

    case "list_topics": {
      const topics = Object.entries(knowledgeBase).map(([key, value]) => ({
        category: key,
        description: (value as Record<string, string>).description || "",
        source: (value as Record<string, string>).source || "",
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                total_categories: topics.length,
                topics,
                usage_tip: "Use search_hubspot_docs for cross-category search, or specific get_* tools for detailed retrieval.",
              },
              null,
              2
            ),
          },
        ],
      };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("HubSpot Dev Knowledge MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
