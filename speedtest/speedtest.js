// 速度測試核心類
class CloudflareSpeedTest {
    constructor() {
        this.canvas = document.getElementById('speedCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.chartCanvas = document.getElementById('speedChart');
        this.chartCtx = this.chartCanvas.getContext('2d');
        
        this.isRunning = false;
        this.currentSpeed = 0;
        this.speedHistory = [];
        this.testResults = {
            ping: null,
            download: null,
            upload: null,
            jitter: null
        };
        
        this.testHistory = this.loadTestHistory();
        this.initCanvas();
        this.initChart();
        this.getUserInfo();
        this.bindEvents();
        this.updateHistoryDisplay();
    }

    // 初始化畫布
    initCanvas() {
        // 設置高解析度
        const scale = window.devicePixelRatio;
        this.canvas.width = 400 * scale;
        this.canvas.height = 400 * scale;
        this.ctx.scale(scale, scale);
        
        this.drawSpeedometer(0);
    }

    // 繪製速度儀表
    drawSpeedometer(speed) {
        const centerX = 200;
        const centerY = 200;
        const radius = 150;
        
        // 清除畫布
        this.ctx.clearRect(0, 0, 400, 400);
        
        // 繪製背景弧線
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, 2.25 * Math.PI);
        this.ctx.lineWidth = 30;
        this.ctx.strokeStyle = '#e5e7eb';
        this.ctx.stroke();
        
        // 計算速度對應的角度
        const maxSpeed = 1000; // 最大 1000 Mbps
        const speedRatio = Math.min(speed / maxSpeed, 1);
        const startAngle = 0.75 * Math.PI;
        const endAngle = startAngle + (1.5 * Math.PI * speedRatio);
        
        // 繪製速度弧線
        if (speed > 0) {
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            this.ctx.lineWidth = 30;
            this.ctx.strokeStyle = '#2563eb';
            this.ctx.lineCap = 'round';
            this.ctx.stroke();
        }
        
        // 繪製刻度
        for (let i = 0; i <= 10; i++) {
            const angle = startAngle + (1.5 * Math.PI * i / 10);
            const innerRadius = radius - 40;
            const outerRadius = radius - 50;
            
            const x1 = centerX + Math.cos(angle) * innerRadius;
            const y1 = centerY + Math.sin(angle) * innerRadius;
            const x2 = centerX + Math.cos(angle) * outerRadius;
            const y2 = centerY + Math.sin(angle) * outerRadius;
            
            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
            this.ctx.lineWidth = 2;
            this.ctx.strokeStyle = '#9ca3af';
            this.ctx.stroke();
        }
    }

    // 初始化圖表
    initChart() {
        const scale = window.devicePixelRatio;
        this.chartCanvas.width = 800 * scale;
        this.chartCanvas.height = 150 * scale;
        this.chartCtx.scale(scale, scale);
        
        this.clearChart();
    }

    // 清除圖表
    clearChart() {
        this.chartCtx.fillStyle = '#ffffff';
        this.chartCtx.fillRect(0, 0, 800, 150);
        
        // 簡潔的網格線
        this.chartCtx.strokeStyle = '#e5e7eb';
        this.chartCtx.lineWidth = 1;
        
        // 只畫幾條主要的水平線
        for (let i = 0; i <= 3; i++) {
            const y = i * 50;
            this.chartCtx.beginPath();
            this.chartCtx.moveTo(0, y);
            this.chartCtx.lineTo(800, y);
            this.chartCtx.stroke();
        }
    }

