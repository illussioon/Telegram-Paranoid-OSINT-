// Добавим глобальную переменную для хранения списка чатов
let availableChats = [];

// Глобальная переменная для хранения начального состояния профиля
let initialProfile = null;

// Функция проверки авторизации при загрузке
async function checkInitialAuth() {
    const result = await eel.check_telegram_auth()();
    if (result.authorized) {
        document.querySelectorAll('.telegram-auth').forEach(el => {
            el.style.display = 'none';
        });
        showTelegramChats();
    }
}

// Вызываем проверку при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Проверка авторизации
    checkInitialAuth();

    // Обработчик для выпадающего меню Telegram
    const dropdownToggle = document.querySelector('.menu-dropdown > .menu-item');
    const dropdown = document.querySelector('.menu-dropdown');

    dropdownToggle.addEventListener('click', function(e) {
        e.preventDefault();
        dropdown.classList.toggle('active');
    });

    // Обработчик для пунктов меню
    document.querySelectorAll('.menu-item[data-section]').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();

            // Убираем активный класс у всех пунктов меню
            document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
            // Добавляем активный класс текущему пункту
            this.classList.add('active');

            // Скрываем все секции
            document.querySelectorAll('.content-section').forEach(section => {
                section.classList.remove('active');
            });

            // Показываем нужную секцию
            const sectionId = this.dataset.section;
            document.getElementById(sectionId).classList.add('active');
        });
    });

    // Обработчики для радио-кнопок выбора источника
    document.querySelectorAll('input[name="dataSource"]').forEach(radio => {
        radio.addEventListener('change', async function() {
            const fileContainer = document.getElementById('fileUploadContainer');
            const telegramContainer = document.getElementById('telegramContainer');

            if (this.value === 'file') {
                fileContainer.style.display = 'block';
                telegramContainer.style.display = 'none';
            } else {
                fileContainer.style.display = 'none';
                telegramContainer.style.display = 'block';

                // Проверяем авторизацию и загружаем чаты
                const authResult = await eel.check_telegram_auth()();
                if (authResult.authorized) {
                    await showTelegramChats();
                } else {
                    // Если не авторизован, показываем кнопку авторизации
                    document.querySelector('.telegram-auth').style.display = 'block';
                    document.querySelector('.telegram-chats').style.display = 'none';
                }
            }
        });
    });

    document.querySelectorAll('input[name="dataSourceGraph"]').forEach(radio => {
        radio.addEventListener('change', async function() {
            const fileContainer = document.getElementById('fileUploadContainerGraph');
            const telegramContainer = document.getElementById('telegramContainerGraph');

            if (this.value === 'file') {
                fileContainer.style.display = 'block';
                telegramContainer.style.display = 'none';
            } else {
                fileContainer.style.display = 'none';
                telegramContainer.style.display = 'block';

                // Проверяем авторизацию и загружаем чаты
                const authResult = await eel.check_telegram_auth()();
                if (authResult.authorized) {
                    await showTelegramChats();
                } else {
                    // Если не авторизован, показываем кнопку авторизации
                    document.querySelector('.telegram-auth').style.display = 'block';
                    document.querySelector('.telegram-chats').style.display = 'none';
                }
            }
        });
    });

    updateSessionStatus();
});

// Начало авторизации
async function startAuth() {
    try {
        const phone = document.getElementById('authPhone').value;
        if (!phone) {
            document.getElementById('authError').textContent = 'Введите номер телефона';
            document.getElementById('authError').style.display = 'block';
            return;
        }

        console.log('Starting auth with phone:', phone); // Для отладки
        const result = await eel.start_telegram_auth(phone)();
        console.log('Auth result:', result); // Для отладки

        if (result.error) {
            document.getElementById('authError').textContent = result.error;
            document.getElementById('authError').style.display = 'block';
            return;
        }

        if (result.step === 'code_required') {
            document.getElementById('phoneStep').style.display = 'none';
            document.getElementById('codeStep').style.display = 'block';
        } else if (result.step === 'completed') {
            hideAuthModal();
            await showTelegramChats(result.chats);
        }
    } catch (error) {
        console.error('Auth error:', error);
        document.getElementById('authError').textContent = 'Произошла ошибка при авторизации';
        document.getElementById('authError').style.display = 'block';
    }
}

// Проверка кода
async function verifyCode() {
    try {
        const code = document.getElementById('authCode').value;
        if (!code) {
            document.getElementById('authError').textContent = 'Введите код';
            document.getElementById('authError').style.display = 'block';
            return;
        }

        console.log('Verifying code:', code); // Для отладки
        const result = await eel.verify_telegram_code(code)();
        console.log('Code verification result:', result); // Для отладки

        if (result.error) {
            document.getElementById('authError').textContent = result.error;
            document.getElementById('authError').style.display = 'block';
            return;
        }

        if (result.step === '2fa_required') {
            document.getElementById('codeStep').style.display = 'none';
            document.getElementById('passwordStep').style.display = 'block';
        } else if (result.step === 'completed') {
            hideAuthModal();
            await showTelegramChats(result.chats);
        }
    } catch (error) {
        console.error('Code verification error:', error);
        document.getElementById('authError').textContent = 'Произошла ошибка при проверке кода';
        document.getElementById('authError').style.display = 'block';
    }
}

