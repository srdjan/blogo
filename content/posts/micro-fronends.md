---
title: Building Micro Frontends with mono-jsx Signals
date: 2025-06-16
tags: [Frontend, Architecture, Signals, HTMX]
excerpt: Reactive signals and HTMX create a powerful micro frontend architecture that keeps components independent while maintaining seamless communication.
---

## The Complexity Problem in Micro Frontends

Modern frontend development has grown increasingly complex, with applications requiring hundreds of dependencies to render simple dashboards. This raises questions about whether current approaches solve the right problems.

Building modular dashboards where different teams can deploy components independently presents significant challenges. Traditional approaches require complex state management libraries, build coordination, and elaborate communication patterns between micro frontends.

## Signals and HTMX Solution

mono-jsx signals combined with HTMX provide reactive components that communicate effortlessly without virtual DOM diffing overhead or complex state management.

Signals provide immediate reactivity while HTMX handles server communication, creating clean separation between local state and server state that traditional SPAs often blur together.

## Core Architecture Concepts

This architecture centers around three core concepts that work together seamlessly:

1. **Shared Signal Store**: Central reactive state that any component can read or modify
2. **Independent Components**: Self-contained modules that use signals for local communication and HTMX for server sync
3. **Duplex Communication**: Immediate local updates through signals, persistent changes through HTMX

This approach eliminates complexity common in traditional micro frontend architectures.

### Centralized Signal Store

The foundation uses a centralized signal store that components can access without prop drilling or complex context providers:

```jsx
// signals/appStore.js
import { signal, computed } from 'mono-jsx';

// Application-wide signals
export const appData = signal({
  message: '',
  counter: 0,
  theme: 'light',
  lastUpdated: null
});

export const notifications = signal([]);

export const serverStatus = signal('connecting');

// Computed signals
export const formattedMessage = computed(() => {
  const data = appData.value;
  return data.message ? `Message: ${data.message}` : 'No message';
});

export const messageCount = computed(() => {
  return appData.value.message.length;
});

export const isOnline = computed(() => {
  return serverStatus.value === 'online';
});

// Signal actions/methods
export const updateMessage = (newMessage) => {
  appData.value = {
    ...appData.value,
    message: newMessage,
    lastUpdated: new Date()
  };
};

export const incrementCounter = () => {
  appData.value = {
    ...appData.value,
    counter: appData.value.counter + 1,
    lastUpdated: new Date()
  };
};

export const decrementCounter = () => {
  appData.value = {
    ...appData.value,
    counter: appData.value.counter - 1,
    lastUpdated: new Date()
  };
};

export const setTheme = (theme) => {
  appData.value = {
    ...appData.value,
    theme,
    lastUpdated: new Date()
  };
  
  // Update DOM immediately
  document.body.className = theme;
};

export const addNotification = (message, type = 'info') => {
  const notification = {
    id: Date.now(),
    message,
    type,
    timestamp: new Date()
  };
  
  notifications.value = [...notifications.value, notification];
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    notifications.value = notifications.value.filter(n => n.id !== notification.id);
  }, 5000);
};

// Server sync functions
export const syncToServer = async (endpoint, data) => {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      serverStatus.value = 'online';
      return await response.json();
    }
  } catch (error) {
    serverStatus.value = 'offline';
    console.error('Sync failed:', error);
  }
};
```

### Reactive Component Layout

The app layout reacts automatically to signal changes, creating a living dashboard that updates in real-time:

```jsx
// AppLayout.jsx (mono-jsx)
import { jsx, effect } from 'mono-jsx';
import { appData, notifications, serverStatus, isOnline } from './signals/appStore.js';

const AppLayout = ({ children }) => {
  // Create reactive elements that update when signals change
  const statusElement = jsx`
    <div id="app-status" class="status ${() => isOnline.value ? 'online' : 'offline'}">
      Status: ${() => serverStatus.value} | ${() => new Date().toLocaleTimeString()}
    </div>
  `;

  const sharedDataElement = jsx`
    <div id="shared-data" class="shared-data">
      <h3>Shared Application Data:</h3>
      <div id="data-content">
        <p><strong>Message:</strong> ${() => appData.value.message || 'None'}</p>
        <p><strong>Counter:</strong> ${() => appData.value.counter}</p>
        <p><strong>Theme:</strong> ${() => appData.value.theme}</p>
        <p><strong>Last Updated:</strong> ${() => 
          appData.value.lastUpdated ? appData.value.lastUpdated.toLocaleTimeString() : 'Never'
        }</p>
      </div>
    </div>
  `;

  const notificationsElement = jsx`
    <div id="notifications" class="notifications">
      ${() => notifications.value.map(notification => jsx`
        <div class="notification notification-${notification.type}" key="${notification.id}">
          <span class="timestamp">${notification.timestamp.toLocaleTimeString()}</span>: 
          ${notification.message}
        </div>
      `).join('')}
    </div>
  `;

  // Server sync effect
  effect(() => {
    // Sync to server whenever appData changes
    if (appData.value.lastUpdated) {
      fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(appData.value)
      }).catch(err => {
        serverStatus.value = 'offline';
      });
    }
  });

  return jsx`
    <div class="app-layout" id="app-container">
      <header>
        <h1>My Web App</h1>
        ${statusElement}
        ${notificationsElement}
      </header>
      
      <main id="main-content">
        ${children}
        ${sharedDataElement}
      </main>
      
      <footer>
        <p>Powered by mono-jsx Signals + HTMX</p>
      </footer>
    </div>
  `;
};

export default AppLayout;
```

### Component Communication Patterns

Signals enable natural component communication. Each component becomes self-contained yet perfectly integrated:

**DataSender: Immediate Updates with Background Persistence**

```jsx
// DataSender.jsx (mono-jsx)
import { jsx, signal } from 'mono-jsx';
import { updateMessage, addNotification, syncToServer, appData } from './signals/appStore.js';

const DataSender = () => {
  // Local component state
  const inputValue = signal('');
  const isSending = signal(false);

  const handleSendData = async (event) => {
    event.preventDefault();
    const message = inputValue.value.trim();
    
    if (!message) return;
    
    isSending.value = true;
    
    // Update local state immediately (optimistic update)
    updateMessage(message);
    addNotification(`Message sent: "${message}"`, 'success');
    
    // Sync to server in background
    try {
      await syncToServer('/api/send-data', { message });
      addNotification('Message synced to server', 'info');
    } catch (error) {
      addNotification('Failed to sync to server', 'error');
    }
    
    // Clear input and reset state
    inputValue.value = '';
    isSending.value = false;
  };

  const handleBroadcast = () => {
    const broadcastMessage = `Broadcast from DataSender at ${new Date().toLocaleTimeString()}`;
    updateMessage(broadcastMessage);
    addNotification(broadcastMessage, 'broadcast');
  };

  return jsx`
    <div class="data-sender-component">
      <h2>Data Sender Component</h2>
      
      <form onsubmit="${handleSendData}">
        <input type="text" 
               value="${() => inputValue.value}"
               oninput="${(e) => inputValue.value = e.target.value}"
               placeholder="Enter message to send"
               disabled="${() => isSending.value}"
               required />
        <button type="submit" disabled="${() => isSending.value || !inputValue.value.trim()}">
          ${() => isSending.value ? 'Sending...' : 'Send Data'}
        </button>
      </form>
      
      <div class="current-message">
        <strong>Current App Message:</strong> ${() => appData.value.message || 'None'}
      </div>
      
      <button onclick="${handleBroadcast}" class="broadcast-btn">
        Broadcast to All Components
      </button>
      
      <!-- Optional: Server persistence with HTMX for form fallback -->
      <form hx-post="/api/send-data" 
            hx-target="#htmx-result"
            style="margin-top: 20px;">
        <input type="text" name="message" placeholder="HTMX fallback send" />
        <button type="submit">Send via HTMX</button>
      </form>
      <div id="htmx-result"></div>
    </div>
  `;
};

export default DataSender;
```

**DataReceiver: Reactive State Consumption**

