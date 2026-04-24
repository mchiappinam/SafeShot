#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod capture;
mod save;

use std::fs::OpenOptions;
use std::io::Write;

use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_autostart::ManagerExt;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

fn log(msg: &str) {
    if let Some(mut dir) = dirs::data_local_dir() {
        dir.push("SafeShot");
        std::fs::create_dir_all(&dir).ok();
        dir.push("safeshot.log");
        // Rotate log if it exceeds 1MB
        if let Ok(meta) = std::fs::metadata(&dir) {
            if meta.len() > 1_000_000 {
                std::fs::write(&dir, "").ok();
            }
        }
        if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&dir) {
            let _ = writeln!(
                f,
                "[{}] {}",
                chrono::Local::now().format("%Y-%m-%d %H:%M:%S"),
                msg
            );
        }
    }
}

/// Tracks whether a blocking dialog (Save As, Browse folder) is active
pub struct DialogActive(pub std::sync::Mutex<bool>);

fn parse_hotkey(s: &str) -> Option<Shortcut> {
    let parts: Vec<&str> = s.split('+').collect();
    let mut mods = Modifiers::empty();
    let mut code: Option<Code> = None;
    for part in &parts {
        match *part {
            "Ctrl" => mods |= Modifiers::CONTROL,
            "Alt" => mods |= Modifiers::ALT,
            "Shift" => mods |= Modifiers::SHIFT,
            "Meta" => mods |= Modifiers::META,
            key => {
                code = match key {
                    "PrintScreen" => Some(Code::PrintScreen),
                    "KeyA" => Some(Code::KeyA), "KeyB" => Some(Code::KeyB), "KeyC" => Some(Code::KeyC),
                    "KeyD" => Some(Code::KeyD), "KeyE" => Some(Code::KeyE), "KeyF" => Some(Code::KeyF),
                    "KeyG" => Some(Code::KeyG), "KeyH" => Some(Code::KeyH), "KeyI" => Some(Code::KeyI),
                    "KeyJ" => Some(Code::KeyJ), "KeyK" => Some(Code::KeyK), "KeyL" => Some(Code::KeyL),
                    "KeyM" => Some(Code::KeyM), "KeyN" => Some(Code::KeyN), "KeyO" => Some(Code::KeyO),
                    "KeyP" => Some(Code::KeyP), "KeyQ" => Some(Code::KeyQ), "KeyR" => Some(Code::KeyR),
                    "KeyS" => Some(Code::KeyS), "KeyT" => Some(Code::KeyT), "KeyU" => Some(Code::KeyU),
                    "KeyV" => Some(Code::KeyV), "KeyW" => Some(Code::KeyW), "KeyX" => Some(Code::KeyX),
                    "KeyY" => Some(Code::KeyY), "KeyZ" => Some(Code::KeyZ),
                    "Digit0" => Some(Code::Digit0), "Digit1" => Some(Code::Digit1),
                    "Digit2" => Some(Code::Digit2), "Digit3" => Some(Code::Digit3),
                    "Digit4" => Some(Code::Digit4), "Digit5" => Some(Code::Digit5),
                    "Digit6" => Some(Code::Digit6), "Digit7" => Some(Code::Digit7),
                    "Digit8" => Some(Code::Digit8), "Digit9" => Some(Code::Digit9),
                    "F1" => Some(Code::F1), "F2" => Some(Code::F2), "F3" => Some(Code::F3),
                    "F4" => Some(Code::F4), "F5" => Some(Code::F5), "F6" => Some(Code::F6),
                    "F7" => Some(Code::F7), "F8" => Some(Code::F8), "F9" => Some(Code::F9),
                    "F10" => Some(Code::F10), "F11" => Some(Code::F11), "F12" => Some(Code::F12),
                    "Space" => Some(Code::Space), "Escape" => Some(Code::Escape),
                    "Backquote" => Some(Code::Backquote), "Pause" => Some(Code::Pause),
                    "ScrollLock" => Some(Code::ScrollLock), "Insert" => Some(Code::Insert),
                    "Home" => Some(Code::Home), "End" => Some(Code::End),
                    "PageUp" => Some(Code::PageUp), "PageDown" => Some(Code::PageDown),
                    "Delete" => Some(Code::Delete), "Backspace" => Some(Code::Backspace),
                    "Tab" => Some(Code::Tab), "Enter" => Some(Code::Enter),
                    "ArrowUp" => Some(Code::ArrowUp), "ArrowDown" => Some(Code::ArrowDown),
                    "ArrowLeft" => Some(Code::ArrowLeft), "ArrowRight" => Some(Code::ArrowRight),
                    "Minus" => Some(Code::Minus), "Equal" => Some(Code::Equal),
                    "BracketLeft" => Some(Code::BracketLeft), "BracketRight" => Some(Code::BracketRight),
                    "Semicolon" => Some(Code::Semicolon), "Quote" => Some(Code::Quote),
                    "Comma" => Some(Code::Comma), "Period" => Some(Code::Period),
                    "Slash" => Some(Code::Slash), "Backslash" => Some(Code::Backslash),
                    "NumpadAdd" => Some(Code::NumpadAdd), "NumpadSubtract" => Some(Code::NumpadSubtract),
                    "NumpadMultiply" => Some(Code::NumpadMultiply), "NumpadDivide" => Some(Code::NumpadDivide),
                    _ => None,
                };
            }
        }
    }
    let c = code?;
    Some(Shortcut::new(if mods.is_empty() { Some(Modifiers::empty()) } else { Some(mods) }, c))
}

