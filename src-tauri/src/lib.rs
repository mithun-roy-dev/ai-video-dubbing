// VideoDubAI — Tauri backend (Rust)
// Registers all required plugins: shell (sidecar), dialog, fs, opener

use std::process::{Command, Stdio};
use std::io::Write;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

/// Global child process handle for the Python sidecar
static CHILD_PID: Mutex<Option<u32>> = Mutex::new(None);

/// Spawn the Python sidecar, send JSON-RPC config via stdin,
/// and stream stdout/stderr events back to the frontend.
#[tauri::command]
fn spawn_python(app: AppHandle, script_path: String, config_json: String) -> Result<(), String> {
    // Resolve python executable
    let python = if cfg!(windows) {
        "python".to_string()
    } else {
        "python3".to_string()
    };

    let mut child = Command::new(&python)
        .arg("-u")
        .arg(&script_path)
        .env("PYTHONDONTWRITEBYTECODE", "1") // Prevent __pycache__ reloads
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn python: {e}"))?;

    // Store PID for cancellation
    {
        let mut pid_guard = CHILD_PID.lock().unwrap();
        *pid_guard = Some(child.id());
    }

    // Write config JSON to stdin
    if let Some(stdin) = child.stdin.take() {
        let mut stdin = stdin;
        let line = format!("{}\r\n", config_json);
        stdin.write_all(line.as_bytes()).map_err(|e| format!("stdin write error: {e}"))?;
        // stdin closes when it drops here — Python's readline() will get EOF after this line
    }

    let app_stdout = app.clone();
    let app_stderr = app.clone();

    // Stream stdout
    if let Some(stdout) = child.stdout.take() {
        std::thread::spawn(move || {
            use std::io::{BufRead, BufReader};
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(l) if !l.trim().is_empty() => {
                        let _ = app_stdout.emit("sidecar-stdout", l);
                    }
                    _ => {}
                }
            }
        });
    }

    // Stream stderr
    if let Some(stderr) = child.stderr.take() {
        std::thread::spawn(move || {
            use std::io::{BufRead, BufReader};
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                match line {
                    Ok(l) if !l.trim().is_empty() => {
                        let _ = app_stderr.emit("sidecar-stderr", l);
                    }
                    _ => {}
                }
            }
        });
    }

    // Wait for child in a thread so we don't block
    let app_done = app.clone();
    std::thread::spawn(move || {
        let _ = child.wait();
        let mut pid_guard = CHILD_PID.lock().unwrap();
        *pid_guard = None;
        let _ = app_done.emit("sidecar-exit", ());
    });

    Ok(())
}

/// Kill the running Python sidecar process
#[tauri::command]
fn kill_python() -> Result<(), String> {
    let mut pid_guard = CHILD_PID.lock().unwrap();
    if let Some(pid) = pid_guard.take() {
        #[cfg(windows)]
        {
            let _ = Command::new("taskkill")
                .args(["/PID", &pid.to_string(), "/T", "/F"])
                .output();
        }
        #[cfg(not(windows))]
        {
            let _ = Command::new("kill").args(["-9", &pid.to_string()]).output();
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![spawn_python, kill_python])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
