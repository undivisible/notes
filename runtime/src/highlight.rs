use syntect::easy::HighlightLines;
use syntect::html::styled_line_to_highlighted_html;
use syntect::parsing::SyntaxSet;
use syntect::highlighting::ThemeSet;
use syntect::util::LinesWithEndings;

thread_local! {
    static SYNTAX_SET: SyntaxSet = SyntaxSet::load_defaults_newlines();
    static THEME_SET: ThemeSet = ThemeSet::load_defaults();
}

pub fn highlight_code(lang: &str, code: &str) -> String {
    SYNTAX_SET.with(|ss| {
        THEME_SET.with(|ts| {
            let syntax = resolve_language(ss, lang);
            let theme = &ts.themes["base16-ocean.dark"];

            let mut highlighter = HighlightLines::new(syntax, theme);
            let mut output = String::new();

            for line in LinesWithEndings::from(code) {
                let ranges = match highlighter.highlight_line(line, ss) {
                    Ok(r) => r,
                    Err(_) => {
                        output.push_str(&html_escape(line));
                        continue;
                    }
                };
                match styled_line_to_highlighted_html(&ranges, syntect::html::IncludeBackground::No) {
                    Ok(html) => output.push_str(&html),
                    Err(_) => output.push_str(&html_escape(line)),
                }
            }

            output
        })
    })
}

fn resolve_language<'a>(ss: &'a SyntaxSet, lang: &str) -> &'a syntect::parsing::SyntaxReference {
    let lower = lang.to_lowercase().trim().to_string();
    if lower.is_empty() {
        return ss.find_syntax_plain_text();
    }

    let name_map: &[(&str, &str)] = &[
        ("js", "JavaScript"), ("javascript", "JavaScript"),
        ("ts", "TypeScript"), ("typescript", "TypeScript"),
        ("jsx", "JavaScript (JSX)"),
        ("tsx", "TypeScriptReact"), ("tsx", "TypeScript (TSX)"),
        ("py", "Python"), ("python", "Python"),
        ("rs", "Rust"), ("rust", "Rust"),
        ("go", "Go"), ("golang", "Go"),
        ("java", "Java"),
        ("c", "C"),
        ("cpp", "C++"), ("c++", "C++"),
        ("html", "HTML"),
        ("css", "CSS"),
        ("json", "JSON"),
        ("yaml", "YAML"), ("yml", "YAML"),
        ("sql", "SQL"),
        ("sh", "Shell Script"), ("bash", "Shell Script"), ("shell", "Shell Script"),
        ("md", "Markdown"), ("markdown", "Markdown"),
        ("rb", "Ruby"), ("ruby", "Ruby"),
        ("php", "PHP"),
        ("swift", "Swift"),
        ("kotlin", "Kotlin"),
        ("scala", "Scala"),
        ("dart", "Dart"),
        ("lua", "Lua"),
        ("r", "R"),
        ("toml", "TOML"),
        ("ini", "INI"),
        ("dockerfile", "Dockerfile"), ("docker", "Dockerfile"),
        ("makefile", "Makefile"),
        ("diff", "Diff"),
        ("xml", "XML"),
        ("graphql", "GraphQL"),
    ];

    let lookup = name_map
        .iter()
        .find(|(k, _)| lower == *k)
        .map(|(_, v)| *v);

    if let Some(name) = lookup {
        if let Some(s) = ss.find_syntax_by_name(name) {
            return s;
        }
    }

    ss.find_syntax_by_extension(&lower)
        .unwrap_or_else(|| ss.find_syntax_plain_text())
}

pub fn highlight_html_content(html: &str) -> String {
    let mut result = String::with_capacity(html.len() * 2);
    let mut search_from = 0;

    loop {
        let pre_tag = match html[search_from..].find("<pre") {
            Some(p) => search_from + p,
            None => break,
        };

        let tag_end = match html[pre_tag..].find('>') {
            Some(p) => pre_tag + p + 1,
            None => break,
        };

        let pre_close = match html[tag_end..].find("</pre>") {
            Some(p) => tag_end + p,
            None => break,
        };
        let pre_end = pre_close + "</pre>".len();

        // Copy everything before this pre block
        result.push_str(&html[search_from..pre_tag]);

        // Extract the opening tag
        let opening_tag = &html[pre_tag..tag_end];
        let lang = extract_lang_attribute(opening_tag);

        // Extract raw text from inner content (strip HTML tags/decode entities)
        let raw_html = &html[tag_end..pre_close];
        let raw_text = decode_and_strip_tags(raw_html);

        // Highlight the code
        let highlighted = highlight_code(&lang, &raw_text);

        // Write the pre block with highlighted content
        result.push_str(opening_tag);
        result.push_str(&highlighted);
        result.push_str("</pre>");

        search_from = pre_end;
    }

    result.push_str(&html[search_from..]);
    result
}

fn extract_lang_attribute(tag: &str) -> String {
    for attr in &["data-lang=\"", "data-lang='"] {
        if let Some(pos) = tag.find(attr) {
            let start = pos + attr.len();
            let end_char = if attr.ends_with('"') { '"' } else { '\'' };
            if let Some(end) = tag[start..].find(end_char) {
                return tag[start..start + end].to_string();
            }
        }
    }
    String::new()
}

fn decode_and_strip_tags(html: &str) -> String {
    let decoded = html
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&amp;", "&")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&apos;", "'")
        .replace("<br>", "\n")
        .replace("<br/>", "\n")
        .replace("<br />", "\n");

    let mut out = String::new();
    let mut in_tag = false;
    for c in decoded.chars() {
        match c {
            '<' => in_tag = true,
            '>' => { in_tag = false; }
            _ if !in_tag => out.push(c),
            _ => {}
        }
    }
    out
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}