/// Check if Windows is using a light taskbar theme.
#[cfg(target_os = "windows")]
fn is_windows_light_theme() -> bool {
    use std::os::windows::process::CommandExt;
    std::process::Command::new("reg")
        .args(["query", r"HKCU\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize", "/v", "SystemUsesLightTheme"])
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .map(|s| s.contains("0x1"))
        .unwrap_or(false)
}

/// Watch for Windows theme changes and update the tray icon.
/// Uses RegNotifyChangeKeyValue to block until the registry key changes.
#[cfg(target_os = "windows")]
fn watch_windows_theme(app: AppHandle, tray_id: tauri::tray::TrayIconId) {
    use windows_sys::Win32::System::Registry::*;
    unsafe {
        let subkey = "Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize\0"
            .encode_utf16().collect::<Vec<u16>>();
        let mut hkey: HKEY = std::ptr::null_mut();
        let status = RegOpenKeyExW(HKEY_CURRENT_USER, subkey.as_ptr(), 0, KEY_NOTIFY, &mut hkey);
        if status != 0 || hkey.is_null() { return; }

        let mut last_light = is_windows_light_theme();
        loop {
            // Block until the key or any of its values change
            let result = RegNotifyChangeKeyValue(hkey, 0, REG_NOTIFY_CHANGE_LAST_SET, std::ptr::null_mut(), 0);
            if result != 0 { break; }

            let light = is_windows_light_theme();
            if light != last_light {
                last_light = light;
                let icon_bytes: &[u8] = if light {
                    include_bytes!("../icons/tray-icon-dark.png")
                } else {
                    include_bytes!("../icons/tray-icon.png")
                };
                if let Ok(icon) = tauri::image::Image::from_bytes(icon_bytes) {
                    if let Some(tray) = app.tray_by_id(&tray_id) {
                        tray.set_icon(Some(icon)).ok();
                        log(&format!("Tray icon updated for {} theme", if light { "light" } else { "dark" }));
                    }
                }
            }
        }
        RegCloseKey(hkey);
    }
}

