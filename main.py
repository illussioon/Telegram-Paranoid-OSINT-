import eel
import sys
import os
import json
import networkx as nx
import matplotlib.pyplot as plt
from collections import Counter
from utils import analyze_text, remove_emojis, estimate_registration_date
from nltk.stem.snowball import SnowballStemmer
import re
import numpy as np
from matplotlib.offsetbox import OffsetImage, AnnotationBbox
import cv2
from telethon import TelegramClient, errors
import asyncio
import nest_asyncio
import nltk
from telethon.tl.functions.users import GetFullUserRequest
from telethon.tl.types import InputMessagesFilterPhotos
from telethon import functions, types
import time
import random
from telethon import events

# Загружаем необходимые ресурсы NLTK
try:
    nltk.data.find('tokenizers/punkt')
except LookupError:
    nltk.download('punkt')

try:
    nltk.data.find('corpora/stopwords')
except LookupError:
    nltk.download('stopwords')

try:
    nltk.data.find('tokenizers/punkt_tab')
except LookupError:
    nltk.download('punkt_tab')

# Загружаем все необходимые языковые модели
for language in ['russian', 'english']:
    try:
        nltk.data.find(f'tokenizers/punkt/{language}.pickle')
    except LookupError:
        nltk.download(f'punkt_{language}')

nest_asyncio.apply()

# Инициализация eel с веб-файлами
eel.init('web')

# Настройки окна
WINDOW_SIZE = {
    'width': 1200,
    'height': 800
}

# Telegram API credentials
API_ID = 4514878
API_HASH = '06ede7494d1559c37337a3fd2047990c'
SESSION_PATH = 'session/telegram_session'

client = None

# Константы для настройки загрузки
BATCH_SIZE = 100  # Размер пакета сообщений
MAX_MESSAGES = 1000000  # или float('inf') для бесконечности

def initialize_nltk():
    """Инициализация и загрузка необходимых ресурсов NLTK"""
    resources = [
        'punkt',
        'stopwords',
        'punkt_tab',
        'punkt_russian',
        'punkt_english'
    ]
    
    for resource in resources:
        try:
            nltk.download(resource, quiet=True)
        except Exception as e:
            print(f"Warning: Could not download {resource}: {e}")