// Проверка двухфакторной аутентификации
async function verify2FA() {
    try {
        const password = document.getElementById('auth2FA').value;
        if (!password) {
            document.getElementById('authError').textContent = 'Введите пароль';
            document.getElementById('authError').style.display = 'block';
            return;
        }

        console.log('Verifying 2FA'); // Для отладки
        const result = await eel.verify_telegram_2fa(password)();
        console.log('2FA result:', result); // Для отладки

        if (result.error) {
            document.getElementById('authError').textContent = result.error;
            document.getElementById('authError').style.display = 'block';
            return;
        }

        if (result.step === 'completed') {
            hideAuthModal();
            await showTelegramChats(result.chats);
        }
    } catch (error) {
        console.error('2FA error:', error);
        document.getElementById('authError').textContent = 'Произошла ошибка при проверке пароля';
        document.getElementById('authError').style.display = 'block';
    }
}

// Обновленная функция показа чатов
async function showTelegramChats(chats = null) {
    try {
        if (!chats) {
            const result = await eel.get_telegram_chats()();
            if (result.error) {
                throw new Error(result.error);
            }
            chats = result.chats;
        }

        availableChats = chats;

        // Показываем контейнеры с чатами
        document.querySelectorAll('.telegram-chats').forEach(el => {
            el.style.display = 'block';
        });

        // Скрываем кнопки авторизации
        document.querySelectorAll('.telegram-auth').forEach(el => {
            el.style.display = 'none';
        });

        // Заполняем выпадающие списки
        const inputs = document.querySelectorAll('#chatSearchInput, #chatSearchInputGraph');
        inputs.forEach(input => {
            input.value = ''; // Очищаем поле поиска
            filterChats(input.id === 'chatSearchInputGraph'); // Показываем все чаты
        });
    } catch (error) {
        console.error('Error showing chats:', error);
        alert('Ошибка при получении списка чатов: ' + error.message);
    }
}

// Функция фильтрации чатов
function filterChats(isGraph = false) {
    const inputId = isGraph ? 'chatSearchInputGraph' : 'chatSearchInput';
    const dropdownId = isGraph ? 'chatsDropdownGraph' : 'chatsDropdown';

    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);
    const searchText = input.value.toLowerCase();

    // Фильтруем чаты
    const filteredChats = availableChats.filter(chat =>
        chat.title.toLowerCase().includes(searchText)
    );

    // Отдаем резуьтаты
    dropdown.innerHTML = '';
    filteredChats.forEach(chat => {
        const option = document.createElement('div');
        option.className = 'chat-option';
        option.textContent = chat.title;
        option.onclick = () => selectChat(chat, isGraph);
        dropdown.appendChild(option);
    });

    // Всегда показываем выпадающий список при фокусе или если есть текст
    dropdown.style.display = 'block';
}

// Функция выбора чата
function selectChat(chat, isGraph = false) {
    const inputId = isGraph ? 'chatSearchInputGraph' : 'chatSearchInput';
    const dropdownId = isGraph ? 'chatsDropdownGraph' : 'chatsDropdown';

    const input = document.getElementById(inputId);
    const dropdown = document.getElementById(dropdownId);

    input.value = chat.title;
    input.dataset.chatId = chat.id;
    dropdown.style.display = 'none';
}

// Функция анализа загруженного JSON файла
async function analyzeChatFile() {
    const fileInput = document.getElementById('chatFile');
    const file = fileInput.files[0];

    if (!file) {
        alert('Выберите файл для анализа');
        return;
    }

    try {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const resultsContainer = document.getElementById('analysisResults');
                resultsContainer.innerHTML = '';

                const result = await eel.analyze_telegram_chat(e.target.result)();
                if (result.error) {
                    alert('Ошибка при анализе: ' + result.error);
                    return;
                }
                displayAnalysisResults(result);
            } catch (error) {
                console.error('Error:', error);
                alert('Ошибка при анализе файла');
            }
        };
        reader.readAsText(file);
    } catch (error) {
        console.error('Error reading file:', error);
        alert('Ошибка при чтении файла');
    }
}

// Функция анализа чата из Telegram
async function analyzeTelegramChat() {
    const input = document.getElementById('chatSearchInput');
    const chatId = input.dataset.chatId;

    if (!chatId) {
        alert('Выберите чат для анализа');
        return;
    }

    try {
        const resultsContainer = document.getElementById('analysisResults');
        resultsContainer.innerHTML = '';

        // Получаем JSON
        const result = await eel.get_chat_json(chatId)();
        if (result.error) {
            alert(result.error);
            return;
        }

        // Анализируем полученные данные
        const analysisResult = await eel.analyze_telegram_chat(JSON.stringify(result.chat_data))();
        if (analysisResult.error) {
            alert(analysisResult.error);
            return;
        }

        // Отображаем результаты анализа
        displayAnalysisResults(analysisResult);

    } catch (error) {
        console.error('Error analyzing Telegram chat:', error);
        alert('Ошибка при анализе чата');
    }
}

// Функция построения графа из Telegram
async function generateGraphFromTelegram() {
    const input = document.getElementById('chatSearchInputGraph');
    const chatId = input.dataset.chatId;

    if (!chatId) {
        alert('Выберите чат для построения графа');
        return;
    }

    try {
        // Получаем и сохраняем JSON
        const result = await eel.get_chat_json(chatId)();
        if (result.error) {
            alert(result.error);
            return;
        }

        // Строим граф
        const graphResult = await eel.generator(JSON.stringify(result.chat_data))();
        if (graphResult.success) {
            const graphResults = document.getElementById('graphResults');
            graphResults.innerHTML = `
                <div class="analysis-section">
                    <h3>Информация о чате: ${graphResult.group_name}</h3>
                    <ul>
                        <li>Первое сообщение: ${graphResult.first_message}</li>
                        <li>Последнее сообщение: ${graphResult.last_message}</li>
                        <li>Всего сообщений: ${graphResult.total_messages}</li>
                        <li>Всего участников: ${graphResult.total_users}</li>
                    </ul>
                </div>
                <img id="interactionGraph" src="assets/interaction_graph.png?${new Date().getTime()}" 
                     style="width: 100%; margin-top: 20px;">
            `;
        }

    } catch (error) {
        console.error('Error generating graph from Telegram:', error);
        alert('Ошибка при построении графа');
    }
}