fn main() {
    // Catch panics and log them
    std::panic::set_hook(Box::new(|info| {
        log(&format!("PANIC: {}", info));
    }));

    log("SafeShot starting...");

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Second instance tried to launch, trigger a capture on the running instance
            start_capture(app);
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .manage(capture::CaptureCache(std::sync::Mutex::new(Vec::new())))
        .manage(DialogActive(std::sync::Mutex::new(false)))
        .invoke_handler(tauri::generate_handler![
            capture::capture_screens,
            save::save_screenshot,
            save::get_next_filename,
            save::copy_to_clipboard,
            save::get_last_color,
            save::set_last_color,
            save::get_last_thickness,
            save::set_last_thickness,
            save::get_fill_mode,
            save::set_fill_mode,
            save::get_last_tool,
            save::set_last_tool,
            save::get_text_settings,
            save::set_text_settings,
            save::get_settings,
            save::set_setting,
            save::get_last_selection,
            save::set_last_selection,
            save::pick_folder,
            close_overlay,
            close_welcome,
            close_about,
            close_settings,
            register_hotkey,
            pause_hotkey,
            resume_hotkey,
            open_url,
            show_overlay,
            open_settings,
        ])
        .setup(|app| {
            log("Setup starting...");

            // Check if this is a first run (no "welcomed" key in config)
            let first_run = {
                let path = save::config_path();
                let welcomed = if let Ok(data) = std::fs::read_to_string(&path) {
                    serde_json::from_str::<serde_json::Value>(&data)
                        .ok()
                        .and_then(|j| j.get("welcomed").and_then(|v| v.as_bool()))
                        .unwrap_or(false)
                } else {
                    false
                };
                if !welcomed {
                    // Mark as welcomed and enable autostart
                    let mut json = if let Ok(data) = std::fs::read_to_string(&path) {
                        serde_json::from_str::<serde_json::Value>(&data)
                            .unwrap_or(serde_json::json!({}))
                    } else {
                        serde_json::json!({})
                    };
                    json["welcomed"] = serde_json::json!(true);
                    json["autostart"] = serde_json::json!(true);
                    std::fs::write(
                        &path,
                        serde_json::to_string_pretty(&json).unwrap_or_default(),
                    )
                    .ok();
                    let autostart = app.autolaunch();
                    if !autostart.is_enabled().unwrap_or(false) {
                        autostart.enable().ok();
                    }
                    log("First run: autostart enabled");
                    true
                } else {
                    // Restore autostart if config says it should be on but the
                    // registry entry was lost (e.g. after upgrade/reinstall)
                    let config_autostart = if let Ok(data) = std::fs::read_to_string(&path) {
                        serde_json::from_str::<serde_json::Value>(&data)
                            .ok()
                            .and_then(|j| j.get("autostart").and_then(|v| v.as_bool()))
                            .unwrap_or(false)
                    } else {
                        false
                    };
                    let autostart = app.autolaunch();
                    let system_enabled = autostart.is_enabled().unwrap_or(false);
                    if config_autostart && !system_enabled {
                        autostart.enable().ok();
                        log("Autostart restored after reinstall");
                    }
                    false
                }
            };

            // Build tray menu
            let autostart_enabled = app.autolaunch().is_enabled().unwrap_or(false);
            let capture_item =
                MenuItem::with_id(app, "capture", "Capture Screenshot", true, None::<&str>)?;
            let open_folder =
                MenuItem::with_id(app, "open_folder", "Open Save Folder", true, None::<&str>)?;
            let autostart_item = CheckMenuItem::with_id(
                app,
                "autostart",
                "Start on Boot",
                true,
                autostart_enabled,
                None::<&str>,
            )?;
            let about_item = MenuItem::with_id(app, "about", "About", true, None::<&str>)?;
            let guide_item = MenuItem::with_id(app, "guide", "How to Use", true, None::<&str>)?;
            let settings_item = MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit SafeShot", true, None::<&str>)?;
            let menu = Menu::with_items(
                app,
                &[
                    &capture_item,
                    &open_folder,
                    &autostart_item,
                    &guide_item,
                    &settings_item,
                    &about_item,
                    &quit_item,
                ],
            )?;
            log("Tray menu built");

            // Pick the right tray icon for the current theme
            #[cfg(target_os = "windows")]
            let initial_icon_bytes: &[u8] = if is_windows_light_theme() {
                include_bytes!("../icons/tray-icon-dark.png")
            } else {
                include_bytes!("../icons/tray-icon.png")
            };
            #[cfg(target_os = "macos")]
            let initial_icon_bytes: &[u8] = include_bytes!("../icons/tray-icon.png");
            #[cfg(target_os = "linux")]
            let initial_icon_bytes: &[u8] = include_bytes!("../icons/tray-icon-blue.png");

            let tray = TrayIconBuilder::new()
                .icon(tauri::image::Image::from_bytes(initial_icon_bytes).unwrap())
                .icon_as_template(true)
                .tooltip("SafeShot")
                .menu(&menu)
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "capture" => start_capture(app),
                    "open_folder" => open_save_folder(app),
                    "autostart" => toggle_autostart(app),
                    "guide" => show_guide(app),
                    "settings" => show_settings(app),
                    "about" => show_about(app),
                    "quit" => {
                        log("Quit requested");
                        std::process::exit(0);
                    }
                    _ => {}
                })
                .build(app)?;
            log("Tray icon created");

            // Watch for Windows theme changes and swap the tray icon
            #[cfg(target_os = "windows")]
            {
                let tray_id = tray.id().clone();
                let app_handle = app.handle().clone();
                std::thread::spawn(move || {
                    watch_windows_theme(app_handle, tray_id);
                });
            }
            #[cfg(not(target_os = "windows"))]
            let _ = &tray; // suppress unused warning

            // On Windows 11, disable the built-in Snipping Tool PrtScn override
            #[cfg(target_os = "windows")]
            {
                use std::os::windows::process::CommandExt;
                // Set registry key to disable Windows Snipping Tool PrtScn capture
                std::process::Command::new("reg")
                    .args(["add", r"HKCU\Control Panel\Keyboard", "/v", "PrintScreenKeyForSnippingEnabled", "/t", "REG_DWORD", "/d", "0", "/f"])
                    .creation_flags(0x08000000) // CREATE_NO_WINDOW
                    .output()
                    .ok();
                log("Windows PrtScn Snipping Tool override disabled");
            }

            // Register global shortcut from config (or platform default)
            {
                let hotkey_str = {
                    let path = save::config_path();
                    if let Ok(data) = std::fs::read_to_string(&path) {
                        serde_json::from_str::<serde_json::Value>(&data)
                            .ok()
                            .and_then(|j| j.get("hotkey").and_then(|v| v.as_str()).map(String::from))
                    } else {
                        None
                    }
                }.unwrap_or_else(|| {
                    if cfg!(target_os = "macos") { "Meta+Shift+KeyS".to_string() }
                    else { "PrintScreen".to_string() }
                });

                if let Some(shortcut) = parse_hotkey(&hotkey_str) {
                    let app_handle = app.handle().clone();
                    match app
                        .global_shortcut()
                        .on_shortcut(shortcut, move |_app, _shortcut, _event| {
                            start_capture(&app_handle);
                        }) {
                        Ok(_) => log(&format!("Shortcut registered: {}", hotkey_str)),
                        Err(e) => {
                            let msg = format!("Failed to register hotkey '{}': {}", hotkey_str, e);
                            log(&msg);
                            rfd::MessageDialog::new()
                                .set_title("SafeShot")
                                .set_description(&msg)
                                .set_level(rfd::MessageLevel::Warning)
                                .show();
                        }
                    }
                } else {
                    let msg = format!("Invalid hotkey in config: '{}'. Reset it in Settings.", hotkey_str);
                    log(&msg);
                    rfd::MessageDialog::new()
                        .set_title("SafeShot")
                        .set_description(&msg)
                        .set_level(rfd::MessageLevel::Warning)
                        .show();
                }
            }

            log("Setup complete. SafeShot ready");

            // Show welcome notification on first run
            if first_run {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    // Small delay to let the tray icon appear first
                    std::thread::sleep(std::time::Duration::from_millis(500));
                    let _ = WebviewWindowBuilder::new(
                        &handle,
                        "welcome",
                        WebviewUrl::App("welcome.html".into()),
                    )
                    .title("Welcome to SafeShot")
                    .icon(tauri::image::Image::from_bytes(include_bytes!("../icons/128x128@2x.png")).unwrap()).unwrap()
                    .inner_size(420.0, 520.0)
                    .resizable(false)
                    .maximizable(false)
                    .minimizable(false)
                    .decorations(false)
                    .always_on_top(true)
                    .center()
                    .build();
                });
                log("First run: welcome notification shown");
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error building tauri app");

    // Hide from Dock on macOS, show only in menu bar
    #[cfg(target_os = "macos")]
    {
        let mut app = app;
        app.set_activation_policy(tauri::ActivationPolicy::Accessory);
        app.run(|app, event| {
            match event {
                tauri::RunEvent::ExitRequested { api, .. } => api.prevent_exit(),
                tauri::RunEvent::Reopen { .. } => start_capture(app),
                _ => {}
            }
        });
    }
    #[cfg(not(target_os = "macos"))]
    app.run(|_app, event| {
        if let tauri::RunEvent::ExitRequested { api, .. } = event {
            api.prevent_exit();
        }
    });

    log("SafeShot exited normally");
}

