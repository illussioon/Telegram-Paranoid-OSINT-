// Глобальные переменные
let currentChats = [];
let totalChats = 0;
let currentOffset = 0;
let isLoading = false;
const CHATS_PER_PAGE = 50;

// Добавим глобальные переменные для текущего чата
let currentChatId = null;
let currentMessages = [];
let isLoadingMessages = false;
let hasMoreMessages = true;
const MESSAGES_PER_LOAD = 100;

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async() => {
    await loadInitialChats();
    setupInfiniteScroll();

    // Добавляем обработчик поиска
    const searchInput = document.querySelector('.search-bar input');
    searchInput.addEventListener('input', filterChats);
});

// Загрузка начальных чатов
async function loadInitialChats() {
    showLoading();
    const result = await loadChats(0, CHATS_PER_PAGE, true);
    if (result.success) {
        renderChats(result.chats, false);
        totalChats = result.total;

        // Если есть кэш, запускаем фоновое обновление
        if (result.from_cache) {
            refreshChatsInBackground();
        }
    }
}

// Фоновое обновление чатов
async function refreshChatsInBackground() {
    const result = await loadChats(0, CHATS_PER_PAGE, false);
    if (result.success) {
        renderChats(result.chats, true);
    }
}

// Настройка бесконечной прокрутки
function setupInfiniteScroll() {
    const chatsList = document.getElementById('chatsList');
    chatsList.addEventListener('scroll', async() => {
        if (isLoading) return;

        const { scrollTop, scrollHeight, clientHeight } = chatsList;
        if (scrollTop + clientHeight >= scrollHeight - 100) {
            if (currentChats.length < totalChats) {
                await loadMoreChats();
            }
        }
    });
}

// Загрузка дополнительных чатов
async function loadMoreChats() {
    isLoading = true;
    showLoadingMore();

    const nextOffset = currentOffset + CHATS_PER_PAGE;
    const result = await loadChats(nextOffset, CHATS_PER_PAGE, true);

    if (result.success) {
        currentOffset = nextOffset;
        renderChats(result.chats, true);
    }

    hideLoadingMore();
    isLoading = false;
}

// Загрузка чатов
async function loadChats(offset, limit, use_cache) {
    try {
        const result = await eel.get_client_chats(offset, limit, use_cache)();
        if (result.error) {
            showError(result.error);
            return { success: false };
        }
        return {
            success: true,
            chats: result.chats,
            total: result.total,
            from_cache: result.from_cache
        };
    } catch (error) {
        showError(`Ошибка при загрузке чатов: ${error.message}`);
        return { success: false };
    }
}

// Отображение чатов
function renderChats(chats, append = false) {
    const chatsList = document.getElementById('chatsList');

    if (!append) {
        chatsList.innerHTML = '';
        currentChats = [];
    }

    chats.forEach(chat => {
        if (!currentChats.find(c => c.id === chat.id)) {
            currentChats.push(chat);
            const chatElement = createChatElement(chat);
            chatsList.appendChild(chatElement);
        }
    });
}

// Создание элемента чата
function createChatElement(chat) {
    const chatElement = document.createElement('div');
    chatElement.className = 'chat-item';
    chatElement.dataset.id = chat.id;

    chatElement.innerHTML = `
        <div class="chat-avatar">
            ${chat.photo_path ? 
                `<img src="${chat.photo_path}" alt="${chat.title}">` : 
                `<div class="no-photo">${chat.title[0]}</div>`}
        </div>
        <div class="chat-info">
            <div class="chat-title">${chat.title}</div>
            <div class="chat-last-message">
                ${chat.last_message || 'Нет сообщений'}
            </div>
        </div>
        ${chat.unread_count ? 
            `<div class="unread-counter">${chat.unread_count}</div>` : 
            ''}
    `;
    
    chatElement.addEventListener('click', () => selectChat(chat.id));
    return chatElement;
}

// Фильтрация чатов при поиске
function filterChats(event) {
    const searchQuery = event.target.value.toLowerCase();
    const filteredChats = currentChats.filter(chat => 
        chat.title.toLowerCase().includes(searchQuery)
    );
    renderChats(filteredChats);
}

