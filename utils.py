import re
import string
import json
import emoji
from nltk.tokenize import word_tokenize
from nltk.corpus import stopwords
from nltk.stem.snowball import SnowballStemmer
import nltk
from datetime import datetime, timedelta

# Загрузка необходимых компонентов NLTK
nltk.download('stopwords')
nltk.download('punkt')

# Специальные символы для очистки текста
spec_chars = string.punctuation + '\n\xa0«»\t—…"<>?!.,;:꧁@#$%^&*()_-+=№%༺༺\༺/༺-•'

def remove_chars_from_text(text, chars=None):
    if chars is None:
        chars = spec_chars
    pattern = f"[{re.escape(chars)}]"
    text = re.sub(pattern, ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def remove_emojis(text):
    return emoji.replace_emoji(text, '')

def analyze_text(text, stemmer):
    if not text or not isinstance(text, str):
        return []
        
    # Удаляем эмоджи и приводим к нижнему регистру
    text = remove_emojis(text).lower()
    
    # Токенизация
    words = text.split()
    
    # Удаляем пунктуацию и цифры
    words = [re.sub(r'[^\w\s]', '', word) for word in words]
    words = [word for word in words if word and not word.isdigit()]
    
    # Удаляем стоп-слова
    stop_words = set(nltk.corpus.stopwords.words('russian'))
    words = [word for word in words if word not in stop_words]
    
    # Стемминг
    stems = [stemmer.stem(word) for word in words if word]
    
    return stems 

def estimate_registration_date(user_id: int) -> str:
    """
    Оценивает примерную дату регистрации аккаунта по ID пользователя.
    Telegram начал работу в августе 2013 года.
    ID пользователей увеличиваются последовательно.
    """
    try:
        # Первый известный ID (~август 2013)
        first_id = 2000
        # Примерная дата начала работы Telegram
        start_date = datetime(2013, 8, 1)
        
        # Примерное количество регистраций в день (может варьироваться)
        registrations_per_day = 10000
        
        # Вычисляем количество дней с начала работы
        days_since_start = (user_id - first_id) / registrations_per_day
        
        # Вычисляем примерную дату регистрации
        estimated_date = start_date + timedelta(days=days_since_start)
        
        return estimated_date.strftime("%d.%m.%Y")
    except Exception as e:
        print(f"Ошибка при оценке даты регистрации: {e}")
        return "Невозможно определить" 