#[tauri::command]
fn close_overlay(app: AppHandle) {
    if let Some(win) = app.get_webview_window("overlay") {
        win.close().ok();
    }
    log("Overlay closed");
}

#[tauri::command]
fn close_welcome(app: AppHandle) {
    if let Some(win) = app.get_webview_window("welcome") {
        win.close().ok();
    }
}

#[tauri::command]
fn close_about(app: AppHandle) {
    if let Some(win) = app.get_webview_window("about") {
        win.close().ok();
    }
}

#[tauri::command]
fn close_settings(app: AppHandle) {
    if let Some(win) = app.get_webview_window("settings") {
        win.close().ok();
    }
}

#[tauri::command]
fn register_hotkey(app: AppHandle, hotkey: String) -> Result<(), String> {
    // Unregister all existing shortcuts first
    app.global_shortcut().unregister_all().map_err(|e| e.to_string())?;
    // Parse and register the new one
    let shortcut = parse_hotkey(&hotkey).ok_or_else(|| format!("Invalid hotkey: {}", hotkey))?;
    let app_handle = app.clone();
    app.global_shortcut()
        .on_shortcut(shortcut, move |_app, _shortcut, _event| {
            start_capture(&app_handle);
        })
        .map_err(|e| {
            let msg = format!("Failed to register hotkey '{}': {}", hotkey, e);
            log(&msg);
            msg
        })?;
    log(&format!("Hotkey re-registered: {}", hotkey));
    Ok(())
}