```jsx
// DataReceiver.jsx (mono-jsx)
import { jsx, signal, computed, effect } from 'mono-jsx';
import { appData, formattedMessage, messageCount, notifications } from './signals/appStore.js';

const DataReceiver = () => {
  // Local component state
  const messageHistory = signal([]);
  const isListening = signal(true);

  // Computed values
  const filteredHistory = computed(() => {
    return messageHistory.value.filter(msg => 
      isListening.value || msg.type === 'important'
    );
  });

  const hasNewMessages = computed(() => {
    return messageCount.value > 0 && appData.value.message;
  });

  // Effect to track message changes
  effect(() => {
    if (appData.value.message && appData.value.lastUpdated) {
      messageHistory.value = [
        ...messageHistory.value,
        {
          id: Date.now(),
          message: appData.value.message,
          timestamp: appData.value.lastUpdated,
          counter: appData.value.counter,
          type: appData.value.message.includes('Broadcast') ? 'broadcast' : 'normal'
        }
      ].slice(-10); // Keep only last 10 messages
    }
  });

  const toggleListening = () => {
    isListening.value = !isListening.value;
    const status = isListening.value ? 'Started' : 'Stopped';
    addNotification(`${status} listening for messages`, 'info');
  };

  const clearHistory = () => {
    messageHistory.value = [];
    addNotification('Message history cleared', 'info');
  };

  return jsx`
    <div class="data-receiver-component">
      <h2>Data Receiver Component</h2>
      
      <div class="receiver-status">
        <span class="status-indicator ${() => isListening.value ? 'active' : 'inactive'}">
          ${() => isListening.value ? '🔊 Listening' : '🔇 Muted'}
        </span>
        <button onclick="${toggleListening}">
          ${() => isListening.value ? 'Stop Listening' : 'Start Listening'}
        </button>
      </div>
      
      <div class="current-data">
        <h3>Current Data:</h3>
        <p class="${() => hasNewMessages.value ? 'has-new' : ''}">
          ${() => formattedMessage.value}
        </p>
        <p><strong>Message Length:</strong> ${() => messageCount.value} characters</p>
        <p><strong>Counter Value:</strong> ${() => appData.value.counter}</p>
      </div>
      
      <div class="message-history">
        <h4>Message History 
          <button onclick="${clearHistory}" class="clear-btn">Clear</button>
        </h4>
        <div class="history-list">
          ${() => filteredHistory.value.map(msg => jsx`
            <div class="history-item ${msg.type}" key="${msg.id}">
              <span class="timestamp">${msg.timestamp.toLocaleTimeString()}</span>
              <span class="message">${msg.message}</span>
              <span class="counter">Counter: ${msg.counter}</span>
            </div>
          `).join('')}
        </div>
        ${() => filteredHistory.value.length === 0 ? 
          jsx`<p class="no-messages">No messages to display</p>` : ''
        }
      </div>
      
      <!-- Optional: HTMX for server-side message fetching -->
      <div class="server-messages">
        <h4>Server Messages</h4>
        <div hx-get="/api/latest-messages" 
             hx-trigger="load, every 30s"
             hx-target="#server-message-list">
          Loading server messages...
        </div>
        <div id="server-message-list"></div>
      </div>
    </div>
  `;
};

export default DataReceiver;
```

**InteractiveWidget: Complex State Management Made Simple**

