use std::cell::RefCell;
use wasm_bindgen::prelude::*;

mod highlight;

// ── Templates ────────────────────────────────────────────────────────────────

const EDITOR_TEMPLATE: &str = include_str!("../../editor.crepus");

// ── State ────────────────────────────────────────────────────────────────────

#[derive(Clone)]
struct Tab {
    id: String,
    title: String,
    content: String,
}

thread_local! {
    static TABS: RefCell<Vec<Tab>> = RefCell::new(Vec::new());
    static ACTIVE_ID: RefCell<String> = RefCell::new(String::new());
    static SHOW_HELP: RefCell<bool> = RefCell::new(false);
    static SHOW_SEARCH: RefCell<bool> = RefCell::new(false);
    static LOADED: RefCell<bool> = RefCell::new(false);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

fn storage() -> Option<web_sys::Storage> {
    web_sys::window()
        .and_then(|w| w.local_storage().ok().flatten())
}

fn next_id() -> String {
    let s = storage();
    let current = s
        .as_ref()
        .and_then(|s| s.get_item("note-counter").ok().flatten())
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(0);
    let next = current + 1;
    if let Some(s) = s.as_ref() {
        let _ = s.set_item("note-counter", &next.to_string());
    }
    format!("n{next}")
}

fn content_key(id: &str) -> String {
    format!("note-content-{id}")
}

fn sync_active_content() {
    let doc = web_sys::window()
        .and_then(|w| w.document())
        .unwrap_or_else(|| panic!("no doc"));
    if let Ok(Some(el)) = doc.query_selector(".editable") {
        let html = el.inner_html();
        TABS.with(|tabs| {
            let mut tabs = tabs.borrow_mut();
            let active = ACTIVE_ID.with(|a| a.borrow().clone());
            if let Some(tab) = tabs.iter_mut().find(|t| t.id == active) {
                tab.content = html;
            }
        });
    }
}

fn save_tab_list(tabs: &[Tab]) {
    let list: Vec<serde_json::Value> = tabs
        .iter()
        .map(|t| serde_json::json!({"id": t.id, "title": t.title}))
        .collect();
    if let Some(s) = storage() {
        let _ = s.set_item(
            "note-tabs",
            &serde_json::to_string(&list).unwrap_or_default(),
        );
    }
}

fn persist_active() {
    if let Some(s) = storage() {
        ACTIVE_ID.with(|a| {
            let _ = s.set_item("note-active", &a.borrow());
        });
    }
}

fn load_state() {
    if LOADED.with(|l| *l.borrow()) {
        return;
    }
    LOADED.with(|l| *l.borrow_mut() = true);

    let s = storage();
    let saved_tabs: Vec<serde_json::Value> = s
        .as_ref()
        .and_then(|s| s.get_item("note-tabs").ok().flatten())
        .and_then(|v| serde_json::from_str(&v).ok())
        .unwrap_or_default();

    let saved_active = s
        .as_ref()
        .and_then(|s| s.get_item("note-active").ok().flatten())
        .unwrap_or_default();

    let mut tabs: Vec<Tab> = saved_tabs
        .iter()
        .map(|v| {
            let id = v["id"].as_str().unwrap_or("").to_string();
            let title = v["title"].as_str().unwrap_or("untitled").to_string();
            let content = s
                .as_ref()
                .and_then(|s| s.get_item(&content_key(&id)).ok().flatten())
                .unwrap_or_default();
            Tab { id, title, content }
        })
        .collect();

    if tabs.is_empty() {
        let id = next_id();
        tabs.push(Tab {
            id,
            title: "untitled".to_string(),
            content: String::new(),
        });
    }

    let active = if tabs.iter().any(|t| t.id == saved_active) {
        saved_active
    } else {
        tabs.first().map(|t| t.id.clone()).unwrap_or_default()
    };

    save_tab_list(&tabs);
    TABS.with(|t| *t.borrow_mut() = tabs);
    ACTIVE_ID.with(|a| *a.borrow_mut() = active);
}

// ── Render context ───────────────────────────────────────────────────────────

fn build_context() -> crepuscularity_core::context::TemplateContext {
    use crepuscularity_core::context::{TemplateContext, TemplateValue};

    let tabs = TABS.with(|t| t.borrow().clone());
    let active_id = ACTIVE_ID.with(|a| a.borrow().clone());
    let active_content = tabs
        .iter()
        .find(|t| t.id == active_id)
        .map(|t| t.content.clone())
        .unwrap_or_default();
    let empty = active_content.trim().is_empty();

    let mut ctx = TemplateContext::new();
    let tab_ctxs: Vec<TemplateContext> = tabs
        .iter()
        .map(|t| {
            let mut tc = TemplateContext::new();
            tc.set("id", t.id.clone());
            tc.set("title", t.title.clone());
            tc.set("active", t.id == active_id);
            tc
        })
        .collect();

    ctx.vars
        .insert("tabs".to_string(), TemplateValue::List(tab_ctxs));
    ctx.set("empty", empty);
    ctx.vars.insert(
        "active_content".to_string(),
        TemplateValue::Str(highlight::highlight_html_content(&active_content)),
    );
    ctx
}

// ── Editor-visible trigger ───────────────────────────────────────────────────

fn trigger_editor_rerender() {
    if let Ok(event) = web_sys::CustomEvent::new("crepus-rerender-editor") {
        let _ = web_sys::window()
            .unwrap()
            .dispatch_event(&event);
    }
}

#[wasm_bindgen]
pub fn init_editor_listener() {
    // called once from main(); sets up custom-event listener for editor rerender
    let cb = wasm_bindgen::closure::Closure::wrap(Box::new(move |_e: web_sys::Event| {
        // JS side handles the actual rerender via app.js window listener
    }) as Box<dyn FnMut(_)>);
    let _ = web_sys::window()
        .unwrap()
        .add_event_listener_with_callback("crepus-rerender-editor", cb.as_ref().unchecked_ref());
    cb.forget();
}

// ── WASM exports ─────────────────────────────────────────────────────────────

#[wasm_bindgen]
pub fn crepus_render(bundle_json: &str) -> Result<String, JsValue> {
    sync_active_content();
    let mut ctx = crepuscularity_core::context::TemplateContext::new();
    ctx.set("show_help", SHOW_HELP.with(|h| *h.borrow()));
    ctx.set("show_search", SHOW_SEARCH.with(|s| *s.borrow()));
    crepuscularity_web::render_bundle_with_context(bundle_json, &ctx)
        .map_err(|e| JsValue::from_str(&e))
}

#[wasm_bindgen]
pub fn render_editor(_props_json: &str) -> Result<String, JsValue> {
    load_state();
    let ctx = build_context();
    crepuscularity_web::render_template_to_html(EDITOR_TEMPLATE, &ctx)
        .map_err(|e| JsValue::from_str(&e))
}

// ── Click handlers (trigger scope re-render in app.js) ───────────────────────

#[wasm_bindgen]
pub fn on_select_tab(data: &str) -> Result<(), JsValue> {
    let parsed: serde_json::Value =
        serde_json::from_str(data).unwrap_or(serde_json::Value::Null);
    let tab_id = parsed["data-tab-id"]
        .as_str()
        .unwrap_or("")
        .to_string();
    if tab_id.is_empty() {
        return Ok(());
    }
    sync_active_content();
    ACTIVE_ID.with(|a| *a.borrow_mut() = tab_id.clone());
    persist_active();
    Ok(())
}

#[wasm_bindgen]
pub fn on_close_tab(data: &str) -> Result<(), JsValue> {
    let parsed: serde_json::Value =
        serde_json::from_str(data).unwrap_or(serde_json::Value::Null);
    let tab_id = parsed["data-tab-id"]
        .as_str()
        .unwrap_or("")
        .to_string();
    if tab_id.is_empty() {
        return Ok(());
    }
    sync_active_content();

    if let Some(s) = storage() {
        let _ = s.remove_item(&content_key(&tab_id));
    }

    TABS.with(|tabs| {
        let mut tabs = tabs.borrow_mut();
        tabs.retain(|t| t.id != tab_id);
        if tabs.is_empty() {
            let id = next_id();
            tabs.push(Tab {
                id: id.clone(),
                title: "untitled".to_string(),
                content: String::new(),
            });
            ACTIVE_ID.with(|a| *a.borrow_mut() = id);
        } else {
            let active = ACTIVE_ID.with(|a| a.borrow().clone());
            if active == tab_id || !tabs.iter().any(|t| t.id == active) {
                let new_active = tabs[0].id.clone();
                ACTIVE_ID.with(|a| *a.borrow_mut() = new_active);
            }
        }
        save_tab_list(&tabs);
    });
    persist_active();
    Ok(())
}

#[wasm_bindgen]
pub fn on_new_tab(_data: &str) -> Result<(), JsValue> {
    sync_active_content();
    let id = next_id();
    TABS.with(|tabs| {
        let mut tabs = tabs.borrow_mut();
        tabs.push(Tab {
            id: id.clone(),
            title: "untitled".to_string(),
            content: String::new(),
        });
        save_tab_list(&tabs);
    });
    ACTIVE_ID.with(|a| *a.borrow_mut() = id);
    persist_active();
    Ok(())
}

// ── Keyboard handler (no auto-rerender) ──────────────────────────────────────

#[wasm_bindgen]
pub fn on_keydown(data: &str) -> Result<(), JsValue> {
    let parsed: serde_json::Value =
        serde_json::from_str(data).unwrap_or(serde_json::Value::Null);
    let key = parsed["_key"].as_str().unwrap_or("");
    let meta = parsed["_meta"].as_bool().unwrap_or(false);
    let ctrl = parsed["_ctrl"].as_bool().unwrap_or(false);

    if (meta || ctrl) && key == "t" {
        on_new_tab("{}")?;
        trigger_editor_rerender();
    }
    if (meta || ctrl) && key == "w" {
        let active = ACTIVE_ID.with(|a| a.borrow().clone());
        if !active.is_empty() {
            let data = format!("{{\"data-tab-id\":\"{active}\"}}");
            on_close_tab(&data)?;
            trigger_editor_rerender();
        }
    }
    Ok(())
}

// ── Input handler (no auto-rerender) ─────────────────────────────────────────

#[wasm_bindgen]
pub fn on_editor_input(_data: &str) -> Result<(), JsValue> {
    sync_active_content();
    let active = ACTIVE_ID.with(|a| a.borrow().clone());
    if let Some(s) = storage() {
        TABS.with(|tabs| {
            if let Some(tab) = tabs.borrow().iter().find(|t| t.id == active) {
                let _ = s.set_item(&content_key(&tab.id), &tab.content);
            }
        });
    }
    update_counts();
    Ok(())
}

// ── Counts display ───────────────────────────────────────────────────────────

fn update_counts() {
    let (words, chars) = TABS.with(|tabs| {
        let tabs = tabs.borrow();
        let active = ACTIVE_ID.with(|a| a.borrow().clone());
        tabs.iter().find(|t| t.id == active).map_or((0, 0), |t| {
            let text = strip_html(&t.content);
            let words = text.split_whitespace().count();
            let chars = text.chars().count();
            (words, chars)
        })
    });

    if let Some(doc) = web_sys::window().and_then(|w| w.document()) {
        if let Some(el) = doc.get_element_by_id("word-count") {
            let _ = el.set_text_content(Some(&words.to_string()));
        }
        if let Some(el) = doc.get_element_by_id("char-count") {
            let _ = el.set_text_content(Some(&chars.to_string()));
        }
    }
}

fn strip_html(html: &str) -> String {
    let mut out = String::new();
    let mut in_tag = false;
    for c in html.chars() {
        match c {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => out.push(c),
            _ => {}
        }
    }
    out
}

// ── Shell handlers (full page rerender) ─────────────────────────────────────

#[wasm_bindgen]
pub fn on_page_new_tab(_data: &str) -> Result<(), JsValue> {
    sync_active_content();
    on_new_tab("{}")?;
    // do NOT trigger scope rerender here — the shell handles will cause full rerender()
    Ok(())
}

#[wasm_bindgen]
pub fn on_toggle_help(_data: &str) -> Result<(), JsValue> {
    sync_active_content();
    SHOW_HELP.with(|h| *h.borrow_mut() = !*h.borrow());
    Ok(())
}

#[wasm_bindgen]
pub fn on_export_md(_data: &str) -> Result<(), JsValue> {
    sync_active_content();
    let (title, content) = TABS.with(|tabs| {
        let tabs = tabs.borrow();
        let active = ACTIVE_ID.with(|a| a.borrow().clone());
        let tab = tabs.iter().find(|t| t.id == active);
        (
            tab.map(|t| t.title.clone()).unwrap_or_else(|| "note".to_string()),
            tab.map(|t| t.content.clone()).unwrap_or_default(),
        )
    });

    if let Some(doc) = web_sys::window().and_then(|w| w.document()) {
        if let Ok(Some(body)) = doc.query_selector("body") {
            if let Ok(a) = doc.create_element("a") {
                if let Ok(a) = a.dyn_into::<web_sys::HtmlAnchorElement>() {
                    let encoded = content.replace('%', "%25").replace('\n', "%0A");
                    let _ = a.set_download(&format!("{title}.html"));
                    let _ = a.set_href(&format!("data:text/html;charset=utf-8,{encoded}"));
                    let _ = body.append_child(&a);
                    a.click();
                    let _ = body.remove_child(&a);
                }
            }
        }
    }
    Ok(())
}

#[wasm_bindgen]
pub fn on_open_search(_data: &str) -> Result<(), JsValue> {
    SHOW_SEARCH.with(|s| *s.borrow_mut() = true);
    Ok(())
}

#[wasm_bindgen]
pub fn on_close_search(_data: &str) -> Result<(), JsValue> {
    SHOW_SEARCH.with(|s| *s.borrow_mut() = false);
    Ok(())
}

#[wasm_bindgen]
pub fn runtime_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}