#[tauri::command]
fn pause_hotkey(app: AppHandle) {
    app.global_shortcut().unregister_all().ok();
    log("Hotkey paused for capture");
}

#[tauri::command]
fn resume_hotkey(app: AppHandle) {
    // Re-read from config and register
    let hotkey_str = {
        let path = save::config_path();
        if let Ok(data) = std::fs::read_to_string(&path) {
            serde_json::from_str::<serde_json::Value>(&data)
                .ok()
                .and_then(|j| j.get("hotkey").and_then(|v| v.as_str()).map(String::from))
        } else {
            None
        }
    }.unwrap_or_else(|| {
        if cfg!(target_os = "macos") { "Meta+Shift+KeyS".to_string() }
        else { "PrintScreen".to_string() }
    });
    if let Some(shortcut) = parse_hotkey(&hotkey_str) {
        let app_handle = app.clone();
        app.global_shortcut()
            .on_shortcut(shortcut, move |_app, _shortcut, _event| {
                start_capture(&app_handle);
            }).ok();
        log(&format!("Hotkey resumed: {}", hotkey_str));
    }
}

#[tauri::command]
fn open_url(url: String) {
    // Only allow known safe URLs
    if url != "https://chiappina.com"
        && url != "https://github.com/mchiappinam/SafeShot"
        && url != "https://github.com/mchiappinam/SafeShot/blob/main/LICENSE"
    { return; }
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        std::process::Command::new("cmd").args(["/c", "start", &url]).creation_flags(0x08000000).spawn().ok();
    }
    #[cfg(target_os = "macos")]
    { std::process::Command::new("open").arg(&url).spawn().ok(); }
    #[cfg(target_os = "linux")]
    { std::process::Command::new("xdg-open").arg(&url).spawn().ok(); }
}

#[tauri::command]
fn show_overlay(app: AppHandle) {
    if let Some(win) = app.get_webview_window("overlay") {
        win.show().ok();
        win.set_focus().ok();
    }
    log("Overlay shown");
}

fn toggle_autostart(app: &AppHandle) {
    let autostart = app.autolaunch();
    let enabled = autostart.is_enabled().unwrap_or(false);
    if enabled {
        autostart.disable().ok();
        log("Autostart disabled");
    } else {
        autostart.enable().ok();
        log("Autostart enabled");
    }
    // Persist the new state so it survives reinstalls
    let new_state = !enabled;
    let path = save::config_path();
    let mut json = if let Ok(data) = std::fs::read_to_string(&path) {
        serde_json::from_str::<serde_json::Value>(&data).unwrap_or(serde_json::json!({}))
    } else {
        serde_json::json!({})
    };
    json["autostart"] = serde_json::json!(new_state);
    std::fs::write(&path, serde_json::to_string_pretty(&json).unwrap_or_default()).ok();
}