// Добвим проверку статуса сессии
async function updateSessionStatus() {
    const result = await eel.check_telegram_auth()();
    const statusElement = document.getElementById('sessionStatus');
    if (result.authorized) {
        statusElement.innerHTML = '<div class="success">Сессия Telegram активна</div>';
    } else {
        statusElement.innerHTML = '<div class="warning">Сессия Telegram не создана</div>';
    }
}

// Добавим обработчики фокуса для полей поиска
document.addEventListener('DOMContentLoaded', function() {
    const inputs = document.querySelectorAll('#chatSearchInput, #chatSearchInputGraph');
    inputs.forEach(input => {
        input.addEventListener('focus', () => {
            filterChats(input.id === 'chatSearchInputGraph');
        });
    });

    // Скрываем выпадающие списки при клике вне них
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.search-chats-container')) {
            document.querySelectorAll('.chats-dropdown').forEach(dropdown => {
                dropdown.style.display = 'none';
            });
        }
    });
});

// Функция проверки авторизации и показа модального окна если нужно
async function requireTelegramAuth(callback) {
    const result = await eel.check_telegram_auth()();
    if (!result.authorized) {
        showAuthModal(callback);
        return;
    }
    await callback();
}

// Функция показа модального окна авторизации
function showAuthModal(callback) {
    document.getElementById('authModal').style.display = 'block';
    document.getElementById('phoneStep').style.display = 'block';
    document.getElementById('codeStep').style.display = 'none';
    document.getElementById('passwordStep').style.display = 'none';
    document.getElementById('authError').style.display = 'none';

    // Сохраняем callback для выполнения после успешной авторизации
    window.authCallback = callback;
}

// Функция скрытия модального окна
function hideAuthModal() {
    document.getElementById('authModal').style.display = 'none';
    // Очищаем все поля ввода
    document.getElementById('authPhone').value = '';
    document.getElementById('authCode').value = '';
    document.getElementById('auth2FA').value = '';
}

// Функция обновления прогресса
eel.expose(updateProgress);

function updateProgress(status, progress) {
    const resultsContainer = document.getElementById('analysisResults');

    // Создаем или обновляем контейнер прогресса
    let progressContainer = document.getElementById('progressContainer');
    if (!progressContainer) {
        progressContainer = document.createElement('div');
        progressContainer.id = 'progressContainer';
        progressContainer.className = 'progress-container glass-effect';
        resultsContainer.prepend(progressContainer);
    }

    // Обновляем содержимое
    if (progress < 0) {
        // Ошибка
        progressContainer.innerHTML = `
            <div class="error-status">${status}</div>
        `;
    } else if (progress >= 100) {
        // Завершено
        progressContainer.innerHTML = `
            <div class="success-status">${status}</div>
            <div class="progress-bar">
                <div class="progress" style="width: 100%"></div>
            </div>
        `;
        // Удаляем контейнер через 3 секунды после завершения
        setTimeout(() => {
            progressContainer.remove();
        }, 3000);
    } else {
        // В процессе
        progressContainer.innerHTML = `
            <div class="status">${status}</div>
            <div class="progress-bar">
                <div class="progress" style="width: ${progress}%"></div>
            </div>
        `;
    }
}

// Функция построения графа из загруженного JSON файла
async function generateGraph() {
    const fileInput = document.getElementById('graphFile');
    const file = fileInput.files[0];

    if (!file) {
        alert('Выберите файл для построения графа');
        return;
    }

    try {
        const reader = new FileReader();
        reader.onload = async function(e) {
            try {
                const result = await eel.generator(e.target.result)();
                if (result.error) {
                    alert('Ошибка при построении графа: ' + result.error);
                    return;
                }

                const graphResults = document.getElementById('graphResults');
                graphResults.innerHTML = `
                    <div class="analysis-section">
                        <h3>Информация о чате: ${result.group_name}</h3>
                        <ul>
                            <li>Первое сообщение: ${result.first_message}</li>
                            <li>Последнее сообщение: ${result.last_message}</li>
                            <li>Всего сообщений: ${result.total_messages}</li>
                            <li>Всего участников: ${result.total_users}</li>
                        </ul>
                    </div>
                    <img id="interactionGraph" src="assets/interaction_graph.png?${new Date().getTime()}" 
                         style="width: 100%; margin-top: 20px;">
                `;
            } catch (error) {
                console.error('Error:', error);
                alert('Ошибка при построении графа');
            }
        };
        reader.readAsText(file);
    } catch (error) {
        console.error('Error reading file:', error);
        alert('Ошибка при чтении файла');
    }
}