// Обновим функцию выбора чата
async function selectChat(chatId) {
    try {
        console.log('Выбран чат:', chatId);
        
        // Останавливаем отслеживание предыдущего чата
        if (currentChatId) {
            await eel.stop_message_updates(currentChatId)();
        }
        
        // Убираем активный класс у всех чатов
        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.remove('active');
        });

        // Добавляем активный класс выбранному чату
        const selectedChat = document.querySelector(`.chat-item[data-id="${chatId}"]`);
        if (selectedChat) {
            selectedChat.classList.add('active');
        }

        currentChatId = chatId;
        currentMessages = [];
        hasMoreMessages = true;
        
        // Очищаем панель сообщений перед загрузкой
        document.getElementById('messagesList').innerHTML = '';
        
        // Загружаем сообщения
        await loadMessages();
        
        // Активируем поле ввода
        enableMessageInput();
        
        // Настраиваем прокрутку для подгрузки старых сообщений
        setupMessagesScroll();
        
        // Запускаем отслеживание новых сообщений
        const result = await eel.start_message_updates(chatId)();
        if (result.error) {
            console.error('Ошибка при запуске отслеживания:', result.error);
        } else {
            console.log('Отслеживание сообщений запущено');
        }
        
    } catch (error) {
        console.error('Ошибка при выборе чата:', error);
        showMessagesError(`Ошибка при выборе чата: ${error.message}`);
    }
}

// Загрузка сообщений
async function loadMessages(minId = null) {
    try {
        if (!minId) {
            showMessagesLoading();
        }
        
        const result = await eel.get_chat_messages(currentChatId, MESSAGES_PER_LOAD, minId)();
        console.log('Получены сообщения:', result);
        
        if (result.error) {
            showMessagesError(result.error);
            return;
        }

        // Обновляем заголовок чата при первой загрузке
        if (!minId) {
            updateChatHeader(result.chat_info);
        }
        
        // Сохраняем информацию о наличии старых сообщений
        hasMoreMessages = result.has_more;
        
        // Отображаем сообщения
        renderMessages(result.messages, !minId);
        
    } catch (error) {
        console.error('Ошибка при загрузке сообщений:', error);
        showMessagesError(`Ошибка при загрузке сообщений: ${error.message}`);
    }
}

// Отображение сообщений
function renderMessages(messages, clear = false) {
    const messagesList = document.getElementById('messagesList');
    const scrollPos = messagesList.scrollTop;
    const oldHeight = messagesList.scrollHeight;
    
    if (clear) {
        messagesList.innerHTML = '';
        currentMessages = [];
    }
    
    const fragment = document.createDocumentFragment();
    messages.forEach(message => {
        if (!currentMessages.find(m => m.id === message.id)) {
            currentMessages.push(message);
            const messageElement = createMessageElement(message);
            fragment.appendChild(messageElement);
        }
    });
    
    if (clear) {
        messagesList.appendChild(fragment);
        messagesList.scrollTop = messagesList.scrollHeight;
    } else {
        messagesList.insertBefore(fragment, messagesList.firstChild);
        messagesList.scrollTop = scrollPos + (messagesList.scrollHeight - oldHeight);
    }
}

// Создание элемента сообщения
function createMessageElement(message) {
    const messageElement = document.createElement('div');
    messageElement.className = `message ${message.is_outgoing ? 'outgoing' : 'incoming'}`;
    messageElement.dataset.id = message.id;
    
    let mediaHtml = '';
    if (message.media) {
        switch (message.media.type) {
            case 'photo':
                mediaHtml = `
                    <div class="message-media">
                        <img src="${message.media.path}" alt="Photo" class="message-photo">
                    </div>
                `;
                break;
            case 'voice':
            case 'audio':
                mediaHtml = `
                    <div class="message-media">
                        <audio controls>
                            <source src="${message.media.path}" type="audio/ogg">
                            Your browser does not support the audio element.
                        </audio>
                        <span class="audio-duration">${formatDuration(message.media.duration)}</span>
                    </div>
                `;
                break;
        }
    }
    
    messageElement.innerHTML = `
        ${message.sender && !message.is_outgoing ? `
            <div class="message-avatar">
                ${message.sender.photo_path ? 
                    `<img src="${message.sender.photo_path}" alt="${message.sender.name}">` :
                    `<div class="no-photo">${message.sender.name[0]}</div>`}
            </div>
        ` : ''}
        <div class="message-content">
            ${message.sender && !message.is_outgoing ? 
                `<div class="message-sender">${message.sender.name}</div>` : ''}
            ${mediaHtml}
            ${message.text ? `<div class="message-text">${message.text}</div>` : ''}
            <div class="message-time">${formatDate(message.date)}</div>
        </div>
    `;
    
    return messageElement;
}

