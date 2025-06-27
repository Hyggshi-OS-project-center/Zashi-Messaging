@echo off
title Zashi Messaging - Server & Client

:: Chạy server Node.js
start cmd /k node server.js

:: Chờ 3 giây cho server khởi động
timeout /t 3 > nul

:: Mở client (index.html) bằng trình duyệt mặc định
start index.html

:: Tùy chọn: Nếu muốn dùng trình duyệt cụ thể (ví dụ Chrome), sửa dòng trên thành:
:: start chrome index.html