// Функция отображения результатов анализа для JSON файлов
function displayAnalysisResults(results) {
    const container = document.getElementById('analysisResults');

    // Общая информация о чате
    container.innerHTML = `
        <div class="analysis-section">
            <h3>Информация о чате: ${results.group_name}</h3>
            <ul>
                <li>Первое сообщение: ${results.first_message}</li>
                <li>Последнее сообщение: ${results.last_message}</li>
                <li>Всего сообщений: ${results.total_messages}</li>
                <li>Всего участников: ${results.total_users}</li>
            </ul>
        </div>
    `;

    // Общая статистика слов
    container.innerHTML += `
        <div class="analysis-section">
            <h3>Общая статистика слов</h3>
            <ul>
                ${results.total_words.map(([word, count]) => 
                    `<li>${word}: ${count}</li>`
                ).join('')}
            </ul>
        </div>
    `;
    
    // Статистика по пользователям
    Object.entries(results.users).forEach(([user, data]) => {
        container.innerHTML += `
            <div class="analysis-section">
                <h3>${user}</h3>
                <p>Количество сообщений: ${data.message_count}</p>
                <h4>Топ слов:</h4>
                <ul>
                    ${data.top_words.map(([word, count]) => 
                        `<li>${word}: ${count}</li>`
                    ).join('')}
                </ul>
            </div>
        `;
    });
    
    // Найденные контакты
    if (results.emails.length || results.phones.length) {
        container.innerHTML += `
            <div class="analysis-section">
                <h3>Найденные контакты</h3>
                ${results.emails.length ? `
                    <h4>Email адреса:</h4>
                    <ul>
                        ${results.emails.map(email => `<li>${email}</li>`).join('')}
                    </ul>
                ` : ''}
                ${results.phones.length ? `
                    <h4>Телефонные номера:</h4>
                    <ul>
                        ${results.phones.map(phone => `<li>${phone}</li>`).join('')}
                    </ul>
                ` : ''}
            </div>
        `;
    }
}

// Функция отображения результатов анализа для Telegram
function displayTelegramAnalysisResults(results) {
    const container = document.getElementById('analysisResults');
    
    // Общая информация о чате
    container.innerHTML = `
        <div class="analysis-section">
            <h3>Информация о чате: ${results.group_name || 'Неизвестно'}</h3>
            <ul>
                <li>Первое сообщение: ${results.first_message || 'Нет данных'}</li>
                <li>Последнее сообщение: ${results.last_message || 'Не данных'}</li>
                <li>Всего сообщений: ${results.total_messages || 0}</li>
                <li>Всего участников: ${results.total_users || 0}</li>
            </ul>
        </div>
    `;
    
    if (results.total_words && results.total_words.length > 0) {
        container.innerHTML += `
            <div class="analysis-section">
                <h3>Общая статистика слов</h3>
                <ul>
                    ${results.total_words.map(([word, count]) => 
                        `<li>${word}: ${count}</li>`
                    ).join('')}
                </ul>
            </div>
        `;
    }
    
    if (results.users) {
        Object.entries(results.users).forEach(([user, data]) => {
            if (data && data.top_words) {
                container.innerHTML += `
                    <div class="analysis-section">
                        <h3>${user}</h3>
                        <p>Количество сообщений: ${data.message_count || 0}</p>
                        <h4>Топ слов:</h4>
                        <ul>
                            ${data.top_words.map(([word, count]) => 
                                `<li>${word}: ${count}</li>`
                            ).join('')}
                        </ul>
                    </div>
                `;
            }
        });
    }
    
    if ((results.emails && results.emails.length) || (results.phones && results.phones.length)) {
        container.innerHTML += `
            <div class="analysis-section">
                <h3>Найденные контакты</h3>
                ${results.emails && results.emails.length ? `
                    <h4>Email адреса:</h4>
                    <ul>
                        ${results.emails.map(email => `<li>${email}</li>`).join('')}
                    </ul>
                ` : ''}
                ${results.phones && results.phones.length ? `
                    <h4>Телефонные номера:</h4>
                    <ul>
                        ${results.phones.map(phone => `<li>${phone}</li>`).join('')}
                    </ul>
                ` : ''}
            </div>
        `;
    }
}

// Поиск пользователей в группах
async function searchUsersInGroup() {
    const groupId = document.getElementById('groupSearchInput').value;
    const query = document.getElementById('userSearchQuery').value;
    const resultsDiv = document.getElementById('userSearchResults');
    
    try {
        const result = await eel.search_users_in_group(groupId, query)();
        resultsDiv.innerHTML = '';
        resultsDiv.className = 'tool-results active';
        
        if (result.error) {
            resultsDiv.innerHTML = `<div class="error">${result.error}</div>`;
            return;
        }
        
        result.users.forEach(user => {
            resultsDiv.innerHTML += `
                <div class="user-item">
                    <strong>${user.name}</strong> (@${user.username})
                </div>
            `;
        });
    } catch (error) {
        resultsDiv.innerHTML = `<div class="error">Ошибка: ${error}</div>`;
    }
}

// Разо членов группы
async function parseGroupMembers() {
    const groupId = document.getElementById('groupParseInput').value;
    const resultsDiv = document.getElementById('groupParseResults');
    
    try {
        resultsDiv.innerHTML = '<div class="status">Получение списка участников...</div>';
        resultsDiv.className = 'tool-results active';
        
        const result = await eel.parse_group_members(groupId)();
        if (result.error) {
            resultsDiv.innerHTML = `<div class="error">${result.error}</div>`;
            return;
        }
        
        resultsDiv.innerHTML = `
            <div>Всего участников: ${result.total}</div>
            <div class="members-list">
                ${result.members.map(member => `
                    <div class="member-item">
                        <strong>${member.name}</strong>
                        ${member.username ? `(@${member.username})` : ''}
                    </div>
                `).join('')}
            </div>
        `;
    } catch (error) {
        resultsDiv.innerHTML = `<div class="error">Ошибка: ${error}</div>`;
    }
}

// Мониторинг онлайн-статуса
let statusMonitoringInterval = null;