// Отправка сообщения
async function sendMessage() {
    const input = document.querySelector('.message-input textarea');
    const text = input.value.trim();
    
    if (!text || !currentChatId) return;
    
    try {
        input.disabled = true;
        const result = await eel.send_message(currentChatId, text)();
        
        if (result.error) {
            showError(result.error);
            return;
        }
        
        // Очищаем поле ввода
        input.value = '';
        
        // Добавляем сообщение в чат
        renderMessages([result.message]);
        
    } catch (error) {
        showError(`Ошибка при отправке сообщения: ${error.message}`);
    } finally {
        input.disabled = false;
        input.focus();
    }
}

// Вспомогательные функции
function formatDate(timestamp) {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function updateChatHeader(chatInfo) {
    const chatHeader = document.getElementById('chatHeader');
    chatHeader.innerHTML = `
        <div class="chat-title">${chatInfo.title}</div>
        <div class="chat-status">${chatInfo.type}</div>
    `;
}

function enableMessageInput() {
    const textarea = document.querySelector('.message-input textarea');
    const sendButton = document.querySelector('.send-button');
    
    textarea.disabled = false;
    sendButton.disabled = false;
    
    // Добавляем обработчики
    textarea.onkeypress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };
    
    sendButton.onclick = sendMessage;
}

// Показ индикатора загрузки
function showLoading() {
    const chatsList = document.getElementById('chatsList');
    chatsList.innerHTML = `
        <div class="loading-message">
            <div class="loading-spinner"></div>
            <div class="loading-text">Загрузка чатов...</div>
        </div>
    `;
}

// Показ индикатора загрузки дополнительных чатов
function showLoadingMore() {
    const loadingMore = document.createElement('div');
    loadingMore.className = 'loading-more';
    loadingMore.innerHTML = `
        <div class="loading-spinner"></div>
        <div class="loading-text">Загрузка дополнительных чатов...</div>
    `;
    document.getElementById('chatsList').appendChild(loadingMore);
}

// Скрытие индикатора загрузки дополнительных чатов
function hideLoadingMore() {
    const loadingMore = document.querySelector('.loading-more');
    if (loadingMore) {
        loadingMore.remove();
    }
}

// Отображение ошибок
function showError(message) {
    const chatsList = document.getElementById('chatsList');
    chatsList.innerHTML = `
        <div class="error-message">
            <div class="error-icon">❌</div>
            <div class="error-text">${message}</div>
        </div>
    `;
}

// Добавим функции для отображения состояния загрузки сообщений
function showMessagesLoading() {
    const messagesList = document.getElementById('messagesList');
    messagesList.innerHTML = `
        <div class="loading-message">
            <div class="loading-spinner"></div>
            <div class="loading-text">Загрузка сообщений...</div>
        </div>
    `;
}

function showMessagesError(message) {
    const messagesList = document.getElementById('messagesList');
    messagesList.innerHTML = `
        <div class="error-message">
            <div class="error-icon">❌</div>
            <div class="error-text">${message}</div>
        </div>
    `;
}

// Добавим обработчик прокрутки для подгрузки старых сообщений
function setupMessagesScroll() {
    const messagesList = document.getElementById('messagesList');
    messagesList.addEventListener('scroll', async () => {
        if (messagesList.scrollTop < 100 && !isLoadingMessages && hasMoreMessages) {
            isLoadingMessages = true;
            
            // Получаем ID самого старого загруженного сообщения
            const oldestMessage = currentMessages[0];
            if (oldestMessage) {
                await loadMessages(oldestMessage.id);
            }
            
            isLoadingMessages = false;
        }
    });
}

// Обновим обработчик новых сообщений
eel.expose(onNewMessage);
function onNewMessage(message) {
    console.log('Получено новое сообщение:', message);
    
    // Проверяем, не дубликат ли это сообщение
    if (!currentMessages.find(m => m.id === message.id)) {
        currentMessages.push(message);
        renderMessages([message], false);
        
        // Прокручиваем к новому сообщению, если чат был прокручен вниз
        const messagesList = document.getElementById('messagesList');
        if (messagesList.scrollHeight - messagesList.scrollTop <= messagesList.clientHeight + 100) {
            messagesList.scrollTop = messagesList.scrollHeight;
        }
    }
}

// Добавим функцию для звонков
async function startCall(chatId) {
    try {
        const result = await eel.start_call(chatId)();
        if (result.error) {
            showError(result.error);
            return;
        }
        
        // Здесь можно добавить логику управления звонком
        console.log('Звонок начат:', result);
        
    } catch (error) {
        showError(`Ошибка при звонке: ${error.message}`);
    }
}

// Вспомогательные функции
function formatDuration(seconds) {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}