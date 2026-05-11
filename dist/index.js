#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const index_js_1 = require("@modelcontextprotocol/sdk/server/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const types_js_1 = require("@modelcontextprotocol/sdk/types.js");
const hubl_variables_json_1 = __importDefault(require("./knowledge/hubl-variables.json"));
const hubl_filters_json_1 = __importDefault(require("./knowledge/hubl-filters.json"));
const hubl_functions_json_1 = __importDefault(require("./knowledge/hubl-functions.json"));
const hubl_tags_json_1 = __importDefault(require("./knowledge/hubl-tags.json"));
const hubl_syntax_json_1 = __importDefault(require("./knowledge/hubl-syntax.json"));
const templates_json_1 = __importDefault(require("./knowledge/templates.json"));
const modules_json_1 = __importDefault(require("./knowledge/modules.json"));
const themes_json_1 = __importDefault(require("./knowledge/themes.json"));
const cli_commands_json_1 = __importDefault(require("./knowledge/cli-commands.json"));
const hubdb_json_1 = __importDefault(require("./knowledge/hubdb.json"));
const serverless_json_1 = __importDefault(require("./knowledge/serverless.json"));
const knowledgeBase = {
    "hubl-variables": hubl_variables_json_1.default,
    "hubl-filters": hubl_filters_json_1.default,
    "hubl-functions": hubl_functions_json_1.default,
    "hubl-tags": hubl_tags_json_1.default,
    "hubl-syntax": hubl_syntax_json_1.default,
    templates: templates_json_1.default,
    modules: modules_json_1.default,
    themes: themes_json_1.default,
    "cli-commands": cli_commands_json_1.default,
    hubdb: hubdb_json_1.default,
    serverless: serverless_json_1.default,
};
function searchInObject(obj, query) {
    const text = JSON.stringify(obj).toLowerCase();
    return query
        .toLowerCase()
        .split(" ")
        .every((term) => text.includes(term));
}
function searchKnowledge(query, category) {
    const results = [];
    const sources = category ? { [category]: knowledgeBase[category] } : knowledgeBase;
    for (const [cat, data] of Object.entries(sources)) {
        if (!data || typeof data !== "object")
            continue;
        // Search arrays within the data
        for (const [key, value] of Object.entries(data)) {
            if (Array.isArray(value)) {
                for (const item of value) {
                    if (searchInObject(item, query)) {
                        results.push({ category: cat, section: key, item });
                    }
                }
            }
            else if (typeof value === "object" && value !== null) {
                for (const [subKey, subValue] of Object.entries(value)) {
                    if (Array.isArray(subValue)) {
                        for (const item of subValue) {
                            if (searchInObject(item, query)) {
                                results.push({ category: cat, section: `${key}.${subKey}`, item });
                            }
                        }
                    }
                    else if (searchInObject(subValue, query)) {
                        results.push({ category: cat, section: key, item: { [subKey]: subValue } });
                    }
                }
            }
        }
    }
    return results;
}
const server = new index_js_1.Server({
    name: "hubspot-dev-knowledge",
    version: "1.0.0",
}, {
    capabilities: {
        tools: {},
        resources: {},
    },
});
server.setRequestHandler(types_js_1.ListResourcesRequestSchema, async () => {
    return {
        resources: Object.keys(knowledgeBase).map((key) => ({
            uri: `hubspot://knowledge/${key}`,
            name: `HubSpot CMS: ${key}`,
            description: knowledgeBase[key].description || key,
            mimeType: "application/json",
        })),
    };
});
server.setRequestHandler(types_js_1.ReadResourceRequestSchema, async (request) => {
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
server.setRequestHandler(types_js_1.ListToolsRequestSchema, async () => {
    return {
        tools: [
            {
                name: "search_hubspot_docs",
                description: "Search across all HubSpot CMS developer documentation. Returns matching entries for HubL variables, filters, functions, tags, templates, modules, themes, CLI commands, HubDB, and serverless functions.",
                inputSchema: {
                    type: "object",
                    properties: {
                        query: {
                            type: "string",
                            description: "Search query — e.g. 'blog recent posts', 'image field', 'dnd_area', 'serverless fetch'",
                        },
                        category: {
                            type: "string",
                            description: "Optional: limit search to a specific category",
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
                description: "Get HubL variables available in HubSpot CMS templates. Filter by section: global, website_page, http_request, blog, email, hubdb, crm_dynamic, menu, editor.",
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
                description: "Get HubL filters for transforming output. Optionally search by filter name or keyword.",
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
                description: "Get HubL built-in functions with syntax, parameters, and examples. Optionally search by function name or category (blog, crm, hubdb, file, color, etc.).",
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
                description: "Get HubL standard tags (blog, form, image, dnd_area, widget_container, etc.) with syntax and parameters.",
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
                description: "Get HubL language syntax reference: delimiters, statements (if/for/macro/set), operators, expression tests, and common code patterns.",
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
                description: "Get all HubSpot CMS template types with required variables, annotations, and file structures. Includes page, blog_listing, blog_post, email, partial, global_partial, error_page, membership pages, etc.",
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
                description: "Get HubSpot CMS module structure reference: file anatomy (meta.json, fields.json, module.html), all field types with examples, and patterns for accessing field values in templates.",
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
                description: "Get HubSpot CMS theme structure: theme.json config, fields.json for theme editor, directory structure, CSS usage with theme variables, and boilerplate info.",
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
                description: "Get HubSpot CMS CLI commands. Filter by group: general, account, cms, projects, hubdb, custom_objects. Also includes common development workflows.",
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
                description: "Get HubDB reference: table structure, column types, HubL usage with filter operators, dynamic pages setup, and CLI commands.",
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
                description: "Get HubSpot CMS serverless functions reference: structure, serverless.json config, function signature, context object, response format, secrets, and code examples.",
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
server.setRequestHandler(types_js_1.CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const a = (args || {});
    switch (name) {
        case "search_hubspot_docs": {
            if (!a.query)
                throw new Error("query is required");
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
            const data = hubl_variables_json_1.default;
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
            const data = hubl_filters_json_1.default;
            let filters = data.filters;
            if (a.search) {
                const q = a.search.toLowerCase();
                filters = filters.filter((f) => f.name?.toString().toLowerCase().includes(q) ||
                    f.description?.toString().toLowerCase().includes(q) ||
                    f.syntax?.toString().toLowerCase().includes(q));
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
            const data = hubl_functions_json_1.default;
            let fns = data.functions;
            if (a.search) {
                const q = a.search.toLowerCase();
                fns = fns.filter((f) => f.name?.toString().toLowerCase().includes(q) ||
                    f.description?.toString().toLowerCase().includes(q) ||
                    f.syntax?.toString().toLowerCase().includes(q));
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
            const data = hubl_tags_json_1.default;
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
            const data = hubl_syntax_json_1.default;
            if (section === "all") {
                return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
            }
            const sectionData = data.sections[section];
            return {
                content: [{ type: "text", text: JSON.stringify(sectionData || `Section "${section}" not found.`, null, 2) }],
            };
        }
        case "get_template_types": {
            const data = templates_json_1.default;
            if (a.type) {
                const found = data.template_types.find((t) => t.type === a.type || t.annotation?.toString().includes(a.type));
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
            const data = modules_json_1.default;
            const section = a.section || "all";
            if (a.field_type) {
                const fieldTypes = data.fields_json.field_types;
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
            const data = themes_json_1.default;
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
            const data = cli_commands_json_1.default;
            const group = a.group || "all";
            if (a.search) {
                const q = a.search.toLowerCase();
                const matches = [];
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
            const data = hubdb_json_1.default;
            const section = a.section || "all";
            if (section === "all") {
                return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
            }
            if (section === "filter_operators") {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify(data.hubl_usage.filter_operators, null, 2),
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
            const data = serverless_json_1.default;
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
                description: value.description || "",
                source: value.source || "",
            }));
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            total_categories: topics.length,
                            topics,
                            usage_tip: "Use search_hubspot_docs for cross-category search, or specific get_* tools for detailed retrieval.",
                        }, null, 2),
                    },
                ],
            };
        }
        default:
            throw new Error(`Unknown tool: ${name}`);
    }
});
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
    console.error("HubSpot Dev Knowledge MCP server running on stdio");
}
main().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});