async function toggleUserStatusMonitoring() {
    let username = document.getElementById('userStatusInput').value;
    // Добавляем @ если его нет
    if (!username.startsWith('@')) {
        username = '@' + username;
    }
    
    const button = document.getElementById('monitoringToggle');
    const resultsDiv = document.getElementById('userStatusResults');
    const interval = parseInt(document.getElementById('statusCheckInterval').value);
    
    if (statusMonitoringInterval) {
        clearInterval(statusMonitoringInterval);
        statusMonitoringInterval = null;
        button.textContent = 'Начать мониторинг';
        return;
    }
    
    button.textContent = 'Остановить мониторинг';
    resultsDiv.className = 'tool-results active';
    
    async function checkStatus() {
        try {
            const result = await eel.check_user_status(username)();
            if (result.error) {
                resultsDiv.innerHTML = `<div class="error">${result.error}</div>`;
                return;
            }
            
            const currentTime = new Date().toLocaleTimeString();
            resultsDiv.innerHTML = `
                <div class="status-check">
                    <div class="check-time">Время проверки: ${currentTime}</div>
                    <div>Статус: ${result.online ? '🟢 Онлайн' : '⚪ Оффлайн'}</div>
                    <div>Последний раз был: ${result.last_seen}</div>
                </div>
            ` + resultsDiv.innerHTML;
            
            // Ограничиваем количество записей в истории
            const statusChecks = resultsDiv.getElementsByClassName('status-check');
            if (statusChecks.length > 10) {
                statusChecks[statusChecks.length - 1].remove();
            }
        } catch (error) {
            resultsDiv.innerHTML = `<div class="error">Ошибка: ${error}</div>`;
        }
    }
    
    await checkStatus();
    statusMonitoringInterval = setInterval(checkStatus, interval);
}

// Загрузка фотографий
async function downloadChannelPhotos() {
    const channelId = document.getElementById('channelPhotosInput').value;
    const resultsDiv = document.getElementById('photosResults');
    
    try {
        resultsDiv.innerHTML = '<div class="status">Загрузка фотографий...</div>';
        resultsDiv.className = 'tool-results active';
        
        const result = await eel.download_channel_photos(channelId)();
        if (result.error) {
            resultsDiv.innerHTML = `<div class="error">${result.error}</div>`;
            return;
        }
        
        resultsDiv.innerHTML = `
            <div>Загружено фотографий: ${result.count}</div>
            <div>Путь: ${result.path}</div>
        `;
    } catch (error) {
        resultsDiv.innerHTML = `<div class="error">Ошибка: ${error}</div>`;
    }
}

// Глобальные переменные для мониторинга профиля
let profileMonitoringInterval = null;

// Функция мониторинга профиля
async function toggleProfileMonitoring() {
    const button = document.querySelector('button[onclick="toggleProfileMonitoring()"]');
    const toolCard = document.getElementById('profileMonitorCard'); // Используем ID
    const resultsDiv = document.getElementById('profileMonitorResults');
    
    if (profileMonitoringInterval) {
        // Останавливаем мониторинг
        clearInterval(profileMonitoringInterval);
        profileMonitoringInterval = null;
        button.textContent = 'Начать мониторинг';
        toolCard.classList.remove('monitoring-active');
        resultsDiv.classList.remove('active');
    } else {
        // Запускаем мониторинг
        const username = document.getElementById('profileMonitorInput').value;
        if (!username) {
            alert('Введите username пользователя');
            return;
        }
        
        // Добавляем классы для расширения блока
        toolCard.classList.add('monitoring-active');
        resultsDiv.classList.add('active');
        
        // Запускаем мониторинг
        button.textContent = 'Остановить мониторинг';
        await checkProfile();
        
        const interval = document.getElementById('profileCheckInterval').value;
        profileMonitoringInterval = setInterval(checkProfile, parseInt(interval));
    }
}

// Инициализация обработчиков вкладок при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    const tabButtons = document.querySelectorAll('.profile-tabs .tab-button');
    if (tabButtons) {
        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                document.querySelectorAll('.profile-tabs .tab-button').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.profile-tab').forEach(t => t.classList.remove('active'));
                
                button.classList.add('active');
                document.getElementById(`${button.dataset.tab}Tab`).classList.add('active');
            });
        });
    }
});

// Функция для определения изменений
function detectChanges(oldState, newState) {
    const changes = [];
    
    if (oldState.bio !== newState.bio) {
        changes.push(`Био изменено: "${oldState.bio || 'пусто'}" → "${newState.bio || 'пусто'}"`);
    }
    if (oldState.first_name !== newState.first_name) {
        changes.push(`Имя изменено: "${oldState.first_name}" → "${newState.first_name}"`);
    }
    if (oldState.last_name !== newState.last_name) {
        changes.push(`Фамилия изменена: "${oldState.last_name}" → "${newState.last_name}"`);
    }
    if (oldState.username !== newState.username) {
        changes.push(`Username изменен: @${oldState.username} → @${newState.username}`);
    }
    if (oldState.profile_photo !== newState.profile_photo) {
        changes.push('Фото профиля обновлено');
    }
    
    return changes;
}

// Функция отображения информации о профиле
function displayProfileInfo(info, container) {
    const profileHtml = `
        <div class="profile-info">
            <div class="profile-header">
                ${info.profile_photo ? 
                    `<img src="${info.profile_photo}" alt="Profile Photo" class="profile-photo">` : 
                    '<div class="no-photo">Нет фото</div>'
                }
                <div class="profile-name">
                    <h3>${info.first_name || ''} ${info.last_name || ''}</h3>
                    <span class="username">@${info.username}</span>
                </div>
            </div>
            
            <div class="profile-details">
                <div class="detail-item">
                    <span class="label">ID:</span>
                    <span class="value">${info.id}</span>
                </div>
                ${info.bio ? `
                    <div class="detail-item">
                        <span class="label">Био:</span>
                        <span class="value">${info.bio}</span>
                    </div>
                ` : ''}
                <div class="detail-item">
                    <span class="label">Последняя активность:</span>
                    <span class="value">${info.last_seen ? new Date(info.last_seen * 1000).toLocaleString() : 'Скрыто'}</span>
                </div>
                <div class="detail-item">
                    <span class="label">Общих чатов:</span>
                    <span class="value">${info.common_chats_count}</span>
                </div>
                <div class="detail-item">
                    <span class="label">Статус:</span>
                    <span class="value">${info.verified ? '✓ Верифицирован' : 'Не верифицирован'}</span>
                </div>
            </div>
        </div>
    `;

    // Обновляем или добавляем информацию о профиле
    const existingInfo = container.querySelector('.profile-info');
    if (existingInfo) {
        existingInfo.outerHTML = profileHtml;
    } else {
        container.insertAdjacentHTML('beforeend', profileHtml);
    }
}

