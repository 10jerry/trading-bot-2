class Dashboard {
    constructor() {
        this.apiBase = 'http://localhost:5000/api';
        this.statusCheckInterval = null;
        this.logsCheckInterval = null;
        this.tradesCheckInterval = null;
        this.isConnected = false;
        this.botRunning = false;
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadSavedSettings();
    }
    
    setupEventListeners() {
        document.getElementById('login-btn').addEventListener('click', () => this.login());
        document.getElementById('max_entries').addEventListener('input', (e) => {
            document.getElementById('max_entries_display').textContent = e.target.value;
        });
        document.getElementById('start-btn').addEventListener('click', () => this.startBot());
        document.getElementById('stop-btn').addEventListener('click', () => this.stopBot());
        document.getElementById('clear-logs-btn').addEventListener('click', () => this.clearLogs());
    }
    
    loadSavedSettings() {
        fetch(`${this.apiBase}/settings`)
            .then(res => res.json())
            .then(data => {
                if (data.saved) {
                    document.getElementById('symbol').value = data.saved.symbol || 'XAUUSD';
                    document.getElementById('lot_size').value = data.saved.lot_size || 0.01;
                    document.getElementById('sl_amount').value = data.saved.sl_amount || 8;
                    document.getElementById('tp_amount').value = data.saved.tp_amount || 20;
                    document.getElementById('max_entries').value = data.saved.max_entries || 1;
                    document.getElementById('max_entries_display').textContent = data.saved.max_entries || 1;
                }
            })
            .catch(err => console.error('Error loading settings:', err));
    }
    
    login() {
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        const accountType = document.getElementById('account-type').value;
        const serverNumber = document.getElementById('server-number').value;
        
        if (!username || !password) {
            this.showMessage('login-message', 'Please enter username and password', 'error');
            return;
        }
        
        if (!serverNumber || serverNumber < 1 || serverNumber > 51) {
            this.showMessage('login-message', 'Server number must be between 1 and 51', 'error');
            return;
        }
        
        const server = accountType === 'real' 
            ? `Exness-MT5Real${serverNumber}` 
            : `Exness-MT5Trial${serverNumber}`;
        
        this.showMessage('login-message', 'Connecting...', 'info');
        
        fetch(`${this.apiBase}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, server })
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                this.isConnected = true;
                this.showMessage('login-message', `✓ Connected to ${server}!`, 'success');
                document.getElementById('login-panel').classList.add('hidden');
                document.getElementById('settings-panel').classList.remove('hidden');
                document.getElementById('status-panel').classList.remove('hidden');
                document.getElementById('logs-panel').classList.remove('hidden');
                document.getElementById('trades-panel').classList.remove('hidden');
                this.updateStatusIndicator(true);
                this.startStatusMonitoring();
            } else {
                this.showMessage('login-message', `❌ ${data.error}`, 'error');
            }
        })
        .catch(err => {
            this.showMessage('login-message', `Error: ${err.message}`, 'error');
            console.error(err);
        });
    }
    
    startBot() {
        const settings = {
            symbol: document.getElementById('symbol').value,
            lot_size: parseFloat(document.getElementById('lot_size').value),
            sl_amount: parseFloat(document.getElementById('sl_amount').value),
            tp_amount: parseFloat(document.getElementById('tp_amount').value),
            max_entries: parseInt(document.getElementById('max_entries').value),
            username: document.getElementById('username').value,
            password: document.getElementById('password').value,
            server: document.getElementById('account-type').value === 'real'
                ? `Exness-MT5Real${document.getElementById('server-number').value}`
                : `Exness-MT5Trial${document.getElementById('server-number').value}`
        };
        
        fetch(`${this.apiBase}/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(settings)
        })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                this.botRunning = true;
                this.updateBotControlButtons();
                this.addLog('🤖 Bot started successfully!', 'success');
                this.startLogsMonitoring();
                this.startTradesMonitoring();
            } else {
                this.addLog(`❌ Failed to start bot: ${data.error}`, 'error');
            }
        })
        .catch(err => {
            this.addLog(`Error: ${err.message}`, 'error');
            console.error(err);
        });
    }
    
    stopBot() {
        fetch(`${this.apiBase}/stop`, { method: 'POST' })
        .then(res => res.json())
        .then(data => {
            if (data.success) {
                this.botRunning = false;
                this.updateBotControlButtons();
                this.addLog('🛑 Bot stopped', 'warning');
                if (this.logsCheckInterval) clearInterval(this.logsCheckInterval);
                if (this.tradesCheckInterval) clearInterval(this.tradesCheckInterval);
            }
        })
        .catch(err => console.error(err));
    }
    
    updateBotControlButtons() {
        const startBtn = document.getElementById('start-btn');
        const stopBtn = document.getElementById('stop-btn');
        
        if (this.botRunning) {
            startBtn.classList.add('hidden');
            stopBtn.classList.remove('hidden');
        } else {
            startBtn.classList.remove('hidden');
            stopBtn.classList.add('hidden');
        }
    }
    
    startStatusMonitoring() {
        if (this.statusCheckInterval) clearInterval(this.statusCheckInterval);
        
        this.statusCheckInterval = setInterval(() => {
            fetch(`${this.apiBase}/status`)
                .then(res => res.json())
                .then(data => {
                    document.getElementById('bot-state').textContent = data.state;
                    document.getElementById('open-trades').textContent = data.open_trades;
                    
                    if (data.marked_zone) {
                        const zone = data.marked_zone;
                        document.getElementById('marked-zone').textContent = 
                            `H: ${zone.high.toFixed(2)} | L: ${zone.low.toFixed(2)}`;
                    } else {
                        document.getElementById('marked-zone').textContent = 'None';
                    }
                })
                .catch(err => console.error('Status check error:', err));
        }, 2000);
    }
    
    startLogsMonitoring() {
        if (this.logsCheckInterval) clearInterval(this.logsCheckInterval);
        
        this.logsCheckInterval = setInterval(() => {
            fetch(`${this.apiBase}/logs`)
                .then(res => res.json())
                .then(data => {
                    const container = document.getElementById('logs-container');
                    container.innerHTML = '';
                    
                    data.logs.forEach(log => {
                        const entry = document.createElement('div');
                        entry.className = 'log-entry';
                        
                        if (log.includes('✓') || log.includes('✅')) {
                            entry.classList.add('success');
                        } else if (log.includes('❌') || log.includes('Error')) {
                            entry.classList.add('error');
                        } else if (log.includes('⚠') || log.includes('🛑')) {
                            entry.classList.add('warning');
                        } else {
                            entry.classList.add('info');
                        }
                        
                        entry.textContent = log;
                        container.appendChild(entry);
                    });
                    
                    container.scrollTop = container.scrollHeight;
                })
                .catch(err => console.error('Logs check error:', err));
        }, 1000);
    }
    
    startTradesMonitoring() {
        if (this.tradesCheckInterval) clearInterval(this.tradesCheckInterval);
        
        this.tradesCheckInterval = setInterval(() => {
            fetch(`${this.apiBase}/trades`)
                .then(res => res.json())
                .then(data => {
                    const container = document.getElementById('trades-container');
                    
                    if (!data.trades || data.trades.length === 0) {
                        container.innerHTML = '<p class="no-trades">No open trades</p>';
                        return;
                    }
                    
                    container.innerHTML = '';
                    data.trades.forEach(trade => {
                        const card = document.createElement('div');
                        const tradeDir = trade.direction.toLowerCase();
                        card.className = `trade-card ${tradeDir}`;
                        
                        const pnl = trade.pnl || 0;
                        const pnlColor = pnl >= 0 ? '#00ff00' : '#ff4444';
                        
                        card.innerHTML = `
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                                <span class="trade-direction ${tradeDir}">${trade.direction}</span>
                                <span style="color: ${pnlColor}; font-weight: bold;">$${pnl.toFixed(2)}</span>
                            </div>
                            <div class="trade-info">
                                <div class="trade-info-item">
                                    <span class="trade-info-label">Ticket:</span>
                                    <span class="trade-info-value">${trade.ticket}</span>
                                </div>
                                <div class="trade-info-item">
                                    <span class="trade-info-label">Entry:</span>
                                    <span class="trade-info-value">${trade.entry_price.toFixed(2)}</span>
                                </div>
                                <div class="trade-info-item">
                                    <span class="trade-info-label">Lot:</span>
                                    <span class="trade-info-value">${trade.lot_size}</span>
                                </div>
                                <div class="trade-info-item">
                                    <span class="trade-info-label">Entry #:</span>
                                    <span class="trade-info-value">${trade.entry_number}</span>
                                </div>
                                <div class="trade-info-item">
                                    <span class="trade-info-label">SL:</span>
                                    <span class="trade-info-value">${trade.sl.toFixed(2)}</span>
                                </div>
                                <div class="trade-info-item">
                                    <span class="trade-info-label">TP:</span>
                                    <span class="trade-info-value">${trade.tp.toFixed(2)}</span>
                                </div>
                            </div>
                        `;
                        
                        container.appendChild(card);
                    });
                })
                .catch(err => console.error('Trades check error:', err));
        }, 2000);
    }
    
    addLog(message, type = 'info') {
        const container = document.getElementById('logs-container');
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        
        const timestamp = new Date().toLocaleTimeString();
        entry.textContent = `[${timestamp}] ${message}`;
        
        container.appendChild(entry);
        container.scrollTop = container.scrollHeight;
    }
    
    clearLogs() {
        document.getElementById('logs-container').innerHTML = '';
    }
    
    updateStatusIndicator(connected) {
        const dot = document.getElementById('bot-status');
        const text = document.getElementById('status-text');
        
        if (connected) {
            dot.classList.remove('offline');
            dot.classList.add('online');
            text.textContent = 'Connected';
        } else {
            dot.classList.remove('online');
            dot.classList.add('offline');
            text.textContent = 'Offline';
        }
    }
    
    showMessage(elementId, message, type) {
        const element = document.getElementById(elementId);
        element.textContent = message;
        element.className = `message ${type}`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new Dashboard();
});