fn start_capture(app: &AppHandle) {
    if app.get_webview_window("overlay").is_some() {
        return;
    }
    log("Starting capture...");

    // Capture screens BEFORE opening the overlay so we don't screenshot our own window
    let screens = match capture::do_capture() {
        Ok(data) => {
            log(&format!("Captured {} displays", data.len()));
            if data.is_empty() {
                log("Capture returned 0 displays, aborting");
                return;
            }
            let cache = app.state::<capture::CaptureCache>();
            *cache.0.lock().unwrap() = data.clone();
            data
        }
        Err(e) => {
            log(&format!("Capture failed: {}", e));
            return;
        }
    };

    // Compute virtual desktop bounds spanning all monitors
    let min_x = screens.iter().map(|s| s.x).min().unwrap_or(0);
    let min_y = screens.iter().map(|s| s.y).min().unwrap_or(0);
    let max_x = screens
        .iter()
        .map(|s| s.x + s.width as i32)
        .max()
        .unwrap_or(1920);
    let max_y = screens
        .iter()
        .map(|s| s.y + s.height as i32)
        .max()
        .unwrap_or(1080);
    let total_w = max_x - min_x;
    let total_h = max_y - min_y;

    log(&format!(
        "Virtual desktop: {}x{} at ({},{})",
        total_w, total_h, min_x, min_y
    ));

    // Create window at the virtual desktop bounds
    let win = match WebviewWindowBuilder::new(app, "overlay", WebviewUrl::App("index.html".into()))
        .title("SafeShot")
        .position(min_x as f64, min_y as f64)
        .inner_size(total_w as f64, total_h as f64)
        .decorations(false)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .closable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .focused(true)
        .transparent(true)
        // On macOS, WebKit defers JS execution for hidden windows, so start visible.
        // The window is transparent so nothing shows until the frontend renders.
        .visible(cfg!(target_os = "macos"))
        .build()
    {
        Ok(w) => {
            log("Overlay window created (hidden)");
            w
        }
        Err(e) => {
            log(&format!("Overlay window failed: {}", e));
            return;
        }
    };

    // On Windows: strip all window styles that cause invisible borders/title bar,
    // then force exact position with SetWindowPos
    #[cfg(target_os = "windows")]
    {
        use raw_window_handle::HasWindowHandle;
        if let Ok(handle) = win.window_handle() {
            if let raw_window_handle::RawWindowHandle::Win32(h) = handle.as_ref() {
                let hwnd = h.hwnd.get() as *mut std::ffi::c_void;
                unsafe {
                    use windows_sys::Win32::UI::WindowsAndMessaging::*;
                    // Strip all frame styles: thick frame, caption, sysmenu, etc.
                    let style = GetWindowLongW(hwnd, GWL_STYLE);
                    let clean = (style as u32
                        & !(WS_THICKFRAME
                            | WS_CAPTION
                            | WS_SYSMENU
                            | WS_MAXIMIZEBOX
                            | WS_MINIMIZEBOX))
                        | WS_POPUP;
                    SetWindowLongW(hwnd, GWL_STYLE, clean as i32);
                    // Also strip extended styles (tool window border, etc.)
                    let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE);
                    let clean_ex = ex_style as u32
                        & !(WS_EX_DLGMODALFRAME | WS_EX_CLIENTEDGE | WS_EX_STATICEDGE);
                    SetWindowLongW(hwnd, GWL_EXSTYLE, clean_ex as i32);
                    // Padding: less on top (it's already flush), more on sides/bottom
                    let pad_top = 2;
                    let pad = 12;
                    SetWindowPos(
                        hwnd,
                        HWND_TOPMOST,
                        min_x - pad,
                        min_y - pad_top,
                        total_w + pad * 2,
                        total_h + pad_top + pad,
                        SWP_FRAMECHANGED | SWP_NOACTIVATE,
                    );

                    // Disable Win11 rounded corners
                    use windows_sys::Win32::Graphics::Dwm::*;
                    let preference: u32 = DWMWCP_DONOTROUND as u32;
                    DwmSetWindowAttribute(
                        hwnd,
                        DWMWA_WINDOW_CORNER_PREFERENCE as u32,
                        &preference as *const u32 as *const std::ffi::c_void,
                        std::mem::size_of::<u32>() as u32,
                    );
                }
                log(&format!(
                    "Win32: styles stripped, positioned at ({},{}) {}x{}",
                    min_x, min_y, total_w, total_h
                ));
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        use tauri::LogicalPosition;
        win.set_position(LogicalPosition::new(min_x as f64, min_y as f64))
            .ok();
    }

    // On macOS, set the window level high enough to cover the menu bar and dock
    #[cfg(target_os = "macos")]
    {
        use raw_window_handle::HasWindowHandle;

        if let Ok(handle) = win.window_handle() {
            if let raw_window_handle::RawWindowHandle::AppKit(h) = handle.as_ref() {
                let ns_view = h.ns_view.as_ptr() as *mut std::ffi::c_void;
                unsafe {
                    extern "C" {
                        fn objc_msgSend(receiver: *mut std::ffi::c_void, sel: *mut std::ffi::c_void, ...) -> *mut std::ffi::c_void;
                        fn sel_registerName(name: *const std::ffi::c_char) -> *mut std::ffi::c_void;
                    }
                    // Get NSWindow from NSView via [nsView window]
                    let window_sel = sel_registerName(b"window\0".as_ptr() as *const _);
                    let ns_window = objc_msgSend(ns_view, window_sel);
                    if !ns_window.is_null() {
                        let set_level = sel_registerName(b"setLevel:\0".as_ptr() as *const _);
                        let set_behavior = sel_registerName(b"setCollectionBehavior:\0".as_ptr() as *const _);
                        // kCGScreenSaverWindowLevel (1000) sits above everything
                        // including menu bar items and the dock
                        objc_msgSend(ns_window, set_level, 1000i64);
                        // NSWindowCollectionBehaviorCanJoinAllSpaces (1 << 0) |
                        // NSWindowCollectionBehaviorFullScreenAuxiliary (1 << 8)
                        let behavior: u64 = (1 << 0) | (1 << 8);
                        objc_msgSend(ns_window, set_behavior, behavior);
                    }
                }
                log("macOS: window level set above menu bar and dock");
            }
        }
    }

    log(&format!(
        "Window ready: ({},{}) {}x{}, waiting for frontend to call show_overlay",
        min_x, min_y, total_w, total_h
    ));

    // Safety: if the frontend doesn't call show_overlay within 3 seconds,
    // force-show the window so we can at least see what's happening
    let app_clone = app.clone();
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(3));
        if let Some(win) = app_clone.get_webview_window("overlay") {
            if !win.is_visible().unwrap_or(true) {
                log("Safety timeout: force-showing overlay");
                win.show().ok();
                win.set_focus().ok();
            }
        }
    });
}