// Получение сообщений пользователя
async function getUserMessages() {
    const username = document.getElementById('userMessagesInput').value;
    const resultsDiv = document.getElementById('userMessagesResults');
    
    // Получаем выбранные чаты
    const selectedChats = Array.from(document.querySelectorAll('#userMessageChats input[type="checkbox"]:checked'))
        .map(checkbox => checkbox.value);
    
    if (selectedChats.length === 0) {
        alert('Выберите хотя бы один чат для поиска');
        return;
    }
    
    try {
        resultsDiv.innerHTML = '<div class="status">Получение сообщений...</div>';
        resultsDiv.className = 'tool-results active';
        
        const result = await eel.get_user_messages(username, selectedChats)();
        if (result.error) {
            resultsDiv.innerHTML = `<div class="error">${result.error}</div>`;
            return;
        }
        
        // Группируем сообщения по чатам
        const messagesByChat = result.messages.reduce((acc, msg) => {
            if (!acc[msg.chat]) {
                acc[msg.chat] = [];
            }
            acc[msg.chat].push(msg);
            return acc;
        }, {});
        
        // Отображаем информацию о пользователе и сообщения
        resultsDiv.innerHTML = `
            <div class="user-info">
                <h4>${result.user_info.name} ${result.user_info.username ? `(@${result.user_info.username})` : ''}</h4>
                <div>ID: ${result.user_info.id}</div>
                <div>Всего найдено сообщений: ${result.total}</div>
            </div>
            ${Object.entries(messagesByChat).map(([chatName, messages]) => `
                <div class="chat-messages">
                    <h4 class="chat-title">${chatName} (${messages.length})</h4>
                    <div class="messages-list">
                        ${messages.map(msg => `
                            <div class="message-item">
                                <div class="message-meta">
                                    <span class="message-time">${new Date(msg.date).toLocaleString()}</span>
                                </div>
                                <div class="message-text">${msg.text}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `).join('')}
        `;
    } catch (error) {
        resultsDiv.innerHTML = `<div class="error">Ошибка: ${error}</div>`;
    }
}

// Добавим функцию загрузки списка чатов
async function loadChatsForUserMessages() {
    try {
        const result = await eel.get_telegram_chats()();
        if (result.error) {
            alert(result.error);
            return;
        }

        const chatsContainer = document.getElementById('userMessageChats');
        chatsContainer.innerHTML = result.chats.map(chat => `
            <div class="chat-checkbox">
                <input type="checkbox" id="chat_${chat.id}" value="${chat.id}">
                <label for="chat_${chat.id}">${chat.title}</label>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading chats:', error);
    }
}

// Функции управления выбором чатов
function selectAllChats() {
    document.querySelectorAll('#userMessageChats input[type="checkbox"]')
        .forEach(checkbox => checkbox.checked = true);
}

function deselectAllChats() {
    document.querySelectorAll('#userMessageChats input[type="checkbox"]')
        .forEach(checkbox => checkbox.checked = false);
}

// Загружаем список чатов при открытии вкладки
document.querySelectorAll('.menu-item[data-section]').forEach(item => {
    item.addEventListener('click', function(e) {
        if (this.dataset.section === 'telegram-tools') {
            loadChatsForUserMessages();
        }
    });
});

// Функция комплексного анализа группы
async function analyzeGroup() {
    const groupSelect = document.getElementById('groupAnalysisSelect');
    const groupId = groupSelect.value;
    
    if (!groupId) {
        alert('Выберите группу для анализа');
        return;
    }
    
    const resultsDiv = document.getElementById('groupAnalysisResults');
    
    try {
        resultsDiv.className = 'tool-results active';
        const postsTab = document.getElementById('postsTab');
        postsTab.innerHTML = '<div class="status">Анализ группы...</div>';
        
        const result = await eel.analyze_group(groupId)();
        if (result.error) {
            postsTab.innerHTML = `<div class="error">${result.error}</div>`;
            return;
        }
        
        // Отображаем статистику постов
        displayPostsStats(result.posts_analysis);
        
        // Отображаем статистику комментариев
        displayCommentsStats(result.comments_analysis);
        
        // Отображаем граф взаимодействий
        displayInteractionGraph(result.graph_data);
        
    } catch (error) {
        resultsDiv.innerHTML = `<div class="error">Ошибка: ${error}</div>`;
    }
}

