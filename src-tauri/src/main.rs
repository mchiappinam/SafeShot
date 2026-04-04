#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod capture;
mod save;

use std::fs::OpenOptions;
use std::io::Write;

use tauri::{
    menu::{CheckMenuItem, Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};
use tauri_plugin_autostart::ManagerExt;

fn log(msg: &str) {
    if let Some(mut dir) = dirs::data_local_dir() {
        dir.push("SafeShot");
        std::fs::create_dir_all(&dir).ok();
        dir.push("safeshot.log");
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

fn main() {
    // Catch panics and log them
    std::panic::set_hook(Box::new(|info| {
        log(&format!("PANIC: {}", info));
    }));

    log("SafeShot starting...");

    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .manage(capture::CaptureCache(std::sync::Mutex::new(Vec::new())))
        .invoke_handler(tauri::generate_handler![
            capture::capture_screens,
            save::save_screenshot,
            save::get_next_filename,
            save::copy_to_clipboard,
            save::get_last_color,
            save::set_last_color,
            save::get_last_thickness,
            save::set_last_thickness,
            close_overlay,
            show_overlay,
        ])
        .setup(|app| {
            log("Setup starting...");

            // On first run, enable autostart and show welcome notification
            let first_run = {
                let path = save::config_path();
                if !path.exists() {
                    std::fs::write(&path, "{}").ok();
                    let autostart = app.autolaunch();
                    autostart.enable().ok();
                    log("First run: autostart enabled");
                    true
                } else {
                    false
                }
            };

            // Build tray menu
            let autostart_enabled = app.autolaunch().is_enabled().unwrap_or(false);
            let capture_item =
                MenuItem::with_id(app, "capture", "Capture Screenshot", true, None::<&str>)?;
            let open_folder =
                MenuItem::with_id(app, "open_folder", "Open Save Folder", true, None::<&str>)?;
            let autostart_item =
                CheckMenuItem::with_id(app, "autostart", "Start on Boot", true, autostart_enabled, None::<&str>)?;
            let about_item = MenuItem::with_id(app, "about", "About", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit SafeShot", true, None::<&str>)?;
            let menu =
                Menu::with_items(app, &[&capture_item, &open_folder, &autostart_item, &about_item, &quit_item])?;
            log("Tray menu built");

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("SafeShot")
                .menu(&menu)
                .on_menu_event(move |app, event| match event.id.as_ref() {
                    "capture" => start_capture(app),
                    "open_folder" => open_save_folder(app),
                    "autostart" => toggle_autostart(app),
                    "about" => show_about(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        start_capture(tray.app_handle());
                    }
                })
                .build(app)?;
            log("Tray icon created");

            // Register PrtScn global shortcut
            let shortcut = Shortcut::new(Some(Modifiers::empty()), Code::PrintScreen);
            let app_handle = app.handle().clone();
            match app
                .global_shortcut()
                .on_shortcut(shortcut, move |_app, _shortcut, _event| {
                    start_capture(&app_handle);
                }) {
                Ok(_) => log("PrtScn shortcut registered"),
                Err(e) => log(&format!("PrtScn shortcut failed: {}", e)),
            }

            log("Setup complete. SafeShot ready");

            // Show welcome notification on first run
            if first_run {
                std::thread::spawn(|| {
                    rfd::MessageDialog::new()
                        .set_title("Welcome to SafeShot!")
                        .set_description(
                            "SafeShot is running in your system tray.\n\n\
                            How to use:\n\
                            - Press Print Screen to capture your screen\n\
                            - Or click the SafeShot tray icon near the clock\n\n\
                            After capturing, drag to select an area, then:\n\
                            - Ctrl+C to copy\n\
                            - Ctrl+S to save\n\
                            - ESC to cancel"
                        )
                        .set_level(rfd::MessageLevel::Info)
                        .show();
                });
                log("First run: welcome notification shown");
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error building tauri app")
        .run(|_app, event| {
            // Keep the app alive when all windows are closed (tray-only mode)
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
    let max_x = screens.iter().map(|s| s.x + s.width as i32).max().unwrap_or(1920);
    let max_y = screens.iter().map(|s| s.y + s.height as i32).max().unwrap_or(1080);
    let total_w = max_x - min_x;
    let total_h = max_y - min_y;

    log(&format!("Virtual desktop: {}x{} at ({},{})", total_w, total_h, min_x, min_y));

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
        .visible(false)
        .build()
    {
        Ok(w) => { log("Overlay window created (hidden)"); w },
        Err(e) => { log(&format!("Overlay window failed: {}", e)); return; },
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
                        & !(WS_THICKFRAME | WS_CAPTION | WS_SYSMENU | WS_MAXIMIZEBOX | WS_MINIMIZEBOX)
                    ) | WS_POPUP;
                    SetWindowLongW(hwnd, GWL_STYLE, clean as i32);
                    // Also strip extended styles (tool window border, etc.)
                    let ex_style = GetWindowLongW(hwnd, GWL_EXSTYLE);
                    let clean_ex = ex_style as u32 & !(WS_EX_DLGMODALFRAME | WS_EX_CLIENTEDGE | WS_EX_STATICEDGE);
                    SetWindowLongW(hwnd, GWL_EXSTYLE, clean_ex as i32);
                    // Padding: less on top (it's already flush), more on sides/bottom
                    let pad_top = 0;
                    let pad = 10;
                    SetWindowPos(
                        hwnd, HWND_TOPMOST,
                        min_x - pad, min_y - pad_top, total_w + pad * 2, total_h + pad_top + pad,
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
                log(&format!("Win32: styles stripped, positioned at ({},{}) {}x{}", min_x, min_y, total_w, total_h));
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        use tauri::LogicalPosition;
        win.set_position(LogicalPosition::new(min_x as f64, min_y as f64)).ok();
    }

    log(&format!("Window ready: ({},{}) {}x{}", min_x, min_y, total_w, total_h));
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

fn show_about(_app: &AppHandle) {
    let version = env!("CARGO_PKG_VERSION");
    rfd::MessageDialog::new()
        .set_title("About SafeShot")
        .set_description(&format!("SafeShot v{}\n\nPrivacy-first screenshot tool.\nYour screenshots stay yours, always.\nNo cloud, no tracking, no compromises.\n\nDeveloped by Matheus Chiappina\nhttps://chiappina.com", version))
        .set_level(rfd::MessageLevel::Info)
        .show();
}
