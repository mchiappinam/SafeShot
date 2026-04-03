#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod capture;
mod save;

use tauri::{
    AppHandle, Manager, WebviewUrl, WebviewWindowBuilder,
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    menu::{Menu, MenuItem},
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            capture::capture_screens,
            save::save_screenshot,
            save::get_next_filename,
            save::copy_to_clipboard,
        ])
        .setup(|app| {
            // Build tray menu
            let capture_item = MenuItem::with_id(app, "capture", "Capture Screenshot", true, None::<&str>)?;
            let open_folder = MenuItem::with_id(app, "open_folder", "Open Save Folder", true, None::<&str>)?;
            let about_item = MenuItem::with_id(app, "about", "About", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit SafeShot", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&capture_item, &open_folder, &about_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("SafeShot")
                .menu(&menu)
                .on_menu_event(move |app, event| {
                    match event.id.as_ref() {
                        "capture" => start_capture(app),
                        "open_folder" => open_save_folder(app),
                        "about" => { /* TODO: show about dialog in overlay */ }
                        "quit" => app.exit(0),
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = event {
                        start_capture(tray.app_handle());
                    }
                })
                .build(app)?;

            // Register PrtScn global shortcut
            let shortcut = Shortcut::new(Some(Modifiers::empty()), Code::PrintScreen);
            let app_handle = app.handle().clone();
            app.global_shortcut().on_shortcut(shortcut, move |_app, _shortcut, _event| {
                start_capture(&app_handle);
            })?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running SafeShot");
}

fn start_capture(app: &AppHandle) {
    if app.get_webview_window("overlay").is_some() {
        return;
    }

    // For multi-monitor: compute bounding rect of all screens
    // For now, use fullscreen on primary (Tauri handles this natively)
    // TODO: span all monitors when Tauri supports multi-window spanning
    let _window = WebviewWindowBuilder::new(app, "overlay", WebviewUrl::App("index.html".into()))
        .title("SafeShot")
        .fullscreen(true)
        .decorations(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .focused(true)
        .build()
        .expect("failed to create overlay window");
}

fn open_save_folder(_app: &AppHandle) {
    let dir = save::get_save_directory();
    std::fs::create_dir_all(&dir).ok();
    // Use std::process::Command as a simple cross-platform open
    #[cfg(target_os = "windows")]
    { std::process::Command::new("explorer").arg(&dir).spawn().ok(); }
    #[cfg(target_os = "macos")]
    { std::process::Command::new("open").arg(&dir).spawn().ok(); }
    #[cfg(target_os = "linux")]
    { std::process::Command::new("xdg-open").arg(&dir).spawn().ok(); }
}