```jsx
// InteractiveWidget.jsx (mono-jsx)
import { jsx, signal, computed } from 'mono-jsx';
import { 
  appData, 
  incrementCounter, 
  decrementCounter, 
  setTheme, 
  addNotification,
  syncToServer 
} from './signals/appStore.js';

const InteractiveWidget = () => {
  // Local widget state
  const autoIncrement = signal(false);
  const incrementInterval = signal(null);
  const customTheme = signal('');

  // Computed values
  const counterDisplay = computed(() => {
    const count = appData.value.counter;
    const emoji = count > 0 ? '📈' : count < 0 ? '📉' : '➖';
    return `${emoji} ${count}`;
  });

  const isEvenCounter = computed(() => {
    return appData.value.counter % 2 === 0;
  });

  // Counter actions
  const handleIncrement = async () => {
    incrementCounter();
    addNotification('Counter incremented!', 'success');
    
    // Sync to server
    await syncToServer('/api/counter/increment', { 
      counter: appData.value.counter 
    });
  };

  const handleDecrement = async () => {
    decrementCounter();
    addNotification('Counter decremented!', 'success');
    
    // Sync to server
    await syncToServer('/api/counter/decrement', { 
      counter: appData.value.counter 
    });
  };

  const toggleAutoIncrement = () => {
    autoIncrement.value = !autoIncrement.value;
    
    if (autoIncrement.value) {
      incrementInterval.value = setInterval(() => {
        incrementCounter();
      }, 1000);
      addNotification('Auto-increment started', 'info');
    } else {
      clearInterval(incrementInterval.value);
      incrementInterval.value = null;
      addNotification('Auto-increment stopped', 'info');
    }
  };

  // Theme handling
  const handleThemeChange = (theme) => {
    setTheme(theme);
    addNotification(`Theme changed to ${theme}`, 'info');
    
    // Sync to server
    syncToServer('/api/theme', { theme });
  };

  const applyCustomTheme = () => {
    if (customTheme.value.trim()) {
      handleThemeChange(customTheme.value.trim());
      customTheme.value = '';
    }
  };

  return jsx`
    <div class="interactive-widget">
      <h2>Interactive Widget</h2>
      
      <!-- Counter Section -->
      <div class="counter-section">
        <h3>Counter Controls</h3>
        <div class="counter-display ${() => isEvenCounter.value ? 'even' : 'odd'}">
          ${() => counterDisplay.value}
        </div>
        
        <div class="counter-controls">
          <button onclick="${handleDecrement}" class="decrement-btn">➖ Decrement</button>
          <button onclick="${handleIncrement}" class="increment-btn">➕ Increment</button>
        </div>
        
        <div class="auto-controls">
          <label>
            <input type="checkbox" 
                   checked="${() => autoIncrement.value}"
                   onchange="${toggleAutoIncrement}" />
            Auto-increment every second
          </label>
        </div>
        
        <div class="counter-info">
          <p>Counter is ${() => isEvenCounter.value ? 'even' : 'odd'}</p>
          <p>Current theme: <strong>${() => appData.value.theme}</strong></p>
        </div>
      </div>
      
      <!-- Theme Section -->
      <div class="theme-section">
        <h3>Theme Controls</h3>
        <div class="theme-buttons">
          <button onclick="${() => handleThemeChange('light')}" 
                  class="${() => appData.value.theme === 'light' ? 'active' : ''}">
            ☀️ Light
          </button>
          <button onclick="${() => handleThemeChange('dark')}" 
                  class="${() => appData.value.theme === 'dark' ? 'active' : ''}">
            🌙 Dark
          </button>
          <button onclick="${() => handleThemeChange('blue')}" 
                  class="${() => appData.value.theme === 'blue' ? 'active' : ''}">
            🌊 Blue
          </button>
          <button onclick="${() => handleThemeChange('green')}" 
                  class="${() => appData.value.theme === 'green' ? 'active' : ''}">
            🌿 Green
          </button>
        </div>
        
        <div class="custom-theme">
          <input type="text" 
                 value="${() => customTheme.value}"
                 oninput="${(e) => customTheme.value = e.target.value}"
                 placeholder="Custom theme name" />
          <button onclick="${applyCustomTheme}" 
                  disabled="${() => !customTheme.value.trim()}">
            Apply Custom
          </button>
        </div>
      </div>
      
      <!-- Server Sync Status -->
      <div class="sync-status">
        <h4>Server Sync</h4>
        <button hx-post="/api/sync-all" 
                hx-include="[data-sync]" 
                hx-target="#sync-result">
          Force Server Sync
        </button>
        <div id="sync-result"></div>
        
        <!-- Hidden data for HTMX sync -->
        <input type="hidden" data-sync name="counter" value="${() => appData.value.counter}" />
        <input type="hidden" data-sync name="theme" value="${() => appData.value.theme}" />
        <input type="hidden" data-sync name="message" value="${() => appData.value.message}" />
      </div>
    </div>
  `;
};

export default InteractiveWidget;
```

### Complete Application Composition

```jsx
// App.jsx (mono-jsx)
import { jsx } from 'mono-jsx';
import AppLayout from './AppLayout.jsx';
import DataSender from './DataSender.jsx';
import DataReceiver from './DataReceiver.jsx';
import InteractiveWidget from './InteractiveWidget.jsx';

const App = () => {
  return jsx`
    <div>
      ${AppLayout({
        children: jsx`
          <div class="components-grid">
            ${DataSender()}
            ${DataReceiver()}
            ${InteractiveWidget()}
          </div>
        `
      })}
    </div>
  `;
};

export default App;
```

### Supporting Server Endpoints