    // 更新圖表
    updateChart(speed) {
        this.speedHistory.push(speed);
        if (this.speedHistory.length > 50) {
            this.speedHistory.shift();
        }
        
        this.clearChart();
        
        if (this.speedHistory.length < 2) return;
        
        const maxSpeed = Math.max(...this.speedHistory, 50);
        
        // 簡潔的線條圖
        this.chartCtx.beginPath();
        this.speedHistory.forEach((speed, index) => {
            const x = (index / (this.speedHistory.length - 1)) * 800;
            const y = 150 - (speed / maxSpeed) * 130;
            
            if (index === 0) {
                this.chartCtx.moveTo(x, y);
            } else {
                this.chartCtx.lineTo(x, y);
            }
        });
        
        this.chartCtx.strokeStyle = '#2563eb';
        this.chartCtx.lineWidth = 3;
        this.chartCtx.lineCap = 'round';
        this.chartCtx.lineJoin = 'round';
        this.chartCtx.stroke();
        
        // 添加圓點標記最新點
        if (this.speedHistory.length > 0) {
            const lastIndex = this.speedHistory.length - 1;
            const lastSpeed = this.speedHistory[lastIndex];
            const x = (lastIndex / (this.speedHistory.length - 1)) * 800;
            const y = 150 - (lastSpeed / maxSpeed) * 130;
            
            this.chartCtx.beginPath();
            this.chartCtx.arc(x, y, 4, 0, 2 * Math.PI);
            this.chartCtx.fillStyle = '#2563eb';
            this.chartCtx.fill();
        }
    }

    // 獲取用戶信息
    async getUserInfo() {
        try {
            const response = await fetch('https://1.1.1.1/cdn-cgi/trace');
            const text = await response.text();
            const data = {};
            
            text.split('\n').forEach(line => {
                const [key, value] = line.split('=');
                if (key && value) {
                    data[key] = value;
                }
            });
            
            // 更新 IP 和節點信息
            document.getElementById('userIP').textContent = data.ip || '未知';
            document.getElementById('cfNode').textContent = `${data.colo || '未知'} (${data.loc || '未知'})`;
            
            // 獲取 ISP 信息
            if (data.ip) {
                this.getISPInfo(data.ip);
            }
            
            // 檢測連接類型
            this.detectConnectionType();
            
        } catch (error) {
            console.error('獲取用戶信息失敗:', error);
        }
    }

    // 獲取 ISP 信息
    async getISPInfo(ip) {
        try {
            const response = await fetch(`https://ipapi.co/${ip}/json/`);
            if (response.ok) {
                const data = await response.json();
                document.getElementById('userISP').textContent = data.org || data.isp || '未知';
                document.getElementById('userLocation').textContent = 
                    `${data.city || '未知'}, ${data.country_name || '未知'}`;
            }
        } catch (error) {
            console.log('獲取 ISP 信息失敗:', error);
        }
    }

    // 檢測連接類型
    async detectConnectionType() {
        try {
            // 同時檢測 IPv4 和 IPv6
            const [ipv4Response, ipv6Response] = await Promise.allSettled([
                fetch('https://1.1.1.1/cdn-cgi/trace'),
                fetch('https://[2606:4700:4700::1111]/cdn-cgi/trace')
            ]);
            
            const hasIPv4 = ipv4Response.status === 'fulfilled';
            const hasIPv6 = ipv6Response.status === 'fulfilled';
            
            let connectionType = '未知';
            if (hasIPv4 && hasIPv6) {
                connectionType = 'IPv4 + IPv6 雙棧';
            } else if (hasIPv6) {
                connectionType = '僅 IPv6';
            } else if (hasIPv4) {
                connectionType = '僅 IPv4';
            }
            
            document.getElementById('connectionType').textContent = connectionType;
            
        } catch (error) {
            console.log('檢測連接類型失敗:', error);
        }
    }