@eel.expose
def analyze_telegram_chat(file_content):
    try:
        data = json.loads(file_content)
        if not data or 'messages' not in data:
            return {'error': 'Неверный формат данных'}
            
        messages = data.get('messages', [])
        if not messages:
            return {'error': 'Нет сообщений для анализа'}
            
        group_name = data.get('name', '')
        
        # Подсчет сообщений и дат
        dates_list = []
        users = {}
        emails = []
        phones = []
        
        for message in messages:
            # Получаем основные данные сообщения
            user = message.get('from', '')
            user_id = message.get('from_id', '')
            text = message.get('text', '')
            date = message.get('date', '')
            
            if not text:
                text = ''
            elif isinstance(text, (list, dict)):
                text = str(text)
            
            if date:
                dates_list.append(date)
            
            if not user or not user_id:
                continue
                
            # Инициализация пользователя
            if user_id not in users:
                users[user_id] = {
                    'name': user,
                    'messages': [],
                    'message_count': 0
                }
            
            # Добавляем сообщение пользователю
            users[user_id]['messages'].append(text)
            users[user_id]['message_count'] += 1
            
            # Поиск email и телефонов
            if text:
                emails.extend(re.findall(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}', text))
                phones.extend(re.findall(r'\+?\d{1,3}?[-.\s]?\(?\d{1,3}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}', text))
        
        # Анализ текста для каждого пользователя
        stemmer = SnowballStemmer("russian")
        analyzed_users = {}
        
        for user_id, user_data in users.items():
            try:
                all_text = ' '.join(user_data['messages'])
                if all_text.strip():  # Проверяем, что текст не пустой
                    tokens = analyze_text(all_text, stemmer)
                    word_freq = Counter(tokens)
                    top_words = word_freq.most_common(10)
                else:
                    top_words = []
                
                analyzed_users[f"{user_data['name']} ({user_id})"] = {
                    'message_count': user_data['message_count'],
                    'top_words': top_words
                }
            except Exception as e:
                print(f"Error analyzing user {user_id}: {e}")
                continue
        
        # Общая статистика
        try:
            all_messages = ' '.join(
                message.get('text', '') if isinstance(message.get('text'), str)
                else str(message.get('text', ''))
                for message in messages
            )
            all_tokens = analyze_text(all_messages, stemmer) if all_messages.strip() else []
            total_words = Counter(all_tokens).most_common(30)
        except Exception as e:
            print(f"Error in total words analysis: {e}")
            total_words = []
        
        return {
            'success': True,
            'group_name': group_name,
            'first_message': dates_list[0] if dates_list else None,
            'last_message': dates_list[-1] if dates_list else None,
            'total_messages': len(messages),
            'total_users': len(users),
            'users': analyzed_users,
            'total_words': total_words,
            'emails': list(set(emails)),
            'phones': list(set(phones))
        }
        
    except Exception as e:
        print(f"Error in analyze_telegram_chat: {e}")
        return {'error': str(e)}

@eel.expose
def generator(file_content):
    try:
        data = json.loads(file_content)
        group_name = data.get('name', '')
        messages = data.get('messages', [])
        dates_list = []
        names = []
        
        # Создаем директорию для файлов
        if not os.path.exists('web/assets'):
            os.makedirs('web/assets')
            
        # Собираем уникальных пользователей
        unique_users = set()
        for msg in messages:
            if msg.get('from_id'):
                unique_users.add(msg.get('from_id'))
        
        # Словарь для хранения аватарок и цветов пользователей
        avatars = {}
        color_map = {}
        
        # Генерируем цвета для каждого уникального пользователя
        colors = plt.cm.Set3(np.linspace(0, 1, len(unique_users)))
        for i, user_id in enumerate(unique_users):
            color_map[user_id] = colors[i]
        
        # Создаем edges.csv
        with open('web/assets/edges.csv', 'w', encoding='utf-8') as f:
            f.write("source,target,label")
        
        # Обрабатываем сообщения
        for message in messages:
            from_user = message.get('from')
            from_id = message.get('from_id')
            date = message.get('date')
            avatar = message.get('avatar', '')
            
            if date:
                dates_list.append(date)
            
            if not from_user or not from_id:
                continue
                
            if from_id in ['source', 'target', None]:
                continue
            
            # Сохраняем аватарку пользователя
            if avatar and from_id not in avatars:
                avatars[from_id] = avatar
            
            name_id = f'{from_user}, {from_id}'
            names.append(name_id)
            
            # Обработка ответов
            reply_to = message.get('reply_to_message_id')
            if reply_to:
                for reply_message in messages:
                    if reply_message.get('id') == reply_to:
                        reply_author = reply_message.get('from')
                        reply_id = reply_message.get('from_id')
                        if reply_author and reply_id:
                            try:
                                with open('web/assets/edges.csv', 'a', encoding='utf-8') as f:
                                    f.write(f'\n{from_id},{reply_id},{from_user}->{reply_author}')
                            except Exception as ex:
                                print(f"Error writing edge: {ex}")
                            break
            else:
                try:
                    with open('web/assets/edges.csv', 'a', encoding='utf-8') as f:
                        f.write(f'\n{from_id},{from_id},{from_user}')
                except Exception as ex:
                    print(f"Error writing self-edge: {ex}")
        
        # Создаем nodes.csv
        with open('web/assets/nodes.csv', 'w', encoding='utf-8') as f:
            f.write("id,label,weight,avatar")
            name_counts = Counter(names)
            for name_id, count in name_counts.items():
                try:
                    user_id = name_id.split(',')[1].strip()
                    username = name_id.split(',')[0].strip()
                    avatar_path = avatars.get(user_id, '')
                    if user_id not in ['id', 'label', 'weight', 'None']:
                        f.write(f'\n{user_id},{username},{count},{avatar_path}')
                except Exception as ex:
                    print(f"Error writing node: {ex}")
        
        # Создаем граф
        G = nx.DiGraph()
        
        # Добавляем узлы
        node_colors = []
        node_images = []
        node_labels = {}
        
        with open('web/assets/nodes.csv', 'r', encoding='utf-8') as nodes:
            next(nodes)
            for line in nodes:
                try:
                    node_id, label, weight, avatar_path = line.strip().split(',')
                    G.add_node(node_id, weight=int(weight))
                    node_labels[node_id] = label
                    # Добавляем цвет узла
                    node_colors.append(color_map.get(node_id, 'lightgray'))
                    # Загружаем аватарку или создаем пустой круг
                    if avatar_path and os.path.exists(avatar_path):
                        img = plt.imread(avatar_path)
                        node_images.append(img)
                    else:
                        node_images.append(None)
                except Exception as ex:
                    print(f"Error adding node: {ex}")
        
        # Добавляем рёбра
        with open('web/assets/edges.csv', 'r', encoding='utf-8') as edges:
            next(edges)
            for line in edges:
                try:
                    source, target, label = line.strip().split(',')
                    G.add_edge(source, target, weight=1.0)
                except Exception as ex:
                    print(f"Error adding edge: {ex}")
        
        # Визуализация
        plt.figure(figsize=(20, 15), facecolor='none')  # Прозрачный фон фигуры
        ax = plt.gca()
        ax.set_facecolor('none')  # Прозрачный фон осей
        
        pos = nx.spring_layout(G, k=2, iterations=50)
        
        # Создаем словарь цветов для рёбер
        edge_colors = []
        for (u, v) in G.edges():
            if u == v:  # Если это self-loop
                edge_colors.append('none')  # Не рисуем self-loop
            else:
                edge_colors.append(color_map.get(u, 'gray'))  # Цвет отправителя
        
        # Рисуем рёбра
        nx.draw_networkx_edges(G, pos,
                             edge_color=edge_colors,
                             arrows=True,
                             alpha=0.5,
                             width=1,
                             connectionstyle="arc3,rad=0.2")  # Изогнутые стрелки
        
        # Рисуем узлы как круги с цветом
        nx.draw_networkx_nodes(G, pos,
                             node_color=node_colors,
                             node_size=3000,
                             alpha=0.6)
        
        # Добавляем аватарки и подписи
        ax = plt.gca()
        for idx, (node, (x, y)) in enumerate(pos.items()):
            if idx < len(node_images):
                # Создаем круглую маску для аватарки
                if node_images[idx] is not None:
                    # Создаем круглую маску
                    img = node_images[idx]
                    height, width = img.shape[:2]
                    
                    # Создаем круглую маску
                    circle_mask = np.zeros((height, width), dtype=np.uint8)
                    cv2.circle(circle_mask, (width//2, height//2), 
                             min(width, height)//2, 255, -1)
                    
                    # Применяем маску
                    if len(img.shape) == 3:  # Цветное изображение
                        mask = cv2.cvtColor(circle_mask, cv2.COLOR_GRAY2BGR)
                        masked_img = np.where(mask == 255, img, 0)
                    else:  # Черно-белое изображение
                        masked_img = np.where(circle_mask == 255, img, 0)
                    
                    # Создаем круглую аватарку с фоном цвета узла
                    bg_color = color_map.get(node, 'lightgray')
                    if isinstance(bg_color, np.ndarray):
                        bg_color = tuple(bg_color[:3])
                    
                    bg = np.full_like(img, fill_value=0)
                    if len(bg.shape) == 3:
                        bg[:,:] = [int(c * 255) for c in bg_color[:3]]
                    
                    final_img = np.where(mask == 255, masked_img, bg)
                    
                    # Размещаем аватарку
                    imagebox = OffsetImage(final_img, zoom=0.15)
                    imagebox.image.axes = ax
                    ab = AnnotationBbox(imagebox, (x, y),
                                      frameon=False,
                                      pad=0)
                    ax.add_artist(ab)
                
                # Добавляем имя пользователя и количество сообщений
                label = node_labels[node]
                weight = G.nodes[node]['weight']
                
                # Создаем многострочную подпись
                label_text = f"{label}\n({weight} сообщ.)"
                
                # Размещаем подпись под узлом
                plt.text(x, y-0.1,
                        label_text,
                        horizontalalignment='center',
                        verticalalignment='top',
                        fontsize=8,
                        fontweight='bold',
                        bbox=dict(facecolor='white',
                                alpha=0.7,
                                edgecolor='none',
                                pad=0.5))
        
        # Устанавливаем пределы графа с учетом подписей
        plt.margins(0.2)
        
        # Убираем оси
        plt.axis('off')
        
        # Сохраняем граф с прозрачным фоном
        plt.savefig('web/assets/interaction_graph.png',
                    bbox_inches='tight',
                    dpi=300,
                    transparent=True,  # Прозрачный фон
                    facecolor='none',  # Прозрачный фон фигуры
                    edgecolor='none',
                    pad_inches=0)  # Убираем отступы
        plt.close()
        
        return {
            'success': True,
            'group_name': group_name,
            'first_message': dates_list[0] if dates_list else None,
            'last_message': dates_list[-1] if dates_list else None,
            'total_messages': len(messages),
            'total_users': len(set(names)),
            'nodes_file': 'web/assets/nodes.csv',
            'edges_file': 'web/assets/edges.csv',
            'graph_file': 'web/assets/interaction_graph.png'
        }
        
    except Exception as e:
        print(f"Error in generator: {e}")
        return {'error': str(e)}

@eel.expose
def connect_telegram(phone_number):
    async def _connect():
        try:
            global client
            # Создаем клиент и подключаемся
            client = TelegramClient(SESSION_PATH, API_ID, API_HASH)
            await client.connect()

            if await client.is_user_authorized():
                # Если уже авторизованы, получаем список диалогов
                dialogs = await client.get_dialogs()
                chats = [{'id': d.id, 'title': d.title} for d in dialogs if d.is_group or d.is_channel]
                return {'success': True, 'authorized': True, 'chats': chats}

            # Отправляем код подтверждения
            await client.send_code_request(phone_number)
            return {'success': True, 'authorized': False, 'step': 'code_sent'}

        except Exception as e:
            return {'error': str(e)}

    # Запускаем асинхронную функцию в текущем event loop
    loop = asyncio.get_event_loop()
    return loop.run_until_complete(_connect())

@eel.expose
async def verify_code(phone_number, code):
    try:
        global client
        if not client:
            return {'error': 'Сначала введите номер телефона'}

        # Пытаемся войти с кодом
        try:
            await client.sign_in(phone=phone_number, code=code)
            
            if await client.is_user_authorized():
                # Получаем список диалогов после успешной авторизации
                dialogs = await client.get_dialogs()
                chats = [{'id': d.id, 'title': d.title} for d in dialogs if d.is_group or d.is_channel]
                return {'success': True, 'authorized': True, 'chats': chats}
                
        except errors.SessionPasswordNeededError:
            # Если требуется двухфакторная аутентификация
            return {'success': True, 'authorized': False, 'step': '2fa_required'}

    except errors.PhoneCodeInvalidError:
        return {'error': 'Неверный код'}
    except Exception as e:
        return {'error': str(e)}

@eel.expose
async def verify_2fa(password):
    try:
        global client
        if not client:
            return {'error': 'Начните авторизацию заново'}

        # Входим с паролем двухфакторной аутентификации
        await client.sign_in(password=password)
        
        if await client.is_user_authorized():
            # Получаем список диалогов после успешной авторизации
            dialogs = await client.get_dialogs()
            chats = [{'id': d.id, 'title': d.title} for d in dialogs if d.is_group or d.is_channel]
            return {'success': True, 'authorized': True, 'chats': chats}
            
        return {'error': 'Не удалось авторизоваться'}

    except errors.PasswordHashInvalidError:
        return {'error': 'Неверный пароль'}
    except Exception as e:
        return {'error': str(e)}

@eel.expose
def get_chat_messages(chat_id, limit=100, min_id=None):
    """Получает сообщения чата с поддержкой пагинации"""
    async def _get_messages():
        try:
            if not client or not await client.is_user_authorized():
                return {'error': 'Необходима авторизация'}
            
            # Получаем информацию о чате
            chat = await client.get_entity(int(chat_id))
            
            # Используем MTProto API для получения сообщений
            if min_id:
                # Получаем старые сообщения
                result = await client(functions.messages.GetHistoryRequest(
                    peer=chat,
                    offset_id=min_id,
                    offset_date=None,
                    add_offset=-limit,
                    limit=limit,
                    max_id=0,
                    min_id=0,
                    hash=0
                ))
            else:
                # Получаем последние сообщения
                result = await client(functions.messages.GetHistoryRequest(
                    peer=chat,
                    offset_id=0,
                    offset_date=None,
                    add_offset=0,  # Изменили с -limit на 0
                    limit=limit,
                    max_id=0,
                    min_id=0,
                    hash=0
                ))

            messages = []
            users = {u.id: u for u in result.users}
            
            for message in reversed(result.messages):  # Реверсируем сообщения, чтобы новые были внизу
                try:
                    # Получаем информацию об отправителе
                    sender_id = message.from_id.user_id if message.from_id else None
                    sender = users.get(sender_id) if sender_id else None
                    
                    if sender:
                        sender_info = {
                            'id': sender.id,
                            'name': getattr(sender, 'first_name', '') or sender.title,
                            'photo_path': None
                        }
                        
                        # Загружаем аватар отправителя
                        if hasattr(sender, 'photo') and sender.photo:
                            photo_path = f'assets/user_photos/{sender.id}.jpg'
                            if not os.path.exists(f'web/{photo_path}'):
                                try:
                                    await client.download_profile_photo(sender, f'web/{photo_path}')
                                    sender_info['photo_path'] = photo_path
                                except Exception as e:
                                    print(f"Ошибка при загрузке фото пользователя {sender.id}: {e}")
                    else:
                        sender_info = None

                    # Обработка медиа
                    media_info = None
                    if message.media:
                        try:
                            if isinstance(message.media, types.MessageMediaPhoto):
                                photo_path = f'assets/media/photos/{message.id}.jpg'
                                await client.download_media(message.media, f'web/{photo_path}')
                                media_info = {'type': 'photo', 'path': photo_path}
                            
                            elif isinstance(message.media, types.MessageMediaDocument):
                                if message.media.document.mime_type.startswith('audio/'):
                                    # Голосовые и аудио сообщения
                                    is_voice = any(isinstance(attr, types.DocumentAttributeAudio) and attr.voice 
                                                 for attr in message.media.document.attributes)
                                    audio_path = f'assets/media/{"voice" if is_voice else "audio"}/{message.id}.ogg'
                                    await client.download_media(message.media, f'web/{audio_path}')
                                    
                                    duration = next((attr.duration for attr in message.media.document.attributes 
                                                   if isinstance(attr, types.DocumentAttributeAudio)), 0)
                                    
                                    media_info = {
                                        'type': 'voice' if is_voice else 'audio',
                                        'path': audio_path,
                                        'duration': duration
                                    }
                                
                                elif message.media.document.mime_type.startswith('video/'):
                                    # Видео сообщения
                                    video_path = f'assets/media/videos/{message.id}.mp4'
                                    await client.download_media(message.media, f'web/{video_path}')
                                    
                                    duration = next((attr.duration for attr in message.media.document.attributes 
                                                   if isinstance(attr, types.DocumentAttributeVideo)), 0)
                                    
                                    media_info = {
                                        'type': 'video',
                                        'path': video_path,
                                        'duration': duration
                                    }
                        except Exception as e:
                            print(f"Ошибка при обработке медиа сообщения {message.id}: {e}")

                    messages.append({
                        'id': message.id,
                        'sender': sender_info,
                        'text': message.message,
                        'date': message.date.timestamp(),
                        'is_outgoing': message.out,
                        'reply_to': message.reply_to.reply_to_msg_id if message.reply_to else None,
                        'media': media_info
                    })
                    
                except Exception as e:
                    print(f"Ошибка при обработке сообщения {message.id}: {e}")
                    continue

            # Создаем директории для медиа если их нет
            os.makedirs('web/assets/media/photos', exist_ok=True)
            os.makedirs('web/assets/media/voice', exist_ok=True)
            os.makedirs('web/assets/media/audio', exist_ok=True)
            
            print(f"Загружено {len(messages)} сообщений")  # Для отладки
            
            return {
                'success': True,
                'chat_info': {
                    'id': chat.id,
                    'title': getattr(chat, 'title', None) or f"{getattr(chat, 'first_name', '')} {getattr(chat, 'last_name', '')}".strip(),
                    'type': 'channel' if getattr(chat, 'broadcast', False) else 'group' if getattr(chat, 'megagroup', False) else 'private'
                },
                'messages': messages,
                'has_more': len(result.messages) == limit
            }
            
        except Exception as e:
            print(f"Ошибка при получении сообщений: {e}")
            return {'error': str(e)}

    loop = asyncio.get_event_loop()
    return loop.run_until_complete(_get_messages())

@eel.expose
def send_message(chat_id, text):
    """Отправляет сообщение в чат"""
    async def _send_message():
        try:
            if not client or not await client.is_user_authorized():
                return {'error': 'Необходима авторизация'}
            
            chat = await client.get_entity(int(chat_id))
            message = await client.send_message(chat, text)
            
            return {
                'success': True,
                'message': {
                    'id': message.id,
                    'text': message.message,
                    'date': message.date.timestamp(),
                    'is_outgoing': True
                }
            }
            
        except Exception as e:
            print(f"Ошибка при отправке сообщения: {e}")
            return {'error': str(e)}

    loop = asyncio.get_event_loop()
    return loop.run_until_complete(_send_message())

@eel.expose
async def analyze_telegram_chat_direct(chat_id):
    try:
        chat_data = await get_chat_messages(chat_id)
        if 'error' in chat_data:
            return chat_data
        
        # Используем существующую функцию анализа для обработки данных
        return analyze_telegram_chat(json.dumps(chat_data))
    except Exception as e:
        return {'error': str(e)}

@eel.expose
async def generate_graph_from_telegram(chat_id):
    try:
        chat_data = await get_chat_messages(chat_id)
        if 'error' in chat_data:
            return chat_data
        
        # Используем существующую функцию построения графа
        return generator(json.dumps(chat_data))
    except Exception as e:
        return {'error': str(e)}

@eel.expose
def check_telegram_auth():
    """Проверяет авторизацию в Telegram"""
    async def _check():
        try:
            if client and await client.is_user_authorized():
                return {'authorized': True}
            return {'authorized': False}
        except Exception as e:
            print(f"Ошибка при проверке авторизации: {e}")
            return {'authorized': False, 'error': str(e)}
    
    loop = asyncio.get_event_loop()
    return loop.run_until_complete(_check())

@eel.expose
def start_telegram_auth(phone):
    async def _connect():
        try:
            global client
            # Создаем клиент и подключаемся
            client = TelegramClient(SESSION_PATH, API_ID, API_HASH)
            await client.connect()
            
            if await client.is_user_authorized():
                # Если уже авторизованы, получаем список чатов
                dialogs = await client.get_dialogs()
                chats = [{'id': d.id, 'title': d.title} for d in dialogs if d.is_group or d.is_channel]
                return {'success': True, 'step': 'completed', 'chats': chats}
            
            # Отправляем код
            await client.send_code_request(phone)
            return {'success': True, 'step': 'code_required'}
            
        except Exception as e:
            print(f"Auth error: {e}")  # Для отладки
            return {'error': str(e)}

    loop = asyncio.get_event_loop()
    return loop.run_until_complete(_connect())

@eel.expose
def verify_telegram_code(code):
    async def _verify():
        try:
            global client
            if not client:
                return {'error': 'Сначала введите номер телефона'}
            
            # Пробуем войти с кодом
            await client.sign_in(code=code)
            
            if await client.is_user_authorized():
                # Если успешно авторизовались, получаем список чатов
                dialogs = await client.get_dialogs()
                chats = [{'id': d.id, 'title': d.title} for d in dialogs if d.is_group or d.is_channel]
                return {'success': True, 'step': 'completed', 'chats': chats}
                
        except errors.SessionPasswordNeededError:
            return {'success': True, 'step': '2fa_required'}
        except errors.PhoneCodeInvalidError:
            return {'error': 'Неверный код'}
        except Exception as e:
            print(f"Code verification error: {e}")  # Для отладки
            return {'error': str(e)}

    loop = asyncio.get_event_loop()
    return loop.run_until_complete(_verify())

@eel.expose
def verify_telegram_2fa(password):
    async def _verify():
        try:
            global client
            if not client:
                return {'error': 'Начните авторизацию заново'}
            
            # Входим с двухфакторной аутентификацией
            await client.sign_in(password=password)
            
            if await client.is_user_authorized():
                # Если усп��шно авторизовались, получаем список чатов
                dialogs = await client.get_dialogs()
                chats = [{'id': d.id, 'title': d.title} for d in dialogs if d.is_group or d.is_channel]
                return {'success': True, 'step': 'completed', 'chats': chats}
            
            return {'error': 'Не удалось авторизоваться'}
            
        except errors.PasswordHashInvalidError:
            return {'error': 'Неверный пароль'}
        except Exception as e:
            print(f"2FA error: {e}")  # Для отладки
            return {'error': str(e)}

    loop = asyncio.get_event_loop()
    return loop.run_until_complete(_verify())

@eel.expose
def get_telegram_chats():
    async def _get_chats():
        try:
            global client
            if not client or not await client.is_user_authorized():
                return {'error': 'Необходима авторизация'}
                
            # Получаем список диалогов
            dialogs = await client.get_dialogs()
            chats = [{'id': d.id, 'title': d.title} for d in dialogs if d.is_group or d.is_channel]
            return {'success': True, 'chats': chats}
            
        except Exception as e:
            return {'error': str(e)}

    # Запускаем асинхронную функцию в текущем event loop
    loop = asyncio.get_event_loop()
    return loop.run_until_complete(_get_chats())

@eel.expose
def get_chat_json(chat_id):
    async def _get_json():
        try:
            eel.updateProgress("Получене сообщений чата...", 0)
            chat_data = await get_chat_messages(chat_id)
            
            if 'error' in chat_data:
                return chat_data
            
            eel.updateProgress("Сохранение JSON файла...", 90)
            
            # Создаем директорию для JSON файлов если её нет
            if not os.path.exists('web/assets/chats'):
                os.makedirs('web/assets/chats')
            
            # Сохраняем JSON файл
            json_path = f'web/assets/chats/chat_{chat_id}.json'
            with open(json_path, 'w', encoding='utf-8') as f:
                json.dump(chat_data, f, ensure_ascii=False, indent=2)
            
            eel.updateProgress("Анализ данных...", 95)
            
            return {
                'success': True,
                'file_path': json_path,
                'chat_data': chat_data
            }
            
        except Exception as e:
            eel.updateProgress(f"Ошибка: {str(e)}", -1)
            return {'error': str(e)}

    loop = asyncio.get_event_loop()
    return loop.run_until_complete(_get_json())

@eel.expose
async def search_users_in_group(group_id, query):
    async def _search():
        try:
            global client
            if not client or not await client.is_user_authorized():
                return {'error': 'Необходима авторизация'}

            # Получаем группу
            try:
                group = await client.get_entity(group_id)
            except ValueError:
                return {'error': 'Группа не найдена'}

            # Получаем участников группы
            users = []
            async for user in client.iter_participants(group):
                if query.lower() in (user.first_name or '').lower() or \
                   query.lower() in (user.last_name or '').lower() or \
                   query.lower() in (user.username or '').lower():
                    users.append({
                        'id': user.id,
                        'name': f"{user.first_name or ''} {user.last_name or ''}".strip(),
                        'username': user.username,
                        'phone': user.phone if hasattr(user, 'phone') else None
                    })

            return {'success': True, 'users': users}
        except Exception as e:
            return {'error': str(e)}

    loop = asyncio.get_event_loop()
    return loop.run_until_complete(_search())

@eel.expose
async def parse_group_members(group_id):
    async def _parse():
        try:
            global client
            if not client or not await client.is_user_authorized():
                return {'error': 'Необходима авторизация'}

            # Получаем группу
            try:
                group = await client.get_entity(group_id)
            except ValueError:
                return {'error': 'Группа не найдена'}

            # Получаем всех участников
            members = []
            async for user in client.iter_participants(group):
                members.append({
                    'id': user.id,
                    'name': f"{user.first_name or ''} {user.last_name or ''}".strip(),
                    'username': user.username,
                    'phone': user.phone if hasattr(user, 'phone') else None,
                    'bot': user.bot if hasattr(user, 'bot') else False
                })

            return {
                'success': True,
                'total': len(members),
                'members': members
            }
        except Exception as e:
            return {'error': str(e)}

    loop = asyncio.get_event_loop()
    return loop.run_until_complete(_parse())

@eel.expose
def check_user_status(username):
    async def _check():
        try:
            global client
            if not client or not await client.is_user_authorized():
                return {'error': 'Необходима авторизация'}

            # Получаем пользователя
            try:
                user = await client.get_entity(username)
                # Получаем статус напрямую из user
                status = user.status
                
                # Определяем онлайн статус
                is_online = False
                last_seen = 'Неизвестно'
                
                if hasattr(status, 'was_online'):
                    last_seen = str(status.was_online)
                    is_online = False
                elif hasattr(status, 'expires'):
                    is_online = True
                    last_seen = 'В сети'
                
                return {
                    'success': True,
                    'online': is_online,
                    'last_seen': last_seen
                }
                
            except ValueError:
                return {'error': 'Пользователь не найден'}
            except Exception as e:
                return {'error': f'Ошибка при получении статуса: {str(e)}'}
                
        except Exception as e:
            return {'error': str(e)}

    loop = asyncio.get_event_loop()
    return loop.run_until_complete(_check())

@eel.expose
async def download_channel_photos(channel_id):
    async def _download():
        try:
            global client
            if not client or not await client.is_user_authorized():
                return {'error': 'Необходима авторизация'}

            # Создаем директорию для фото
            photos_dir = f'web/assets/channel_photos/{channel_id}'
            os.makedirs(photos_dir, exist_ok=True)

            # Получаем канал
            try:
                channel = await client.get_entity(channel_id)
            except ValueError:
                return {'error': 'Канал не найден'}

            # Скачиваем фотографии
            count = 0
            async for message in client.iter_messages(channel, filter=InputMessagesFilterPhotos):
                if message.media:
                    path = os.path.join(photos_dir, f'photo_{message.id}.jpg')
                    await client.download_media(message, path)
                    count += 1

            return {
                'success': True,
                'count': count,
                'path': photos_dir
            }
        except Exception as e:
            return {'error': str(e)}

    loop = asyncio.get_event_loop()
    return loop.run_until_complete(_download())

@eel.expose
async def check_user_profile(username):
    async def _check():
        try:
            global client
            if not client or not await client.is_user_authorized():
                return {'error': 'Необходима авторизация'}

            # Получаем пользователя
            try:
                user = await client.get_entity(username)
            except ValueError:
                return {'error': 'Пользователь не найден'}

            # Получаем полную информацию
            full = await client(functions.users.GetFullUserRequest(user))
            
            return {
                'success': True,
                'id': user.id,
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'bio': full.full_user.about if hasattr(full.full_user, 'about') else None,
                'photo': bool(user.photo),
                'status': str(full.full_user.status) if hasattr(full.full_user, 'status') else None
            }
        except Exception as e:
            return {'error': str(e)}

    loop = asyncio.get_event_loop()
    return loop.run_until_complete(_check())

@eel.expose
def get_user_messages(username, selected_chats=None):
    async def _get():
        try:
            global client
            if not client or not await client.is_user_authorized():
                return {'error': 'Необходима авторизация'}

            # Получаем пользователя
            try:
                target_user = await client.get_entity(username)
            except ValueError:
                return {'error': 'Пользователь не найден'}

            # Получаем все диалоги или только выбранные
            dialogs = await client.get_dialogs()
            messages = []
            total_count = 0

            # Проходим по каждому диалогу
            for dialog in dialogs:
                # Пропускаем чаты, которые не выбраны
                if selected_chats and str(dialog.id) not in selected_chats:
                    continue
                    
                try:
                    # Получаем сообщения от конкретного пользователя в этом чате
                    async for message in client.iter_messages(dialog, from_user=target_user):
                        if message.text:  # Только текстовые сообщения
                            messages.append({
                                'id': message.id,
                                'date': message.date.isoformat(),
                                'text': message.text,
                                'chat': dialog.title,
                                'chat_id': dialog.id
                            })
                            total_count += 1
                except Exception as e:
                    print(f"Error getting messages from {dialog.title}: {e}")
                    continue

            # Сортируем сообщения по дате (новые сверху)
            messages.sort(key=lambda x: x['date'], reverse=True)

            return {
                'success': True,
                'total': total_count,
                'user_info': {
                    'id': target_user.id,
                    'name': f"{target_user.first_name or ''} {target_user.last_name or ''}".strip(),
                    'username': target_user.username
                },
                'messages': messages
            }
        except Exception as e:
            return {'error': str(e)}

    loop = asyncio.get_event_loop()
    return loop.run_until_complete(_get())

def start_app():
    try:
        # Создаем event loop
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        
        # Инициализируем клиент Telegram если есть сессия
        async def init_client():
            global client
            if os.path.exists(f"{SESSION_PATH}.session"):
                client = TelegramClient(SESSION_PATH, API_ID, API_HASH)
                await client.connect()
                if await client.is_user_authorized():
                    print("Telegram session loaded successfully")
                    return True
                else:
                    print("Telegram session exists but not authorized")
                    return False
            return False

        # Запускаем инициализацию
        loop.run_until_complete(init_client())
        
        # Запускаем приложение
        eel.start('index.html', 
                 size=(WINDOW_SIZE['width'], WINDOW_SIZE['height']),
                 mode='chrome',
                 block=False)
        
        # Запускаем event loop
        while True:
            try:
                loop.run_until_complete(asyncio.sleep(0.1))
                eel.sleep(0.1)
            except Exception as e:
                print(f"Loop error: {e}")
                continue
            
    except (SystemExit, MemoryError, KeyboardInterrupt):
        print("Closing application...")
        try:
            if client:
                async def disconnect():
                    await client.disconnect()
                loop.run_until_complete(disconnect())
        except Exception as e:
            print(f"Error disconnecting client: {e}")
        sys.exit(0)

@eel.expose
def analyze_group(group_id):
    async def _analyze():
        try:
            global client
            if not client or not await client.is_user_authorized():
                return {'error': 'Необходима авторизация'}

            # Получаем группу
            try:
                group = await client.get_entity(int(group_id))
            except ValueError:
                return {'error': 'Группа не найдена'}

            # Анализ постов
            posts_data = {
                'texts': [],
                'dates': [],
                'lengths': [],
                'authors': [],
                'message_ids': []  # Добавляем ID сообщений
            }
            
            # Анализ комментариев
            comments_data = {
                'texts': [],
                'users': [],
                'lengths': [],
                'replies_to': [],
                'user_names': []
            }
            
            print("Начинаем сбор сообщений...")
            
            # Получаем посты
            async for message in client.iter_messages(group, limit=1000):
                try:
                    if message.text:
                        # Получаем информацию об авторе в зависимости от типа
                        if hasattr(message.sender, 'title'):  # Для каналов
                            author = message.sender.title
                        elif hasattr(message.sender, 'first_name'):  # Для пользователей
                            author = f"{message.sender.first_name or ''} {message.sender.last_name or ''}"
                            author = author.strip() or str(message.sender.id)
                        else:
                            author = str(message.sender.id) if message.sender else "Unknown"

                        posts_data['texts'].append(message.text)
                        posts_data['dates'].append(message.date)
                        posts_data['lengths'].append(len(message.text.split()))
                        posts_data['authors'].append(author)
                        posts_data['message_ids'].append(message.id)

                except Exception as e:
                    print(f"Error processing post: {e}")
                    continue

            print(f"Собрано {len(posts_data['texts'])} постов")

            # Получаем комментарии для каждого поста
            for msg_id in posts_data['message_ids']:
                try:
                    # Получаем комментарии к посту
                    async for comment in client.iter_messages(group, reply_to=msg_id):
                        if comment.text:
                            try:
                                # Получаем информацию об авторе комментария
                                if hasattr(comment.sender, 'first_name'):  # Для пользователей
                                    commenter = f"{comment.sender.first_name or ''} {comment.sender.last_name or ''}"
                                    commenter = commenter.strip() or str(comment.sender.id)
                                else:
                                    commenter = str(comment.sender.id) if comment.sender else "Unknown"

                                comments_data['texts'].append(comment.text)
                                comments_data['users'].append(comment.sender.id if comment.sender else 0)
                                comments_data['lengths'].append(len(comment.text.split()))
                                comments_data['replies_to'].append(msg_id)
                                comments_data['user_names'].append(commenter)
                            except Exception as e:
                                print(f"Error processing comment: {e}")
                                continue
                except Exception as e:
                    print(f"Error getting comments for post {msg_id}: {e}")
                    continue

            print(f"Собрано {len(comments_data['texts'])} комментариев")

            # Анализируем посты
            posts_analysis = analyze_posts_data(posts_data)
            
            # Анализируем комментарии
            comments_analysis = analyze_comments_data(comments_data)
            
            # Создаем граф взаимодействий на основе комментариев
            graph_data = generate_comments_graph(comments_data)

            return {
                'success': True,
                'group_info': {
                    'id': group.id,
                    'title': group.title,
                    'type': str(type(group).__name__)
                },
                'posts_analysis': posts_analysis,
                'comments_analysis': comments_analysis,
                'graph_data': graph_data
            }

        except Exception as e:
            print(f"Error in analyze_group: {e}")
            return {'error': str(e)}

    loop = asyncio.get_event_loop()
    return loop.run_until_complete(_analyze())

def analyze_posts_data(data):
    from collections import Counter
    from datetime import datetime
    
    # Анализ частоты слов
    stemmer = SnowballStemmer("russian")
    all_texts = ' '.join(data['texts'])
    words = analyze_text(all_texts, stemmer)
    word_freq = Counter(words).most_common(30)
    
    # Анализ по месяцам
    months = {}
    for date in data['dates']:
        month_key = date.strftime('%Y-%m')
        months[month_key] = months.get(month_key, 0) + 1
    
    # Анализ авторов
    author_stats = Counter(data['authors']).most_common(10)
    
    return {
        'total_posts': len(data['texts']),
        'avg_length': sum(data['lengths']) / len(data['lengths']) if data['lengths'] else 0,
        'avg_posts_per_day': len(data['texts']) / len(set(d.date() for d in data['dates'])) if data['dates'] else 0,
        'monthly_stats': dict(sorted(months.items())),
        'common_words': word_freq,
        'top_authors': author_stats
    }

def analyze_comments_data(data):
    from collections import Counter
    
    # Анализ частоты слов
    stemmer = SnowballStemmer("russian")
    all_texts = ' '.join(data['texts'])
    words = analyze_text(all_texts, stemmer)
    word_freq = Counter(words).most_common(30)
    
    # Анализ комментаторов с именами
    commenters = Counter(zip(data['users'], data['user_names'])).most_common(10)
    commenters = [(name, count) for (user_id, name), count in commenters]
    
    return {
        'total_comments': len(data['texts']),
        'unique_commenters': len(set(data['users'])),
        'avg_length': sum(data['lengths']) / len(data['lengths']) if data['lengths'] else 0,
        'top_commenters': commenters,
        'common_words': word_freq
    }

def generate_comments_graph(data):
    import networkx as nx
    import matplotlib.pyplot as plt
    
    # Создаем граф
    G = nx.DiGraph()
    
    # Создаем словарь для хранения имен пользователей
    user_names = {}
    for user_id, name in zip(data['users'], data['user_names']):
        user_names[user_id] = name
    
    # Добавляем узлы с метками имен
    for user_id in set(data['users']):
        G.add_node(user_id, label=user_names.get(user_id, str(user_id)))
    
    # Добавляем связи на основе ответов на сообщения
    for i in range(len(data['users'])):
        reply_to = data['replies_to'][i]
        user_id = data['users'][i]
        # Добавляем связь между автором комментария и автором поста
        G.add_edge(user_id, reply_to)
    
    # Сохраняем граф
    plt.figure(figsize=(12, 8))
    pos = nx.spring_layout(G)
    
    # Рисуем узлы
    nx.draw_networkx_nodes(G, pos, node_color='lightblue', node_size=1000)
    
    # Рисуем ребра
    nx.draw_networkx_edges(G, pos, arrows=True)
    
    # Добавляем метки с именами
    labels = nx.get_node_attributes(G, 'label')
    nx.draw_networkx_labels(G, pos, labels, font_size=8)
    
    plt.savefig('web/assets/comments_graph.png')
    plt.close()
    
    return {
        'nodes': list(G.nodes()),
        'edges': list(G.edges())
    }

@eel.expose
def monitor_user_profile(username: str):
    async def _monitor():
        try:
            # Получаем базовую информацию о пользователе
            user = await client.get_entity(username)
            
            # Получаем полную информацию о пользователе
            try:
                full_user = await client(functions.users.GetFullUserRequest(user))
                about = full_user.full_user.about
            except Exception as e:
                print(f"Ошибка при получении полной информации: {e}")
                about = None
            
            # Получаем примерную дату регистрации
            registration_date = estimate_registration_date(user.id)
            
            # Получаем количество общих чатов
            try:
                result = await client(functions.messages.GetCommonChatsRequest(
                    user_id=user,
                    max_id=0,
                    limit=100
                ))
                common_chats_count = len(result.chats)
            except Exception as e:
                print(f"Ошибка при получении общих чатов: {e}")
                common_chats_count = 0
            
            # Загружаем фото профиля
            try:
                photos = await client.get_profile_photos(user)
                if photos:
                    photo = photos[0]
                    photo_path = f'web/assets/profile_photos/{user.id}.jpg'
                    os.makedirs(os.path.dirname(photo_path), exist_ok=True)
                    await client.download_media(photo, photo_path)
            except Exception as e:
                print(f"Ошибка при загрузке фото профиля: {e}")
            
            profile_info = {
                'id': user.id,
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'phone': user.phone,
                'bio': about,  # Используем about из полной информации
                'verified': user.verified,
                'restricted': user.restricted,
                'common_chats_count': common_chats_count,
                'last_seen': user.status.was_online.timestamp() if hasattr(user.status, 'was_online') else None,
                'profile_photo': f"assets/profile_photos/{user.id}.jpg",
                'is_bot': user.bot,
                'registration_date': registration_date
            }
            
            return {'success': True, 'profile_info': profile_info}
        except Exception as e:
            print(f"Ошибка при мониторинге профиля: {e}")
            return {'success': False, 'error': str(e)}

    # Запускаем асинхронную функцию в event loop
    loop = asyncio.get_event_loop()
    return loop.run_until_complete(_monitor())

@eel.expose
def open_paranoid_client():
    """Открывает новое окно Paranoid Client"""
    try:
        # Вместо eel.start() используем window.open()
        eel.window_open('client.html')()
    except Exception as e:
        print(f"Ошибка при открытии Paranoid Client: {e}")
        return {'error': str(e)}

@eel.expose
def get_client_chats(offset=0, limit=50, use_cache=True):
    """Получает список чатов для клиента с поддержкой кэширования и пагинации"""
    async def _get_chats():
        try:
            if not client or not await client.is_user_authorized():
                return {'error': 'Необходима авторизация'}
            
            cache_file = 'web/assets/cache/chats_cache.json'
            os.makedirs('web/assets/cache', exist_ok=True)
            
            # Проверяем кэш
            if use_cache and os.path.exists(cache_file):
                try:
                    with open(cache_file, 'r', encoding='utf-8') as f:
                        cache_data = json.load(f)
                        if time.time() - cache_data['timestamp'] < 3600:  # Кэш действителен 1 час
                            chats = cache_data['chats']
                            total = cache_data['total']
                            return {
                                'success': True,
                                'chats': chats[offset:offset + limit],
                                'total': total,
                                'from_cache': True
                            }
                except Exception as e:
                    print(f"Ошибка при чтении кэша: {e}")

            print("Начинаем получение чатов...")
            chats = []
            total_count = 0
            
            async for dialog in client.iter_dialogs():
                try:
                    total_count += 1
                    
                    # Получаем базовую информацию о чате
                    chat_info = {
                        'id': dialog.id,
                        'title': dialog.entity.title if hasattr(dialog.entity, 'title') else 
                                f"{dialog.entity.first_name or ''} {dialog.entity.last_name or ''}".strip(),
                        'type': 'channel' if dialog.is_channel else 'group' if dialog.is_group else 'private',
                        'unread_count': dialog.unread_count,
                        'last_message': dialog.message.message if dialog.message else None,
                        'last_message_date': dialog.message.date.timestamp() if dialog.message else None,
                        'photo_path': None
                    }
                    
                    # Проверяем и загружаем фото
                    if hasattr(dialog.entity, 'photo') and dialog.entity.photo:
                        photo_path = f'assets/chat_photos/{dialog.id}.jpg'
                        if not os.path.exists(f'web/{photo_path}'):
                            try:
                                await client.download_profile_photo(
                                    dialog.entity,
                                    f'web/{photo_path}'
                                )
                                chat_info['photo_path'] = photo_path
                            except Exception as e:
                                print(f"Ошибка при загрузке фото чата {dialog.id}: {e}")
                    
                    chats.append(chat_info)
                    
                except Exception as e:
                    print(f"Ошибка при обработке чата {dialog.id}: {e}")
                    continue

            # Сохраняем в кэш
            cache_data = {
                'timestamp': time.time(),
                'chats': chats,
                'total': total_count
            }
            try:
                with open(cache_file, 'w', encoding='utf-8') as f:
                    json.dump(cache_data, f, ensure_ascii=False)
            except Exception as e:
                print(f"Ошибка при сохранении кэша: {e}")

            return {
                'success': True,
                'chats': chats[offset:offset + limit],
                'total': total_count,
                'from_cache': False
            }
            
        except Exception as e:
            print(f"Ошибка при получении чатов: {e}")
            return {'error': str(e)}

    loop = asyncio.get_event_loop()
    return loop.run_until_complete(_get_chats())

@eel.expose
def start_message_updates(chat_id):
    """Запускает отслеживание новых сообщени��"""
    async def _listen_updates():
        try:
            if not client or not await client.is_user_authorized():
                return {'error': 'Необходима авторизация'}
            
            # Создаем обработчик новых сообщений
            @client.on(events.NewMessage(chats=int(chat_id)))
            async def handler(event):
                try:
                    message = event.message
                    sender = await event.get_sender()
                    
                    # Подготавливаем информацию о медиа
                    media_info = None
                    if message.media:
                        try:
                            if isinstance(message.media, types.MessageMediaPhoto):
                                photo_path = f'assets/media/photos/{message.id}.jpg'
                                await client.download_media(message.media, f'web/{photo_path}')
                                media_info = {'type': 'photo', 'path': photo_path}
                            elif isinstance(message.media, types.MessageMediaDocument):
                                if message.media.document.mime_type.startswith('audio/'):
                                    is_voice = any(isinstance(attr, types.DocumentAttributeAudio) and attr.voice 
                                                 for attr in message.media.document.attributes)
                                    audio_path = f'assets/media/{"voice" if is_voice else "audio"}/{message.id}.ogg'
                                    await client.download_media(message.media, f'web/{audio_path}')
                                    duration = next((attr.duration for attr in message.media.document.attributes 
                                                   if isinstance(attr, types.DocumentAttributeAudio)), 0)
                                    media_info = {
                                        'type': 'voice' if is_voice else 'audio',
                                        'path': audio_path,
                                        'duration': duration
                                    }
                        except Exception as e:
                            print(f"Ошибка при обработке медиа: {e}")

                    # Формируем данные о сообщении
                    message_data = {
                        'id': message.id,
                        'sender': {
                            'id': sender.id,
                            'name': getattr(sender, 'first_name', '') or sender.title,
                            'photo_path': None
                        },
                        'text': message.message,
                        'date': message.date.timestamp(),
                        'is_outgoing': message.out,
                        'reply_to': message.reply_to.reply_to_msg_id if message.reply_to else None,
                        'media': media_info
                    }

                    # Отправляем новое сообщение в интерфейс
                    eel.onNewMessage(message_data)()

                except Exception as e:
                    print(f"Ошибка при обработке нового сообщения: {e}")

            print(f"Начато отслеживание сообщений для чата {chat_id}")
            return {'success': True}
            
        except Exception as e:
            print(f"Ошибка при запуске отслеживания: {e}")
            return {'error': str(e)}

    # Запускаем в существующем event loop
    loop = asyncio.get_event_loop()
    return loop.run_until_complete(_listen_updates())

# Добавим глобальный словарь для хранения обработчиков событий
message_handlers = {}

# Добавим функцию для остановки отслеживания
@eel.expose
def stop_message_updates(chat_id):
    """Останавливает отслеживание сообщений для чата"""
    if chat_id in message_handlers:
        client.remove_event_handler(message_handlers[chat_id])
        del message_handlers[chat_id]
        return {'success': True}
    return {'error': 'Обработчик не найден'}

@eel.expose
def start_call(chat_id):
    """Начинает голосовой звонок"""
    async def _start_call():
        try:
            if not client or not await client.is_user_authorized():
                return {'error': 'Необходима авторизация'}
            
            # Получаем информацию о чате
            chat = await client.get_entity(int(chat_id))
            
            # Проверяем, поддерживаются ли звонки в этом чате
            if not isinstance(chat, types.User):
                return {'error': 'Звонки доступны только в личных чатах'}
            
            # Создаем звонок
            call = await client(functions.phone.RequestCallRequest(
                user_id=chat,
                random_id=random.randint(0, 2**32-1),
                video=False  # Для видеозвонка установите True
            ))
            
            return {'success': True, 'call_id': call.id}
            
        except Exception as e:
            print(f"Ошибка при начале звонка: {e}")
            return {'error': str(e)}

    loop = asyncio.get_event_loop()
    return loop.run_until_complete(_start_call())

if __name__ == '__main__':
    initialize_nltk()
    start_app() 