```javascript
// server.js
const express = require('express');
const app = express();

// In-memory store for demo
let appData = {
  message: '',
  counter: 0,
  theme: 'light',
  messages: []
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Layout communication endpoints
app.get('/api/status', (req, res) => {
  res.send(`<span>Status: Active (${new Date().toLocaleTimeString()})</span>`);
});

app.get('/api/data', (req, res) => {
  res.send(`
    <div id="data-content">
      <p><strong>Message:</strong> ${appData.message || 'None'}</p>
      <p><strong>Counter:</strong> ${appData.counter}</p>
      <p><strong>Theme:</strong> ${appData.theme}</p>
    </div>
  `);
});

// DataSender endpoints
app.post('/api/send-data', (req, res) => {
  appData.message = req.body.message;
  appData.messages.push({
    timestamp: new Date(),
    message: req.body.message
  });
  
  res.send(`
    <div class="success">
      ✅ Message sent: "${req.body.message}"
    </div>
  `);
});

app.post('/api/broadcast', (req, res) => {
  const broadcast = {
    type: req.body.type,
    message: req.body.message,
    timestamp: new Date()
  };
  
  appData.messages.push(broadcast);
  res.json(broadcast);
});

// DataReceiver endpoints
app.get('/api/latest-data', (req, res) => {
  res.send(`
    <div>
      <p><strong>Latest Message:</strong> ${appData.message || 'No messages yet'}</p>
      <p><strong>Last Updated:</strong> ${new Date().toLocaleString()}</p>
    </div>
  `);
});

app.get('/api/component-messages', (req, res) => {
  const recentMessages = appData.messages.slice(-5);
  const html = recentMessages.map(msg => 
    `<div class="message">
      <span class="timestamp">${msg.timestamp.toLocaleTimeString()}</span>: 
      ${msg.message}
    </div>`
  ).join('');
  
  res.send(html || '<p>No messages yet</p>');
});

// Interactive Widget endpoints
app.get('/api/counter', (req, res) => {
  res.send(`<span class="counter-value">${appData.counter}</span>`);
});

app.post('/api/counter/increment', (req, res) => {
  appData.counter++;
  res.send(`<span class="counter-value">${appData.counter}</span>`);
});

app.post('/api/counter/decrement', (req, res) => {
  appData.counter--;
  res.send(`<span class="counter-value">${appData.counter}</span>`);
});

app.post('/api/theme', (req, res) => {
  appData.theme = req.body.theme;
  res.send(`<span>Theme updated to: ${appData.theme}</span>`);
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
```

