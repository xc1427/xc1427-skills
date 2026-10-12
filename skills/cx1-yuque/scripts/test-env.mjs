// 主站测试固定环境，避免继承调用 shell 的站点或真实会话路径。
process.env.YUQUE_HOST = "https://www.yuque.com";
delete process.env.YUQUE_SESSION_FILE;