// Отображение статистики постов
function displayPostsStats(data) {
    const postsTab = document.getElementById('postsTab');
    postsTab.innerHTML = `
        <div class="stats-card">
            <h4>Общая статистика</h4>
            <ul>
                <li>Всего постов: ${data.total_posts}</li>
                <li>Средняя длина поста: ${data.avg_length} слов</li>
                <li>Среднее количество постов в день: ${data.avg_posts_per_day}</li>
            </ul>
        </div>
        
        <div class="stats-card">
            <h4>Статистика по месяцам</h4>
            <div class="monthly-stats">
                ${Object.entries(data.monthly_stats).map(([month, count]) => `
                    <div class="monthly-item">
                        <div class="month">${month}</div>
                        <div class="count">${count} постов</div>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="stats-card">
            <h4>Популярные слова</h4>
            <ul>
                ${data.common_words.map(([word, count]) => 
                    `<li>${word}: ${count}</li>`
                ).join('')}
            </ul>
        </div>
    `;
}

// Отображение статистики комментариев
function displayCommentsStats(data) {
    const commentsTab = document.getElementById('commentsTab');
    commentsTab.innerHTML = `
        <div class="stats-card">
            <h4>Общая статистика комментариев</h4>
            <ul>
                <li>Всего комментариев: ${data.total_comments}</li>
                <li>Уникальных комментаторов: ${data.unique_commenters}</li>
                <li>Средняя длина комментария: ${data.avg_length} слов</li>
            </ul>
        </div>
        
        <div class="stats-card">
            <h4>Топ комментаторов</h4>
            <ul>
                ${data.top_commenters.map(([user, count]) => 
                    `<li>${user}: ${count} комментариев</li>`
                ).join('')}
            </ul>
        </div>
        
        <div class="stats-card">
            <h4>Популярные слова в комментариях</h4>
            <ul>
                ${data.common_words.map(([word, count]) => 
                    `<li>${word}: ${count}</li>`
                ).join('')}
            </ul>
        </div>
    `;
}

// Обработчики вкладок
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        // Убираем активный класс у всех кнопок и вкладок
        document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        
        // Добвляем активный класс выбранной кнопке и вкладке
        button.classList.add('active');
        document.getElementById(`${button.dataset.tab}Tab`).classList.add('active');
    });
}); 

// Функция загрузки списка групп для комплексного анализа
async function loadGroupsForAnalysis() {
    try {
        const result = await eel.get_telegram_chats()();
        if (result.error) {
            alert(result.error);
            return;
        }

        const select = document.getElementById('groupAnalysisSelect');
        if (!select) {
            console.error('Group analysis select element not found');
            return;
        }

        // Схрняем текущее выбранное значение
        const currentValue = select.value;

        // Обновляем список групп
        select.innerHTML = `
            <option value="">Выберите группу...</option>
            ${result.chats.map(chat => 
                `<option value="${chat.id}" ${chat.id === currentValue ? 'selected' : ''}>
                    ${chat.title}
                </option>`
            ).join('')}
        `;
    } catch (error) {
        console.error('Error loading groups:', error);
    }
}

// Добавляем новую функцию для комплексного анализа группы
async function loadAndAnalyzeGroup() {
    const select = document.getElementById('groupAnalysisSelect');
    const groupId = select.value;
    const resultsDiv = document.getElementById('groupAnalysisResults');
    
    if (!groupId) {
        alert('Выберите группу для анализа');
        return;
    }
    
    try {
        resultsDiv.className = 'tool-results active';
        const postsTab = document.getElementById('postsTab');
        postsTab.innerHTML = '<div class="status">Анализ группы...</div>';
        
        // Получаем и анализируем данные группы
        const result = await eel.analyze_group(groupId)();
        if (result.error) {
            postsTab.innerHTML = `<div class="error">${result.error}</div>`;
            return;
        }

        // Отображаем статистику постов
        if (result.posts_analysis) {
            displayGroupPostsStats(result.posts_analysis);
        }
        
        // Отображаем статистику комментариев
        if (result.comments_analysis) {
            displayGroupCommentsStats(result.comments_analysis);
        }
        
        // Отображаем граф взаимодействий
        if (result.graph_data) {
            displayGroupInteractionGraph(result.graph_data);
        }
        
    } catch (error) {
        resultsDiv.innerHTML = `<div class="error">Ошибка: ${error}</div>`;
    }
}

// Функция отображения статистики постов группы
function displayGroupPostsStats(data) {
    const postsTab = document.getElementById('postsTab');
    postsTab.innerHTML = `
        <div class="stats-card">
            <h4>Статистика постов</h4>
            <ul>
                <li>Всего постов: ${data.total_posts}</li>
                <li>Средняя длина поста: ${Math.round(data.avg_length)} слов</li>
                <li>Среднее количество постов в день: ${data.avg_posts_per_day.toFixed(2)}</li>
            </ul>
        </div>
        
        <div class="stats-card">
            <h4>Активность по месяцам</h4>
            <div class="monthly-stats">
                ${Object.entries(data.monthly_stats).map(([month, count]) => `
                    <div class="monthly-item">
                        <div class="month">${month}</div>
                        <div class="count">${count} постов</div>
                    </div>
                `).join('')}
            </div>
        </div>
        
        <div class="stats-card">
            <h4>Часто используемые слова</h4>
            <ul>
                ${data.common_words.map(([word, count]) => 
                    `<li>${word}: ${count}</li>`
                ).join('')}
            </ul>
        </div>
    `;
}

// Функция отображения статистики комментариев группы
function displayGroupCommentsStats(data) {
    const commentsTab = document.getElementById('commentsTab');
    commentsTab.innerHTML = `
        <div class="stats-card">
            <h4>Статистика комментариев</h4>
            <ul>
                <li>Всего комментариев: ${data.total_comments}</li>
                <li>Уникальных комментаторов: ${data.unique_commenters}</li>
                <li>Средняя длина комментария: ${Math.round(data.avg_length)} слов</li>
            </ul>
        </div>
        
        <div class="stats-card">
            <h4>Активные комментаторы</h4>
            <ul>
                ${data.top_commenters.map(([user, count]) => 
                    `<li>${user}: ${count} комментариев</li>`
                ).join('')}
            </ul>
        </div>
        
        <div class="stats-card">
            <h4>Популярные слова в комментариях</h4>
            <ul>
                ${data.common_words.map(([word, count]) => 
                    `<li>${word}: ${count}</li>`
                ).join('')}
            </ul>
        </div>
    `;
}

// Функция отображения графа взаимодействий
function displayGroupInteractionGraph(data) {
    const graphTab = document.getElementById('graphTab');
    graphTab.innerHTML = `
        <div class="stats-card">
            <h4>Граф взаимодействий</h4>
            <div class="graph-container">
                <img src="assets/comments_graph.png" alt="График взаимодействий" style="max-width: 100%; height: auto;">
            </div>
            <div class="graph-stats">
                <p>Количество участников: ${data.nodes.length}</p>
                <p>Количество взаимодействий: ${data.edges.length}</p>
            </div>
        </div>
    `;
}

// Обновляем обработчик для кнопки анализа группы
document.addEventListener('DOMContentLoaded', function() {
    const analyzeButton = document.querySelector('.tool-card button[onclick="analyzeGroup()"]');
    if (analyzeButton) {
        analyzeButton.onclick = loadAndAnalyzeGroup;
    }
});

// Функция проверки профиля
async function checkProfile() {
    try {
        const username = document.getElementById('profileMonitorInput').value.trim().replace('@', '');
        const monitoringTabElement = document.getElementById('monitoringTab');
        
        console.log('=== Начало проверки профиля ===');
        console.log(`Проверяем профиль для п��льзователя: ${username}`);
        
        // Показываем статус загрузки
        monitoringTabElement.innerHTML = '<div class="status">Загрузка профиля...</div>';
        
        // Получаем данные профиля
        const result = await eel.monitor_user_profile(username)();
        console.log('Получены данные от сервера:', result);
        
        if (!result || !result.profile_info) {
            throw new Error('Не удалось получить данные профиля');
        }
        
        const info = result.profile_info;
        
        // Формируем HTML для таблицы
        const profileHtml = `
            <div class="monitoring-container">
                <div class="monitoring-status">
                    <span class="status-icon">🔄</span>
                    Обновлено: ${new Date().toLocaleString()}
                </div>
                <table class="profile-table">
                    <tr>
                        <td colspan="2" class="profile-header">
                            ${info.profile_photo ? 
                                `<img src="${info.profile_photo}" class="profile-photo" alt="Profile Photo">` : 
                                '<div class="no-photo">👤</div>'
                            }
                            <div class="profile-info">
                                <h3>${info.first_name || ''} ${info.last_name || ''}</h3>
                                <span class="username">@${info.username}</span>
                            </div>
                        </td>
                    </tr>
                    <tr>
                        <td class="label">ID:</td>
                        <td class="value">${info.id}</td>
                    </tr>
                    <tr>
                        <td class="label">Примерная дата регистрации:</td>
                        <td class="value">${info.registration_date}</td>
                    </tr>
                    ${info.bio ? `
                        <tr>
                            <td class="label">Био:</td>
                            <td class="value">${info.bio}</td>
                        </tr>
                    ` : ''}
                    <tr>
                        <td class="label">Последняя активность:</td>
                        <td class="value">${info.last_seen ? new Date(info.last_seen * 1000).toLocaleString() : 'Скрыто'}</td>
                    </tr>
                    <tr>
                        <td class="label">Общих чатов:</td>
                        <td class="value">${info.common_chats_count}</td>
                    </tr>
                    <tr>
                        <td class="label">Статус:</td>
                        <td class="value">${info.verified ? '✓ Верифицирован' : 'Не верифицирован'}</td>
                    </tr>
                    <tr>
                        <td class="label">Тип аккаунта:</td>
                        <td class="value">${info.is_bot ? '🤖 Бот' : '👤 Пользователь'}</td>
                    </tr>
                </table>
            </div>
        `;
        
        // Обновляем содержимое
        monitoringTabElement.innerHTML = profileHtml;
        
        // Проверяем изменения
        if (!initialProfile) {
            initialProfile = info;
            console.log('Первая проверка - сохраняем начальное состояние');
        } else {
            // Проверяем изменения в профиле
            const changes = [];
            for (const key in info) {
                if (JSON.stringify(info[key]) !== JSON.stringify(initialProfile[key])) {
                    changes.push({
                        field: key,
                        old: initialProfile[key],
                        new: info[key]
                    });
                }
            }
            
            // Если есть изменения, отображаем их
            if (changes.length > 0) {
                const changesTab = document.getElementById('changesTab');
                changesTab.innerHTML += `
                    <div class="change-record">
                        <div class="change-header">Изменения ${new Date().toLocaleString()}</div>
                        <div class="changes-list">
                            ${changes.map(change => `
                                <div class="change-item">
                                    <span class="change-type">${change.field}:</span>
                                    ${change.old} → ${change.new}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }
        }
        
    } catch (error) {
        console.error('Ошибка при проверке профиля:', error);
        const monitoringTab = document.getElementById('monitoringTab');
        monitoringTab.innerHTML = `<div class="error">Ошибка: ${error.message}</div>`;
    }
}

// Функция для открытия Paranoid Client в новом окне
async function openParanoidClient() {
    try {
        // Проверяем авторизацию в Telegram
        const authStatus = await eel.check_telegram_auth()();
        
        if (!authStatus.authorized) {
            alert('Для использования Paranoid Client необходимо авторизоваться в Telegram');
            document.querySelector('[data-section="telegram-auth"]').click();
            return;
        }

        // Открываем новое окно
        window.open('client.html', 'ParanoidClient', 
            'width=1200,height=800,menubar=no,toolbar=no,location=no,status=no');
    } catch (error) {
        console.error('Ошибка при открытии Paranoid Client:', error);
        alert('Произошла ошибка при открытии Paranoid Client');
    }
}