### Complete Implementation

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Micro Frontends with mono-jsx Signals + HTMX</title>
    <script src="https://unpkg.com/htmx.org@1.9.10"></script>
    <script src="https://unpkg.com/mono-jsx@latest"></script>
    <style>
        .app-layout { max-width: 1200px; margin: 0 auto; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
        .components-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 20px; margin: 20px 0; }
        
        /* Component styles */
        .data-sender-component, .data-receiver-component, .interactive-widget { 
            border: 1px solid #ddd; padding: 20px; border-radius: 12px; 
            background: #fafafa; box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        
        /* Shared data and notifications */
        .shared-data { background: #f0f8ff; padding: 20px; margin: 20px 0; border-radius: 12px; border-left: 4px solid #007bff; }
        .notifications { position: fixed; top: 20px; right: 20px; max-width: 300px; z-index: 1000; }
        .notification { margin: 5px 0; padding: 12px; border-radius: 6px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
        .notification-success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .notification-error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        .notification-info { background: #cce7ff; color: #004085; border: 1px solid #99d3ff; }
        .notification-broadcast { background: #fff3cd; color: #856404; border: 1px solid #ffeaa7; }
        
        /* Status indicators */
        .status { padding: 8px 12px; border-radius: 6px; font-weight: 500; }
        .status.online { background: #d4edda; color: #155724; }
        .status.offline { background: #f8d7da; color: #721c24; }
        
        /* Form and input styles */
        input, button, select { padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px; }
        button { background: #007bff; color: white; cursor: pointer; transition: background 0.2s; }
        button:hover:not(:disabled) { background: #0056b3; }
        button:disabled { background: #6c757d; cursor: not-allowed; opacity: 0.6; }
        
        /* Counter styles */
        .counter-display { font-size: 2em; text-align: center; margin: 15px 0; padding: 20px; border-radius: 8px; }
        .counter-display.even { background: #e7f3ff; color: #004085; }
        .counter-display.odd { background: #fff2e7; color: #8b4513; }
        .counter-controls { display: flex; gap: 10px; justify-content: center; margin: 15px 0; }
        
        /* Theme styles */
        .theme-buttons { display: flex; gap: 8px; flex-wrap: wrap; margin: 10px 0; }
        .theme-buttons button.active { background: #28a745; }
        .custom-theme { display: flex; gap: 8px; margin: 10px 0; }
        
        /* Message history */
        .history-list { max-height: 200px; overflow-y: auto; border: 1px solid #eee; border-radius: 6px; padding: 10px; }
        .history-item { margin: 5px 0; padding: 8px; border-radius: 4px; font-size: 0.9em; }
        .history-item.normal { background: #f8f9fa; }
        .history-item.broadcast { background: #fff3cd; }
        .timestamp { font-size: 0.8em; color: #666; margin-right: 8px; }
        
        /* Receiver status */
        .receiver-status { margin: 15px 0; display: flex; align-items: center; gap: 10px; }
        .status-indicator { padding: 6px 10px; border-radius: 15px; font-size: 0.9em; }
        .status-indicator.active { background: #d4edda; color: #155724; }
        .status-indicator.inactive { background: #f8d7da; color: #721c24; }
        .has-new { animation: highlight 0.5s ease-in-out; }
        
        /* Responsive design */
        @media (max-width: 768px) {
            .components-grid { grid-template-columns: 1fr; }
            .notifications { position: relative; top: auto; right: auto; max-width: 100%; margin: 10px 0; }
        }
        
        /* Theme variations */
        body.dark { background: #2c3e50; color: #ecf0f1; }
        body.dark .data-sender-component, 
        body.dark .data-receiver-component, 
        body.dark .interactive-widget { background: #34495e; border-color: #4a6741; }
        body.dark .shared-data { background: #2c3e50; color: #ecf0f1; border-left-color: #3498db; }
        
        body.blue { background: #e3f2fd; color: #1565c0; }
        body.blue .data-sender-component, 
        body.blue .data-receiver-component, 
        body.blue .interactive-widget { background: #f3e5f5; border-color: #9c27b0; }
        
        body.green { background: #e8f5e8; color: #2e7d32; }
        body.green .data-sender-component, 
        body.green .data-receiver-component, 
        body.green .interactive-widget { background: #f1f8e9; border-color: #689f38; }
        
        /* Animations */
        @keyframes highlight {
            0% { background-color: #fff3cd; }
            100% { background-color: transparent; }
        }
        
        .success { color: #28a745; margin: 10px 0; padding: 8px; background: #d4edda; border-radius: 4px; }
        .sync-success { background: #d4edda; color: #155724; padding: 15px; border-radius: 6px; margin: 10px 0; }
        .sync-success ul { margin: 10px 0; }
        .no-messages { color: #6c757d; font-style: italic; text-align: center; padding: 20px; }
    </style>
</head>
<body>
    <div id="root"></div>
    
    <script type="module">
        import App from './App.jsx';
        import { appData, serverStatus } from './signals/appStore.js';
        
        // Initialize the application
        document.getElementById('root').innerHTML = App();
        
        // Initialize HTMX
        htmx.process(document.body);
        
        // Set up signal debugging (development only)
        if (window.location.hostname === 'localhost') {
            window.appSignals = {
                appData,
                serverStatus
            };
            console.log('🔧 Development mode: appSignals available in window.appSignals');
        }
        
        // Server connection check
        const checkServerConnection = async () => {
            try {
                const response = await fetch('/api/health');
                if (response.ok) {
                    serverStatus.value = 'online';
                } else {
                    serverStatus.value = 'offline';
                }
            } catch (error) {
                serverStatus.value = 'offline';
            }
        };
        
        // Check server status periodically
        checkServerConnection();
        setInterval(checkServerConnection, 30000); // Every 30 seconds
        
        // Handle visibility change (pause/resume when tab not visible)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                checkServerConnection();
            }
        });
        
        // Service worker registration (optional, for offline capability)
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('Service Worker registered');
                })
                .catch(error => {
                    console.log('Service Worker registration failed');
                });
        }
        
        console.log('🚀 Micro Frontends app loaded with mono-jsx signals + HTMX');
    </script>
</body>
</html>
```

## Signal-Based Architecture Insights

### Effective Component Communication

Signals eliminate communication complexity that plagues traditional micro frontend implementations:

- Components update instantly when shared state changes
- No prop drilling or context provider complexity
- Computed values recalculate automatically when dependencies change
- Side effects and server synchronization happen naturally through effects

### Performance Characteristics

Performance characteristics often exceed expectations from React-based applications:

- Only affected DOM elements update when signals change
- Direct DOM manipulation eliminates virtual DOM overhead
- Computed signals recalculate only when accessed and dependencies change
- Bundle size remained dramatically smaller than equivalent React implementations

### Intuitive State Management

Separating local and server state through signals and HTMX creates a mental model that matches how users interact with applications:

- UI responds immediately to user actions through signals
- Server persistence happens in the background via HTMX
- Optimistic updates provide instant feedback
- State reconciliation occurs automatically through signal reactivity

### Scalable Communication Patterns

**Local Communication Through Signals**

```javascript
// Component A updates shared state
updateMessage("Hello from Component A");

// Component B automatically receives the update
effect(() => {
  console.log("Message changed:", appData.value.message);
});
```

**Server Communication Through HTMX**

```jsx
// Background sync without blocking UI
<form hx-post="/api/save" hx-target="#result">
  <!-- Form automatically syncs to server -->
</form>
```

**The Hybrid Approach That Works**

```javascript
// Update local state immediately + sync to server
const handleAction = async () => {
  // 1. Immediate local update
  incrementCounter();
  
  // 2. Background server sync
  await syncToServer('/api/counter', { counter: appData.value.counter });
};
```

### Scalable Micro Frontend Architecture

This approach solves deployment and team coordination challenges common in micro frontend implementations:

- Components can be deployed independently across different domains
- Server technology choices remain flexible
- Applications work without JavaScript, enhanced progressively with signals
- Teams can work independently using shared signal contracts

### Natural Developer Experience

This architecture feels natural compared to complex state management libraries:

- Signals behave like reactive variables with obvious semantics
- Debugging becomes straightforward since signal values are always inspectable
- Development workflow improves because signal state persists across hot reloads
- TypeScript integration provides complete type safety without configuration overhead

### Practical Implementation Patterns

**Cross-Component Notifications**

```javascript
// Any component can trigger notifications
addNotification("User action completed", "success");

// Layout automatically displays them
effect(() => {
  notifications.value.forEach(notification => {
    // Auto-render in UI
  });
});
```

**Theme Synchronization**

```javascript
// One component changes theme
setTheme("dark");

// All components instantly update
effect(() => {
  document.body.className = appData.value.theme;
});
```

**Real-Time Data Flow**

```javascript
// Server data flows through signals
effect(() => {
  if (serverData.value.newMessage) {
    updateMessage(serverData.value.newMessage);
    addNotification("New message received", "info");
  }
});
```

### Production Deployment Considerations

**Error Handling**

```javascript
// Signal-based error handling
const errorState = signal(null);

effect(() => {
  try {
    // Risky operation
    processData(appData.value);
  } catch (error) {
    errorState.value = error;
    addNotification("Operation failed", "error");
  }
});
```

**Memory Management**

```javascript
// Automatic cleanup when components unmount
const cleanup = effect(() => {
  // Side effect logic
});

// Call cleanup() when component is destroyed
onUnmount(() => cleanup());
```

**Performance Monitoring**

```javascript
// Track signal update frequency
const updateCount = signal(0);

effect(() => {
  appData.value; // Dependency
  updateCount.value++;
  
  if (updateCount.value > 100) {
    console.warn("High frequency updates detected");
  }
});
```

## Benefits of This Approach

Building micro frontends with signals and HTMX fundamentally changes frontend architecture thinking. The combination provides reactive programming benefits without complexity overhead that typically accompanies modern frontend frameworks.

Applications become more maintainable, teams gain independence, and users experience better performance. The development process focuses on solving business problems rather than wrestling with framework complexity.

This architecture scales from simple components to complex applications while maintaining simplicity that makes it approachable for teams of any size.
