fn main() {
    println!("cargo:rerun-if-changed=tauri.conf.json");
    println!("cargo:rerun-if-changed=icons/codex-skin-studio/icon.ico");
    println!("cargo:rerun-if-changed=icons/codex-skin-studio/icon.png");
    tauri_build::build()
}
