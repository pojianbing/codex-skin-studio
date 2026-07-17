use std::io;

#[derive(Debug, thiserror::Error)]
pub enum StudioError {
    #[error("{0}")]
    Message(String),
    #[error("文件操作失败：{0}")]
    Io(#[from] io::Error),
    #[error("主题配置无效：{0}")]
    Json(#[from] serde_json::Error),
    #[error("图片无效：{0}")]
    Image(#[from] image::ImageError),
    #[error("网络请求失败：{0}")]
    Http(#[from] reqwest::Error),
    #[error("CDP 连接失败：{0}")]
    WebSocket(#[from] tungstenite::Error),
}

impl From<&str> for StudioError {
    fn from(value: &str) -> Self {
        Self::Message(value.to_owned())
    }
}

impl From<String> for StudioError {
    fn from(value: String) -> Self {
        Self::Message(value)
    }
}

pub type Result<T> = std::result::Result<T, StudioError>;