fn open_save_folder(_app: &AppHandle) {
    let dir = save::get_save_directory();
    std::fs::create_dir_all(&dir).ok();
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&dir)
            .spawn()
            .ok();
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open").arg(&dir).spawn().ok();
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&dir)
            .spawn()
            .ok();
    }
}

fn is_blocked(app: &AppHandle) -> bool {
    if app.get_webview_window("overlay").is_some() { return true; }
    let flag = app.state::<DialogActive>();
    let active = *flag.0.lock().unwrap();
    active
}

fn show_guide(app: &AppHandle) {
    if app.get_webview_window("welcome").is_some() || is_blocked(app) {
        return;
    }
    let _ = WebviewWindowBuilder::new(app, "welcome", WebviewUrl::App("welcome.html".into()))
        .title("How to Use SafeShot")
        .inner_size(420.0, 520.0)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .decorations(false)
        .center()
        .build();
}

#[tauri::command]
fn open_settings(app: AppHandle) {
    show_settings(&app);
}

fn show_settings(app: &AppHandle) {
    if app.get_webview_window("settings").is_some() || is_blocked(app) {
        return;
    }
    let _ = WebviewWindowBuilder::new(app, "settings", WebviewUrl::App("settings.html".into()))
        .title("SafeShot Settings")
        .inner_size(460.0, 480.0)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .decorations(false)
        .center()
        .build();
}

fn show_about(app: &AppHandle) {
    if app.get_webview_window("about").is_some() || is_blocked(app) {
        return;
    }
    let _ = WebviewWindowBuilder::new(app, "about", WebviewUrl::App("about.html".into()))
        .title("About SafeShot")
        .icon(tauri::image::Image::from_bytes(include_bytes!("../icons/128x128@2x.png")).unwrap()).unwrap()
        .inner_size(420.0, 440.0)
        .resizable(false)
        .maximizable(false)
        .minimizable(false)
        .decorations(false)
        .center()
        .build();
}