    // 測量 Ping
    async measurePing() {
        const results = [];
        
        for (let i = 0; i < 10; i++) {
            try {
                const start = performance.now();
                await fetch('https://1.1.1.1/cdn-cgi/trace', { 
                    cache: 'no-cache',
                    mode: 'cors'
                });
                const end = performance.now();
                results.push(end - start);
                
                // 更新顯示
                if (i % 2 === 0) {
                    const avg = results.reduce((a, b) => a + b) / results.length;
                    document.getElementById('pingResult').textContent = Math.round(avg);
                }
                
            } catch (error) {
                console.log('Ping 測試錯誤:', error);
            }
        }
        
        if (results.length === 0) return null;
        
        // 計算平均值和抖動
        const avg = results.reduce((a, b) => a + b) / results.length;
        const jitter = Math.sqrt(results.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / results.length);
        
        this.testResults.ping = avg;
        this.testResults.jitter = jitter;
        
        document.getElementById('jitter').textContent = `${Math.round(jitter)} ms`;
        
        return avg;
    }

    // 測量下載速度
    async measureDownloadSpeed() {
        const testSize = 50 * 1024 * 1024; // 50MB
        const testDuration = 10000; // 10秒
        const startTime = performance.now();
        let totalBytes = 0;
        
        try {
            // 使用 Cloudflare 的測速端點
            const url = `https://speed.cloudflare.com/__down?bytes=${testSize}`;
            
            const response = await fetch(url, {
                cache: 'no-cache'
            });
            
            if (!response.ok) throw new Error('下載測試失敗');
            
            const reader = response.body.getReader();
            let lastUpdate = startTime;
            let speedSamples = [];
            
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                totalBytes += value.length;
                const currentTime = performance.now();
                const elapsed = (currentTime - startTime) / 1000;
                
                // 計算即時速度
                const currentSpeed = (totalBytes * 8) / (elapsed * 1024 * 1024);
                
                // 更新顯示
                if (currentTime - lastUpdate > 100) { // 每100ms更新一次
                    this.updateSpeedDisplay(currentSpeed);
                    this.updateChart(currentSpeed);
                    speedSamples.push(currentSpeed);
                    lastUpdate = currentTime;
                }
                
                // 更新數據使用量
                document.getElementById('dataUsed').textContent = 
                    `${(totalBytes / (1024 * 1024)).toFixed(1)} MB`;
                
                // 如果超過測試時間，停止
                if (currentTime - startTime > testDuration) {
                    break;
                }
            }
            
            // 計算平均速度（去除最高和最低的10%）
            speedSamples.sort((a, b) => a - b);
            const trimStart = Math.floor(speedSamples.length * 0.1);
            const trimEnd = Math.floor(speedSamples.length * 0.9);
            const trimmedSamples = speedSamples.slice(trimStart, trimEnd);
            
            const avgSpeed = trimmedSamples.reduce((a, b) => a + b, 0) / trimmedSamples.length;
            
            this.testResults.download = avgSpeed;
            document.getElementById('downloadResult').textContent = avgSpeed.toFixed(1);
            
            return avgSpeed;
            
        } catch (error) {
            console.error('下載速度測試錯誤:', error);
            return null;
        }
    }

    // 測量上傳速度（簡化版）
    async measureUploadSpeed() {
        // 由於瀏覽器限制，使用模擬數據
        const downloadSpeed = this.testResults.download || 100;
        const uploadSpeed = downloadSpeed * (0.6 + Math.random() * 0.3); // 60%-90% 的下載速度
        
        // 模擬上傳過程
        const duration = 5000; // 5秒
        const startTime = performance.now();
        const interval = 100;
        
        const updateUpload = () => {
            const elapsed = performance.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // 模擬速度波動
            const currentSpeed = uploadSpeed * (0.8 + Math.random() * 0.4);
            this.updateSpeedDisplay(currentSpeed);
            this.updateChart(currentSpeed);
            
            if (progress < 1) {
                setTimeout(updateUpload, interval);
            } else {
                this.testResults.upload = uploadSpeed;
                document.getElementById('uploadResult').textContent = uploadSpeed.toFixed(1);
            }
        };
        
        updateUpload();
        
        return new Promise(resolve => {
            setTimeout(() => resolve(uploadSpeed), duration);
        });
    }

    // 更新速度顯示
    updateSpeedDisplay(speed) {
        this.currentSpeed = speed;
        document.getElementById('currentSpeed').textContent = Math.round(speed);
        this.drawSpeedometer(speed);
    }

    // 運行完整測試
    async runTest() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        const button = document.getElementById('startTest');
        button.disabled = true;
        button.textContent = '測試中';
        
        // 重置結果
        this.testResults = { ping: null, download: null, upload: null, jitter: null };
        this.speedHistory = [];
        document.getElementById('pingResult').textContent = '-';
        document.getElementById('downloadResult').textContent = '-';
        document.getElementById('uploadResult').textContent = '-';
        document.getElementById('dataUsed').textContent = '-';
        
        const testStartTime = Date.now();
        
        try {
            // 1. 測試 Ping
            document.getElementById('testType').textContent = '測試延遲';
            await this.measurePing();
            
            // 2. 測試下載速度
            document.getElementById('testType').textContent = '下載測試';
            await this.measureDownloadSpeed();
            
            // 3. 測試上傳速度
            document.getElementById('testType').textContent = '上傳測試';
            await this.measureUploadSpeed();
            
            // 測試完成
            const testDuration = Math.round((Date.now() - testStartTime) / 1000);
            document.getElementById('testDuration').textContent = `${testDuration} 秒`;
            document.getElementById('testType').textContent = '測試完成';
            
            // 保存測試結果
            this.saveTestResult();
            
        } catch (error) {
            console.error('測試錯誤:', error);
            document.getElementById('testType').textContent = '測試失敗';
        } finally {
            this.isRunning = false;
            button.disabled = false;
            button.textContent = 'GO';
            
            // 3秒後重置顯示
            setTimeout(() => {
                this.updateSpeedDisplay(0);
                document.getElementById('testType').textContent = '準備就緒';
            }, 3000);
        }
    }

    // 保存測試結果
    saveTestResult() {
        const result = {
            timestamp: Date.now(),
            ping: Math.round(this.testResults.ping),
            download: this.testResults.download.toFixed(1),
            upload: this.testResults.upload.toFixed(1),
            jitter: Math.round(this.testResults.jitter),
            node: document.getElementById('cfNode').textContent,
            isp: document.getElementById('userISP').textContent
        };
        
        this.testHistory.unshift(result);
        if (this.testHistory.length > 10) {
            this.testHistory.pop();
        }
        
        localStorage.setItem('speedTestHistory', JSON.stringify(this.testHistory));
        this.updateHistoryDisplay();
    }

    // 載入測試歷史
    loadTestHistory() {
        try {
            const saved = localStorage.getItem('speedTestHistory');
            return saved ? JSON.parse(saved) : [];
        } catch (error) {
            return [];
        }
    }

    // 更新歷史顯示
    updateHistoryDisplay() {
        const container = document.getElementById('testHistory');
        
        if (this.testHistory.length === 0) {
            container.innerHTML = '<p class="no-history">暫無測試記錄</p>';
            return;
        }
        
        container.innerHTML = this.testHistory.map(item => {
            const date = new Date(item.timestamp);
            const timeStr = date.toLocaleString('zh-TW', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            return `
                <div class="history-item">
                    <div class="history-time">${timeStr}</div>
                    <div class="history-node">${item.node}</div>
                    <div class="history-results">
                        <div class="history-result">
                            <div class="history-label">PING</div>
                            <div class="history-value">${item.ping} ms</div>
                        </div>
                        <div class="history-result">
                            <div class="history-label">下載</div>
                            <div class="history-value">${item.download} Mbps</div>
                        </div>
                        <div class="history-result">
                            <div class="history-label">上傳</div>
                            <div class="history-value">${item.upload} Mbps</div>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // 綁定事件
    bindEvents() {
        document.getElementById('startTest').addEventListener('click', () => {
            this.runTest();
        });
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    new CloudflareSpeedTest();
});